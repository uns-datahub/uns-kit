import { readFileSync } from "fs";
import { IClientPublishOptions } from "mqtt";
import * as path from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { basePath } from "../base-path.js";
import logger from "../logger.js";
import { IMqttMessage, IUnsPacket, IUnsParameters, UnsEvents, ValueType } from "../uns/uns-interfaces.js";
import { MeasurementUnit } from "../uns/uns-measurements.js";
import { UnsPacket } from "../uns/uns-packet.js";
import { IMqttParameters, IMqttWorkerData } from "./mqtt-interfaces.js";
import { MqttTopicBuilder } from "./mqtt-topic-builder.js";
import UnsProxy from "../uns/uns-proxy.js";
import { UnsAttributeType } from "../graphql/schema.js";

const packageJsonPath = path.join(basePath, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDirectory, "..", "..");
const workerScriptPath = path.join(packageRoot, "dist/uns-mqtt/mqtt-worker-init.js");

export enum MessageMode {
  Raw = 'raw',     // Send only the original message
  Delta = 'delta', // Send only the delta message
  Both = 'both'    // Send both the original and delta messages
}

export default class UnsMqttProxy extends UnsProxy {
  private lastValues: Map<string, { value: ValueType; uom: string; timestamp: Date }> = new Map();
  private worker: Worker;
  private pendingEnqueues: Map<string, { resolve: () => void; reject: (reason?: any) => void }> = new Map();
  private unsParameters: IUnsParameters;
  protected processStatusTopic: string;
  public instanceName: string;
  private currentSequenceId: Map<string, number> = new Map();
  private topicBuilder: MqttTopicBuilder;

  constructor(
    mqttHost: string,
    processName: string,
    instanceName: string,
    unsParameters?: IUnsParameters,
    publisherActive: boolean = false,
    subscriberActive: boolean = false
  ) {
    super();
    this.instanceName = instanceName;
    // Create the topic builder using packageJson values and the processName.
    this.topicBuilder = new MqttTopicBuilder(`uns-infra/${MqttTopicBuilder.sanitizeTopicPart(packageJson.name)}/${MqttTopicBuilder.sanitizeTopicPart(packageJson.version)}/${MqttTopicBuilder.sanitizeTopicPart(processName)}/`);

    // Generate the processStatusTopic using the builder.
    this.processStatusTopic = this.topicBuilder.getProcessStatusTopic();
    // Derive the instanceStatusTopic by appending the instance name.
    this.instanceStatusTopic = this.processStatusTopic + instanceName + "/";

    // Concatenate processName with instanceName for the worker identification.
    this.instanceNameWithSuffix = `${processName}-${instanceName}`;
    
    const mqttParameters: IMqttParameters = {
      mqttSubToTopics: unsParameters?.mqttSubToTopics ?? [],
      username: unsParameters?.username ?? "",
      password: unsParameters?.password ?? "",
      mqttSSL: unsParameters?.mqttSSL ?? false,
      statusTopic: this.instanceStatusTopic,
    };
    this.unsParameters = unsParameters ?? {};
    this.startQueueWorker(mqttHost, this.instanceNameWithSuffix, mqttParameters, publisherActive, subscriberActive);
  }

