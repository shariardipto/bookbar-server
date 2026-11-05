# BookBar Test Report

Date: 05 November 2026 (Asia/Dhaka).
Environment: Windows / PowerShell, Node.js 24.22.2, npm 11.19.1, Git 2.54.0.windows.1.

## P00 checks

| Check | Client | Server |
| --- | --- | --- |
| Dependency installation, exact versions, clean offline install, and complete dependency tree | PASS | PASS |
| `npm run lint` | PASS | PASS |
| `npm run typecheck` | PASS | PASS |
| `npm run test` | NOT RUN (feature suite); runner exits 0 and explicitly reports zero tests | PASS; 15 tests across 2 files |
| `npm run build` | PASS; Next.js static home compiled with Turbopack | PASS; runtime source compiled to `dist/` |
| Development HTTP smoke check | PASS; HTTP 200, BookBar title/opening-soon copy, CSS HTTP 200 and navy token | PASS; `/books` 503/NOT_IMPLEMENTED, exact CORS origin, `/health` 404 |
| Production HTTP smoke check | PASS; same checks against `next start` | PASS; same checks against compiled `dist/index.js` |
| `npm audit --include=dev --json` | PASS; 0 vulnerabilities | PASS; 0 vulnerabilities |
| Git ignore rules, staged-file artifact/credential-pattern scan, and authored source whitespace | PASS | PASS |

The server test suite covers explicit unavailable-catalog behavior, structured 404, CORS/security headers, malformed JSON, request-size limits, and startup configuration. No mocks replace database verification: the database is not connected in P00.

## Commands and fixes

- Installed dependencies with `npm install --include=dev`; the execution environment defaults to production mode and otherwise omits development tools. Final direct dependency versions are exact; lockfile synchronization used `npm install --package-lock-only --offline --include=dev --ignore-scripts --no-audit --no-fund`.
- Ran `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` separately in each project.
- Initial client lint found a plain anchor for internal navigation. Replaced it with Next.js `Link`; the subsequent lint passed.
- Initial server run had 13 passing and 2 failing tests: invalid URL values threw before the intended sanitized configuration error. Switched the origin check to `URL.parse`; the subsequent run passed all 15 tests.
- Initial client Vitest configuration emitted an ESM/CommonJS warning. Declared the client package as ESM; the subsequent runner reports zero tests without that warning.
- Audited dependencies, addressed the minimatch advisory using parent-scoped patched overrides, and retained compatible client ESLint peers. A conditional override initially left stale/invalid dependency entries; scoped overrides and a fresh server dependency/lockfile resolution fixed that. The old server dependencies/lockfile were preserved in the ignored parent `.cache` before regeneration. Final `npm ci --offline --include=dev --ignore-scripts --no-audit --no-fund` and `npm ls --all --include=dev --json` passed for both apps, proving that the final lockfiles reproduce valid trees. Both final `npm audit --include=dev --json` reports returned zero vulnerabilities. See `DEPENDENCIES.md` for the client ESLint deprecation/compatibility limitation.
- Started production processes with `npm start` and development processes with `npm run dev`. Executed parent `node scripts/smoke-baseline.mjs production` and `node scripts/smoke-baseline.mjs development`. Both returned successful assertions; JSON evidence is in the ignored parent `.cache/smoke-production.json` and `.cache/smoke-development.json` files.
- The sandbox prevented `tsx watch` from reading Windows user information (`uv_os_get_passwd`); the same server development command ran successfully with approved execution outside the sandbox. Both development and production processes were stopped after verification.
- An early inline smoke command failed at PowerShell parsing before any assertions ran. Replaced it with the reusable script above; both modes subsequently passed.
- Confirmed `.env`, `.env.local`, `.env.production`, dependencies, coverage, and build output are ignored while `.env.example` is trackable. Staged-file inspection found no private environment files, generated artifacts, MongoDB URI literals, private-key blocks, or JWT-shaped tokens. Authored source/configuration passed `git diff --cached --check`; supplied Markdown source documents retain their original formatting.
- Both repositories use `main`; baseline commits include actual source, configuration, lockfiles, and verification documentation. Remote publication is not performed in P00. Exact commit hashes are recorded in the parent coordination log after the commits are created.

## Assignment acceptance matrix

All AUTH-01–AUTH-07, BOOK-01–BOOK-05, BORROW-01–BORROW-06, API-01–API-02, UI-01–UI-02, and DEPLOY-01–DEPLOY-02 scenarios from blueprint section 12 are NOT RUN. Their implementations belong to P01–P09. A running baseline is not evidence that those features pass.

## Verification limits

No browser layout audit, MongoDB connection, real auth flow, JWT verification, image upload, concurrency test, GitHub push, or deployment has been performed yet. Phase-specific evidence will replace these statuses as the work is implemented.
