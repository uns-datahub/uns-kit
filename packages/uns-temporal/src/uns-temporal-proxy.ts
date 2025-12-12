import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
import logger from "@uns-kit/core/logger.js";
import { ITopicObject } from "@uns-kit/core/uns/uns-interfaces.js";
import { MqttTopicBuilder } from "@uns-kit/core/uns-mqtt/mqtt-topic-builder.js";
import * as path from "path";
import { basePath } from "@uns-kit/core/base-path.js";
import { readFileSync } from "fs";
import { Connection, Client, ConnectionOptions, ClientOptions, Workflow, WorkflowStartOptions } from '@temporalio/client';
import { ITemporalTopic } from "./temporal-interfaces.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { UnsAttributeType } from "@uns-kit/core/graphql/schema.js";
import { ObjectTypes } from "@uns-kit/core/uns/uns-object.js";
import { LineAttributes } from "@uns-kit/core/uns/uns-attributes.js";


const packageJsonPath = path.join(basePath, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));


export default class UnsTemporalProxy extends UnsProxy {
  public instanceName: string;
  protected processStatusTopic: string;  
  private topicBuilder: MqttTopicBuilder;
  private processName: string;
  private connectionOptions: ConnectionOptions;
  private clientOptions: ClientOptions;
  private client:Client;
  private unsTopic:ITopicObject;

  constructor(processName: string, instanceName: string, connectionOptions: ConnectionOptions, clientOptions: ClientOptions) {
    super();
    
    this.connectionOptions = connectionOptions;
    this.clientOptions = clientOptions;
    this.instanceName = instanceName;
    this.processName = processName;
    // Create the topic builder using packageJson values and the processName.
    this.topicBuilder = new MqttTopicBuilder(`uns-infra/${MqttTopicBuilder.sanitizeTopicPart(packageJson.name)}/${MqttTopicBuilder.sanitizeTopicPart(packageJson.version)}/${MqttTopicBuilder.sanitizeTopicPart(processName)}/`);

    // Generate the processStatusTopic using the builder.
    this.processStatusTopic = this.topicBuilder.getProcessStatusTopic();

    // Derive the instanceStatusTopic by appending the instance name.
    this.instanceStatusTopic = this.processStatusTopic + instanceName + "/";

    // Concatenate processName with instanceName for the worker identification.
    this.instanceNameWithSuffix = `${processName}-${instanceName}`;
  }


  /**
   * Initializes the Temporal proxy by registering the given topic and establishing a client connection.
   * @param unsTopic - The topic object to register with Temporal.
   * @returns A promise that resolves when initialization is complete.
   * @throws If the Temporal client fails to initialize.
   */
  public async initializeTemporalProxy(temporalTopic: ITemporalTopic): Promise<void> {
    try {
      const unsTopic: ITopicObject = {
        timestamp: UnsPacket.formatToISO8601(new Date()),
        topic: temporalTopic.topic,
        asset: temporalTopic.asset,
        objectType: temporalTopic.objectType,
        objectId: temporalTopic.objectId,
        attribute: temporalTopic.attribute,
        attributeType: temporalTopic.attributeType,
        description: temporalTopic.description ?? "",
        tags: temporalTopic.tags ?? [],
        attributeNeedsPersistence: temporalTopic.attributeNeedsPersistence ?? true,
        dataGroup: temporalTopic.dataGroup ?? "",
      };

      // Register the UNS topic for temporal data.
      this.registerTemporalTopic(unsTopic);
      this.clientOptions.connection = this.clientOptions.connection ?? await Connection.connect(this.connectionOptions);
      this.client = new Client(this.clientOptions);
    } catch (error) {
      logger.error(`Failed to initialize Temporal client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a temporal proxy for the UNS process.
   * This method registers the UNS topic for temporal data.
   */
  private async registerTemporalTopic(unsTopic: ITopicObject): Promise<void> {
    try {
      // Register the UNS topic for temporal data.
      this.registerUniqueTopic(unsTopic);
      this.unsTopic = unsTopic;
    } catch (error) {
      logger.error(`Error creating temporal proxy: ${error.message}`);
      throw error;
    }
  }


  public async startWorkflow(
    workflowTypeOrFunc: string | Workflow,
    arg: Record<string, any>,
    taskQueue: string,
    workflowId?: string
  ): Promise<any> {
    try {
      const workflowInput = {
        input_data: arg,
        uns_params: {
          uns_attribute: this.unsTopic.attribute,
          uns_attribute_type: this.unsTopic.attributeType,
          uns_topic: this.unsTopic.topic
        }
      };
      const workflowOptions: WorkflowStartOptions = {
        args: [workflowInput], // single JSON object
        taskQueue,
        workflowId: workflowId ?? `${this.instanceNameWithSuffix}-${Math.floor(Date.now() / 1000)}`
      };
      logger.info(`Starting workflow with options: ${JSON.stringify(workflowOptions)}`);
      const handle = await this.client.workflow.start(workflowTypeOrFunc, workflowOptions);
      return await handle.result();
    } catch (error) {
      logger.error(`Failed to start/complete workflow: ${error.message}`);
    }
  }

}
