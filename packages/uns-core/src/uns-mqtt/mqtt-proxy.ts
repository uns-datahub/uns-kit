import mqtt, { IClientOptions, MqttClient } from "mqtt";
import logger from "../logger.js";
import { UnsEvents } from "../uns/uns-interfaces.js";
import { UnsEventEmitter } from "../uns/uns-event-emitter.js";
import { IMqttParameters } from "./mqtt-interfaces.js";
import { MqttWorker } from "./mqtt-worker.js";
import { DataSizeMeasurements, PhysicalMeasurements } from "../uns/uns-measurements.js";

export default class MqttProxy {
  public event: UnsEventEmitter<UnsEvents> = new UnsEventEmitter<UnsEvents>();
  public statusTopic: string;
  public instanceName: string;
  private mqttHost: string;
  private mqttSubToTopics: string | string[];
  private mqttSSL: boolean;
  private mqttClient: MqttClient;
  private startDate: Date;
  private mqttParameters: IMqttParameters;
  private statusUpdateInterval: ReturnType<typeof setInterval>;
  private transformationStatsInterval: NodeJS.Timeout | null = null;
  private publishedMessageCount = 0;
  private publishedMessageBytes = 0;
  private subscribedMessageCount = 0;
  private subscribedMessageBytes = 0;
  private mqttWorker: MqttWorker;
  public isConnected = false;
  private rejectUnauthorized: boolean;

  constructor(mqttHost: string, instanceName: string, mqttParameters: IMqttParameters, mqttWorker?: MqttWorker) {
    this.mqttSSL = mqttParameters?.mqttSSL ?? false;
    this.rejectUnauthorized = mqttParameters.rejectUnauthorized ?? false;
    this.mqttSubToTopics = mqttParameters?.mqttSubToTopics ?? [];
    this.mqttHost = mqttHost;
    this.startDate = new Date();
    this.instanceName = instanceName ?? "process";
    this.statusTopic = `${mqttParameters?.statusTopic}`;
    this.mqttParameters = mqttParameters ?? {};
    this.mqttWorker = mqttWorker;
  }

  private resolveProtocol(): IMqttParameters["protocol"] {
    return this.mqttParameters.protocol ?? (this.mqttSSL ? "mqtts" : "mqtt");
  }

  private resolveDefaultPort(protocol: IMqttParameters["protocol"]): number {
    switch (protocol) {
      case "mqtts":
      case "ssl":
        return 8883;
      case "wss":
        return 443;
      case "ws":
        return 80;
      case "tcp":
      case "mqtt":
      default:
        return 1883;
    }
  }

  private buildServers(defaultProtocol: IMqttParameters["protocol"]): IClientOptions["servers"] | undefined {
    const servers: IClientOptions["servers"] = [];
    const { port } = this.mqttParameters;
    const protocol = this.mqttParameters.protocol ?? defaultProtocol;

    if (Array.isArray(this.mqttParameters.servers) && this.mqttParameters.servers.length > 0) {
      for (const server of this.mqttParameters.servers) {
        if (!server?.host) continue;
        const resolvedProtocol = server.protocol ?? protocol;
        const resolvedPort =
          typeof server.port === "number"
            ? server.port
            : typeof port === "number"
              ? port
              : this.resolveDefaultPort(resolvedProtocol);
        const entry: { host: string; port: number; protocol?: IMqttParameters["protocol"] } = {
          host: server.host,
          port: resolvedPort,
        };
        if (resolvedProtocol) {
          entry.protocol = resolvedProtocol;
        }
        servers.push(entry);
      }
    } else if (Array.isArray(this.mqttParameters.hosts) && this.mqttParameters.hosts.length > 0) {
      for (const host of this.mqttParameters.hosts) {
        if (!host) continue;
        const resolvedPort = typeof port === "number" ? port : this.resolveDefaultPort(protocol);
        const entry: { host: string; port: number; protocol?: IMqttParameters["protocol"] } = {
          host,
          port: resolvedPort,
        };
        if (protocol) {
          entry.protocol = protocol;
        }
        servers.push(entry);
      }
    }

    return servers.length > 0 ? servers : undefined;
  }

