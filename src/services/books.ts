import { ObjectId, type Db, type MongoClient } from "mongodb";
import { getLibraryCollections } from "../config/collections.js";
import { ApiError } from "../lib/api-error.js";
import type { MemberIdentity } from "../lib/jwt.js";
import type { BookDocument } from "../types/library.js";
import type {
  BookInput,
  BookListQuery,
  BookPatch,
} from "../validators/library.js";

const summaryFields = {
  _id: 1,
  title: 1,
  author: 1,
  category: 1,
  imageUrl: 1,
  copies: 1,
  totalCopies: 1,
  createdAt: 1,
} as const;
export type BookSummary = Pick<BookDocument, keyof typeof summaryFields>;
export interface BookService {
  list(query: BookListQuery, member?: MemberIdentity): Promise<BookSummary[]>;
  get(id: ObjectId): Promise<BookDocument>;
  create(input: BookInput, member: MemberIdentity): Promise<BookDocument>;
  patch(
    id: ObjectId,
    input: BookPatch,
    member: MemberIdentity,
  ): Promise<BookDocument>;
  remove(id: ObjectId, member: MemberIdentity): Promise<{ _id: ObjectId }>;
}

export function createBookService(
  database: () => Db,
  mongoClient: () => MongoClient,
): BookService {
  return {
    async list(query, member) {
      if (query.mine && !member)
        throw new ApiError(401, "AUTH_REQUIRED", "Log in to view your books.");
      const { books } = getLibraryCollections(database());
      const cursor = books
        .find<BookSummary>(query.mine ? { addedByUserId: member!.id } : {}, {
          projection: summaryFields,
        })
        .sort({ createdAt: -1, _id: -1 });
      if (query.limit !== undefined) cursor.limit(query.limit);
      return cursor.toArray();
    },
    async get(id) {
      const book = await getLibraryCollections(database()).books.findOne({
        _id: id,
      });
      if (!book)
        throw new ApiError(
          404,
          "BOOK_NOT_FOUND",
          "This book could not be found.",
        );
      return book;
    },
    async create(input, member) {
      const now = new Date();
      const book: BookDocument = {
        ...input,
        _id: new ObjectId(),
        copies: input.totalCopies,
        addedByUserId: member.id,
        addedByName: member.name,
        addedByEmail: member.email,
        createdAt: now,
        updatedAt: now,
      };
      await getLibraryCollections(database()).books.insertOne(book);
      return book;
    },
    async patch(id, input, member) {
      return mongoClient().withSession((session) =>
        session.withTransaction(
          async () => {
            const { books, borrows } = getLibraryCollections(database());
            const book = await books.findOne({ _id: id }, { session });
            if (!book)
              throw new ApiError(
                404,
                "BOOK_NOT_FOUND",
                "This book could not be found.",
              );
            if (book.addedByUserId !== member.id)
              throw new ApiError(
                403,
                "NOT_BOOK_OWNER",
                "Only the owner can edit this book.",
              );
            const active = await borrows.countDocuments(
              { bookId: id },
              { session },
            );
            if (book.totalCopies - book.copies !== active)
              throw new ApiError(
                409,
                "INVENTORY_CONFLICT",
                "The book's inventory needs review before editing.",
              );
            const total = input.totalCopies ?? book.totalCopies;
            if (total < active)
              throw new ApiError(
                409,
                "COPIES_BELOW_BORROWED",
                "Total copies cannot be lower than the number currently borrowed.",
              );
            const updated = await books.findOneAndUpdate(
              { _id: id, addedByUserId: member.id },
              {
                $set: {
                  ...input,
                  totalCopies: total,
                  copies: total - active,
                  updatedAt: new Date(),
                },
              },
              { session, returnDocument: "after" },
            );
            if (!updated)
              throw new ApiError(
                409,
                "BOOK_CHANGED",
                "This book changed. Refresh and try again.",
              );
            return updated;
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            maxCommitTimeMS: 5000,
          },
        ),
      );
    },
    async remove(id, member) {
      return mongoClient().withSession((session) =>
        session.withTransaction(
          async () => {
            const { books, borrows } = getLibraryCollections(database());
            const book = await books.findOne({ _id: id }, { session });
            if (!book)
              throw new ApiError(
                404,
                "BOOK_NOT_FOUND",
                "This book could not be found.",
              );
            if (book.addedByUserId !== member.id)
              throw new ApiError(
                403,
                "NOT_BOOK_OWNER",
                "Only the owner can delete this book.",
              );
            if (await borrows.findOne({ bookId: id }, { session }))
              throw new ApiError(
                409,
                "ACTIVE_BORROWS",
                "Return all borrowed copies before deleting this book.",
              );
            if (book.copies !== book.totalCopies)
              throw new ApiError(
                409,
                "INVENTORY_CONFLICT",
                "The book's inventory needs review before deletion.",
              );
            const result = await books.deleteOne(
              { _id: id, addedByUserId: member.id },
              { session },
            );
            if (result.deletedCount !== 1)
              throw new ApiError(
                409,
                "BOOK_CHANGED",
                "This book changed. Refresh and try again.",
              );
            return { _id: id };
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            maxCommitTimeMS: 5000,
          },
        ),
      );
    },
  };
}
