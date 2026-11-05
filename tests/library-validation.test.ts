import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { bookInputSchema, bookPatchSchema, borrowInputSchema, objectIdSchema } from "../src/validators/library.js";

const validBook = { title: "  A good book  ", author: "An Author", category: "Fiction", imageUrl: "https://example.com/cover.jpg", description: "A book worth reading.", totalCopies: 2 };

describe("book and borrow input contracts", () => {
  it("trims book text and accepts the assigned fields", () => {
    expect(bookInputSchema.parse(validBook).title).toBe("A good book");
  });
  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, 2_147_483_648])("rejects invalid total copies: %s", (totalCopies) => {
    expect(bookInputSchema.safeParse({ ...validBook, totalCopies }).success).toBe(false);
  });
  it("rejects body-controlled ownership, stock, IDs, and timestamps", () => {
    for (const field of ["addedByUserId", "addedByEmail", "copies", "createdAt", "_id"]) {
      expect(bookInputSchema.safeParse({ ...validBook, [field]: "user-controlled" }).success).toBe(false);
    }
  });
  it("rejects empty titles, unknown categories, and non-HTTP images", () => {
    expect(bookInputSchema.safeParse({ ...validBook, title: " " }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...validBook, category: "Unknown" }).success).toBe(false);
    expect(bookInputSchema.safeParse({ ...validBook, imageUrl: "javascript:invalid" }).success).toBe(false);
  });
  it("allows only nonempty edits of approved fields", () => {
    expect(bookPatchSchema.parse({ title: "Updated title" })).toEqual({ title: "Updated title" });
    expect(bookPatchSchema.safeParse({}).success).toBe(false);
    expect(bookPatchSchema.safeParse({ copies: 10 }).success).toBe(false);
  });
  it("validates IDs before conversion and rejects caller identity in borrow input", () => {
    const id = new ObjectId().toHexString();
    expect(objectIdSchema.parse(id)).toEqual(new ObjectId(id));
    expect(objectIdSchema.safeParse("invalid-id").success).toBe(false);
    expect(borrowInputSchema.safeParse({ bookId: id, userId: "someone-else" }).success).toBe(false);
  });
});
