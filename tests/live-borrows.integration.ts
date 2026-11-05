import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { MongoServerError, ObjectId, type Collection, type Db } from "mongodb";
import request from "supertest";
import { createApp } from "../src/app.js";
import { parseEnv, parseJwtEnv } from "../src/config/env.js";
import {
  getDatabase,
  getMongoClient,
  closeDatabase,
} from "../src/config/database.js";
import { getLibraryCollections } from "../src/config/collections.js";
import { createTokenVerifier } from "../src/lib/jwt.js";
import { createBorrowService } from "../src/services/borrows.js";

// Real Atlas inventory/HTTP integration with signed, verified test identities.
// The key resolver is local; real Next/JWKS integration was verified in P04.
// Fault probes send invalid operations to MongoDB through test-only wrappers.
// Production contains no failure hooks, extra routes or authentication bypass.
dotenv.config({ quiet: true });
const run = randomUUID();
const ownerId = `p05:${run}:a`,
  otherId = `p05:${run}:b`;
const description = `Temporary P05 acceptance probe ${run}`;
const ids: ObjectId[] = [];
const checks: string[] = [];
let stage = "configuration",
  failed = false;
function ensure(condition: unknown): asserts condition {
  if (!condition) throw new Error("Acceptance condition failed");
}

try {
  const db = getDatabase();
  const { books, borrows } = getLibraryCollections(db);
  const config = { ...parseEnv(process.env), ...parseJwtEnv(process.env) };
  const pair = await generateKeyPair("EdDSA");
  const resolver = createLocalJWKSet({
    keys: [
      {
        ...(await exportJWK(pair.publicKey)),
        alg: "EdDSA",
        kid: run,
        use: "sig",
      },
    ],
  });
  const verifyToken = createTokenVerifier(config, resolver);
  const app = createApp(config, { verifyToken });
  const token = async (id: string) =>
    new SignJWT({
      email: "p05-probe@example.invalid",
      name: "P05 verification",
    })
      .setProtectedHeader({ alg: "EdDSA", kid: run })
      .setSubject(id)
      .setIssuer(config.BETTER_AUTH_ISSUER)
      .setAudience(config.BETTER_AUTH_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(pair.privateKey);
  const owner = await token(ownerId),
    other = await token(otherId);
  async function makeBook(totalCopies: number) {
    const result = await request(app)
      .post("/books")
      .auth(owner, { type: "bearer" })
      .send({
        title: "P05 inventory probe",
        author: "BookBar verification",
        category: "Others",
        imageUrl: "https://example.invalid/p05-cover.png",
        description,
        totalCopies,
      });
    ensure(result.status === 201 && ObjectId.isValid(result.body.data?._id));
    const id = ObjectId.createFromHexString(result.body.data._id as string);
    ids.push(id);
    return id;
  }
  const borrow = (id: ObjectId, jwt = owner, target = app) =>
    request(target)
      .post("/borrows")
      .auth(jwt, { type: "bearer" })
      .send({ bookId: id.toHexString() });
  const giveBack = (id: string, jwt = owner, target = app) =>
    request(target).delete(`/borrows/${id}`).auth(jwt, { type: "bearer" });
  async function stock(id: ObjectId, copies: number, active: number) {
    const book = await books.findOne({ _id: id });
    ensure(
      book &&
        book.copies === copies &&
        book.copies >= 0 &&
        book.copies <= book.totalCopies,
    );
    ensure(
      (await borrows.countDocuments({ bookId: id })) === active &&
        book.totalCopies - book.copies === active,
    );
  }
  function faultyApp(
    nameToFail: "books" | "borrows",
    operation: "insertOne" | "deleteOne" | "updateOne",
  ) {
    const faultyDb = {
      collection(name: string) {
        const collection = db.collection(name);
        if (name !== nameToFail) return collection;
        return new Proxy(collection, {
          get(target, property) {
            if (property === operation) {
              if (operation === "insertOne")
                return ((doc, options) =>
                  target.insertOne(
                    { ...doc, userEmail: "" },
                    options,
                  )) as Collection["insertOne"];
              if (operation === "deleteOne")
                return ((filter, options) =>
                  target.deleteOne(filter, {
                    ...options,
                    hint: "p05-nonexistent-index",
                  })) as Collection["deleteOne"];
              return ((filter, _update, options) =>
                target.updateOne(
                  filter,
                  { $set: { copies: -1 } },
                  options,
                )) as Collection["updateOne"];
            }
            const value: unknown = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    } as unknown as Db;
    return createApp(config, {
      verifyToken,
      borrows: createBorrowService(() => faultyDb, getMongoClient),
    });
  }

  stage = "required unique active-loan index";
  const index = (await borrows.listIndexes().toArray()).find(
    (item) => item.name === "one_active_borrow_per_member",
  );
  ensure(
    index?.unique === true && index.key.bookId === 1 && index.key.userId === 1,
  );
  stage = "borrow snapshot, due date and duplicate prevention";
  const first = await makeBook(2),
    before = Date.now();
  const loan = await borrow(first),
    loanId = loan.body.data?._id as string;
  ensure(loan.status === 201 && ObjectId.isValid(loanId));
  ensure(
    loan.body.data.bookId === first.toHexString() &&
      loan.body.data.userId === ownerId &&
      loan.body.data.bookTitle === "P05 inventory probe",
  );
  ensure(
    new Date(loan.body.data.borrowDate).getTime() >= before &&
      new Date(loan.body.data.borrowDate).getTime() <= Date.now(),
  );
  ensure(
    new Date(loan.body.data.returnDate).getTime() -
      new Date(loan.body.data.borrowDate).getTime() ===
      7 * 86_400_000,
  );
  await stock(first, 1, 1);
  const duplicate = await borrow(first);
  ensure(
    duplicate.status === 409 &&
      duplicate.body.error.code === "ALREADY_BORROWED",
  );
  await stock(first, 1, 1);
  checks.push(
    "atomic borrow, signed borrower/snapshot, seven-day due date and duplicate prevention",
  );

  stage = "borrower filtering and return authorization";
  const mine = await request(app)
    .get("/borrows")
    .auth(owner, { type: "bearer" });
  const theirs = await request(app)
    .get("/borrows")
    .auth(other, { type: "bearer" });
  ensure(
    mine.status === 200 &&
      mine.body.data.length === 1 &&
      mine.body.data[0].userId === ownerId &&
      theirs.status === 200 &&
      theirs.body.data.length === 0,
  );
  ensure((await giveBack(loanId, other)).status === 403);
  await stock(first, 1, 1);
  ensure((await giveBack(loanId)).status === 200);
  await stock(first, 2, 0);
  ensure((await giveBack(loanId)).status === 404);
  await stock(first, 2, 0);
  const again = await borrow(first);
  ensure(again.status === 201 && again.body.data._id !== loanId);
  ensure((await giveBack(again.body.data._id as string)).status === 200);
  await stock(first, 2, 0);
  checks.push(
    "member-only loans, foreign-return rejection, exactly-once return and reborrow",
  );

  stage = "concurrent last-copy borrowing";
  const last = await makeBook(1);
  const lastResults = await Promise.all([
    borrow(last, owner),
    borrow(last, other),
  ]);
  ensure(
    lastResults.filter((result) => result.status === 201).length === 1 &&
      lastResults.filter((result) => result.status === 409).length === 1,
  );
  await stock(last, 0, 1);
  const winner = lastResults.findIndex((result) => result.status === 201);
  ensure(
    (
      await giveBack(
        lastResults[winner]!.body.data._id as string,
        winner === 0 ? owner : other,
      )
    ).status === 200,
  );
  await stock(last, 1, 0);
  checks.push(
    "concurrent last-copy requests: one success, one 409, no negative inventory",
  );

  stage = "same-member concurrent duplicate and concurrent returns";
  const simultaneous = await makeBook(2);
  const doubleBorrow = await Promise.all([
    borrow(simultaneous),
    borrow(simultaneous),
  ]);
  ensure(
    doubleBorrow.filter((result) => result.status === 201).length === 1 &&
      doubleBorrow.filter((result) => result.status === 409).length === 1,
  );
  await stock(simultaneous, 1, 1);
  const successful = doubleBorrow.find((result) => result.status === 201)!;
  const doubleReturn = await Promise.all([
    giveBack(successful.body.data._id as string),
    giveBack(successful.body.data._id as string),
  ]);
  ensure(
    doubleReturn.filter((result) => result.status === 200).length === 1 &&
      doubleReturn.filter(
        (result) => result.status === 404 || result.status === 409,
      ).length === 1,
  );
  await stock(simultaneous, 2, 0);
  checks.push(
    "same-member concurrent requests create one loan/decrement; concurrent returns increment once",
  );

  stage = "active-loan deletion and total-copy edit guards";
  const guarded = await makeBook(3),
    guardedA = await borrow(guarded),
    guardedB = await borrow(guarded, other);
  ensure(guardedA.status === 201 && guardedB.status === 201);
  await stock(guarded, 1, 2);
  ensure(
    (
      await request(app)
        .delete(`/books/${guarded}`)
        .auth(owner, { type: "bearer" })
    ).status === 409,
  );
  ensure(
    (
      await request(app)
        .patch(`/books/${guarded}`)
        .auth(owner, { type: "bearer" })
        .send({ totalCopies: 1 })
    ).status === 409,
  );
  await stock(guarded, 1, 2);
  ensure(
    (
      await request(app)
        .patch(`/books/${guarded}`)
        .auth(owner, { type: "bearer" })
        .send({ totalCopies: 2 })
    ).status === 200,
  );
  await stock(guarded, 0, 2);
  ensure(
    (
      await request(app)
        .patch(`/books/${guarded}`)
        .auth(owner, { type: "bearer" })
        .send({ totalCopies: 4 })
    ).status === 200,
  );
  await stock(guarded, 2, 2);
  ensure(
    (await giveBack(guardedA.body.data._id as string)).status === 200 &&
      (await giveBack(guardedB.body.data._id as string, other)).status === 200,
  );
  await stock(guarded, 4, 0);
  ensure(
    (
      await request(app)
        .delete(`/books/${guarded}`)
        .auth(owner, { type: "bearer" })
    ).status === 200,
  );
  checks.push(
    "active-loan deletion block, count-edit limits, safe resizing and deletion after returns",
  );

  stage = "borrow versus total-copy edit race";
  const resized = await makeBook(2);
  ensure((await borrow(resized)).status === 201);
  const editRace = await Promise.all([
    borrow(resized, other),
    request(app)
      .patch(`/books/${resized}`)
      .auth(owner, { type: "bearer" })
      .send({ totalCopies: 1 }),
  ]);
  ensure(
    (editRace[0]!.status === 201 && editRace[1]!.status === 409) ||
      (editRace[0]!.status === 409 && editRace[1]!.status === 200),
  );
  const resizedBook = await books.findOne({ _id: resized }),
    resizedLoans = await borrows.countDocuments({ bookId: resized });
  ensure(
    resizedBook &&
      resizedBook.totalCopies - resizedBook.copies === resizedLoans &&
      resizedBook.copies === 0,
  );
  stage = "borrow versus book-deletion race";
  const deleting = await makeBook(1);
  const deleteRace = await Promise.all([
    borrow(deleting, other),
    request(app).delete(`/books/${deleting}`).auth(owner, { type: "bearer" }),
  ]);
  ensure(
    (deleteRace[0]!.status === 201 && deleteRace[1]!.status === 409) ||
      (deleteRace[0]!.status === 404 && deleteRace[1]!.status === 200),
  );
  if (deleteRace[0]!.status === 201) await stock(deleting, 0, 1);
  else ensure((await borrows.countDocuments({ bookId: deleting })) === 0);
  checks.push(
    "concurrent borrowing versus resizing/deletion preserves inventory and loan references",
  );

  stage = "failed real MongoDB insert rolls back the decrement";
  const rollback = await makeBook(1);
  const rejectedInsert = await borrow(
    rollback,
    owner,
    faultyApp("borrows", "insertOne"),
  );
  ensure(
    rejectedInsert.status === 409 &&
      rejectedInsert.body.error.code === "RECORD_CONFLICT",
  );
  await stock(rollback, 1, 0);
  stage = "failed real MongoDB delete leaves stock and loan unchanged";
  const rollbackLoan = await borrow(rollback);
  ensure(rollbackLoan.status === 201);
  const rejectedDelete = await giveBack(
    rollbackLoan.body.data._id as string,
    owner,
    faultyApp("borrows", "deleteOne"),
  );
  ensure(rejectedDelete.status === 500);
  await stock(rollback, 0, 1);
  stage = "failed stock increment rolls back the real loan deletion";
  const rejectedIncrement = await giveBack(
    rollbackLoan.body.data._id as string,
    owner,
    faultyApp("books", "updateOne"),
  );
  ensure(
    rejectedIncrement.status === 409 &&
      rejectedIncrement.body.error.code === "RECORD_CONFLICT",
  );
  await stock(rollback, 0, 1);
  ensure((await giveBack(rollbackLoan.body.data._id as string)).status === 200);
  await stock(rollback, 1, 0);
  checks.push(
    "real MongoDB insert/delete/stock-write failures preserve or roll back stock and active loans",
  );

  stage = "empty inventory and missing-record responses";
  const unavailable = await makeBook(1);
  ensure((await borrow(unavailable)).status === 201);
  const empty = await borrow(unavailable, other);
  ensure(empty.status === 409 && empty.body.error.code === "NOT_AVAILABLE");
  await stock(unavailable, 0, 1);
  ensure(
    (await borrow(new ObjectId())).status === 404 &&
      (await giveBack(new ObjectId().toHexString())).status === 404,
  );
  checks.push(
    "unavailable stock and missing books/loans fail without mutation",
  );
} catch (error) {
  const suffix =
    error instanceof MongoServerError && typeof error.code === "number"
      ? ` (MongoDB code ${error.code})`
      : "";
  console.error(
    `FAIL: P05 acceptance at ${stage}${suffix}. No raw response or credentials printed.`,
  );
  failed = true;
} finally {
  try {
    const db = getDatabase();
    const probes = await db
      .collection("books")
      .find({ addedByUserId: ownerId, description }, { projection: { _id: 1 } })
      .toArray();
    const cleanupIds = [...ids, ...probes.map((book) => book._id)];
    await db
      .collection("borrows")
      .deleteMany({
        bookId: { $in: cleanupIds },
        userId: { $in: [ownerId, otherId] },
      });
    await db
      .collection("books")
      .deleteMany({
        _id: { $in: cleanupIds },
        addedByUserId: ownerId,
        description,
      });
    ensure(
      (await db
        .collection("books")
        .countDocuments({ _id: { $in: cleanupIds } })) === 0,
    );
    ensure(
      (await db
        .collection("borrows")
        .countDocuments({ bookId: { $in: cleanupIds } })) === 0,
    );
    checks.push(
      "all committed probe books and loans removed and absence verified",
    );
  } catch {
    console.error("FAIL: P05 probe cleanup could not be verified.");
    failed = true;
  }
  await closeDatabase().catch(() => {
    failed = true;
  });
}
if (failed) process.exitCode = 1;
else for (const check of checks) console.log(`PASS: ${check}`);
