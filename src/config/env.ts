import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_ORIGIN: z
    .url()
    .refine((value) => {
      const url = URL.parse(value);
      return (
        url !== null &&
        ["http:", "https:"].includes(url.protocol) &&
        value === url.origin
      );
    }, "Use an HTTP(S) origin without a trailing slash or path")
    .default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): ServerEnv {
  const result = envSchema.safeParse(input);

  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(
      `Invalid server configuration. Check: ${fields.join(", ")}.`,
    );
  }

  return result.data;
}

const mongoEnvSchema = z.object({
  MONGODB_URI: z
    .string()
    .trim()
    .regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  MONGODB_DB_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,63}$/)
    .default("bookbar"),
});

export function parseMongoEnv(input: Record<string, unknown>) {
  const result = mongoEnvSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(
      `Invalid MongoDB configuration. Check: ${fields.join(", ")}.`,
    );
  }
  return result.data;
}

const trustedUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.hash &&
    !url.search &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)))
  );
}, "Use HTTPS, or HTTP on localhost for development");

const jwtEnvSchema = z.object({
  BETTER_AUTH_JWKS_URL: trustedUrl,
  BETTER_AUTH_ISSUER: trustedUrl.refine(
    (value) => value === new URL(value).origin,
  ),
  BETTER_AUTH_AUDIENCE: z.string().trim().min(1),
});
export type JwtEnv = z.infer<typeof jwtEnvSchema>;

export function parseJwtEnv(input: Record<string, unknown>): JwtEnv {
  const defaults =
    input.NODE_ENV === "production"
      ? {}
      : {
          BETTER_AUTH_JWKS_URL: "http://localhost:3000/api/auth/jwks",
          BETTER_AUTH_ISSUER: "http://localhost:3000",
          BETTER_AUTH_AUDIENCE: "http://localhost:3000",
        };
  const result = jwtEnvSchema.safeParse({ ...defaults, ...input });
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid JWT configuration. Check: ${fields.join(", ")}.`);
  }
  return result.data;
}
