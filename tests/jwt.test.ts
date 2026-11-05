import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTPayload,
} from "jose";
import { createTokenVerifier } from "../src/lib/jwt.js";
import { parseJwtEnv } from "../src/config/env.js";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let verify: ReturnType<typeof createTokenVerifier>;
const config = parseJwtEnv({});
const claims: JWTPayload = {
  sub: "member-a",
  email: "reader@example.com",
  name: "A Reader",
  iss: config.BETTER_AUTH_ISSUER,
  aud: config.BETTER_AUTH_AUDIENCE,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 600,
};
const sign = (payload: JWTPayload) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", kid: "unit-key" })
    .sign(keys.privateKey);
beforeAll(async () => {
  keys = await generateKeyPair("EdDSA");
  const key = {
    ...(await exportJWK(keys.publicKey)),
    kid: "unit-key",
    alg: "EdDSA",
    use: "sig",
  };
  verify = createTokenVerifier(config, createLocalJWKSet({ keys: [key] }));
});

describe("JWT signature and claims", () => {
  it("accepts a signed token and derives its stable user identity", async () => {
    expect(await verify(await sign(claims))).toEqual({
      id: "member-a",
      email: "reader@example.com",
      name: "A Reader",
    });
  });
  it.each([
    ["expired", { exp: Math.floor(Date.now() / 1000) - 1 }],
    ["wrong issuer", { iss: "https://wrong.invalid" }],
    ["wrong audience", { aud: "other-service" }],
    ["no expiration", { exp: undefined }],
    ["no subject", { sub: undefined }],
    ["blank subject", { sub: " " }],
    ["no issued-at", { iat: undefined }],
    ["no email", { email: undefined }],
    ["bad email", { email: "invalid" }],
    ["no display name", { name: undefined }],
  ] as [string, JWTPayload][])("rejects %s", async (_name, override) => {
    await expect(
      verify(await sign({ ...claims, ...override })),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_TOKEN" });
  });
  it("rejects an altered payload and a signature from another key", async () => {
    const token = await sign(claims);
    const parts = token.split(".");
    parts[1] = Buffer.from(
      JSON.stringify({ ...claims, sub: "somebody-else" }),
    ).toString("base64url");
    await expect(verify(parts.join("."))).rejects.toMatchObject({
      status: 401,
    });
    const other = await generateKeyPair("EdDSA");
    const forged = await new SignJWT(claims)
      .setProtectedHeader({ alg: "EdDSA", kid: "unit-key" })
      .sign(other.privateKey);
    await expect(verify(forged)).rejects.toMatchObject({ status: 401 });
  });
  it("rejects another algorithm, unknown keys and malformed compact tokens", async () => {
    const hmac = await new SignJWT(claims)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new Uint8Array(32));
    const unknown = await new SignJWT(claims)
      .setProtectedHeader({ alg: "EdDSA", kid: "unknown" })
      .sign(keys.privateKey);
    for (const token of [hmac, unknown, "not-a-token"])
      await expect(verify(token)).rejects.toMatchObject({ status: 401 });
  });
  it("reports unavailable key infrastructure without exposing its error", async () => {
    const unavailable = createTokenVerifier(config, async () => {
      throw new TypeError("private infrastructure details");
    });
    await expect(unavailable(await sign(claims))).rejects.toMatchObject({
      status: 503,
      message: "Sign-in verification is temporarily unavailable.",
    });
  });
});

describe("trusted verifier configuration", () => {
  it("requires explicit provider settings in production", () => {
    expect(() => parseJwtEnv({ NODE_ENV: "production" })).toThrow(
      "BETTER_AUTH_JWKS_URL",
    );
  });
  it.each([
    "http://remote.invalid/jwks",
    "file:///keys.json",
    "https://user:secret@example.com/jwks",
  ])("rejects unsafe key URL %s", (url) => {
    expect(() => parseJwtEnv({ BETTER_AUTH_JWKS_URL: url })).toThrow(
      "Check: BETTER_AUTH_JWKS_URL",
    );
  });
});
