// src/uns-config/uns-core-schema.ts
import { z } from "zod";
import { secretValueSchema } from "./secret-placeholders.js";
import { hostValueSchema } from "./host-placeholders.js";

const mqttChannelSchema = z.object({
  host: hostValueSchema,
  username: z.string().optional(),
  password: secretValueSchema.optional(),
  clientId: z.string().optional(),
}).strict();

export const unsCoreSchema = z.object({
  uns: z.object({
    graphql: z.string().url(),
    rest: z.string().url(),
    instanceMode: z.enum(["wait", "force", "handover"]).default("wait"),
    processName: z.string().min(1).optional(),
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
