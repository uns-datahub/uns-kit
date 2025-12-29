export interface IMqttParameters {
  mqttSubToTopics?: string | string[];
  username?: string;
  password?: string;
  mqttSSL?: boolean;
  clientId?: string;
  statusTopic?: string;
  rejectUnauthorized?: boolean;
}

export interface HandoverManagerEvents {
  handoverManager: { active: boolean; };
}

export interface IMqttWorkerData {
  publishThrottlingDelay?: number; // Delay in milliseconds; default is 1ms
  subscribeThrottlingDelay?: number; // Delay in milliseconds; default is 1ms
  persistToDisk?: boolean; // Whether to persist the queue to disk; default is false
  mqttHost: string; // MQTT broker host
  instanceNameWithSuffix: string; // Unique instance name for logging
  mqttParameters?: any; // Additional parameters for the MQTT client  
  publisherActive: boolean; // Whether the publisher is active
  subscriberActive: boolean; // Whether the subscriber is active
}
