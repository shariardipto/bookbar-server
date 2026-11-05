import assert from "node:assert/strict";
import { MongoServerError, ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb";
import { bookValidator, borrowValidator, ensureCollectionSchemas } from "./collection-schemas.js";
import { getLibraryCollections } from "./collections.js";
import { bookIndexes, borrowIndexes, ensureLibraryIndexes } from "./indexes.js";
import type { BookDocument, BorrowDocument } from "../types/library.js";

async function rolledBack(client: MongoClient, work: (session: ClientSession) => Promise<void>) {
  const session = client.startSession();
  try {
    session.startTransaction({ readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    await work(session);
  } finally {
    try { if (session.inTransaction()) await session.abortTransaction(); }
    finally { await session.endSession(); }
  }
}

// Real MongoDB checks. Every probe write is inside an explicitly aborted
// transaction; no customer documents are deleted and no probe data is committed.
export async function checkDatabase(client: MongoClient, db: Db): Promise<string[]> {
  await db.command({ ping: 1 });
  await ensureCollectionSchemas(db);
  await ensureLibraryIndexes(db);
  const checks = ["connection"];

  for (const [name, validator, indexes] of [
    ["books", bookValidator, bookIndexes], ["borrows", borrowValidator, borrowIndexes],
  ] as const) {
    const info = await db.listCollections({ name }, { nameOnly: false }).next();
    assert.deepEqual(info?.options?.validator, validator, `${name} validator differs`);
    assert.equal(info?.options?.validationLevel, "strict");
    assert.equal(info?.options?.validationAction, "error");
    const installed = await db.collection(name).listIndexes().toArray();
    for (const index of indexes) {
      const actual = installed.find((item) => item.name === index.name);
      assert.ok(actual, `Missing ${index.name}`);
      assert.deepEqual(actual.key, index.key);
      if (index.unique) assert.equal(actual.unique, true);
    }
  }
  checks.push("collection validators", "required indexes");

  const { books, borrows } = getLibraryCollections(db);
  const ids = Array.from({ length: 5 }, () => new ObjectId());
  const [bookId, olderId, newerId, negativeId, inflatedId] = ids as [ObjectId, ObjectId, ObjectId, ObjectId, ObjectId];
  const loanIds = [new ObjectId(), new ObjectId()];
  const now = new Date();
  const book: BookDocument = {
    _id: bookId, title: "BookBar database readiness probe", author: "BookBar system",
    category: "Others", imageUrl: "https://example.invalid/database-probe.svg", description: "Temporary transaction probe; never committed.",
    addedByUserId: `database-check:${bookId.toHexString()}`, addedByName: "Database readiness probe",
    addedByEmail: "database-check@example.invalid", totalCopies: 2, copies: 2, createdAt: now, updatedAt: now,
  };

  await rolledBack(client, async (session) => {
    await books.insertMany([
      book,
      { ...book, _id: olderId, createdAt: new Date(now.getTime() - 1000) },
      { ...book, _id: newerId, createdAt: new Date(now.getTime() + 1000) },
    ], { session });
    assert.equal((await books.findOne({ _id: bookId }, { session }))?.title, book.title);
    const latest = await books.find({ _id: { $in: [bookId, olderId, newerId] } }, { session })
      .sort({ createdAt: -1, _id: -1 }).limit(2).toArray();
    assert.deepEqual(latest.map((item) => item._id.toHexString()), [newerId, bookId].map((id) => id.toHexString()));
  });
  assert.equal(await books.countDocuments({ _id: { $in: ids } }), 0);
  checks.push("transactional write/read", "sort and limit", "transaction rollback");

  for (const [id, copies] of [[negativeId, -1], [inflatedId, 3]] as const) {
    await rolledBack(client, async (session) => {
      await assert.rejects(books.insertOne({ ...book, _id: id, copies }, { session }),
        (error: unknown) => error instanceof MongoServerError && error.code === 121);
    });
  }
  checks.push("database inventory validation");

  const loan: BorrowDocument = {
    _id: loanIds[0]!, bookId, bookTitle: book.title, bookImage: book.imageUrl,
    userId: book.addedByUserId, userEmail: book.addedByEmail,
    borrowDate: now, returnDate: new Date(now.getTime() + 7 * 86_400_000),
  };
  await rolledBack(client, async (session) => {
    await books.insertOne(book, { session });
    await borrows.insertOne(loan, { session });
    await assert.rejects(borrows.insertOne({ ...loan, _id: loanIds[1]! }, { session }),
      (error: unknown) => error instanceof MongoServerError && error.code === 11000);
  });
  assert.equal(await books.countDocuments({ _id: { $in: ids } }), 0);
  assert.equal(await borrows.countDocuments({ _id: { $in: loanIds } }), 0);
  checks.push("unique active-loan enforcement", "no persisted probe records");
  return checks;
}
