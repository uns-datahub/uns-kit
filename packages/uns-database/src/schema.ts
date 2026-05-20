import { z } from "zod";
import { hostValueSchema, secretValueSchema } from "./placeholders.js";

const positiveInt = z.number().int().positive();
const sqlDirSchema = z.string().min(1).optional();

const sslModeSchema = z.union([
  z.boolean(),
  z.object({
    rejectUnauthorized: z.boolean().default(true),
    ca: z.string().optional(),
    cert: z.string().optional(),
    key: z.string().optional(),
    servername: z.string().optional(),
  }).strict(),
]);

export const postgresDatabaseSchema = z.object({
  dialect: z.literal("pg"),
  host: hostValueSchema,
  port: positiveInt.default(5432),
  database: z.string().min(1),
  user: z.string().min(1),
  password: secretValueSchema.optional(),
  usePool: z.boolean().default(true),
  ssl: sslModeSchema.optional(),
  sqlDir: sqlDirSchema,
  applicationName: z.string().min(1).optional(),
  statementTimeoutMs: z.number().int().nonnegative().optional(),
  connectionTimeoutMs: z.number().int().nonnegative().optional(),
  idleTimeoutMs: z.number().int().nonnegative().optional(),
  maxPoolSize: positiveInt.optional(),
  minPoolSize: z.number().int().nonnegative().optional(),
}).strict();

export const sqliteDatabaseSchema = z.object({
  dialect: z.literal("sqlite"),
  filename: z.string().min(1),
  sqlDir: sqlDirSchema,
  readonly: z.boolean().optional(),
  fileMustExist: z.boolean().optional(),
  timeoutMs: z.number().int().nonnegative().optional(),
}).strict();

const oracleDatabaseBaseSchema = z.object({
  dialect: z.literal("oracle"),
  user: z.string().min(1),
  password: secretValueSchema.optional(),
  usePool: z.boolean().default(true),
  connectString: z.string().min(1).optional(),
  host: hostValueSchema.optional(),
  port: positiveInt.default(1521),
  serviceName: z.string().min(1).optional(),
  sid: z.string().min(1).optional(),
  sqlDir: sqlDirSchema,
  poolMin: z.number().int().nonnegative().optional(),
  poolMax: positiveInt.optional(),
  poolIncrement: positiveInt.optional(),
  stmtCacheSize: positiveInt.optional(),
}).strict();

export const oracleDatabaseSchema = oracleDatabaseBaseSchema.superRefine((value: z.infer<typeof oracleDatabaseBaseSchema>, ctx) => {
  if (!value.connectString && !value.host) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "oracle connection requires either connectString or host",
      path: ["connectString"],
    });
  }

  if (!value.connectString && !value.serviceName && !value.sid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "oracle connection requires serviceName or sid when connectString is omitted",
      path: ["serviceName"],
    });
  }
});

export const databaseConnectionSchema = z.union([
  postgresDatabaseSchema,
  sqliteDatabaseSchema,
  oracleDatabaseSchema,
]);

export const databasesConfigSchema = z.record(
  z.string().min(1),
  databaseConnectionSchema
);

export const databaseProjectExtrasSchema = z.object({
  databases: databasesConfigSchema,
});

export type PostgresDatabaseConfig = z.infer<typeof postgresDatabaseSchema>;
export type SqliteDatabaseConfig = z.infer<typeof sqliteDatabaseSchema>;
export type OracleDatabaseConfig = z.infer<typeof oracleDatabaseSchema>;
export type DatabaseConnectionConfig = z.infer<typeof databaseConnectionSchema>;
export type DatabasesConfig = z.infer<typeof databasesConfigSchema>;
export type DatabaseProjectExtras = z.infer<typeof databaseProjectExtrasSchema>;
