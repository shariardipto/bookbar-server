import { Router, type RequestHandler } from "express";
import type { BookService } from "../services/books.js";
import type { BorrowService } from "../services/borrows.js";
import { memberIdentity } from "../middleware/require-auth.js";
import {
  bookInputSchema,
  bookPatchSchema,
  bookListQuerySchema,
  borrowInputSchema,
  emptyQuerySchema,
  objectIdSchema,
} from "../validators/library.js";

export function createLibraryRouter(
  books: BookService,
  borrows: BorrowService,
  authenticate: RequestHandler,
) {
  const router = Router();
  router.get(
    "/books",
    (request, response, next) => {
      const query = bookListQuerySchema.parse(request.query);
      if (query.mine) return authenticate(request, response, next);
      next();
    },
    async (request, response) => {
      response.json({
        success: true,
        data: await books.list(
          bookListQuerySchema.parse(request.query),
          request.member,
        ),
      });
    },
  );
  router.get("/books/:id", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response.json({
      success: true,
      data: await books.get(objectIdSchema.parse(request.params.id)),
    });
  });
  router.post("/books", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response
      .status(201)
      .json({
        success: true,
        data: await books.create(
          bookInputSchema.parse(request.body),
          memberIdentity(request),
        ),
      });
  });
  router.patch("/books/:id", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response.json({
      success: true,
      data: await books.patch(
        objectIdSchema.parse(request.params.id),
        bookPatchSchema.parse(request.body),
        memberIdentity(request),
      ),
    });
  });
  router.delete("/books/:id", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response.json({
      success: true,
      data: await books.remove(
        objectIdSchema.parse(request.params.id),
        memberIdentity(request),
      ),
    });
  });
  router.get("/borrows", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response.json({
      success: true,
      data: await borrows.list(memberIdentity(request)),
    });
  });
  router.post("/borrows", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    const { bookId } = borrowInputSchema.parse(request.body);
    response
      .status(201)
      .json({
        success: true,
        data: await borrows.create(bookId, memberIdentity(request)),
      });
  });
  router.delete("/borrows/:id", authenticate, async (request, response) => {
    emptyQuerySchema.parse(request.query);
    response.json({
      success: true,
      data: await borrows.remove(
        objectIdSchema.parse(request.params.id),
        memberIdentity(request),
      ),
    });
  });
  return router;
}