  /**
   * Starts a worker thread to process the throttled publish queue.
   */
  private startQueueWorker(
    mqttHost: string,
    instanceNameWithSuffix: string,
    mqttParameters: IMqttParameters,
    publisherActive: boolean,
    subscriberActive: boolean
  ): void {
    const workerData: IMqttWorkerData = {
      publishThrottlingDelay: this.unsParameters.publishThrottlingDelay ?? 1,
      subscribeThrottlingDelay: this.unsParameters.subscribeThrottlingDelay ?? 1,
      persistToDisk: false,
      mqttHost: mqttHost,
      instanceNameWithSuffix: instanceNameWithSuffix,
      mqttParameters: mqttParameters,
      publisherActive,
      subscriberActive
    };

    this.worker = new Worker(workerScriptPath, { workerData });

    this.worker.on("message", (msg) => {
      if (msg && msg.command === "enqueueResult" && msg.id) {
        const pending = this.pendingEnqueues.get(msg.id);
        if (pending) {
          if (msg.status === "success" && msg.topic && msg.message) {
            pending.resolve();
          } else {
            pending.reject(new Error(msg.error));
          }
          this.pendingEnqueues.delete(msg.id);
        }
      } else if (msg && msg.command === "input") {
        this.event.emit("input", { topic: msg.topic, message: msg.message.toString(), packet: msg.packet });
      } else if (msg && (msg.command === "handover_subscriber" || msg.command === "handover_publisher")) {
        this.event.emit("mqttWorker", { command: msg.command, batchSize: msg.batchSize, referenceHash: msg.referenceHash, instanceName: this.instanceName });
      } else if (msg && msg.command === "mqttProxyStatus") {
        this.event.emit("mqttProxyStatus", { event: msg.event, value: msg.value, uom: msg.uom, statusTopic: msg.statusTopic });
      }
    });

    this.worker.on("error", (err) => {
      logger.error("Error in worker:", err);
    });

    this.worker.on("exit", (code) => {
      if (code !== 0) {
        logger.error(`Worker exited with code ${code}`);
      }
    });
  }

