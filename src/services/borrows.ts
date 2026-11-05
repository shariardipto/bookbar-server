import { MongoServerError, ObjectId, type Db, type MongoClient } from "mongodb";
import { getLibraryCollections } from "../config/collections.js";
import { ApiError } from "../lib/api-error.js";
import type { MemberIdentity } from "../lib/jwt.js";
import type { BorrowDocument } from "../types/library.js";
import { runTransaction } from "../lib/transaction.js";

export interface BorrowService {
  list(member: MemberIdentity): Promise<BorrowDocument[]>;
  create(bookId: ObjectId, member: MemberIdentity): Promise<BorrowDocument>;
  remove(
    id: ObjectId,
    member: MemberIdentity,
  ): Promise<{ _id: ObjectId; bookId: ObjectId }>;
}

export function createBorrowService(
  database: () => Db,
  mongoClient: () => MongoClient,
): BorrowService {
  return {
    async list(member) {
      return getLibraryCollections(database())
        .borrows.find({ userId: member.id })
        .sort({ borrowDate: -1, _id: -1 })
        .toArray();
    },
    async create(bookId, member) {
      const loanId = new ObjectId();
      try {
        return await runTransaction(mongoClient(), async (session) => {
          const { books, borrows } = getLibraryCollections(database());
          if (await borrows.findOne({ bookId, userId: member.id }, { session }))
            throw new ApiError(
              409,
              "ALREADY_BORROWED",
              "You already have an active loan for this book.",
            );
          const book = await books.findOne({ _id: bookId }, { session });
          if (!book)
            throw new ApiError(
              404,
              "BOOK_NOT_FOUND",
              "This book could not be found.",
            );
          const active = await borrows.countDocuments({ bookId }, { session });
          if (book.totalCopies - book.copies !== active)
            throw new ApiError(
              409,
              "INVENTORY_CONFLICT",
              "The book's inventory needs review before borrowing.",
            );
          if (book.copies < 1)
            throw new ApiError(
              409,
              "NOT_AVAILABLE",
              "All copies of this book are currently borrowed.",
            );
          const borrowDate = new Date();
          const changed = await books.updateOne(
            { _id: bookId, copies: { $gt: 0 } },
            { $inc: { copies: -1 }, $set: { updatedAt: borrowDate } },
            { session },
          );
          if (changed.matchedCount !== 1)
            throw new ApiError(
              409,
              "NOT_AVAILABLE",
              "All copies of this book are currently borrowed.",
            );
          const loan: BorrowDocument = {
            _id: loanId,
            bookId,
            bookTitle: book.title,
            bookImage: book.imageUrl,
            userId: member.id,
            userEmail: member.email,
            borrowDate,
            returnDate: new Date(borrowDate.getTime() + 7 * 86_400_000),
          };
          await borrows.insertOne(loan, { session });
          return loan;
        });
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000)
          throw new ApiError(
            409,
            "ALREADY_BORROWED",
            "You already have an active loan for this book.",
          );
        throw error;
      }
    },
    async remove(id, member) {
      return runTransaction(mongoClient(), async (session) => {
        const { books, borrows } = getLibraryCollections(database());
        const loan = await borrows.findOne({ _id: id }, { session });
        if (!loan)
          throw new ApiError(
            404,
            "BORROW_NOT_FOUND",
            "This active loan could not be found.",
          );
        if (loan.userId !== member.id)
          throw new ApiError(
            403,
            "NOT_BORROWER",
            "Only the borrower can return this book.",
          );
        const book = await books.findOne({ _id: loan.bookId }, { session });
        const active = await borrows.countDocuments(
          { bookId: loan.bookId },
          { session },
        );
        if (
          !book ||
          book.totalCopies - book.copies !== active ||
          book.copies >= book.totalCopies
        )
          throw new ApiError(
            409,
            "INVENTORY_CONFLICT",
            "The book's inventory needs review before returning.",
          );
        const removed = await borrows.deleteOne(
          { _id: id, userId: member.id },
          { session },
        );
        if (removed.deletedCount !== 1)
          throw new ApiError(
            409,
            "BORROW_CHANGED",
            "This loan changed. Refresh and try again.",
          );
        const changed = await books.updateOne(
          { _id: loan.bookId, copies: { $lt: book.totalCopies } },
          { $inc: { copies: 1 }, $set: { updatedAt: new Date() } },
          { session },
        );
        if (changed.matchedCount !== 1)
          throw new ApiError(
            409,
            "INVENTORY_CONFLICT",
            "The book's inventory needs review before returning.",
          );
        return { _id: id, bookId: loan.bookId };
      });
    },
  };
}
