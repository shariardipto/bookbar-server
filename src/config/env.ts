import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z
    .url()
    .refine((value) => {
      const url = URL.parse(value);
      return url !== null && ["http:", "https:"].includes(url.protocol) && value === url.origin;
    }, "Use an HTTP(S) origin without a trailing slash or path")
    .default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): ServerEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid server configuration. Check: ${fields.join(", ")}.`);
  }

  return result.data;
}

const mongoEnvSchema = z.object({
  MONGODB_URI: z.string().trim().regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  MONGODB_DB_NAME: z.string().regex(/^[a-zA-Z0-9_-]{1,63}$/).default("bookbar"),
});

export function parseMongoEnv(input: Record<string, unknown>) {
  const result = mongoEnvSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid MongoDB configuration. Check: ${fields.join(", ")}.`);
  }
  return result.data;
}