  public async start(): Promise<void> {
    logger.info(`${this.instanceName} - Connecting to MQTT broker...`);

    return new Promise<void>((resolve, reject) => {
      try {
        const username = this.mqttParameters.username;
        const password = this.mqttParameters.password;
        const clientId = this.mqttParameters.clientId ?? this.instanceName;
        const protocol = this.resolveProtocol();

        const options: IClientOptions = {
          username,
          password,
          protocolVersion: 5,
          rejectUnauthorized: this.rejectUnauthorized,
          keepalive: this.mqttParameters.keepalive,
          clean: this.mqttParameters.clean ?? true,
          connectTimeout: this.mqttParameters.connectTimeout,
          reconnectPeriod: this.mqttParameters.reconnectPeriod,
          reconnectOnConnackError: this.mqttParameters.reconnectOnConnackError,
          resubscribe: this.mqttParameters.resubscribe,
          queueQoSZero: this.mqttParameters.queueQoSZero,
          properties: this.mqttParameters.properties,
          ca: this.mqttParameters.ca,
          cert: this.mqttParameters.cert,
          key: this.mqttParameters.key,
          servername: this.mqttParameters.servername,
          
          will: {
            topic: `${this.statusTopic}alive`,
            payload: Buffer.from(""),
            qos: 0,
            retain: true,
            properties: { messageExpiryInterval: 3600 },
          },
          clientId,
        };

        const servers = this.buildServers(protocol);
        if (servers) {
          options.servers = servers;
          options.protocol = protocol;
          this.mqttClient = mqtt.connect(options);
        } else {
          options.host = this.mqttHost;
          options.port = this.mqttParameters.port;
          options.protocol = protocol;
          this.mqttClient = mqtt.connect(options);
        }

        const onConnect = () => {
          try {
            this.mqttClient.stream.setMaxListeners(0);
            logger.info(`${this.instanceName} - Connected to MQTT broker at ${this.mqttHost}`);

            if (this.mqttSubToTopics && this.mqttSubToTopics.length > 0) {
              logger.info(`${this.instanceName} - Subscribed to ${this.mqttSubToTopics.length} topics.`);
              this.mqttClient.subscribe(this.mqttSubToTopics, { qos: 0 });
            }

            if (this.statusTopic) {
              this.statusUpdateInterval = setInterval(() => this.emitStatusUpdates(), 10000);
            }

            this.transformationStatsInterval = setInterval(() => {
              this.emitTransformationStatistics();
            }, 60000);

            this.mqttClient.off("connect", onConnect);
            this.isConnected = true;
            resolve();
          } catch (error) {
            logger.error(`${this.instanceName} - Error in MQTT connect handler: ${error.message}`);
            this.isConnected = false;
            reject(error);
          }
        };

        this.mqttClient.on("connect", onConnect);

        this.mqttClient.on("message", (topic: string, message: Buffer, packet: mqtt.IPublishPacket) => {
          try {
            logger.debug(`${this.instanceName} - Message received on topic ${topic}`);
            this.event.emit("input", {
              message: message.toString(),
              topic: topic,
              packet: packet,
            });
            this.updateSubscribeTransformationStats(message.length);
          } catch (error) {
            logger.error(`${this.instanceName} - Error in MQTT message handler: ${error.message}`);
          }
        });

        this.mqttClient.on("error", (error) => {
          logger.error(`${this.instanceName} - MQTT client error: ${error.message}`);
          this.isConnected = false;
          if ("code" in error) {
            this.event.emit("error", { code: error.code, message: error.message });
          } else {
            this.event.emit("error", { message: error.message, code: 0 });
          }
          reject(error);
        });

        this.mqttClient.on("reconnect", () => {
          logger.debug(`${this.instanceName} - Attempting to reconnect to MQTT broker...`);
        });

        this.mqttClient.on("close", () => {
          logger.debug(`${this.instanceName} - MQTT connection closed.`);
          this.isConnected = false;
        });

        this.mqttClient.on("offline", () => {
          logger.debug(`${this.instanceName} - MQTT client is offline.`);
          this.isConnected = false;
        });

        this.mqttClient.on("end", () => {
          logger.debug(`${this.instanceName} - MQTT client connection ended.`);
          this.isConnected = false;
        });

        this.mqttClient.on("disconnect", (packet) => {
          logger.debug(`${this.instanceName} - MQTT client disconnected. Reason: ${packet?.reasonCode}`);
          this.isConnected = false;
        });
      } catch (error) {
        logger.error(`${this.instanceName} - Error starting MQTT proxy: ${error.message}`);
        this.isConnected = false;
        reject(error);
      }
    });
  }

  public async publish(topic: string, message: string | Buffer, options?: mqtt.IClientPublishOptions): Promise<void> {
    this.updatePublishTransformationStats(JSON.stringify(message).length);
    return new Promise((resolve, reject) => {
      if (!this.mqttClient || !this.mqttClient.connected) {
        const error = new Error(`${this.instanceName} - MQTT client is not connected.`);
        logger.error(error.message);
        return reject(error);
      }

      this.mqttClient.publish(topic, message, options || {}, (err) => {
        if (err) {
          logger.error(`${this.instanceName} - Error publishing to topic ${topic}: ${err.message}`);
          return reject(err);
        }
        logger.debug(`${this.instanceName} - Published message to topic ${topic}`);
        resolve();
      });
    });
  }

