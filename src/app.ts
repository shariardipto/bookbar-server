import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { JwtEnv, ServerEnv } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createTokenVerifier, type TokenVerifier } from "./lib/jwt.js";
import { requireAuth } from "./middleware/require-auth.js";
import { getDatabase, getMongoClient } from "./config/database.js";
import { createBookService, type BookService } from "./services/books.js";
import { createBorrowService, type BorrowService } from "./services/borrows.js";
import { createLibraryRouter } from "./routes/library.js";

export type AppConfig = Pick<ServerEnv, "CLIENT_ORIGIN"> & JwtEnv;
export function createApp(
  config: AppConfig,
  dependencies: {
    verifyToken?: TokenVerifier;
    books?: BookService;
    borrows?: BorrowService;
  } = {},
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  app.use(
    createLibraryRouter(
      dependencies.books ?? createBookService(getDatabase, getMongoClient),
      dependencies.borrows ?? createBorrowService(getDatabase, getMongoClient),
      requireAuth(dependencies.verifyToken ?? createTokenVerifier(config)),
    ),
  );

  app.use((_request, response) => {
    response.status(404).json({
      success: false,
      message: "This API route does not exist.",
      error: { code: "NOT_FOUND" },
    });
  });

  app.use(errorHandler);

  return app;
}
