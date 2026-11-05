import dotenv from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { parseEnv, parseJwtEnv } from "../src/config/env.js";
import {
  getDatabase,
  getMongoClient,
  closeDatabase,
} from "../src/config/database.js";
import { getLibraryCollections } from "../src/config/collections.js";

// Opt-in real integration check. Next must already be running on localhost.
// Credentials, cookies, tokens and raw responses are never logged or persisted.
dotenv.config({ quiet: true });
let stage = "configuration";
const checks: string[] = [];
const allowedEmails: string[] = [];
const bookIds: ObjectId[] = [];
const loanIds = [new ObjectId(), new ObjectId()];
const run = randomUUID();
const description = `Temporary P04 acceptance probe ${run}`;
let failed = false;

function ensure(condition: unknown) {
  if (!condition) throw new Error("Acceptance condition failed");
}

try {
  const config = { ...parseEnv(process.env), ...parseJwtEnv(process.env) };
  const authOrigin = config.BETTER_AUTH_ISSUER;
  ensure(["localhost", "127.0.0.1"].includes(new URL(authOrigin).hostname));
  const db = getDatabase();
  const app = createApp(config); // Real repositories and remote Next JWKS; no dependency stubs.

  async function auth(path: string, body?: unknown, cookie = "") {
    return fetch(`${authOrigin}/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Origin: authOrigin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
      redirect: "manual",
    });
  }

  async function member(index: number) {
    stage = `real auth registration ${index}`;
    const email = `p04-${run}-${index}@example.invalid`;
    ensure(!(await db.collection("user").findOne({ email })));
    allowedEmails.push(email);
    const password =
      index === 1
        ? `Aa${randomBytes(2).toString("hex")}`
        : `Aa${randomBytes(16).toString("hex")}`;
    const signup = await auth("sign-up/email", {
      name: `P04 Reader ${index}`,
      email,
      image: "https://example.invalid/p04-avatar.png",
      password,
    });
    ensure(signup.ok);
    const created = (await signup.json()) as {
      user?: { id?: string; email?: string };
      token?: unknown;
    };
    ensure(
      created.user?.email === email &&
        ObjectId.isValid(created.user?.id ?? "") &&
        !created.token,
    );
    const signupCookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    ensure(
      (await (await auth("get-session", undefined, signupCookie)).json()) ===
        null,
    );
    if (index === 1) {
      stage = "real wrong-password rejection";
      const rejected = await auth("sign-in/email", {
        email,
        password: `Wrong${randomUUID()}`,
      });
      ensure(rejected.status === 401);
    }
    stage = `real auth login and token ${index}`;
    const login = await auth("sign-in/email", { email, password });
    ensure(login.ok);
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    ensure(cookie.length > 0);
    const persisted = (await (
      await auth("get-session", undefined, cookie)
    ).json()) as { user?: { id?: string } };
    ensure(persisted.user?.id === created.user?.id);
    const issued = await auth("token", undefined, cookie);
    const token = (await issued.json()) as { token?: string };
    ensure(
      issued.ok &&
        typeof token.token === "string" &&
        token.token.split(".").length === 3,
    );
    return { id: created.user!.id!, email, token: token.token!, cookie };
  }

  const owner = await member(1);
  const other = await member(2);
  checks.push(
    "real six-character registration without auto-login",
    "real wrong-password rejection, persisted email sessions and JWT issuance",
  );
  stage = "anonymous and invalid-token authorization";
  ensure((await request(app).post("/books").send({})).status === 401);
  ensure((await request(app).get("/books?mine=true")).status === 401);
  ensure((await request(app).get(`/books/${new ObjectId()}`)).status === 401);
  const parts = owner.token.split(".");
  parts[2] = (parts[2]!.startsWith("A") ? "B" : "A") + parts[2]!.slice(1);
  ensure(
    (
      await request(app)
        .post("/books")
        .auth(parts.join("."), { type: "bearer" })
        .send({})
    ).status === 401,
  );
  checks.push(
    "anonymous/private/mine guards and tampered real-token rejection",
  );

  stage = "real book creation and JWT-derived ownership";
  const input = {
    title: `P04 probe ${run}`,
    author: "BookBar verification",
    category: "Others",
    imageUrl: "https://example.invalid/p04-cover.png",
    description,
    totalCopies: 3,
  };
  for (const mismatch of [
    { BETTER_AUTH_ISSUER: "https://other-issuer.invalid" },
    { BETTER_AUTH_AUDIENCE: "another-service" },
  ]) {
    const mismatched = createApp({ ...config, ...mismatch });
    ensure(
      (
        await request(mismatched)
          .post("/books")
          .auth(owner.token, { type: "bearer" })
          .send(input)
      ).status === 401,
    );
  }
  ensure(
    (
      await request(app)
        .post("/books")
        .auth(owner.token, { type: "bearer" })
        .send({ ...input, addedByUserId: other.id })
    ).status === 400,
  );
  const created = await request(app)
    .post("/books")
    .auth(owner.token, { type: "bearer" })
    .send(input);
  ensure(created.status === 201 && ObjectId.isValid(created.body.data?._id));
  const id = ObjectId.createFromHexString(created.body.data._id as string);
  bookIds.push(id);
  ensure(
    created.body.data.addedByUserId === owner.id &&
      created.body.data.addedByEmail === owner.email &&
      created.body.data.copies === 3 &&
      created.body.data.totalCopies === 3,
  );
  ensure(typeof created.body.data.createdAt === "string");
  checks.push(
    "real book creation with server timestamps, stock and verified owner",
  );
  checks.push(
    "real Next JWT rejected by APIs expecting a different issuer or audience",
  );

  stage = "public listing, latest limit and member filtering";
  const listing = await request(app).get("/books?sort=latest&limit=6");
  ensure(
    listing.status === 200 &&
      Array.isArray(listing.body.data) &&
      listing.body.data.length <= 6,
  );
  ensure(
    listing.body.data.some(
      (item: { _id: string }) => item._id === id.toHexString(),
    ),
  );
  ensure(
    listing.body.data.every(
      (item: Record<string, unknown>) =>
        !("addedByEmail" in item) && !("description" in item),
    ),
  );
  const mine = await request(app)
    .get("/books?mine=true")
    .auth(owner.token, { type: "bearer" });
  const theirs = await request(app)
    .get("/books?mine=true")
    .auth(other.token, { type: "bearer" });
  ensure(
    mine.status === 200 &&
      mine.body.data.length === 1 &&
      theirs.status === 200 &&
      theirs.body.data.length === 0,
  );
  checks.push(
    "public summary projection, latest limit and verified-user filtering",
  );

  stage = "details, malformed IDs and missing records";
  ensure(
    (
      await request(app)
        .get(`/books/${id}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 200,
  );
  ensure(
    (await request(app).get("/books/bad").auth(owner.token, { type: "bearer" }))
      .status === 400,
  );
  ensure(
    (
      await request(app)
        .get(`/books/${new ObjectId()}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 404,
  );
  stage = "real owner edit/delete authorization";
  ensure(
    (
      await request(app)
        .patch(`/books/${id}`)
        .auth(other.token, { type: "bearer" })
        .send({ title: "Forbidden" })
    ).status === 403,
  );
  ensure(
    (
      await request(app)
        .delete(`/books/${id}`)
        .auth(other.token, { type: "bearer" })
    ).status === 403,
  );
  const changed = await request(app)
    .patch(`/books/${id}`)
    .auth(owner.token, { type: "bearer" })
    .send({ title: "Updated P04 probe", totalCopies: 4 });
  ensure(
    changed.status === 200 &&
      changed.body.data.copies === 4 &&
      changed.body.data.addedByUserId === owner.id,
  );
  checks.push("private details and real 400/403/404 owner CRUD flows");

  stage = "transactional fixture setup for active-loan conflicts";
  const { books, borrows } = getLibraryCollections(db);
  const now = new Date();
  await getMongoClient().withSession((session) =>
    session.withTransaction(async () => {
      await books.updateOne(
        { _id: id, addedByUserId: owner.id },
        { $inc: { copies: -2 } },
        { session },
      );
      await borrows.insertMany(
        [owner, other].map((person, index) => ({
          _id: loanIds[index]!,
          bookId: id,
          bookTitle: "Updated P04 probe",
          bookImage: input.imageUrl,
          userId: person.id,
          userEmail: person.email,
          borrowDate: now,
          returnDate: new Date(now.getTime() + 7 * 86_400_000),
        })),
        { session },
      );
    }),
  );
  stage = "active-loan count edits and deletion safety";
  ensure(
    (
      await request(app)
        .patch(`/books/${id}`)
        .auth(owner.token, { type: "bearer" })
        .send({ totalCopies: 1 })
    ).status === 409,
  );
  ensure(
    (
      await request(app)
        .delete(`/books/${id}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 409,
  );
  const increased = await request(app)
    .patch(`/books/${id}`)
    .auth(owner.token, { type: "bearer" })
    .send({ totalCopies: 5 });
  ensure(increased.status === 200 && increased.body.data.copies === 3);
  checks.push(
    "active-loan deletion block and safe transactional total-copy edits",
  );

  stage = "borrow read, duplicate and return contracts";
  const loans = await request(app)
    .get("/borrows")
    .auth(owner.token, { type: "bearer" });
  ensure(
    loans.status === 200 &&
      loans.body.data.length === 1 &&
      loans.body.data[0].userId === owner.id,
  );
  ensure(
    (
      await request(app)
        .post("/borrows")
        .auth(owner.token, { type: "bearer" })
        .send({ bookId: id.toHexString() })
    ).status === 409,
  );
  ensure(
    (
      await request(app)
        .post("/borrows")
        .auth(owner.token, { type: "bearer" })
        .send({ bookId: new ObjectId().toHexString() })
    ).status === 404,
  );
  ensure(
    (
      await request(app)
        .delete(`/borrows/${loanIds[0]}`)
        .auth(other.token, { type: "bearer" })
    ).status === 403,
  );
  ensure(
    (
      await request(app)
        .delete(`/borrows/${loanIds[0]}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 200,
  );
  ensure(
    (
      await request(app)
        .delete(`/borrows/${new ObjectId()}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 404,
  );
  ensure(
    (await books.findOne({ _id: id }))?.copies === 4 &&
      (await borrows.countDocuments({ _id: { $in: loanIds } })) === 1,
  );
  checks.push(
    "member-only borrow reads, duplicate rejection, borrower authorization and transactional return",
  );

  stage = "real owner deletion and logout";
  await getMongoClient().withSession((session) =>
    session.withTransaction(async () => {
      await borrows.deleteMany(
        { _id: { $in: loanIds }, bookId: id },
        { session },
      );
      await books.updateOne(
        { _id: id, addedByUserId: owner.id },
        { $set: { copies: 5 } },
        { session },
      );
    }),
  );
  ensure(
    (
      await request(app)
        .delete(`/books/${id}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 200,
  );
  ensure(
    (
      await request(app)
        .delete(`/books/${id}`)
        .auth(owner.token, { type: "bearer" })
    ).status === 404,
  );
  const logout = await auth("sign-out", {}, owner.cookie);
  ensure(
    logout.ok &&
      (await (await auth("get-session", undefined, owner.cookie)).json()) ===
        null,
  );
  checks.push("owner deletion and real cookie-session logout");
} catch {
  console.error(
    `FAIL: live API acceptance at ${stage}. No raw response or credentials were printed.`,
  );
  failed = true;
} finally {
  try {
    const db = getDatabase();
    const members = await db
      .collection("user")
      .find({ email: { $in: allowedEmails } }, { projection: { _id: 1 } })
      .toArray();
    const memberIds = members.flatMap((person) => [
      person._id,
      person._id.toString(),
    ]);
    // Restrict cleanup to this run's unique probe accounts/records, even on failure.
    await db.collection("borrows").deleteMany({ _id: { $in: loanIds } });
    await db
      .collection("books")
      .deleteMany({ description, addedByUserId: { $in: memberIds } });
    await db.collection("session").deleteMany({ userId: { $in: memberIds } });
    await db.collection("account").deleteMany({ userId: { $in: memberIds } });
    await db.collection("user").deleteMany({
      _id: { $in: members.map((person) => person._id) },
      email: { $in: allowedEmails },
    });
    ensure(
      (await db
        .collection("books")
        .countDocuments({ _id: { $in: bookIds } })) === 0,
    );
    ensure(
      (await db
        .collection("borrows")
        .countDocuments({ _id: { $in: loanIds } })) === 0,
    );
    ensure(
      (await db
        .collection("user")
        .countDocuments({ email: { $in: allowedEmails } })) === 0,
    );
    ensure(
      (await db
        .collection("session")
        .countDocuments({ userId: { $in: memberIds } })) === 0,
    );
    ensure(
      (await db
        .collection("account")
        .countDocuments({ userId: { $in: memberIds } })) === 0,
    );
    checks.push("probe books, loans, users, accounts and sessions removed");
  } catch {
    console.error(
      "FAIL: probe cleanup could not be verified. Review this run before retrying.",
    );
    failed = true;
  }
  await closeDatabase().catch(() => {
    failed = true;
  });
}
if (failed) process.exitCode = 1;
else for (const check of checks) console.log(`PASS: ${check}`);
