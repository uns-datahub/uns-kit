// src/uns-config/uns-core-schema.ts
import { z } from "zod";
import { secretValueSchema } from "./secret-placeholders.js";
import { hostValueSchema } from "./host-placeholders.js";

const mqttProtocolSchema = z.enum(["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]);

const mqttServerSchema = z.object({
  host: hostValueSchema,
  port: z.number().int().positive().optional(),
  protocol: mqttProtocolSchema.optional(),
}).strict();

const mqttConnectPropertiesSchema = z.object({
  sessionExpiryInterval: z.number().int().nonnegative().optional(),
  receiveMaximum: z.number().int().positive().optional(),
  maximumPacketSize: z.number().int().positive().optional(),
  topicAliasMaximum: z.number().int().nonnegative().optional(),
  requestResponseInformation: z.boolean().optional(),
  requestProblemInformation: z.boolean().optional(),
  userProperties: z.record(z.string()).optional(),
}).strict();

const mqttChannelSchema = z.object({
  host: hostValueSchema.optional(),
  hosts: z.array(hostValueSchema).optional(),
  servers: z.array(mqttServerSchema).optional(),
  port: z.number().int().positive().optional(),
  protocol: mqttProtocolSchema.optional(),
  username: z.string().optional(),
  password: secretValueSchema.optional(),
  clientId: z.string().optional(),
  clean: z.boolean().optional(),
  keepalive: z.number().int().nonnegative().optional(),
  connectTimeout: z.number().int().nonnegative().optional(),
  reconnectPeriod: z.number().int().nonnegative().optional(),
  reconnectOnConnackError: z.boolean().optional(),
  resubscribe: z.boolean().optional(),
  queueQoSZero: z.boolean().optional(),
  rejectUnauthorized: z.boolean().optional(),
  properties: mqttConnectPropertiesSchema.optional(),
  ca: z.string().optional(),
  cert: z.string().optional(),
  key: z.string().optional(),
  servername: z.string().optional(),
}).strict().refine((value) => {
  return !!value.host || (Array.isArray(value.hosts) && value.hosts.length > 0) || (Array.isArray(value.servers) && value.servers.length > 0);
}, {
  message: "One of host, hosts, or servers must be provided.",
});

export const unsCoreSchema = z.object({
  uns: z.object({
    graphql: z.string().url(),
    rest: z.string().url(),
    email: z.string().email().describe("Email used when authenticating to graphql endpoint of the UNS instance."),
    password: secretValueSchema.describe("Password or secret value paired with the UNS email."),
    instanceMode: z.enum(["wait", "force", "handover"]).default("wait"),
    processName: z
      .string()
      .min(1)
      .describe("Process name used in MQTT topics and logs."),
    handover: z.boolean().default(true),
    jwksWellKnownUrl: z.string().url().optional(),
    kidWellKnownUrl: z.string().url().optional(),
    env: z.enum(["dev", "staging", "test", "prod"]).default("dev"),
  }).strict(),

  input: mqttChannelSchema.optional(),
  output: mqttChannelSchema.optional(),
  infra: mqttChannelSchema,
  devops: z.object({
    provider: z.enum(["azure-devops"]).default("azure-devops"),
    organization: z.string().min(1),
    project: z.string().min(1).optional(),
  }).strict().optional(),
}).strict();

export type UnsCore = z.infer<typeof unsCoreSchema>;
