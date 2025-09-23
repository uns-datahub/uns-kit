import WebSocket from 'ws';
import logger from '../logger';

export interface WsEvents {
  deal: { message: string};
  input: { message: string };
  error: { code: number; message: string };
  reconnect: {}; // Add reconnect event with an empty payload or specific data as needed
}

export interface IWsParameters {
  username?: string;
  statusPath?: string;
}

class WsEventEmitter<Events extends Record<string, any>> {
  private listeners: { [K in keyof Events]?: Array<(event: Events[K]) => void> } = {};

  on<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void {
    if (!this.listeners[eventName]) this.listeners[eventName] = [];
    this.listeners[eventName]!.push(listener);
  }

  off<K extends keyof Events>(eventName: K, listener: (event: Events[K]) => void): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName]!.filter((l) => l !== listener);
  }

  emit<K extends keyof Events>(eventName: K, event: Events[K]): void {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName]!.forEach((listener) => listener(event));
  }
}

export default class WsProxy {
  // Other properties and methods...
  public event: WsEventEmitter<WsEvents> = new WsEventEmitter<WsEvents>();
  protected wsClient: WebSocket;
  private wsUrl: string;
  private instanceName: string;
  private reconnectDelay = 3000;
  private maxReconnectAttempts = 5;
  private reconnectAttempts = 0;

  constructor(wsUrl: string, instanceName: string) {
    this.wsUrl = wsUrl;
    this.instanceName = instanceName;
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        logger.info(`${this.instanceName} - Attempting to reconnect... (${this.reconnectAttempts + 1})`);
        this.reconnectAttempts++;
        this.start().then(() => {
          logger.info(`${this.instanceName} - Reconnected successfully`);
          this.event.emit('reconnect', {}); // Emit reconnect event here
        }).catch(() => logger.error(`${this.instanceName} - Reconnect attempt failed`));
      }, this.reconnectDelay);
    } else {
      logger.error(`${this.instanceName} - Maximum reconnect attempts reached. Giving up.`);
    }
  }

  // Starts the WebSocket connection
  public start(): Promise<void> {
    logger.info(`${this.instanceName} - Connecting to WebSocket server...`);

    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocket(this.wsUrl);

      this.wsClient.on('open', () => {
        logger.info(`${this.instanceName} - Connected to WebSocket server at ${this.wsUrl}`);
        this.reconnectAttempts = 0; // Reset the reconnect attempts after a successful connection
        resolve();
      });

      this.wsClient.on('message', (data: WebSocket.Data) => {
        const message = typeof data === 'string' ? data : data.toString();
//        logger.info(`${this.instanceName} - Message received from server: ${message}`);
        this.event.emit('input', { message });
      });

      this.wsClient.on('error', (error) => {
        logger.error(`${this.instanceName} - WebSocket client error: ${(error as Error).message}`);
        this.event.emit('error', { code: 0, message: (error as Error).message });
        reject(error);
      });

      this.wsClient.on('close', (code, reason) => {
        logger.info(`${this.instanceName} - WebSocket connection closed: ${code} - ${reason}`);
        // Attempt reconnection for non-normal closure (code 1000 is normal)
        if (code !== 1000) {
          this.reconnect();
        }
      });
    });
  }

  // Stops the WebSocket connection
  public stop() {
    logger.info(`${this.instanceName} - Disconnecting from WebSocket server...`);
    if (this.wsClient) {
      this.wsClient.close(1000, 'Client closed connection');
      logger.info(`${this.instanceName} - Disconnected from WebSocket server.`);
    }
  }
}
