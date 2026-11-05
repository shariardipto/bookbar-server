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
