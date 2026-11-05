import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { ServerEnv } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp(config: Pick<ServerEnv, "CLIENT_ORIGIN">) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN }));
  app.use(express.json({ limit: "100kb" }));

  // P00 readiness response on an assigned route, not an additional health route.
  // Replace this with database-backed listing in P04.
  app.get("/books", (_request, response) => {
    response.status(503).json({
      success: false,
      message: "The BookBar catalog is not implemented yet. Database setup begins in P02.",
      error: { code: "NOT_IMPLEMENTED" },
    });
  });

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
