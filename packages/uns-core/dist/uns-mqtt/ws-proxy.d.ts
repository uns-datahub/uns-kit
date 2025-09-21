import WebSocket from 'ws';
export interface WsEvents {
    deal: {
        message: string;
    };
    input: {
        message: string;
    };
    error: {
        code: number;
        message: string;
    };
    reconnect: {};
}
export interface IWsParameters {
    username?: string;
    statusPath?: string;
}
declare class WsEventEmitter<Events extends Record<string, any>> {
    private listeners;
    on<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void;
    off<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void;
    emit<K extends keyof Events>(eventName: K, event: Events[K]): void;
}
export default class WsProxy {
    event: WsEventEmitter<WsEvents>;
    protected wsClient: WebSocket;
    private wsUrl;
    private instanceName;
    private reconnectDelay;
    private maxReconnectAttempts;
    private reconnectAttempts;
    constructor(wsUrl: string, instanceName: string);
    private reconnect;
    start(): Promise<void>;
    stop(): void;
}
export {};
