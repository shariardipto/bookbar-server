import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

describe("server startup configuration", () => {
  it("boots with local defaults without provider credentials", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      PORT: 5000,
      CLIENT_ORIGIN: "http://localhost:3000",
    });
  });

  it.each(["0", "65536", "not-a-port"])("rejects invalid port %s", (port) => {
    expect(() => parseEnv({ PORT: port })).toThrow("Check: PORT");
  });

  it.each(["*", "https://example.com/path", "ftp://example.com", "https://example.com/"])(
    "requires a single HTTP(S) client origin: %s",
    (origin) => {
      expect(() => parseEnv({ CLIENT_ORIGIN: origin })).toThrow("Check: CLIENT_ORIGIN");
    },
  );

  it("accepts a production origin and a numeric port from environment strings", () => {
    expect(parseEnv({ NODE_ENV: "production", PORT: "8080", CLIENT_ORIGIN: "https://bookbar.example" })).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
      CLIENT_ORIGIN: "https://bookbar.example",
    });
  });

  it("reports only configuration field names, not invalid values", () => {
    expect(() => parseEnv({ CLIENT_ORIGIN: "private-invalid-value" })).toThrow(
      "Invalid server configuration. Check: CLIENT_ORIGIN.",
    );
  });
});