  public async subscribeAsync(topic: string | string[], options?: mqtt.IClientSubscribeOptions): Promise<mqtt.ISubscriptionGrant[]> {
    return this.mqttClient.subscribeAsync(topic, options);
  }

  public async unsubscribeAsync(topic: string | string[]): Promise<mqtt.Packet | undefined> {
    const topics = Array.isArray(topic) ? topic.filter((t) => typeof t === "string" && t.length > 0) : [topic].filter((t): t is string => typeof t === "string" && t.length > 0);
    if (topics.length === 0) {
      logger.warn(`${this.instanceName} - unsubscribeAsync called with empty topic list; skipping.`);
      return Promise.resolve(undefined);
    }
    return this.mqttClient.unsubscribeAsync(topics);
  }

  public stop() {
    logger.info(`${this.instanceName} - Disconnecting from MQTT broker...`);
    try {
      if (this.statusUpdateInterval) {
        clearInterval(this.statusUpdateInterval);
        this.statusUpdateInterval = null;
      }
      if (this.transformationStatsInterval) {
        clearInterval(this.transformationStatsInterval);
        this.transformationStatsInterval = null;
      }
      if (this.mqttClient) {
        this.mqttClient.end(false, () => {
          this.isConnected = false;
          logger.info(`${this.instanceName} - Disconnected from MQTT broker.`);
        });
      }
    } catch (error) {
      logger.error(`${this.instanceName} - Error during stop: ${error.message}`);
      this.isConnected = false;
    }
  }

  private emitStatusUpdates() {
    try {
      const uptime = Math.round((new Date().getTime() - this.startDate.getTime()) / 60000);
      this.event.emit("mqttProxyStatus", { event: "uptime", value: uptime, uom: PhysicalMeasurements.Minute, statusTopic: this.statusTopic + "uptime" });
      this.event.emit("mqttProxyStatus", { event: "alive", value: 1, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "alive" });

      if (this.mqttWorker !== undefined) {
        const tpValue = this.mqttWorker.getPublisherState() ? 1 : 0;
        this.event.emit("mqttProxyStatus", { event: "t-publisher-active", value: tpValue, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "t-publisher-active" });
        const tsValue = this.mqttWorker.getSubscriberState() ? 1 : 0;
        this.event.emit("mqttProxyStatus", { event: "t-subscriber-active", value: tsValue, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "t-subscriber-active" });
      }
    } catch (error) {
      logger.error(`${this.instanceName} - Error publishing MQTT status: ${error.message}`);
    }
  }

  private updatePublishTransformationStats(messageSizeOut: number): void {
    this.publishedMessageCount += 1;
    this.publishedMessageBytes += messageSizeOut;
  }

  private updateSubscribeTransformationStats(messageSizeIn: number): void {
    this.subscribedMessageCount += 1;
    this.subscribedMessageBytes += messageSizeIn;
  }

  private async emitTransformationStatistics(): Promise<void> {
    if (this.statusTopic !== "") {
      try {
        this.event.emit("mqttProxyStatus", {
          event: "published-message-count",
          value: this.publishedMessageCount,
          uom: "",
          statusTopic: this.statusTopic + "published-message-count",
        });
        this.event.emit("mqttProxyStatus", {
          event: "published-message-bytes",
          value: Math.round(this.publishedMessageBytes / 1024),
          uom: DataSizeMeasurements.KiloByte,
          statusTopic: this.statusTopic + "published-message-bytes",
        });
        this.event.emit("mqttProxyStatus", {
          event: "subscribed-message-count",
          value: this.subscribedMessageCount,
          uom: "",
          statusTopic: this.statusTopic + "subscribed-message-count",
        });
        this.event.emit("mqttProxyStatus", {
          event: "subscribed-message-bytes",
          value: Math.round(this.subscribedMessageBytes / 1024),
          uom: DataSizeMeasurements.KiloByte,
          statusTopic: this.statusTopic + "subscribed-message-bytes",
        });
        this.publishedMessageCount = 0;
        this.publishedMessageBytes = 0;
        this.subscribedMessageCount = 0;
        this.subscribedMessageBytes = 0;
      } catch (error: any) {
        this.publishedMessageCount = 0;
        this.publishedMessageBytes = 0;
        this.subscribedMessageCount = 0;
        this.subscribedMessageBytes = 0;
        logger.error(`${this.instanceName} - Error emitting transformation statistics: ${error.message}`);
      }
    }
  }
}
