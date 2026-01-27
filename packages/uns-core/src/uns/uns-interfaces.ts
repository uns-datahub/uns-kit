import { UnsAttributeType } from "../graphql/schema.js";
import { MeasurementUnit } from "./uns-measurements.js";
import { UnsTags } from "./uns-tags.js";
import type { UnsObjectId, UnsObjectType } from "./uns-object.js";
import type { UnsAsset } from "./uns-asset.js";
import type { IMqttConnectProperties, IMqttPublishOptions, IMqttServerConfig, MqttProtocol } from "../uns-mqtt/mqtt-interfaces.js";
import { UnsTopics } from "./uns-topics.js";
import { knownUnsAttributes, type KnownUnsAttributeName } from "./uns-attributes.js";

export type ISO8601 = `${number}-${string}-${string}T${string}:${string}:${string}.${string}Z`;
export function isIOS8601Type(value: string): value is ISO8601 {
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  return iso8601Regex.test(value);
}
// Known attribute names (with IntelliSense) while still allowing arbitrary strings.
export type UnsAttribute = KnownUnsAttributeName | (string & {});

export const valueTypes = ["string", "number"];
export type ValueTypeString = typeof valueTypes[number];
export type ValueType = string | number;

// Supported QuestDB column types for UNS tables.
export type QuestDbType =
  | "boolean"
  | "ipv4"
  | "byte"
  | "short"
  | "char"
  | "int"
  | "float"
  | "symbol"
  | "varchar"
  | "string"
  | "long"
  | "date"
  | "timestamp"
  | "timestamp_ns"
  | "double"
  | "uuid"
  | "binary"
  | "long256"
  | `geohash(${number}${"b" | "c"})`
  | `decimal(${number},${number})`
  | `array<${string}>`;

export interface IUnsParameters {
  mqttSubToTopics?: string | string[];
  username?: string;
  password?: string;
  mqttSSL?: boolean;
  publishThrottlingDelay?: number; // Delay in milliseconds; default is 1ms
  subscribeThrottlingDelay?: number; // Delay in milliseconds; default is 1ms
  rejectUnauthorized?: boolean;
  clientId?: string;
  hosts?: string[];
  servers?: IMqttServerConfig[];
  port?: number;
  protocol?: MqttProtocol;
  keepalive?: number;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
  reconnectOnConnackError?: boolean;
  resubscribe?: boolean;
  queueQoSZero?: boolean;
  properties?: IMqttConnectProperties;
  ca?: string;
  cert?: string;
  key?: string;
  servername?: string;
  /**
   * Default MQTT publish options applied to all outgoing messages
   * (e.g., qos, retain, messageExpiryInterval).
   */
  defaultPublishOptions?: IMqttPublishOptions;
}

export interface IUnsProcessParameters {
  processName: string;
  mqttSubToTopics?: string | string[];
  username?: string;
  password?: string;
  mqttSSL?: boolean;
  clientId?: string;
  hosts?: string[];
  servers?: IMqttServerConfig[];
  port?: number;
  protocol?: MqttProtocol;
  keepalive?: number;
  clean?: boolean;
  connectTimeout?: number;
  reconnectPeriod?: number;
  reconnectOnConnackError?: boolean;
  resubscribe?: boolean;
  queueQoSZero?: boolean;
  rejectUnauthorized?: boolean;
  properties?: IMqttConnectProperties;
  ca?: string;
  cert?: string;
  key?: string;
  servername?: string;
}

export interface UnsEvents {
  // Emitters in MqttProxy, UnsMqttProxy
  input: { topic: string; message: string, packet: any };
  mqttProxyStatus: { event: string, value: number, uom: MeasurementUnit, statusTopic: string };
  
  // Emitters in MqttProxy
  error: { code: number; message: string };
  
  // Emitters in UnsMqttProxy
  mqttWorker: { command: string, instanceName: string; batchSize: number, referenceHash: string };

  // Emitter in UnsCronProxy
  cronEvent: { event?: string; cronExpression?: string };

  // Emitters in UnsApiProxy
  apiGetEvent: {req: any, res: any};

  // Emitters in UnsProxy
  unsProxyProducedTopics: { producedTopics: ITopicObject[], statusTopic: string };

  // Emitters in UnsProxy
  unsProxyProducedApiEndpoints: { producedApiEndpoints: IApiObject[], statusTopic: string };

  // Emitters in UnsProxy
  unsProxyProducedApiCatchAll: { producedCatchall: IApiCatchallMapping[], statusTopic: string };
}

export interface IUnsExtendedData extends IUnsData {
  valueType: ValueTypeString;
}