  /**
   * Enqueues a message to the worker queue.
   *
   * @param topic - The topic to which the message belongs.
   * @param message - The message to be enqueued.
   * @param options - Optional publish options.
   * @returns A promise that resolves when the message is successfully enqueued.
   */
  private async enqueueMessageToWorkerQueue(topic: string, message: string, options?: IClientPublishOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      // const id: string = String(this.currentSequenceId.get(topic) ?? 0);
      const id = `${Date.now()}-${Math.random()}`;
      this.pendingEnqueues.set(id, { resolve, reject });
      this.worker.postMessage({ command: "enqueue", id, topic, message, options });
    });
  }

  /**
   * Sets the publisher active state.
   *
   * @param batchSize - Optional batch size.
   * @param referenceHash - Optional reference hash.
   */
  public setPublisherActive(batchSize?: number, referenceHash?: string): void {
    this.worker.postMessage({ command: "setPublisherActive", batchSize, referenceHash });
  }

  /**
   * Sets the publisher to passive mode.
   * @returns A promise that resolves when the publisher is set to passive.
   */
  public setPublisherPassive(): Promise<UnsEvents["mqttWorker"]> {
    this.worker.postMessage({ command: "setPublisherPassive"});
    return new Promise((resolve) => {
      this.event.on("mqttWorker", (msg: UnsEvents["mqttWorker"]) => {
        if (msg.command === "handover_publisher") {
          logger.info(`${this.instanceNameWithSuffix} - Publisher set to passive.`);
          resolve(msg);
        }
      });
    });
  }

  /**
   * Sets the subscriber active state.
   *
   * @param batchSize - Optional batch size.
   * @param referenceHash - Optional reference hash.
   */
  public setSubscriberActive(batchSize?: number, referenceHash?: string): void {
    this.worker.postMessage({ command: "setSubscriberActive", batchSize, referenceHash });
  }

  /**
   * Sets the subscriber to passive mode.
   * @returns A promise that resolves when the subscriber is set to passive.
   */
  public setSubscriberPassive(): Promise<UnsEvents["mqttWorker"]> {
    this.worker.postMessage({ command: "setSubscriberPassive"});
    return new Promise((resolve) => {
      this.event.on("mqttWorker", (msg: UnsEvents["mqttWorker"]) => {
        if (msg.command === "handover_subscriber") {
          logger.info(`${this.instanceNameWithSuffix} - Publisher set to passive.`);
          resolve(msg);
        }
      });
    });
  }


  /**
   * Sets the subscriber to passive mode and allows the publisher to run
   * until the queue is empty (all messages are processed).
   */
  public async setSubscriberPassiveAndDrainQueue(): Promise<UnsEvents["mqttWorker"]> {
    return new Promise(async (resolve) => {
      const mqttWorkerData = await this.setSubscriberPassive();
      while (this.pendingEnqueues.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms
      }
      logger.info(`${this.instanceNameWithSuffix} - Subscriber set to passive and queue drained.`);
      resolve(mqttWorkerData);
    });
  }

  /**
   * Processes and publishes MQTT messages based on the selected message mode.
   *
   * @param mqttMessage - The MQTT message object.
   * @param mode - The message mode (Raw, Delta, or Both).
   */
  public publishMqttMessage(mqttMessage: IMqttMessage | null, mode: MessageMode = MessageMode.Raw) {
    if (mqttMessage) {
      if (mqttMessage.packet) {
        const time = UnsPacket.formatToISO8601(new Date());
        switch (mode) {
          case MessageMode.Raw: {
            this.processAndEnqueueMessage(mqttMessage, time, false);
            break;
          }
          case MessageMode.Delta: {
            const deltaMessage = { ...mqttMessage };
            deltaMessage.attribute = `${mqttMessage.attribute}-delta`;
            deltaMessage.description = `${mqttMessage.description} (delta)`;
            this.processAndEnqueueMessage(deltaMessage, time, true);
            break;
          }
          case MessageMode.Both: {
            this.processAndEnqueueMessage(mqttMessage, time, false);
            const deltaMessageBoth = { ...mqttMessage };
            deltaMessageBoth.attribute = `${mqttMessage.attribute}-delta`;
            deltaMessageBoth.description = `${mqttMessage.description} (delta)`;
            this.processAndEnqueueMessage(deltaMessageBoth, time, true);
            break;
          }
        }  
      } else {
        logger.error(`${this.instanceNameWithSuffix} - Error publishing mqtt message: mqttMessage.packet must be defined.`);
      }
    } else {
      logger.error(`${this.instanceNameWithSuffix} - Error publishing mqtt message: mqttMessage must be defined.`);
    }
  }

  /**
   * Publishes a message to a specified topic.
   *
   * @param topic - The MQTT topic.
   * @param message - The message to publish.
   * @returns A promise that resolves when enqueued.
   */
  public publishMessage(topic: string, message: string): Promise<void> {
    return this.enqueueMessageToWorkerQueue(topic, message);
  }

  /**
   * Parses an MQTT packet from a JSON string.
   *
   * @param mqttPacket - The MQTT packet string.
   * @returns A parsed IUnsPacket object or null.
   */
  public parseMqttPacket(mqttPacket: string): IUnsPacket | null {
    return UnsPacket.parseMqttPacket(mqttPacket, this.instanceNameWithSuffix);
  }

  /**
   * Subscribes asynchronously to one or more topics.
   *
   * @param topics - A topic or list of topics.
   */
  public subscribeAsync(topics: string | string[]): void {
    this.worker.postMessage({ command: "subscribeAsync", topics });
  }

  /**
   * Unsubscribes asynchronously from the given topics.
   *
   * @param topics - A list of topics.
   */
  public unsubscribeAsync(topics: string[]): void {
    this.worker.postMessage({ command: "unsubscribeAsync", topics });
  }

  /**
   * Processes and enqueues a message to the worker queue, including handling
   * sequencing, value differences, and tracking of unique topics.
   *
   * @param msg - The MQTT message to process.
   * @param time - The timestamp.
   * @param valueIsCumulative - Whether the value is cumulative.
   */
  private async processAndEnqueueMessage(msg: IMqttMessage, time: string, valueIsCumulative: boolean = false): Promise<void> {
    try {
      const attributeType =
        msg.packet.message.data ? UnsAttributeType.Data :
        msg.packet.message.event ? UnsAttributeType.Event :
        msg.packet.message.table ? UnsAttributeType.Table : null;
      
      let dataGroup = "";
      if (attributeType == UnsAttributeType.Data)
        dataGroup = msg.packet.message.data.dataGroup ?? "";
      if (attributeType == UnsAttributeType.Table)
        dataGroup = msg.packet.message.table.dataGroup ?? "";
      if (attributeType == UnsAttributeType.Event)
        dataGroup = msg.packet.message.event.dataGroup ?? "";

      this.registerUniqueTopic({
        timestamp: time,
        topic: msg.topic,
        attribute: msg.attribute,
        attributeType: attributeType,
        description: msg.description,
        tags: msg.tags,
        attributeNeedsPersistence: msg.attributeNeedsPersistence,
        dataGroup
      });

      const fullTopic = `${msg.topic}${msg.attribute}`;
      const sequenceId = this.currentSequenceId.get(msg.topic) ?? 0;
      this.currentSequenceId.set(msg.topic, sequenceId + 1);
      msg.packet.sequenceId = sequenceId;

      if (msg.packet.message.data) {
        const newValue = msg.packet.message.data.value;
        const newUom: MeasurementUnit = msg.packet.message.data.uom;
        const lastValueEntry = this.lastValues.get(fullTopic);
        const currentTime = new Date(msg.packet.message.data.time);

        if (lastValueEntry) {
          const intervalBetweenMessages = currentTime.getTime() - lastValueEntry.timestamp.getTime();
          const lastValue = lastValueEntry.value;
          this.lastValues.set(fullTopic, { value: newValue, uom: newUom, timestamp: currentTime });
          // Compute the delta and manage cumulative resets
          if (valueIsCumulative == true && typeof newValue === "number" && typeof lastValue === "number") {
            // Skip if newValue is 0 (likely a glitch)
            if (newValue === 0) {
              return; // Don't process or enqueue
            }
            const delta = newValue - lastValue;
            msg.packet.message.data.value = delta < 0 ? newValue : delta;
          }
          msg.packet.interval = intervalBetweenMessages;
          await this.enqueueMessageToWorkerQueue(fullTopic, JSON.stringify(msg.packet));
        } else {
          this.lastValues.set(fullTopic, { value: newValue, uom: newUom, timestamp: currentTime });
          logger.debug(`${this.instanceNameWithSuffix} - Need one more packet to calculate interval on topic ${fullTopic}`);
          if (valueIsCumulative === false) {
            await this.enqueueMessageToWorkerQueue(fullTopic, JSON.stringify(msg.packet));
          } else {
            logger.debug(`${this.instanceNameWithSuffix} - Need one more packet to calculate difference on value in data for topic ${fullTopic}`);
          }
        }
      } else if (msg.packet.message.command) {
        await this.enqueueMessageToWorkerQueue(fullTopic, JSON.stringify(msg.packet));
      } else if (msg.packet.message.event) {
        await this.enqueueMessageToWorkerQueue(fullTopic, JSON.stringify(msg.packet));
      } else if (msg.packet.message.table) {
        await this.enqueueMessageToWorkerQueue(fullTopic, JSON.stringify(msg.packet));
      }
    } catch (error: any) {
      logger.error(`${this.instanceNameWithSuffix} - Error publishing message to topic ${msg.topic}${msg.attribute}: ${error.message}`);
    }
  }

  /**
   * Stops the UnsProxy instance and cleans up resources.
   */
  public async stop(): Promise<void> {
    super.stop();
    // Terminate the worker thread if it exists.
    if (this.worker) {
      try {
        const exitCode = await this.worker.terminate();
        logger.info(`${this.instanceNameWithSuffix} - Worker terminated with exit code ${exitCode}`);
      } catch (error: any) {
        logger.error(`${this.instanceNameWithSuffix} - Error terminating worker: ${error.message}`);
      }
    }
    
    // Optionally, handle any pending enqueues.
    for (const [id, pending] of this.pendingEnqueues) {
      pending.reject(new Error("UnsProxy has been stopped"));
      this.pendingEnqueues.delete(id);
    }
  }

}
