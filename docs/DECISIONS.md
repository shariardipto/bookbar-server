# BookBar Decisions

## D001 — Product name: BookBar

- Date: 05 November 2026 (Asia/Dhaka).
- Status: OWNER-APPROVED CUSTOMIZATION.
- Owner instruction: "project name will be BookBar".
- Decision: Use BookBar for the public product name, logo/wordmark, navbar, page titles, README, and submission materials. Use `bookbar-client`, `bookbar-server`, and database name `bookbar` when creating the new projects.
- Assignment impact: The original assignment uses BookNook. The owner explicitly overrides that naming requirement; all functional, technology, commit-count, and submission requirements still apply. Keep `B14-A8-Cat_Ron.md` unchanged as the source document.
- Documentation: Rename the implementation blueprint to `BookBar_Master_Blueprint.md` and update its references. The existing workspace directory is not part of the product branding and does not need to be moved.

## D002 — Premium visual direction

- Date: 05 November 2026 (Asia/Dhaka).
- Status: OWNER-REQUESTED CUSTOMIZATION; specific tokens are PROPOSED DEFAULTS selected for implementation.
- Owner instruction: Replace the forest green, warm ivory, and gold look with another premium style.
- Decision: Use **Midnight Editorial**, inspired by a premium independent bookshop: midnight navy `#14213D`, porcelain `#F7F8FC`, white `#FFFFFF`, burnished copper `#A65F46`, graphite `#202637`, slate `#5F687A`, and mist gray `#E2E6EF`.
- Typography default: DM Serif Display for wordmark/display headings and Manrope for body text and controls, with appropriate fallbacks.
- Layout default: An editorial grid, generous whitespace, prominent book covers, fine borders, modest corner radii, and restrained shadows; copper appears sparingly.
- Assignment impact: Visual styling is customizable. Retain consistent typography, button/card/image sizing, responsive layouts, readable contrast, and the modern X icon. P01 includes design-reference research and an original composition; P07 verifies accessibility and responsive behavior.
- Scope: This decision updates the implementation specification. No application UI has been built yet.

## D003 — P00 workspace and repository boundaries

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT applied within the authorized P00 scope.
- Decision: Keep this parent directory as an unversioned workspace containing two independent Git repositories, `bookbar-client` and `bookbar-server`. Each repository carries its own lockfile, scripts, environment example, README, and planning/progress documents. Parent `docs` remains the coordination source; synchronize applicable updates into both repositories.
- Discovery: No application code, package manifests, phase log, or Git repository existed at the start of P00. Git already has an owner identity configured. No existing implementation is being replaced.
- Publication: Initialize and commit locally in P00. GitHub remote creation, pushing, deployment, and credentials are not required for this phase and will be handled when needed.

## D004 — Honest API baseline within the eight-route limit

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT applied for P00 only.
- Decision: Use assigned `GET /books` for the baseline HTTP smoke check. It returns HTTP 503 with `NOT_IMPLEMENTED` until the database-backed listing is implemented in P04. Unknown routes return structured 404 responses. Do not add `/health` or return fake catalog data.
- Assignment impact: The final eight API routes remain the target. P00 demonstrates a running server, not completed CRUD or authentication. Database-backed acceptance checks remain unrun until their phases.

