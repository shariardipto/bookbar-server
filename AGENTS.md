# BookBar server

Read `docs/AGENTS.md`, `docs/B14-A8-Cat_Ron.md`, `docs/BookBar_Master_Blueprint.md`, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_LOG.md`, and `docs/MANUAL_HANDOFFS.md` first. This is an independent Git repository. Respect the owner's currently authorized phase.

Use Express, strict TypeScript/NodeNext, and the native MongoDB driver when P02 begins. Implement exactly the eight assigned API endpoints. P00 exposes only an explicit unavailable-catalog response on assigned `GET /books`; no extra health endpoint. Better Auth belongs in Next.js. Later protected endpoints must verify JWT signatures, issuer, audience, expiry, and user identity before applying ownership rules. Borrow/return requires transactions, `$inc`, and a unique active-borrow index. Keep secrets out of code and output. Run relevant checks and report actual results. Keep `docs` current; synchronize workspace planning updates when working inside the larger local workspace.
