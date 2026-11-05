import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const errorType = typeof error === "object" && error !== null && "type" in error ? error.type : undefined;

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