## D005 — Reproducible local tooling

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT applied for P00.
- Decision: Use Node.js 24 LTS (verified with 24.22.2), npm lockfiles, exact direct dependency versions, strict TypeScript, ESLint flat configuration, and Vitest. Express uses ESM/NodeNext and a separate production build configuration.
- Tooling note: The execution environment starts with `NODE_ENV=production`, so dependency installation explicitly includes development dependencies. Use `npm ci --include=dev` for development/checks.
- Scope: Install the baseline framework, CSS/build, and test tools now. Better Auth, MongoDB, shadcn, Swiper, and feature-specific packages are added in the phases that use them. Client feature tests are not implemented in P00; the configured test command reports zero tests instead of fabricating a passing suite.
- Typography: P00 uses local system serif/sans-serif fallbacks without remote font downloads. P01 adds the selected display/body fonts and full design system.
- Official installation guidance checked: [Next.js](https://nextjs.org/docs/app/getting-started/installation), [Express](https://expressjs.com/en/5x/starter/installing/), [Tailwind CSS](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [typescript-eslint](https://typescript-eslint.io/getting-started/), and [Vitest](https://vitest.dev/guide/). Package versions are resolved from the npm registry and recorded in each lockfile.
- Compatibility follow-up: The client uses ESLint 9.39.5 to satisfy the Next.js preset's React/import/accessibility peer ranges; the server uses ESLint 10.14.0. The deprecated client ESLint line is tracked in `DEPENDENCIES.md` for revisiting when those plugins support ESLint 10. Both repositories use parent-scoped overrides for affected minimatch dependencies to patched 11.0.4 rather than force-downgrading the Next.js preset. Exact versions, rationale, and the upstream advisory are recorded in `DEPENDENCIES.md`.
- Generated files: Ignore `next-env.d.ts` and framework/build artifacts. `npm run typecheck` generates the Next.js types first, so a fresh checkout does not depend on generated files from another machine.

## D006 — P01 collection preview and account entry points

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT applied within authorized P01.
- Decision: Use nine typed, explicitly labeled sample titles from `src/lib/preview-books.ts`. Home shows six fixture arrivals; All Books supports title/author search, category filtering, sorting, and URL state preserved on refresh. This is local preview behavior, not live MongoDB retrieval or availability.
- Authentication boundary: Login/Register are honest membership-preview landing pages. Known sample detail URLs go to `/login?callbackUrl=...`; no book details, fake session, or borrowing action is exposed. P03 must replace the temporary entry gate with a real Better Auth server session check and real account forms. Unknown detail IDs use the custom 404.
- P06 removal checklist: Replace fixture consumers in `src/app/page.tsx`, `src/components/books/catalog.tsx`, and `src/app/books/[id]/page.tsx` with typed API/TanStack Query behavior. Verify latest-six sort/limit in MongoDB, remove preview notices, and remove unused fixture/filter tests. Original cover art may remain as static promotional artwork; it is not evidence of live inventory.
- Public contact/social content: No business contact address or BookBar profile URLs were supplied. The footer explicitly states that details are forthcoming; its social icons link to the platforms themselves and do not claim to be BookBar accounts. Replace these with owner-supplied public details before final delivery.
- API impact: No Express routes or business logic change in P01.

## D007 — P01 editorial design, assets, and component system

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT within the owner-requested Midnight Editorial style.
- Research: Reviewed the [Folio Society collection](https://www.foliosociety.com/uk/limited-edition) and [London Review Bookshop's curated storefront](https://uk.bookshop.org/shop/LondonReviewBookshop) for cover-led discovery and curated browsing. These informed the direction; the BookBar composition and cover illustrations are original.
- Design: A navy three-slide editorial hero, porcelain surfaces, sparse copper accents, consistent book cards, a five-category section, a borrowing guide, and a restrained global shell. No fabricated reader counts, ratings, testimonials, or book availability.
- Fonts/assets: Bundle DM Serif Display and Manrope locally through Fontsource and `next/font/local`. Nine original SVG cover illustrations are generated by `scripts/generate-preview-covers.mjs`; they do not reproduce publisher editions. Use a visible fallback for failed cover requests. The favicon and brand mark use original vector book artwork.
- Components: Initialized the official shadcn CLI with Radix/nova and added Button, Badge, Card, Sheet, Input, Select, and Skeleton. Used the CLI's `eject` command to inline its shared stylesheet and remove the full CLI package from application dependencies. Generated component sources remain editable and future additions can use `npx shadcn`. Direct dependencies are exact and `.npmrc` preserves that convention.
- Accessibility: Manual slide navigation without autoplay, inactive slides inert, controls disabled during transitions, focus-managed mobile Sheet, skip link, labeled filters/search/sort, status announcements, and reduced-motion support. Use darker copper `#8D4D36` for small text on tinted surfaces; the main decorative copper token remains `#A65F46`.

## D008 — P01 browser verification

- Date: 05 November 2026 (Asia/Dhaka).
- Status: PROPOSED DEFAULT applied for verification.
- Decision: Add project-owned Playwright tests using installed headless Chrome and axe-core. The interactive Computer Use browser bridge was unavailable; no user browser/profile is controlled by these tests. The runner starts/stops its own local production process and writes screenshots/reports only to ignored local directories.
- Coverage: Public routes, Swiper controls, fixture filtering/sort/refresh, category links, detail entry, custom 404, mobile focus/navigation, image fallback, and public layouts at 360/390/768/1280/1440 px. Automated WCAG A/AA scanning is evidence for the tested pages, not a complete manual accessibility certification.
- Dependency scope: Playwright and axe are development dependencies. Database, JWT, provider sign-in, image hosting, protected-route session refresh, and transactional borrowing remain future-phase checks.
