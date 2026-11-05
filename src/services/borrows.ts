import type { Db, ObjectId } from "mongodb";
import { getLibraryCollections } from "../config/collections.js";
import { ApiError } from "../lib/api-error.js";
import type { MemberIdentity } from "../lib/jwt.js";
import type { BorrowDocument } from "../types/library.js";

export interface BorrowService {
  list(member: MemberIdentity): Promise<BorrowDocument[]>;
  create(bookId: ObjectId, member: MemberIdentity): Promise<never>;
  remove(id: ObjectId, member: MemberIdentity): Promise<never>;
}

// P04 provides authenticated contracts and reads. P05 adds atomic borrow/return.
// Never acknowledge a borrow/return that has not actually changed inventory.
export function createBorrowService(database: () => Db): BorrowService {
  return {
    async list(member) {
      return getLibraryCollections(database())
        .borrows.find({ userId: member.id })
        .sort({ borrowDate: -1, _id: -1 })
        .toArray();
    },
    async create(bookId, _member) {
      if (
        !(await getLibraryCollections(database()).books.findOne(
          { _id: bookId },
          { projection: { _id: 1 } },
        ))
      ) {
        throw new ApiError(
          404,
          "BOOK_NOT_FOUND",
          "This book could not be found.",
        );
      }
      throw new ApiError(
        501,
        "BORROWING_NOT_READY",
        "Borrowing is not available yet.",
      );
    },
    async remove(id, member) {
      const borrow = await getLibraryCollections(database()).borrows.findOne({
        _id: id,
      });
      if (!borrow)
        throw new ApiError(
          404,
          "BORROW_NOT_FOUND",
          "This active loan could not be found.",
        );
      if (borrow.userId !== member.id)
        throw new ApiError(
          403,
          "NOT_BORROWER",
          "Only the borrower can return this book.",
        );
      throw new ApiError(
        501,
        "RETURNS_NOT_READY",
        "Returning books is not available yet.",
      );
    },
  };
}
