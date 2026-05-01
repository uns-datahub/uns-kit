import { IUnsParameters, IUnsProcessParameters } from "./uns-interfaces.js";
import UnsMqttProxy from "../uns-mqtt/uns-mqtt-proxy.js";
import { type UnsServiceMetadata, type UnsServiceMetadataInput } from "./service-metadata.js";
/**
 * UnsProxyProcess is responsible for managing the process lifecycle,
 * configuring MQTT (subscriptions and publishing for status updates), and
 * handling UNS proxy instances.
 *
 * It leverages HandoverManager for handover events and StatusMonitor for health reporting.
 */
export type UnsProxyProcessPluginMethod = (this: UnsProxyProcess, ...args: unknown[]) => unknown;
export type UnsProxyProcessPluginMethods = Record<string, UnsProxyProcessPluginMethod>;
export interface UnsProxyProcessPluginApi {
    version: number;
    define(methods: UnsProxyProcessPluginMethods): void;
    UnsProxyProcess: typeof UnsProxyProcess;
}
export type UnsProxyProcessPlugin = (api: UnsProxyProcessPluginApi) => void;
declare class UnsProxyProcess {
    private active;
    private processStatusTopic;
    private processName;
    private processId;
    private unsMqttProxies;
    private unsApiProxies;
    private unsTemporalProxies;
    private processMqttProxy;
    private handoverManager;
    private statusMonitor;
    private serviceMetadataTopic;
    static pluginApiVersion: number;
    private static registered;
    private static registeredMethodNames;
    private static applied;
    static use(plugin: UnsProxyProcessPlugin): typeof UnsProxyProcess;
    private static applyPlugin;
    private static applyAll;
    private mqttInputHandler;
    constructor(mqttHost: string, unsProxyProcessParameters: IUnsProcessParameters);
    /**
     * Initializes the HandoverManager instance and sets up event listeners for handover and MQTT input events.
     * Determines handover and force start modes based on process arguments.
     */
    private initHandoverManager;
    /**
     * Creates a new UNS proxy instance and stores it for future management.
     */
    createUnsMqttProxy(mqttHost: string, instanceName: string, instanceMode: string, handover: boolean, unsParameters?: IUnsParameters): Promise<UnsMqttProxy>;
    waitForProcessConnection(): Promise<void>;
    /**
     * Publishes retained product/system service metadata for controller discovery.
     *
     * The payload is intentionally separate from the volatile active/alive status
     * topics. Controllers can combine this retained identity/capability metadata
     * with live process status to decide whether a service is currently healthy.
     */
    publishServiceMetadata(metadata: UnsServiceMetadataInput): Promise<UnsServiceMetadata>;
    /**
     * Shuts down the process by clearing intervals, timeouts, and removing
     * MQTT event listeners, and stopping the StatusMonitor.
     */
    shutdown(): void;
}
interface UnsProxyProcess {
}
export default UnsProxyProcess;
export type { UnsServiceMetadata, UnsServiceMetadataInput };
export { UnsProxyProcess };
//# sourceMappingURL=uns-proxy-process.d.ts.map