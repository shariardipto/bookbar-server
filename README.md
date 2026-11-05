# BookBar API

The separate Express + TypeScript backend for BookBar. Better Auth sessions belong to Next.js; this API verifies service JWTs and enforces ownership and inventory rules.

**Current phase:** P04 implementation and live acceptance pass. Exactly eight routes provide public book summaries, authenticated book CRUD, owner-only edits/deletes and member-filtered borrow reads. Borrow/return mutations deliberately return 501 until P05 implements their transactions. P02 remains DONE.

**Live API:** Not deployed; deployment is scheduled for P08. Changes are committed locally; no push is performed in this phase.

The browser catalog still uses labeled fixtures until P06. The API itself now reads and writes real MongoDB records. P03 Google callback/browser refresh acceptance remains a separate pending verification; P04 live tests use real email sessions and Next-issued JWTs.

## Local setup

Use Node.js 24 LTS (verified with 24.22.2) and npm.

```powershell
npm ci --include=dev
npm run dev
```

The process listens on port 5000 by default. Set private Mongo settings in ignored `.env` without overwriting an existing file. `CLIENT_ORIGIN` must be one HTTP(S) origin without a path or trailing slash. Restart after environment changes.

`GET http://localhost:5000/books` returns real book summaries (an empty array for an empty library). `/health` returns 404; there is no extra health/auth/upload endpoint. Start the Next app on `http://localhost:3000` before protected API requests so its JWKS endpoint is available.

Configure `BETTER_AUTH_JWKS_URL=http://localhost:3000/api/auth/jwks`, `BETTER_AUTH_ISSUER=http://localhost:3000`, and `BETTER_AUTH_AUDIENCE=http://localhost:3000`; issuer/audience must match Next's JWT configuration. Production requires explicit settings and HTTPS JWKS. `jose` 6.2.15 verifies EdDSA signatures, issuer, audience and expiration; issued-at and nonempty subject are required, along with the signed email/display name used for ownership. A cached remote key resolver uses only the configured JWKS URL. Invalid tokens return 401; unavailable key infrastructure returns 503. No tokens or raw driver errors are logged.

The browser obtains a service JWT with `authClient.token()` and sends `Authorization: Bearer …`. The Better Auth session cookie is not an API JWT. Follow the [official Better Auth JWT guide](https://better-auth.com/docs/plugins/jwt) and [jose remote JWKS reference](https://github.com/panva/jose/blob/main/docs/jwks/remote/functions/createRemoteJWKSet.md).

## MongoDB setup and verification

Set `MONGODB_URI` privately in ignored `.env` and use `MONGODB_DB_NAME=bookbar`. Restart the server after changing settings. Run `npm run db:check`: it builds the server, connects, creates/checks `books`/`borrows` validation and indexes, and checks actual transaction/write/read/rollback, sort/limit, inventory validation, and duplicate-loan enforcement. All probe writes use explicitly aborted transactions; no probe data is committed and no customer documents are deleted. Existing incompatible validation/indexes/duplicates cause failure rather than overwriting rules or destructive cleanup. Repeated checks need no admin-only `collMod` action; use read/write access scoped to `bookbar`. Better Auth collections are managed by its Next.js adapter, not this script.

No URI, password, or document content is printed. Missing configuration returns `BLOCKED_MANUAL` and exit code 2; a failed live check returns 1; only real successful checks report PASS. This command and the client's `npm run db:check` both passed after the latest Atlas IP-access update, completing P02. Unit tests do not replace live checks. The driver is MongoDB 7.8.0.

Current coordination state lives in workspace `../docs/ACTIVE_CONTEXT.md`; existing repository logs are historical snapshots and are no longer copied after every phase.

## Application commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | TypeScript watch server |
| `npm run build` | Compile runtime source to `dist/` |
| `npm start` | Run compiled `dist/index.js` |
| `npm run lint` | ESLint, with no warnings allowed |
| `npm run typecheck` | Strict checks for runtime, test, and configuration code |
| `npm test` | Vitest + Supertest unit/contract checks |
| `npm run api:check` | Opt-in real Next/Atlas acceptance using temporary probe accounts and records |

## API contract

| Method | Route | P04 behavior |
| --- | --- | --- |
| GET | `/books` | Public summaries; `mine=true` requires JWT; newest first; optional `sort=latest&limit=6` |
| GET | `/books/:id` | Private full details; 400/401/404 |
| POST | `/books` | JWT-derived owner/timestamps, initial copies = totalCopies; 201 |
| PATCH | `/books/:id` | Owner only; transactional inventory checks; 200/403/404/409 |
| DELETE | `/books/:id` | Owner only; rejects active loans or inconsistent inventory; 200/403/404/409 |
| POST | `/borrows` | JWT and validated bookId; 404 if missing; otherwise 501 pending P05 |
| GET | `/borrows` | Only the verified user's active loans; newest first |
| DELETE | `/borrows/:id` | JWT/ID/borrower checks; 403/404 or 501 pending P05; stock unchanged |

Success responses are `{ success: true, data }`; ObjectIds serialize as hex strings and dates as ISO strings. Book listing includes `_id`, title, author, category, imageUrl, copies, totalCopies and createdAt, without owner email or description. `limit` accepts 1–100; omit it to retrieve all summaries. Unknown query parameters, identity/email filters, malformed IDs, invalid inputs and caller-owned fields return 400. Request book fields are title, author, category, imageUrl, description and totalCopies; PATCH accepts a nonempty subset.

Failures use `{ success: false, message, error: { code, details? } }`. Validation details contain field/message pairs. Missing/invalid auth is 401, forbidden ownership 403, missing records 404, inventory conflicts 409, malformed JSON 400, oversized bodies 413 and unexpected failures a sanitized 500. Private responses use `Cache-Control: private, no-store`. CORS advertises only `CLIENT_ORIGIN`; it does not replace JWT verification.

P04 verification: `npm test -- tests/jwt.test.ts tests/api-contract.test.ts tests/app.test.ts` runs the 54 focused unit/HTTP checks. `npm run api:check` requires the local Next app, Atlas and dev dependencies. It creates uniquely named temporary users/books/loans, obtains real tokens, exercises CRUD/authorization/inventory conflicts, then verifies removal of only its own probe users/accounts/sessions/books/loans. It prints fixed PASS/FAIL summaries. Unlike P02's aborted probes, these are committed test fixtures removed in `finally`; it never deletes arbitrary library records or prints credentials.

## Documentation and delivery

See [blueprint](docs/BookBar_Master_Blueprint.md), [decisions](docs/DECISIONS.md), [implementation log](docs/IMPLEMENTATION_LOG.md), [handoffs](docs/MANUAL_HANDOFFS.md), [test report](docs/TEST_REPORT.md), and [dependency versions](docs/DEPENDENCIES.md). Target at least 8 meaningful server commits by submission. No real connection URI, API secret, token, or private environment file belongs in Git.
