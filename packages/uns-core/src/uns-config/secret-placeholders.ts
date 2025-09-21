import { z } from "zod";

// A SecretPlaceholder marks values that should be resolved from external secret stores
// instead of being stored in plain text within config files. It supports loading from
// environment variables ("env") and Infisical ("infisical"). The union below is kept
// minimal so the same shape can be reused across core/project config schemas.

const envSecretSchema = z
  .object({
    provider: z.literal("env").describe("Load the secret from an environment variable."),
    key: z
      .string()
      .min(1, "Environment variable key is required")
      .describe("Name of the environment variable to read."),
    optional: z
      .boolean()
      .optional()
      .describe("Allow the variable to be absent without throwing during resolution."),
    default: z
      .string()
      .optional()
      .describe("Fallback value when optional is true and the variable is missing."),
  })
  .strict()
  .describe("Secret placeholder resolved from process.env.");

const infisicalSecretSchema = z
  .object({
    provider: z.literal("infisical").describe("Load the secret from Infisical."),
    path: z
      .string()
      .min(1, "Secret path is required")
      .describe("Secret folder path in Infisical, e.g. '/app/database'."),
    key: z
      .string()
      .min(1, "Secret key is required")
      .describe("Secret key/name inside the given path."),
    optional: z
      .boolean()
      .optional()
      .describe("Allow the secret to be absent without throwing during resolution."),
    environment: z
      .string()
      .optional()
      .describe("Infisical environment override (defaults to current mode if omitted)."),
    projectId: z
      .string()
      .optional()
      .describe("Optional Infisical project identifier when not using the default."),
    default: z
      .string()
      .optional()
      .describe("Fallback value when the secret is missing and optional resolution is allowed."),
  })
  .strict()
  .describe("Secret placeholder resolved from Infisical.");

export const secretPlaceholderSchema = z.discriminatedUnion("provider", [
  envSecretSchema,
  infisicalSecretSchema,
]);

export const secretValueSchema = z.union([
  z.string(),
  secretPlaceholderSchema,
]);

export type SecretPlaceholder = z.infer<typeof secretPlaceholderSchema>;
export type SecretValue = z.infer<typeof secretValueSchema>;
export type EnvSecretPlaceholder = z.infer<typeof envSecretSchema>;
export type InfisicalSecretPlaceholder = z.infer<typeof infisicalSecretSchema>;

export function isSecretPlaceholder(value: unknown): value is SecretPlaceholder {
  return secretPlaceholderSchema.safeParse(value).success;
}
