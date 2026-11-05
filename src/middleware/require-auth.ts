import type { Request, RequestHandler } from "express";
import { ApiError } from "../lib/api-error.js";
import type { MemberIdentity, TokenVerifier } from "../lib/jwt.js";

declare module "express-serve-static-core" {
  interface Request {
    member?: MemberIdentity;
  }
}

export function requireAuth(verifyToken: TokenVerifier): RequestHandler {
  return async (request, response, next) => {
    response.set("Cache-Control", "private, no-store");
    const header = request.get("authorization");
    const match =
      header && header.length <= 8192
        ? /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(header)
        : null;
    if (!match?.[1])
      throw new ApiError(401, "AUTH_REQUIRED", "Log in to continue.");
    request.member = await verifyToken(match[1]);
    next();
  };
}

export function memberIdentity(request: Request): MemberIdentity {
  if (!request.member)
    throw new ApiError(401, "AUTH_REQUIRED", "Log in to continue.");
  return request.member;
}
