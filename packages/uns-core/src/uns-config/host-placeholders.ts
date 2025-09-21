import { z } from "zod";

// Host placeholders allow configuration values such as MQTT brokers or database
// hosts to be defined dynamically. They support in-line values as well as
// externally resolved entries so projects can avoid storing environment-specific
// hosts directly inside shared config files.

const inlineHostSchema = z
  .object({
    provider: z.literal("inline").describe("Use the supplied host or IP address."),
    value: z
      .string()
      .min(1, "Host/IP value is required")
      .describe("Host or IP address that should be used directly."),
  })
  .strict()
  .describe("Host placeholder resolved from an in-line value.");

const externalHostSchema = z
  .object({
    provider: z.literal("external").describe("Resolve the host from an external mapping."),
    key: z
      .string()
      .min(1, "External host key is required")
      .describe("Identifier used when resolving the host from HostResolverOptions."),
    optional: z
      .boolean()
      .optional()
      .describe("Allow the external host to be missing without throwing during resolution."),
    default: z
      .string()
      .optional()
      .describe("Fallback host when optional is true and the external entry is missing."),
  })
  .strict()
  .describe("Host placeholder resolved via HostResolverOptions.externalHosts or resolveExternal function.");

const systemHostSchema = z
  .object({
    provider: z.literal("system").describe("Resolve the host from local network interfaces."),
    family: z
      .union([z.literal("IPv4"), z.literal("IPv6")])
      .default("IPv4")
      .describe("Address family to return when scanning interfaces."),
    interfaceName: z
      .string()
      .optional()
      .describe("Specific interface to read (falls back to the first match when omitted)."),
    optional: z
      .boolean()
      .optional()
      .describe("Allow the interface lookup to fail without throwing during resolution."),
    default: z
      .string()
      .optional()
      .describe("Fallback host/IP when optional is true and no interface matches."),
  })
  .strict()
  .describe("Host placeholder resolved from os.networkInterfaces().");

export const hostPlaceholderSchema = z.discriminatedUnion("provider", [
  inlineHostSchema,
  externalHostSchema,
  systemHostSchema,
]);

export const hostValueSchema = z.union([
  z
    .string()
    .min(1, "Host/IP value is required")
    .describe("Host or IP address used directly without placeholder."),
  hostPlaceholderSchema,
]);

export type HostPlaceholder = z.infer<typeof hostPlaceholderSchema>;
export type HostValue = z.infer<typeof hostValueSchema>;
export type InlineHostPlaceholder = z.infer<typeof inlineHostSchema>;
export type ExternalHostPlaceholder = z.infer<typeof externalHostSchema>;
export type SystemHostPlaceholder = z.infer<typeof systemHostSchema>;

export function isHostPlaceholder(value: unknown): value is HostPlaceholder {
  return hostPlaceholderSchema.safeParse(value).success;
}
