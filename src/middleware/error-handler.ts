import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MongoServerError } from "mongodb";
import { ApiError } from "../lib/api-error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const errorType =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;

  if (error instanceof ApiError) {
    if (error.status === 401) response.set("WWW-Authenticate", "Bearer");
    response
      .status(error.status)
      .json({
        success: false,
        message: error.message,
        error: { code: error.code },
      });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      message: "Check the request fields.",
      error: {
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (
    error instanceof MongoServerError &&
    typeof error.code === "number" &&
    [11000, 121].includes(error.code)
  ) {
    response
      .status(409)
      .json({
        success: false,
        message: "The request conflicts with the library's current records.",
        error: { code: "RECORD_CONFLICT" },
      });
    return;
  }

  if (errorType === "entity.parse.failed") {
    response.status(400).json({
      success: false,
      message: "Request body must contain valid JSON.",
      error: { code: "INVALID_JSON" },
    });
    return;
  }

  if (errorType === "entity.too.large") {
    response.status(413).json({
      success: false,
      message: "Request body is too large.",
      error: { code: "PAYLOAD_TOO_LARGE" },
    });
    return;
  }

  response.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
    error: { code: "INTERNAL_ERROR" },
  });
};
