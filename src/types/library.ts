import type { ObjectId } from "mongodb";

export const categories = ["Fiction", "Science", "History", "Kids", "Others"] as const;
export type Category = (typeof categories)[number];

export interface BookDocument {
  _id: ObjectId;
  title: string;
  author: string;
  category: Category;
  imageUrl: string;
  description: string;
  addedByUserId: string;
  addedByName: string;
  addedByEmail: string;
  totalCopies: number;
  copies: number;
  createdAt: Date;
  updatedAt: Date;
}

// Only active loans are stored; return deletes the document transactionally.
export interface BorrowDocument {
  _id: ObjectId;
  bookId: ObjectId;
  bookTitle: string;
  bookImage: string;
  userId: string;
  userEmail: string;
  borrowDate: Date;
  returnDate: Date;
}
