# BookBar API

The separate Express + TypeScript backend for the BookBar online library. Better Auth sessions belong to the Next.js client project; this API will validate service JWTs and enforce book ownership, borrowing, and inventory rules.

**Current phase:** P00 foundation. The HTTP process, configuration validation, structured errors, CORS/security headers, body-size limits, and baseline tests are implemented. MongoDB, JWT, and business endpoints are not implemented yet.

**Live API:** Not deployed; deployment is scheduled for P08. A local `origin` remote is configured. No push is performed during P01.

The client public interface is complete for P01, with explicitly labeled sample data. This API remains at its verified P00 baseline; see the shared implementation log for current project progress. P01 adds no Express routes or business logic.

## Local setup

Use Node.js 24 LTS (verified with 24.22.2) and npm.

```powershell
npm ci --include=dev
npm run dev
```

The process listens on port 5000 by default. No credentials or `.env` file are required for P00. For local overrides, copy `.env.example` to ignored `.env`; never commit its contents. `CLIENT_ORIGIN` must be one HTTP(S) origin without a path or trailing slash.

Check http://localhost:5000/books. Expected P00 response: HTTP 503, `success: false`, `error.code: NOT_IMPLEMENTED`. This shows that the server is reachable while honestly reporting that the database-backed catalog is unavailable. `/health` returns 404; no ninth API route is added.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | TypeScript watch server |
| `npm run build` | Compile runtime source to `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm run lint` | ESLint, with no warnings allowed |
| `npm run typecheck` | Strict checks for runtime, test, and configuration code |
| `npm test` | Vitest + Supertest baseline checks |

## Final API contract

| Method | Route | P00 status |
| --- | --- | --- |
| GET | `/books` | Explicit 503 readiness response; database implementation in P04 |
| GET | `/books/:id` | Not implemented |
| POST | `/books` | Not implemented |
| PATCH | `/books/:id` | Not implemented |
| DELETE | `/books/:id` | Not implemented |
| POST | `/borrows` | Not implemented |
| GET | `/borrows` | Not implemented |
| DELETE | `/borrows/:id` | Not implemented |

Only book listing is public in the final contract; `mine=true` and the remaining operations require the appropriate authentication/authorization. P00's readiness response contains no book data and is not a completed listing.

All current API responses use `{ success, message, error: { code } }` for errors. P04 will add the corresponding data envelopes. Malformed JSON returns 400, oversized JSON 413, unknown routes 404, and unexpected errors a sanitized 500. CORS advertises only `CLIENT_ORIGIN`; it does not replace future JWT authentication.

## Documentation and delivery

See [blueprint](docs/BookBar_Master_Blueprint.md), [decisions](docs/DECISIONS.md), [implementation log](docs/IMPLEMENTATION_LOG.md), [handoffs](docs/MANUAL_HANDOFFS.md), [test report](docs/TEST_REPORT.md), and [dependency versions](docs/DEPENDENCIES.md). Target at least 8 meaningful server commits by submission. No real connection URI, API secret, token, or private environment file belongs in Git.
