export interface GatewayAddress {
    address: string;
    isUDS: boolean;
}
export interface GatewayStartOptions {
    processNameOverride?: string;
    instanceSuffix?: string;
    instanceModeOverride?: "wait" | "force" | "handover";
    handoverOverride?: boolean;
}
export declare class UnsGatewayServer {
    private server;
    private unsProcess;
    private mqttInput;
    private mqttOutput;
    private handlers;
    private unsApiProxy;
    private apiStreams;
    private pendingApi;
    private inputHost;
    private outputHost;
    private inputParams;
    private outputParams;
    private apiOptions;
    private outPublisherActive;
    private inSubscriberActive;
    start(desiredAddr?: string, opts?: {
        processNameOverride?: string;
        instanceSuffix?: string;
        instanceModeOverride?: "wait" | "force" | "handover";
        handoverOverride?: boolean;
    }): Promise<GatewayAddress>;
    private getProcessName;
    private publish;
    private subscribe;
    private attachStatusListeners;
    private ensureMqttOutput;
    private ensureMqttInput;
    private ensureApiProxy;
    private getInstanceName;
    private registerApiGet;
    private unregisterApiGet;
    private onApiGetEvent;
    private apiEventStream;
    private ready;
    private cleanupHandler;
    shutdown(): Promise<void>;
}
export declare function startUnsGateway(addrOverride?: string, opts?: GatewayStartOptions): Promise<GatewayAddress>;
//# sourceMappingURL=uns-gateway-server.d.ts.map