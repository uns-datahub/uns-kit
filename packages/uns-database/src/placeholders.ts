import { z } from "zod";

const envSecretSchema = z.object({
  provider: z.literal("env"),
  key: z.string().min(1),
  optional: z.boolean().optional(),
  default: z.string().optional(),
}).strict();

const infisicalSecretSchema = z.object({
  provider: z.literal("infisical"),
  path: z.string().min(1),
  key: z.string().min(1),
  optional: z.boolean().optional(),
  environment: z.string().optional(),
  projectId: z.string().optional(),
  default: z.string().optional(),
}).strict();

const inlineHostSchema = z.object({
  provider: z.literal("inline"),
  value: z.string().min(1),
}).strict();

const externalHostSchema = z.object({
  provider: z.literal("external"),
  key: z.string().min(1),
  optional: z.boolean().optional(),
  default: z.string().optional(),
}).strict();

const systemHostSchema = z.object({
  provider: z.literal("system"),
  family: z.enum(["IPv4", "IPv6"]).default("IPv4"),
  interfaceName: z.string().optional(),
  optional: z.boolean().optional(),
  default: z.string().optional(),
}).strict();

export const secretPlaceholderSchema = z.discriminatedUnion("provider", [
  envSecretSchema,
  infisicalSecretSchema,
]);

export const secretValueSchema = z.union([
  z.string(),
  secretPlaceholderSchema,
]);

export const hostPlaceholderSchema = z.discriminatedUnion("provider", [
  inlineHostSchema,
  externalHostSchema,
  systemHostSchema,
]);

export const hostValueSchema = z.union([
  z.string(),
  hostPlaceholderSchema,
]);
