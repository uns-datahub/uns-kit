import UnsProxy from "@uns-kit/core/uns/uns-proxy";
import { ConnectionOptions, ClientOptions, Workflow } from '@temporalio/client';
import { ITemporalTopic } from "./temporal-interfaces.js";
export default class UnsTemporalProxy extends UnsProxy {
    instanceName: string;
    protected processStatusTopic: string;
    private topicBuilder;
    private processName;
    private connectionOptions;
    private clientOptions;
    private client;
    private unsTopic;
    constructor(processName: string, instanceName: string, connectionOptions: ConnectionOptions, clientOptions: ClientOptions);
    /**
     * Initializes the Temporal proxy by registering the given topic and establishing a client connection.
     * @param unsTopic - The topic object to register with Temporal.
     * @returns A promise that resolves when initialization is complete.
     * @throws If the Temporal client fails to initialize.
     */
    initializeTemporalProxy(temporalTopic: ITemporalTopic): Promise<void>;
    /**
     * Creates a temporal proxy for the UNS process.
     * This method registers the UNS topic for temporal data.
     */
    private registerTemporalTopic;
    startWorkflow(workflowTypeOrFunc: string | Workflow, arg: Record<string, any>, taskQueue: string, workflowId?: string): Promise<any>;
}
