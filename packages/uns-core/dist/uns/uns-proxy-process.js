import logger from "../logger";
import MqttProxy from "../uns-mqtt/mqtt-proxy";
import UnsMqttProxy from "../uns-mqtt/uns-mqtt-proxy";
import { HandoverManager } from "./handover-manager";
// Import configuration and initialization modules.
import { PACKAGE_INFO, MQTT_UPDATE_INTERVAL } from "./process-config";
import { getProcessName } from "./process-name-service";
import { MqttTopicBuilder } from "../uns-mqtt/mqtt-topic-builder";
import { StatusMonitor } from "./status-monitor";
import { UnsPacket } from "./uns-packet";
class UnsProxyProcess {
    active = false;
    processStatusTopic;
    processName;
    unsMqttProxies;
    unsApiProxies;
    unsTemporalProxies;
    processMqttProxy;
    handoverManager;
    statusMonitor;
    // Plugin
    static pluginApiVersion = 1;
    static registered = new Set();
    static registeredMethodNames = new Set();
    static applied = false;
    static use(plugin) {
        if (this.registered.has(plugin))
            return this;
        this.registered.add(plugin);
        if (this.applied)
            this.applyPlugin(plugin);
        return this;
    }
    static applyPlugin(plugin) {
        const define = (methods) => {
            for (const [name, fn] of Object.entries(methods)) {
                if (typeof fn !== "function") {
                    throw new TypeError(`UnsProxyProcess plugin attempted to register non-function member \"${name}\".`);
                }
                if (this.registeredMethodNames.has(name) || Reflect.has(this.prototype, name)) {
                    throw new Error(`UnsProxyProcess plugin attempted to overwrite existing member \"${name}\".`);
                }
                Object.defineProperty(this.prototype, name, {
                    value: fn,
                    writable: true,
                    configurable: true,
                    enumerable: false,
                });
                this.registeredMethodNames.add(name);
            }
        };
        plugin({
            define,
            version: this.pluginApiVersion,
            UnsProxyProcess: this,
        });
    }
    static applyAll() {
        if (this.applied)
            return;
        this.applied = true;
        for (const p of this.registered)
            this.applyPlugin(p);
    }
    // References for cleanup.
    mqttInputHandler;
    constructor(mqttHost, unsProxyProcessParameters) {
        this.constructor.applyAll(); // Activate all the plugins
        this.unsMqttProxies = [];
        this.unsApiProxies = [];
        this.unsTemporalProxies = [];
        this.processName = unsProxyProcessParameters.processName || getProcessName();
        const { name: packageName, version } = PACKAGE_INFO;
        // Instantiate the topic builder.
        const topicBuilder = new MqttTopicBuilder(`uns-infra/${packageName}/${version}/${this.processName}/`);
        // Generate topics.
        const processStatusTopic = topicBuilder.getProcessStatusTopic();
        const handoverTopic = topicBuilder.getHandoverTopic();
        const wildcardActiveTopic = topicBuilder.getWildcardActiveTopic();
        this.processStatusTopic = processStatusTopic;
        // Configure MQTT topics for subscription.
        const mqttSubToTopics = unsProxyProcessParameters?.mqttSubToTopics ?? [
            wildcardActiveTopic,
            handoverTopic,
        ];
        const mqttParameters = {
            mqttSubToTopics,
            username: unsProxyProcessParameters?.username ?? "",
            password: unsProxyProcessParameters?.password ?? "",
            mqttSSL: unsProxyProcessParameters?.mqttSSL ?? false,
            statusTopic: this.processStatusTopic,
        };
        // Initialize MQTT proxy and start connection.
        this.processMqttProxy = new MqttProxy(mqttHost, this.processName, mqttParameters);
        this.processMqttProxy.start();
        // Instantiate and start the StatusMonitor for memory and status updates.
        this.statusMonitor = new StatusMonitor(this.processMqttProxy, this.processStatusTopic, () => this.active, MQTT_UPDATE_INTERVAL, MQTT_UPDATE_INTERVAL);
        this.statusMonitor.start();
    }
    /**
     * Initializes the HandoverManager instance and sets up event listeners for handover and MQTT input events.
     * Determines handover and force start modes based on process arguments.
     */
    initHandoverManager(instanceMode, handover) {
        const handoverRequestEnabled = instanceMode == "handover" ? true : false;
        const forceStartEnabled = instanceMode == "force" ? true : false;
        this.handoverManager = new HandoverManager(this.processName, this.processMqttProxy, this.unsMqttProxies, handoverRequestEnabled, handover ?? true, forceStartEnabled);
        // Listen for handover events.
        this.handoverManager.event.on("handoverManager", (event) => {
            this.active = event.active;
        });
        // Delegate MQTT events to the HandoverManager.
        this.mqttInputHandler = async (event) => {
            await this.handoverManager.handleMqttMessage(event);
        };
        this.processMqttProxy.event.on("input", this.mqttInputHandler);
    }
    /**
     * Creates a new UNS proxy instance and stores it for future management.
     */
    async createUnsMqttProxy(mqttHost, instanceName, instanceMode, handover, unsParameters) {
        // Wait until the MQTT connection is established before proceeding.
        await this.waitForProcessConnection();
        // Currently handover manager can handle only mqtt events
        if (!this.handoverManager) {
            this.initHandoverManager(instanceMode, handover);
        }
        const unsMqttProxy = new UnsMqttProxy(mqttHost, this.processName, instanceName, unsParameters);
        // Listen for UNS proxy producing topics and publish them via MQTT.
        unsMqttProxy.event.on("unsProxyProducedTopics", (event) => {
            this.processMqttProxy.publish(event.statusTopic, JSON.stringify(event.producedTopics), {
                retain: true,
                properties: { messageExpiryInterval: 120000 },
            });
        });
        // Listen for UNS proxy status events and publish them via MQTT.
        unsMqttProxy.event.on("mqttProxyStatus", (event) => {
            const time = UnsPacket.formatToISO8601(new Date());
            const unsMessage = { data: { time, value: event.value, uom: event.uom } };
            UnsPacket.unsPacketFromUnsMessage(unsMessage).then((packet) => {
                this.processMqttProxy.publish(event.statusTopic, JSON.stringify(packet));
            });
        });
        this.unsMqttProxies.push(unsMqttProxy);
        return unsMqttProxy;
    }
    async waitForProcessConnection() {
        while (!this.processMqttProxy?.isConnected) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    /**
     * Shuts down the process by clearing intervals, timeouts, and removing
     * MQTT event listeners, and stopping the StatusMonitor.
     */
    shutdown() {
        logger.info(`${this.processName} - Shutting down UnsProxyProcess...`);
        try {
            this.statusMonitor.stop();
        }
        catch (e) {
            logger.error(`${this.processName} - Error stopping StatusMonitor: ${e.message}`);
        }
        if (this.mqttInputHandler) {
            this.processMqttProxy.event.off("input", this.mqttInputHandler);
        }
        try {
            if (typeof this.processMqttProxy.stop === "function") {
                this.processMqttProxy.stop();
            }
        }
        catch (e) {
            logger.error(`${this.processName} - Error stopping MQTT proxy: ${e.message}`);
        }
        logger.info(`${this.processName} - Shutdown complete.`);
    }
}
export default UnsProxyProcess;
export { UnsProxyProcess };
