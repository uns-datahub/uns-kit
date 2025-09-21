import { z } from "zod";
declare const envSecretSchema: z.ZodObject<{
    provider: z.ZodLiteral<"env">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}>;
declare const infisicalSecretSchema: z.ZodObject<{
    provider: z.ZodLiteral<"infisical">;
    path: z.ZodString;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    environment: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}>;
export declare const secretPlaceholderSchema: z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
    provider: z.ZodLiteral<"env">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}>, z.ZodObject<{
    provider: z.ZodLiteral<"infisical">;
    path: z.ZodString;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    environment: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}>]>;
export declare const secretValueSchema: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
    provider: z.ZodLiteral<"env">;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}, {
    default?: string;
    key?: string;
    provider?: "env";
    optional?: boolean;
}>, z.ZodObject<{
    provider: z.ZodLiteral<"infisical">;
    path: z.ZodString;
    key: z.ZodString;
    optional: z.ZodOptional<z.ZodBoolean>;
    environment: z.ZodOptional<z.ZodString>;
    projectId: z.ZodOptional<z.ZodString>;
    default: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}, {
    default?: string;
    key?: string;
    provider?: "infisical";
    optional?: boolean;
    path?: string;
    environment?: string;
    projectId?: string;
}>]>]>;
export type SecretPlaceholder = z.infer<typeof secretPlaceholderSchema>;
export type SecretValue = z.infer<typeof secretValueSchema>;
export type EnvSecretPlaceholder = z.infer<typeof envSecretSchema>;
export type InfisicalSecretPlaceholder = z.infer<typeof infisicalSecretSchema>;
export declare function isSecretPlaceholder(value: unknown): value is SecretPlaceholder;
export {};
