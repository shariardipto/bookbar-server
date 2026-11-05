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

## Assignment acceptance matrix at P00

At P00, all AUTH-01–AUTH-07, BOOK-01–BOOK-05, BORROW-01–BORROW-06, API-01–API-02, UI-01–UI-02, and DEPLOY-01–DEPLOY-02 scenarios from blueprint section 12 were NOT RUN. Their implementations belong to P01–P09. A running baseline is not evidence that those features pass. P01 public-page evidence follows below.

## Verification limits at P00

No browser layout audit, MongoDB connection, real auth flow, JWT verification, image upload, concurrency test, GitHub push, or deployment has been performed yet. Phase-specific evidence will replace these statuses as the work is implemented.

## P01 checks

Date: 05 November 2026 (Asia/Dhaka). Environment: the same Windows/Node/npm baseline; project-owned headless installed Google Chrome, Playwright 1.64.1, axe-core Playwright integration 4.14.0.

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS | No ESLint errors or warnings |
| `npm run typecheck` | PASS | Next.js route type generation and TypeScript |
| `npm test` | PASS | 4 catalog unit tests in 1 file |
| `npm run build` | PASS | Production compilation; home, books, detail entry, login, register, 404, and icon routes |
| `npm run test:e2e` | PASS | Complete run: 12 passed in 20.4 seconds; 3 targeted navigation/accessibility checks also passed after the final smooth-scroll routing hint |
| Home/Swiper | PASS | Six labeled sample arrivals; 3 slides; next/previous/pager controls; inactive slides inert; Browse Books navigation; no page errors during the tested flow |
| Catalog behavior | PASS | 9 fixtures, combined search/category filtering, empty/reset state, alphabetic sorting, URL state after refresh |
| Category/detail navigation | PASS | Category links filter the collection; sample details enter login with the original callback path preserved |
| Custom 404 | PASS | HTTP 404, BookBar page title, global navbar/footer, working Back to Home |
| Broken cover request | PASS | An intentionally failed image request renders the accessible cover fallback |
| Mobile Sheet | PASS | Open/close, keyboard focus containment, Escape/focus restoration, and navigation |
| Responsive public pages | PASS | Home, Books, Login, Register, 404 at 360/390/768/1280/1440 px; no document overflow; intended 1/2/3-column grids; equal card dimensions |
| Automated accessibility | PASS | No detected violations for WCAG 2 A/AA and 2.1 A/AA tags on the five tested public routes |
| Visual screenshot inspection | PASS | Reviewed desktop and mobile Home, tablet Home, desktop Books, and mobile Books captures; original art, readable layouts, and consistent styling |
| Development smoke | PASS | Parent `node scripts/smoke-baseline.mjs development`: client 200, CSS 200, navy token, six sample cards; unchanged API 503/NOT_IMPLEMENTED, expected CORS origin, no extra health route |
| Dependency audit | PASS | Final `npm audit --include=dev --json`: 0 vulnerabilities |

### P01 fixes observed during verification

- The first browser run had 10 passing / 2 failing checks. Home's same-segment metadata did not inherit the root title template; set an explicit absolute `BookBar | Home` title. The first contrast scan caught the small copper caption on the warm invitation surface.
- The next run again had 10 passing / 2 failing checks. Rapid slideshow input could be ignored during a transition, so all custom controls now disable during transitions. The scan reached the catalog and caught its copper eyebrow on a tinted surface. Added the darker accessible copper text token while preserving the decorative brand accent.
- The final full browser run passed all 12 checks, including all five public-route accessibility scans. No failures were waived or hidden.
- Development log review then identified Next.js's smooth-scroll routing hint. Added `data-scroll-behavior="smooth"` on the root HTML element as its bundled version guide prescribes; lint/typecheck/build passed again, followed by all 3 targeted home/category-navigation/accessibility checks. The latest HTML report contains this targeted follow-up; the full-suite summary above records the earlier complete run. Screenshot geometry is unchanged by this attribute.
- The shadcn CLI initially rejected an obsolete combined preset name; reran with its reported `--base radix --preset nova` syntax. The full CLI dependency was then ejected using its official command; the resulting generated source/stylesheet remains local. An intermediate audit's advisories disappeared with the unnecessary CLI dependency removed; final audit is zero.
- The formatter does not infer an SVG parser. Excluded SVG from the formatting glob and reran successfully; the SVG assets themselves were visually verified in browser captures.

### P01 artifacts and verification limits

- Screenshots: client `.cache/p01/home-{360,390,768,1280,1440}.png` and `books-{360,390,768,1280,1440}.png`. These are local generated evidence and intentionally ignored by Git. HTML browser report: client `playwright-report/index.html`. Development smoke JSON: parent `.cache/smoke-p01-development.json`.
- Screenshot assertions and automated accessibility checks cover the P01 public preview. They do not establish complete manual assistive-technology or multi-browser compatibility. The interactive Computer Use bridge was unavailable; all browser evidence above comes from the project-owned headless test process.
- Loading skeletons and the retryable error boundary are implemented and compile; they were not forced into an artificial production failure solely to claim a browser pass. Empty state, image-error fallback, and mobile navigation were exercised in the browser.
- UI-01 passes for the five public preview routes at the listed widths. UI-02 passes for the exercised empty/image-error states; live API loading/error behavior remains NOT RUN. BOOK-02 is NOT RUN against MongoDB; fixture sorting does not satisfy it. BOOK-03 has preview UI evidence only. All actual AUTH, protected session-refresh, CRUD/borrow/JWT, provider, production, and concurrency scenarios remain NOT RUN until their phases.
- No server source, dependency, route, or business behavior changed in P01. The existing P00 server unit/build results were not rerun or relabeled as P01 tests; only its unchanged HTTP baseline was rechecked for the development smoke.
- Test-owned and development smoke processes were stopped after verification. All private environment/build/cache/browser-report artifacts remain ignored; source, original artwork, tests, and documentation are the intended Git changes.
- Public contact information and BookBar-owned social profiles remain owner content needed before launch. No account, address, or provider credentials were fabricated.
