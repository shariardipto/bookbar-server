import { ObjectId } from "mongodb";
import { z } from "zod";
import { categories } from "../types/library.js";

const imageUrl = z.url().refine((value) => {
  const url = URL.parse(value);
  return url !== null && ["https:", "http:"].includes(url.protocol);
}, "Use an HTTP(S) image URL");

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID")
  .transform((value) => ObjectId.createFromHexString(value));

export const bookInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(160),
  category: z.enum(categories),
  imageUrl,
  description: z.string().trim().min(1).max(5000),
  totalCopies: z.number().int().min(1).max(2_147_483_647),
}).strict();

export const bookPatchSchema = bookInputSchema.partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one editable field");

export const borrowInputSchema = z.object({ bookId: objectIdSchema }).strict();
export type BookInput = z.infer<typeof bookInputSchema>;
