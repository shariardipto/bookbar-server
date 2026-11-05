import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";
import type { JwtEnv } from "../config/env.js";
import { ApiError } from "./api-error.js";

const identitySchema = z.object({
  sub: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => value === value.trim()),
  email: z.email().max(254),
  name: z.string().trim().min(1).max(200),
});
export type MemberIdentity = { id: string; email: string; name: string };
export type TokenVerifier = (token: string) => Promise<MemberIdentity>;

export function createTokenVerifier(
  config: JwtEnv,
  resolveKey?: JWTVerifyGetKey,
): TokenVerifier {
  // One resolver per app instance caches trusted public keys across requests.
  // A token's jku/x5u header never chooses the verification key source.
  const jwks =
    resolveKey ??
    createRemoteJWKSet(new URL(config.BETTER_AUTH_JWKS_URL), {
      timeoutDuration: 5000,
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ["EdDSA"],
        issuer: config.BETTER_AUTH_ISSUER,
        audience: config.BETTER_AUTH_AUDIENCE,
        requiredClaims: ["sub", "exp", "iat", "iss", "aud"],
      });
      const result = identitySchema.safeParse(payload);
      if (!result.success)
        throw new ApiError(
          401,
          "INVALID_TOKEN",
          "Your sign-in token is invalid or expired.",
        );
      return {
        id: result.data.sub,
        email: result.data.email,
        name: result.data.name,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof errors.JOSEError &&
        !["ERR_JWKS_TIMEOUT", "ERR_JOSE_GENERIC"].includes(error.code)
      ) {
        throw new ApiError(
          401,
          "INVALID_TOKEN",
          "Your sign-in token is invalid or expired.",
        );
      }
      throw new ApiError(
        503,
        "AUTH_UNAVAILABLE",
        "Sign-in verification is temporarily unavailable.",
      );
    }
  };
}
