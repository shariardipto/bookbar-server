import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { parseJwtEnv } from "../src/config/env.js";
import { ApiError } from "../src/lib/api-error.js";

const id = new ObjectId().toHexString();
const member = { id: "member-a", name: "Reader", email: "reader@example.com" };
const books = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
};
const borrows = { list: vi.fn(), create: vi.fn(), remove: vi.fn() };
const verifyToken = vi.fn(async (token: string) => {
  if (token !== "valid.test.token")
    throw new ApiError(
      401,
      "INVALID_TOKEN",
      "Your sign-in token is invalid or expired.",
    );
  return member;
});
const app = createApp(
  { CLIENT_ORIGIN: "http://localhost:3000", ...parseJwtEnv({}) },
  { books, borrows, verifyToken },
);
const bookInput = {
  title: "A Book",
  author: "An Author",
  category: "Fiction",
  imageUrl: "https://example.com/cover.jpg",
  description: "A test book.",
  totalCopies: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  books.list.mockResolvedValue([]);
  books.get.mockResolvedValue({ _id: id });
  books.create.mockResolvedValue({ _id: id });
  books.patch.mockResolvedValue({ _id: id });
  books.remove.mockResolvedValue({ _id: id });
  borrows.list.mockResolvedValue([]);
  borrows.create.mockResolvedValue({ _id: id, bookId: id, userId: member.id });
  borrows.remove.mockResolvedValue({ _id: id, bookId: id });
});

describe("eight-route HTTP contracts (repository and token-verifier stubs)", () => {
  it.each([
    ["get", "/books?mine=true"],
    ["get", `/books/${id}`],
    ["post", "/books"],
    ["patch", `/books/${id}`],
    ["delete", `/books/${id}`],
    ["get", "/borrows"],
    ["post", "/borrows"],
    ["delete", `/borrows/${id}`],
  ] as const)("blocks anonymous %s %s", async (method, url) => {
    const response = await request(app)[method](url);
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(books.create).not.toHaveBeenCalled();
    expect(borrows.create).not.toHaveBeenCalled();
  });
  it("keeps the public listing public and filters mine by the verified ID", async () => {
    expect((await request(app).get("/books?sort=latest&limit=6")).status).toBe(
      200,
    );
    expect(verifyToken).not.toHaveBeenCalled();
    const mine = await request(app)
      .get("/books?mine=true")
      .auth("valid.test.token", { type: "bearer" });
    expect(mine.status).toBe(200);
    expect(mine.headers["cache-control"]).toContain("no-store");
    expect(books.list).toHaveBeenLastCalledWith(
      { mine: true, sort: "latest" },
      member,
    );
  });
  it.each(["Basic abc", "Bearer bad", "Bearer bad.test.token"])(
    "rejects unsupported or invalid credentials",
    async (authorization) => {
      const result = await request(app)
        .post("/books")
        .set("Authorization", authorization)
        .send(bookInput);
      expect(result.status).toBe(401);
      expect(books.create).not.toHaveBeenCalled();
    },
  );
  it("does not use a session cookie as an API token", async () => {
    expect(
      (
        await request(app)
          .get("/borrows")
          .set("Cookie", "better-auth.session_token=test-only")
      ).status,
    ).toBe(401);
  });
  it("passes validated book input and verified owner identity to creation", async () => {
    const response = await request(app)
      .post("/books")
      .auth("valid.test.token", { type: "bearer" })
      .send(bookInput);
    expect(response.status).toBe(201);
    expect(books.create).toHaveBeenCalledWith(bookInput, member);
  });
  it("rejects caller-owned fields before the repository", async () => {
    const response = await request(app)
      .post("/books")
      .auth("valid.test.token", { type: "bearer" })
      .send({ ...bookInput, addedByUserId: "victim", copies: 50 });
    expect(response.status).toBe(400);
    expect(books.create).not.toHaveBeenCalled();
  });
  it.each([
    "/books?email=victim@example.com",
    "/books?mine[]=true",
    "/books?limit=0",
    "/books?limit=101",
    "/books?limit[]=6",
    "/books?sort=unknown",
  ])("rejects invalid query %s", async (url) => {
    expect((await request(app).get(url)).status).toBe(400);
  });
  it.each([
    ["get", "/books/bad"],
    ["patch", "/books/bad"],
    ["delete", "/books/bad"],
    ["delete", "/borrows/bad"],
  ] as const)("returns 400 for malformed IDs on %s", async (method, url) => {
    const operation = request(app)[method](url);
    const response = await operation
      .auth("valid.test.token", { type: "bearer" })
      .send({ title: "Updated" });
    expect(response.status).toBe(400);
  });
  it("preserves owner/not-found/conflict errors", async () => {
    for (const status of [403, 404, 409]) {
      books.patch.mockRejectedValueOnce(
        new ApiError(status, "TEST_CONFLICT", "Request cannot be completed."),
      );
      expect(
        (
          await request(app)
            .patch(`/books/${id}`)
            .auth("valid.test.token", { type: "bearer" })
            .send({ title: "Updated" })
        ).status,
      ).toBe(status);
    }
  });
  it("wires details and deletion on the assigned routes", async () => {
    expect(
      (
        await request(app)
          .get(`/books/${id}`)
          .auth("valid.test.token", { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/books/${id}`)
          .auth("valid.test.token", { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(books.remove).toHaveBeenCalledWith(new ObjectId(id), member);
  });
  it("lists, creates and returns loans using the verified member identity", async () => {
    expect(
      (
        await request(app)
          .get("/borrows")
          .auth("valid.test.token", { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(borrows.list).toHaveBeenCalledWith(member);
    expect(
      (
        await request(app)
          .post("/borrows")
          .auth("valid.test.token", { type: "bearer" })
          .send({ bookId: id })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .delete(`/borrows/${id}`)
          .auth("valid.test.token", { type: "bearer" })
      ).status,
    ).toBe(200);
    expect(borrows.create).toHaveBeenCalledWith(new ObjectId(id), member);
    expect(borrows.remove).toHaveBeenCalledWith(new ObjectId(id), member);
    expect(
      (
        await request(app)
          .post("/borrows")
          .auth("valid.test.token", { type: "bearer" })
          .send({ bookId: id, userId: "victim" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get("/borrows?email=victim@example.com")
          .auth("valid.test.token", { type: "bearer" })
      ).status,
    ).toBe(400);
  });
  it("does not add convenience, upload or health routes", async () => {
    for (const path of [
      "/health",
      "/my-books",
      "/latest-books",
      "/upload",
      "/return-book",
    ])
      expect((await request(app).get(path)).status).toBe(404);
  });
  it("redacts unexpected repository failures", async () => {
    books.list.mockRejectedValueOnce(new Error("private database details"));
    const result = await request(app).get("/books");
    expect(result.status).toBe(500);
    expect(result.body.error.code).toBe("INTERNAL_ERROR");
    expect(result.text).not.toContain("private database details");
  });
  it("allows the configured origin to preflight bearer requests", async () => {
    const result = await request(app)
      .options("/books")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(result.status).toBe(204);
    expect(result.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
  });
});
