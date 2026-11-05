import { afterEach, describe, expect, it, vi } from "vitest";
import { closeDatabase, getDatabase, getMongoClient } from "../src/config/database.js";
import { parseMongoEnv } from "../src/config/env.js";

afterEach(async () => { await closeDatabase(); vi.unstubAllEnvs(); });

describe("MongoDB configuration and connection ownership", () => {
  it("reuses one client without connecting during module import or configuration", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017");
    vi.stubEnv("MONGODB_DB_NAME", "bookbar");
    expect(getMongoClient()).toBe(getMongoClient());
    expect(getDatabase().databaseName).toBe("bookbar");
    expect(getMongoClient().options.maxPoolSize).toBe(10);
  });

  it("allows a fresh client after shutdown", async () => {
    vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017");
    const previous = getMongoClient();
    await closeDatabase();
    expect(getMongoClient()).not.toBe(previous);
  });

  it("rejects missing configuration and invalid database names without echoing values", () => {
    expect(() => parseMongoEnv({})).toThrow("Check: MONGODB_URI");
    expect(() => parseMongoEnv({ MONGODB_URI: "private-invalid-value" })).toThrow("Check: MONGODB_URI");
    expect(() => parseMongoEnv({ MONGODB_URI: "mongodb://127.0.0.1:27017", MONGODB_DB_NAME: "invalid/name" })).toThrow("Check: MONGODB_DB_NAME");
  });

  it("sanitizes driver constructor failures", () => {
    vi.stubEnv("MONGODB_URI", "mongodb:///");
    expect(() => getMongoClient()).toThrow("Invalid MongoDB connection settings. Check your private environment file.");
  });
});
