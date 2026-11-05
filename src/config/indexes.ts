import type { Db, IndexDescription } from "mongodb";

export const bookIndexes: IndexDescription[] = [
  { key: { createdAt: -1, _id: -1 }, name: "books_newest_first" },
  { key: { addedByUserId: 1, createdAt: -1 }, name: "books_by_owner" },
];

export const borrowIndexes: IndexDescription[] = [
  { key: { userId: 1, borrowDate: -1 }, name: "borrows_by_member" },
  { key: { bookId: 1, userId: 1 }, unique: true, name: "one_active_borrow_per_member" },
];

export async function ensureLibraryIndexes(db: Db) {
  await db.collection("books").createIndexes(bookIndexes);
  // Existing duplicate loans must be reviewed; never delete them automatically.
  await db.collection("borrows").createIndexes(borrowIndexes);
}
