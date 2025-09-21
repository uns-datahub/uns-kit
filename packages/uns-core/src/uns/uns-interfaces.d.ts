import { UnsAttributeType } from "../graphql/schema";
import { MeasurementUnit } from "./uns-measurements";
import { UnsTags } from "./uns-tags";
import { UnsTopics } from "./uns-topics";
export type ISO8601 = `${number}-${string}-${string}T${string}:${string}:${string}.${string}Z`;
export declare function isIOS8601Type(value: string): value is ISO8601;
export type UnsAttribute = string;
export declare const valueTypes: string[];
export type ValueTypeString = typeof valueTypes[number];
export type ValueType = string | number;
export interface IUnsParameters {
    mqttSubToTopics?: string | string[];
    username?: string;
    password?: string;
    mqttSSL?: boolean;
    publishThrottlingDelay?: number;
    subscribeThrottlingDelay?: number;
}
export interface IUnsProcessParameters {
    processName?: string | undefined;
    mqttSubToTopics?: string | string[];
    username?: string;
    password?: string;
    mqttSSL?: boolean;
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
export interface IUnsEvent {
    time: ISO8601;
    dataGroup?: string;
    details?: string;
    uniqueEventId?: string;
}
export interface IUnsTable {
    time: ISO8601;
    values: Record<string, string | number | undefined | null>;
    dataGroup?: string;
}
export interface IUnsCommand {
    time: ISO8601;
    details?: string;
}
export interface IMqttMessage {
    topic: UnsTopics;
    attribute: UnsAttribute;
    description?: string;
    tags?: UnsTags[];
    packet: IUnsPacket;
    attributeNeedsPersistence?: boolean | null;
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
    command?: IUnsCommand;
    data?: IUnsData;
    event?: IUnsEvent;
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
