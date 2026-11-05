import { MongoServerError, type Db, type Document } from "mongodb";
import { categories } from "../types/library.js";

const text = { bsonType: "string", minLength: 1 };
const date = { bsonType: "date" };
const objectId = { bsonType: "objectId" };

export const bookValidator = {
  $and: [
    { $jsonSchema: {
      bsonType: "object",
      additionalProperties: false,
      required: ["_id", "title", "author", "category", "imageUrl", "description", "addedByUserId", "addedByName", "addedByEmail", "totalCopies", "copies", "createdAt", "updatedAt"],
      properties: {
        _id: objectId,
        title: { ...text, maxLength: 200 },
        author: { ...text, maxLength: 160 },
        category: { enum: [...categories] },
        imageUrl: { ...text, pattern: "^https?://" },
        description: { ...text, maxLength: 5000 },
        addedByUserId: text,
        addedByName: text,
        addedByEmail: text,
        totalCopies: { bsonType: "int", minimum: 1 },
        copies: { bsonType: "int", minimum: 0 },
        createdAt: date,
        updatedAt: date,
      },
    } },
    { $expr: { $lte: ["$copies", "$totalCopies"] } },
  ],
};

export const borrowValidator = {
  $and: [
    { $jsonSchema: {
      bsonType: "object",
      additionalProperties: false,
      required: ["_id", "bookId", "bookTitle", "bookImage", "userId", "userEmail", "borrowDate", "returnDate"],
      properties: {
        _id: objectId,
        bookId: objectId,
        bookTitle: text,
        bookImage: { ...text, pattern: "^https?://" },
        userId: text,
        userEmail: text,
        borrowDate: date,
        returnDate: date,
      },
    } },
    { $expr: { $gt: ["$returnDate", "$borrowDate"] } },
  ],
};

// Explicit setup only, not per-request. Update validation in place; never drop
// an existing collection or delete records to make setup succeed.
export async function ensureCollectionSchemas(db: Db) {
  for (const [name, validator] of [["books", bookValidator], ["borrows", borrowValidator]] as const) {
    const options = { validator: validator as Document, validationLevel: "strict" as const, validationAction: "error" as const };
    try {
      await db.createCollection(name, options);
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 48) throw error;
      await db.command({ collMod: name, ...options });
    }
  }
}
