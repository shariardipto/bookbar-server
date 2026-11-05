import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp({ CLIENT_ORIGIN: "http://localhost:3000" });

describe("P00 HTTP baseline", () => {
  it("reports the catalog as unavailable instead of claiming fake book data", async () => {
    const response = await request(app).get("/books");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, error: { code: "NOT_IMPLEMENTED" } });
    expect(response.body).not.toHaveProperty("data");
  });

  it("uses a structured 404 and does not expose an extra health endpoint", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns only the configured CORS origin and disables the Express signature", async () => {
    const response = await request(app).get("/books").set("Origin", "https://untrusted.example");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers).not.toHaveProperty("x-powered-by");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects malformed JSON without echoing request content or a stack", async () => {
    const response = await request(app)
      .post("/books")
      .set("Content-Type", "application/json")
      .send('{"privateValue":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.text).not.toContain("privateValue");
    expect(response.body).not.toHaveProperty("stack");
  });

  it("caps incoming JSON bodies", async () => {
    const response = await request(app).post("/books").send({ content: "x".repeat(110_000) });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
