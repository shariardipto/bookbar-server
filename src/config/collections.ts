import type { Db } from "mongodb";
import type { BookDocument, BorrowDocument } from "../types/library.js";

export function getLibraryCollections(db: Db) {
  return {
    books: db.collection<BookDocument>("books"),
    borrows: db.collection<BorrowDocument>("borrows"),
  };
}
