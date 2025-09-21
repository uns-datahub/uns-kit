import { z } from "zod";
declare const inlineHostSchema: z.ZodObject<{
    provider: z.ZodLiteral<"inline">;
    value: z.ZodString;
}, "strict", z.ZodTypeAny, {
    value?: string;
    provider?: "inline";
}, {
    value?: string;
    provider?: "inline";
}>;
declare const externalHostSchema: z.ZodObject<{
    provider: z.ZodLiteral<"external">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}>;
declare const systemHostSchema: z.ZodObject<{
    provider: z.ZodLiteral<"system">;
    family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
    interfaceName: z.ZodOptional<z.ZodString>;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}>;
export declare const hostPlaceholderSchema: z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
    provider: z.ZodLiteral<"inline">;
    value: z.ZodString;
}, "strict", z.ZodTypeAny, {
    value?: string;
    provider?: "inline";
}, {
    value?: string;
    provider?: "inline";
}>, z.ZodObject<{
    provider: z.ZodLiteral<"external">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}>, z.ZodObject<{
    provider: z.ZodLiteral<"system">;
    family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
    interfaceName: z.ZodOptional<z.ZodString>;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}>]>;
export declare const hostValueSchema: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
    provider: z.ZodLiteral<"inline">;
    value: z.ZodString;
}, "strict", z.ZodTypeAny, {
    value?: string;
    provider?: "inline";
}, {
    value?: string;
    provider?: "inline";
}>, z.ZodObject<{
    provider: z.ZodLiteral<"external">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "external";
    optional?: boolean;
}>, z.ZodObject<{
    provider: z.ZodLiteral<"system">;
    family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
    interfaceName: z.ZodOptional<z.ZodString>;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}, {
    default?: string;
    provider?: "system";
    optional?: boolean;
    family?: "IPv4" | "IPv6";
    interfaceName?: string;
}>]>]>;
export type HostPlaceholder = z.infer<typeof hostPlaceholderSchema>;
export type HostValue = z.infer<typeof hostValueSchema>;
export type InlineHostPlaceholder = z.infer<typeof inlineHostSchema>;
export type ExternalHostPlaceholder = z.infer<typeof externalHostSchema>;
export type SystemHostPlaceholder = z.infer<typeof systemHostSchema>;
export declare function isHostPlaceholder(value: unknown): value is HostPlaceholder;
export {};