export interface IUnsData {
  time: ISO8601;
  value: ValueType;
  dataGroup?: string;
  uom?: MeasurementUnit;
  foreignEventKey?: string;
  intervalStart?: ISO8601 | number;
  intervalEnd?: ISO8601 | number;
  windowStart?: ISO8601 | number;
  windowEnd?: ISO8601 | number;
  eventId?: string;
  deleted?: boolean;
  deletedAt?: ISO8601 | number;
  lastSeen?: ISO8601 | number;
}

export interface IUnsTableColumn {
  name: string;
  type: QuestDbType;
  value: string | number | null;
  uom?: MeasurementUnit;
}

export interface IUnsTable {
  time: ISO8601;
  dataGroup?: string;
  columns: IUnsTableColumn[];
  intervalStart?: ISO8601 | number;
  intervalEnd?: ISO8601 | number;
  windowStart?: ISO8601 | number;
  windowEnd?: ISO8601 | number;
  eventId?: string;
  deleted?: boolean;
  deletedAt?: ISO8601 | number;
  lastSeen?: ISO8601 | number;
}

export interface IMqttAttributeMessage {
  attribute: UnsAttribute;
  description?: string;
  tags?: UnsTags[];
  attributeNeedsPersistence?: boolean | null;
}

type AttributePayload =
  | { message: IUnsMessage; data?: never; table?: never; createdAt?: never; expiresAt?: never }
  | { message?: never; data: IUnsData; table?: never; createdAt?: ISO8601; expiresAt?: ISO8601 }
  | { message?: never; data?: never; table: IUnsTable; createdAt?: ISO8601; expiresAt?: ISO8601 };

export type IMqttAttributeEntry = IMqttAttributeMessage & AttributePayload;

export interface IMqttPublishRequest {
  topic: UnsTopics;
  asset: UnsAsset;
  assetDescription?: string;
  objectType: UnsObjectType;
  objectTypeDescription?: string;
  objectId: UnsObjectId;
  attributes: IMqttAttributeEntry | IMqttAttributeEntry[];
}

// This interface represents a packet for a UNS system
export interface IUnsPacket {
  // The message object of the packet
  message: IUnsExtendedMessage;
  
  // The HMAC signature of the message
  messageSignature?: string;

  // Automatically calculated interval between two packets in ms
  interval?: number;

  // Current library version
  readonly version: string;

  // Autogenerated sequence number
  sequenceId?: number;
}

export interface IUnsPackatParameters {

}

export interface IUnsMessage {
    data?: IUnsData;
    table?: IUnsTable;
    expiresAt?: ISO8601;
    createdAt?: ISO8601;
}

export interface IUnsExtendedMessage extends IUnsMessage {
  data?: IUnsExtendedData;
}

export interface ITopicObject {
  timestamp: string;
  attribute:string;
  attributeType: UnsAttributeType;
  topic:string;
  description:string;
  dataGroup:string;
  tags:string[] | null;
  attributeNeedsPersistence: boolean | null;
  asset: UnsAsset;
  assetDescription?: string;
  objectType: UnsObjectType;
  objectTypeDescription?: string;
  objectId: UnsObjectId;
}

// API Interfaces below
export interface IApiObject {
  timestamp: string;
  attribute:string;
  topic:string;
  attributeType: UnsAttributeType;
  apiDescription?: string; // Optional description for the API endpoint
  apiHost: string; // Hostname of the service
  apiEndpoint: string; // API endpoint for virtual topics
  apiSwaggerEndpoint: string; // Swagger endpoint for API documentation
  apiMethod: "GET" | "POST" | "PUT" | "DELETE"; // HTTP method for API endpoint
  apiQueryParams: QueryParamDef[]; // query parameters for the API endpoint
  asset: UnsAsset;
  objectType: UnsObjectType;
  objectId: UnsObjectId;
  controllerName?: string;
  controllerHost?: string;
  controllerPort?: string;
  controllerPublicBase?: string;
}

export interface IApiCatchallMapping {
  topic: string;
  apiBase: string;
  apiBasePath: string;
  swaggerPath: string;
}

export interface QueryParamDef {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  description?: string;
}

export interface IApiProxyOptions {
  jwtSecret?: string;
  jwks?: {
    wellKnownJwksUrl: string;
    activeKidUrl?: string;
    cacheTtlMs?: number;
    algorithms?: ("RS256" | "RS384" | "RS512")[];
  };
  /**
   * Optional base prefixes to mount the API and swagger JSON under (e.g. "/archiver-3").
   * Defaults to "/api" when not provided.
   */
  apiBasePath?: string;
  swaggerBasePath?: string;
  /**
   * Skip mounting the default "/api" route. Useful when rebasing entirely under a custom prefix.
   */
  disableDefaultApiMount?: boolean;
}

export interface IGetEndpointOptions {
  apiDescription?: string;
  tags?: string[];
  queryParams?: QueryParamDef[];
}
