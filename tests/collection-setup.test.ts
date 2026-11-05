import { MongoServerError, type Db } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { bookValidator, borrowValidator, ensureCollectionSchemas } from "../src/config/collection-schemas.js";

describe("safe repeatable collection setup", () => {
  it("checks existing matching collections without admin-only mutations", async () => {
    const command = vi.fn(() => { throw new Error("Administrative commands must not be needed"); });
    const db = {
      createCollection: vi.fn().mockRejectedValue(new MongoServerError({ message: "Already exists", code: 48 })),
      listCollections: ({ name }: { name: string }) => ({ next: async () => ({ options: {
        validator: name === "books" ? bookValidator : borrowValidator, validationLevel: "strict", validationAction: "error",
      } }) }),
      command,
    } as unknown as Db;
    await expect(ensureCollectionSchemas(db)).resolves.toBeUndefined();
    expect(command).not.toHaveBeenCalled();
  });

  it("requires review instead of replacing an existing different validator", async () => {
    const db = {
      createCollection: vi.fn().mockRejectedValue(new MongoServerError({ message: "Already exists", code: 48 })),
      listCollections: () => ({ next: async () => ({ options: {} }) }),
    } as unknown as Db;
    await expect(ensureCollectionSchemas(db)).rejects.toMatchObject({ code: "SCHEMA_REVIEW_REQUIRED" });
  });

  it("does not hide authorization or connectivity failures as existing collections", async () => {
    const error = new MongoServerError({ message: "Not authorized", code: 13 });
    const db = { createCollection: vi.fn().mockRejectedValue(error) } as unknown as Db;
    await expect(ensureCollectionSchemas(db)).rejects.toBe(error);
  });
});
