import { UnsAttributeType } from "../graphql/schema.js";
import { MeasurementUnit } from "./uns-measurements.js";
import { UnsTags } from "./uns-tags.js";
import type { UnsObjectId, UnsObjectType } from "./uns-object.js";
import type { UnsAsset } from "./uns-asset.js";
import type { IMqttConnectProperties, IMqttServerConfig, MqttProtocol } from "../uns-mqtt/mqtt-interfaces.js";
import { UnsTopics } from "./uns-topics.js";
import { type KnownUnsAttributeName } from "./uns-attributes.js";
export type ISO8601 = `${number}-${string}-${string}T${string}:${string}:${string}.${string}Z`;
export declare function isIOS8601Type(value: string): value is ISO8601;
export type UnsAttribute = KnownUnsAttributeName | (string & {});
export declare const valueTypes: string[];
export type ValueTypeString = typeof valueTypes[number];
export type ValueType = string | number;
export type QuestDbType = "boolean" | "ipv4" | "byte" | "short" | "char" | "int" | "float" | "symbol" | "varchar" | "string" | "long" | "date" | "timestamp" | "timestamp_ns" | "double" | "uuid" | "binary" | "long256" | `geohash(${number}${"b" | "c"})` | `decimal(${number},${number})` | `array<${string}>`;
export interface IUnsParameters {
    mqttSubToTopics?: string | string[];
    username?: string;
    password?: string;
    mqttSSL?: boolean;
    publishThrottlingDelay?: number;
    subscribeThrottlingDelay?: number;
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
    input: {
        topic: string;
        message: string;
        packet: any;
    };
    mqttProxyStatus: {
        event: string;
        value: number;
        uom: MeasurementUnit;
        statusTopic: string;
    };
    error: {
        code: number;
        message: string;
    };
    mqttWorker: {
        command: string;
        instanceName: string;
        batchSize: number;
        referenceHash: string;
    };
    cronEvent: {};
    apiGetEvent: {
        req: any;
        res: any;
    };
    unsProxyProducedTopics: {
        producedTopics: ITopicObject[];
        statusTopic: string;
    };
    unsProxyProducedApiEndpoints: {
        producedApiEndpoints: IApiObject[];
        statusTopic: string;
    };
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
}
export interface IMqttMessage {
    topic: UnsTopics;
    attribute: UnsAttribute;
    asset: UnsAsset;
    assetDescription?: string;
    objectType: UnsObjectType;
    objectTypeDescription?: string;
    objectId: UnsObjectId;
    description?: string;
    tags?: UnsTags[];
    packet: IUnsPacket;
    attributeNeedsPersistence?: boolean | null;
}
export interface IMqttAttributeMessage {
    attribute: UnsAttribute;
    description?: string;
    tags?: UnsTags[];
    attributeNeedsPersistence?: boolean | null;
}
type AttributePayload = {
    message: IUnsMessage;
    data?: never;
    table?: never;
    createdAt?: never;
    expiresAt?: never;
} | {
    message?: never;
    data: IUnsData;
    table?: never;
    createdAt?: ISO8601;
    expiresAt?: ISO8601;
} | {
    message?: never;
    data?: never;
    table: IUnsTable;
    createdAt?: ISO8601;
    expiresAt?: ISO8601;
};
export type IMqttAttributeEntry = IMqttAttributeMessage & AttributePayload;
export interface IMqttMultiMessage {
    topic: UnsTopics;
    asset: UnsAsset;
    assetDescription?: string;
    objectType: UnsObjectType;
    objectTypeDescription?: string;
    objectId: UnsObjectId;
    attributes: IMqttAttributeEntry[];
}
export interface IUnsPacket {
    message: IUnsExtendedMessage;
    messageSignature?: string;
    interval?: number;
    readonly version: string;
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
    attribute: string;
    attributeType: UnsAttributeType;
    topic: string;
    description: string;
    dataGroup: string;
    tags: string[] | null;
    attributeNeedsPersistence: boolean | null;
    asset: UnsAsset;
    assetDescription?: string;
    objectType: UnsObjectType;
    objectTypeDescription?: string;
    objectId: UnsObjectId;
}
export interface IApiObject {
    timestamp: string;
    attribute: string;
    topic: string;
    attributeType: UnsAttributeType;
    apiDescription?: string;
    apiHost: string;
    apiEndpoint: string;
    apiSwaggerEndpoint: string;
    apiMethod: "GET" | "POST" | "PUT" | "DELETE";
    apiQueryParams: QueryParamDef[];
    asset: UnsAsset;
    objectType: UnsObjectType;
    objectId: UnsObjectId;
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
}
export interface IGetEndpointOptions {
    apiDescription?: string;
    tags?: string[];
    queryParams?: QueryParamDef[];
}
export {};
//# sourceMappingURL=uns-interfaces.d.ts.map