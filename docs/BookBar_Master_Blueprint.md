# BookBar

## Project Master Blueprint & AI/Codex Development Playbook

**Project:** BookBar — A Small Online Library  
**Document version:** 1.1 | 05 November 2026  
**Audience:** Project owner, AI coding agents (Codex, Claude Code, Cursor), and reviewers  
**Status:** Implementation specification / not a claim that the application has been built

> **Owner quick start (বাংলা):** এই ডকুমেন্টটি Codex/AI agent-কে দাও এবং Section 16-এর **Master Agent Prompt** দিয়ে কাজ শুরু করাও। Agent একেকটি phase শেষ করে test করবে, কাজের report দেবে এবং পরবর্তী phase-এ যাবে। MongoDB Atlas, Google OAuth, imgbb, GitHub, Vercel বা Render-এর account/credential/configuration দরকার হলে সে **MANUAL HANDOFF** করবে—তুমি নিজের account-এ কাজ করে local `.env` বা dashboard-এ information বসাবে, তারপর `DONE` বললে agent check করে আবার এগোবে। কোনো password, API secret বা private connection URI public chat-এ paste করবে না।

---

# 01 | Mission, source of truth & success criteria

### 1.1 Product mission

Build a responsive full-stack online library where visitors browse books, authenticated users add books, book owners manage their entries, and members borrow/return books. The core experience is **Add a book → Borrow a book → Return a book**.

### 1.2 Source-of-truth order

1. **Assignment source:** `B14-A8-Cat_Ron.md` is authoritative for requirements and submission constraints.
2. **This blueprint:** Technical design, implementation defaults, phase instructions and measurable completion checks.
3. **Current official documentation:** Consult before installing or calling rapidly changing libraries, especially Better Auth, Next.js and deployment SDKs.
4. **Owner decisions:** If a required choice conflicts with the assignment or this plan, get explicit owner approval and record it in `docs/DECISIONS.md`.

**Conflict policy:** Do not silently change the assignment. Mark each decision as `ASSIGNMENT REQUIRED`, `OWNER-APPROVED CUSTOMIZATION`, `PROPOSED DEFAULT`, or `OPTIONAL`. Do not treat a proposed design choice as a grading requirement.

**Owner-approved customization (05 November 2026):** Use **BookBar** as the product name instead of the original assignment's BookNook. Apply BookBar consistently to the logo, navigation, page titles, README, and submission materials. The original assignment is retained verbatim; its functional and submission requirements still apply. See `docs/DECISIONS.md` for the recorded naming override and the premium visual direction replacing the original palette.

### 1.3 Submission success

- Two separate GitHub repositories: **client (15+ meaningful commits)** and **server (8+ meaningful commits)**.
- Working live website link, with the frontend and backend deployed and integrated.
- Client README states BookBar, includes live URL and at least five meaningful feature bullets.
- No lorem ipsum, default `alert()`, or default browser `confirm()`.
- No private-route redirect errors on refresh, including a currently logged-in user.
- Eight specified Express API endpoints and all book/borrow functionalities.
- Better Auth + MongoDB adapter; Google sign-in; JWT verification for protected Express APIs.
- Available copies `$inc`, no double borrow, responsive UI, loading feedback, custom 404 and per-route titles.

---

# 02 | Requirements matrix

| Domain | Requirement (assignment) | Priority / acceptance |
|---|---|---|
| Global layout | Logo + name; Home, All Books; signed-in Add Book, My Books, My Borrows; profile-photo dropdown; Footer on every page | REQUIRED |
| Homepage | Swiper.js slider with at least 3 slides; latest 6 books using MongoDB sort/limit; See All Books; 2 extra sections | REQUIRED |
| Accounts | Register with name, email, photo URL, password; login with email/password; Google only; toast errors | REQUIRED |
| Validation | Password has 1 uppercase, 1 lowercase, at least 6 characters; no email verification or actual password reset | REQUIRED |
| Routing | Unauthenticated private-route visitors go to login and return to intended page; private reload retains authenticated access | REQUIRED |
| Book CRUD | Create book with image upload, category, description and readonly owner info; public 3-column grid; private details; own-book edit/delete with modal | REQUIRED |
| Borrows | Borrow confirmation modal; save required fields; My Borrows table; Return Book removes active borrow | REQUIRED |
| Inventory challenges | Total Copies field; decrement/increment on borrow/return with `$inc`; disable when zero; prevent duplicate active borrow | REQUIRED challenge |
| Authorization | JWT validation; own-book updates/deletion; user-specific borrows | REQUIRED + protective interpretation |
| UI quality | Uniform headings/cards/buttons/images; responsive desktop/tablet/mobile; current X icon; toast, loading, custom 404, page metadata | REQUIRED |
| Enhancements | Dark/light toggle; subtle animation | OPTIONAL; implement last |

**Scope boundary:** Do not invent extra Express endpoints. All eight assigned endpoints must exist. Better Auth's Next.js-owned `/api/auth/*` endpoints are separate from the eight Express routes. For image upload, prefer a **Next.js Server Action**, not a ninth Express endpoint.

---

# 03 | Technology & system architecture

### 3.1 Locked technologies

| Area | Implementation choice | Why |
|---|---|---|
| Client | Next.js App Router + TypeScript | Matches assignment; typed code |
| UI | Tailwind CSS + shadcn/ui | Matches permitted UI library; reusable components |
| Data retrieval | TanStack Query + a typed fetch client | Loading, mutations and refetching |
| Forms | React Hook Form + Zod | Reusable form validation and clear messages |
| Notifications | Sonner | Non-blocking toasts |
| Slider | Swiper.js | Explicit assignment dependency |
| Auth / session | Better Auth in Next.js | Explicit assignment dependency |
| Auth persistence | `@better-auth/mongo-adapter` + MongoDB | Explicit assignment dependency |
| API JWT | Better Auth JWT plugin, `jwtClient`, `jose` verification | Token signed by Next auth, verified in Express |
| API server | Express.js + TypeScript | Explicit assignment dependency |
| Storage | MongoDB Atlas, native MongoDB driver | Data, indexes, transactions |
| Book image hosting | imgbb called server-side | Explicitly allowed; keep API key off browser |
| Deployment | Vercel (client) + Render (server) | Allowed suggestion; verify plan limits |
| Testing | Vitest + Supertest for API; optional Playwright for E2E | Repeatable validation |

Use compatible stable dependency versions at implementation time; record them in `package-lock.json`. Do **not** guess that an old tutorial's Better Auth import/API still works.

### 3.2 Trust boundaries / data flow

```text
Browser (public pages / protected UI)
  |
  +--> Next.js client (Vercel)
  |       |-- Better Auth session cookie (Next.js origin)
  |       |-- /api/auth/[...all] (Next.js-owned auth routes)
  |       |-- /api/auth/jwks (JWT public verification keys)
  |       |-- Server Action: secure imgbb upload
  |       +-- Request Bearer JWT using authClient.token()
  |
  +--> Express API (Render): exactly 8 book/borrow routes
          |-- Validate Bearer JWT via jose + Better Auth JWKS
          |-- Validate request data using Zod
          |-- Enforce ownership / current user / copy limits
          +-- MongoDB Atlas (books, borrows)

Next.js Better Auth ----> MongoDB Atlas (user, session, account, jwks)
```

**Architecture rules:**

- Next.js is the **source of user authentication**; Express is the **source of book and borrowing authorization/business rules**.
- A browser-visible logged-in state is never enough to authorize an Express mutation.
- MongoDB is accessed from both server processes using server-only environment variables, never from browser code.
- The client sends an API JWT in `Authorization: Bearer ...`; Express verifies the signature, issuer, audience and expiry through JWKS.
- User identity is taken from verified JWT `sub`/user ID, not user-controlled email, name, or addedBy values.
- Store UTC timestamps; display them in a friendly local format in the UI.

### 3.3 Repository layout

```text
workspace/
  bookbar-client/                        # GitHub repository #1
    src/app/
      layout.tsx
      page.tsx
      login/page.tsx
      register/page.tsx
      books/page.tsx
      books/[id]/page.tsx
      add-book/page.tsx
      my-books/page.tsx
      my-borrows/page.tsx
      profile/page.tsx
      not-found.tsx
      api/auth/[...all]/route.ts
    src/actions/upload-book-image.ts
    src/components/{layout,books,forms,auth,ui}/
    src/lib/{auth,auth-client,api-client,validators,utils}/
    src/hooks/
    public/
    docs/{DECISIONS,IMPLEMENTATION_LOG,MANUAL_HANDOFFS,TEST_REPORT}.md
    .env.example
    README.md
  bookbar-server/                        # GitHub repository #2
    src/index.ts
    src/app.ts
    src/config/{env,database}.ts
    src/routes/{books,borrows}.ts
    src/controllers/{books,borrows}.ts
    src/services/{books,borrows}.ts
    src/middleware/{require-auth,error-handler}.ts
    src/lib/{jwt,db-errors}.ts
    src/validators/
    src/types/
    tests/
    .env.example
    README.md
```

Use this as a target shape, not a command to destroy existing files. The agent first inspects the workspace and adapts harmlessly to existing setup.

---

# 04 | Page architecture & UI specification

### 4.1 Route table

| Route | Visibility | Responsibilities |
|---|---|---|
| `/` | Public | Slider, latest six, two static sections, browsing CTA |
| `/books` | Public | Book cards in responsive grid; View Details CTA |
| `/books/[id]` | Private | Book image, author, category, description, owner, copies and borrow modal |
| `/add-book` | Private | Complete add form, upload, owner name/email readonly |
| `/my-books` | Private | Logged-in user's books; edit prefilled form and delete dialog |
| `/my-borrows` | Private | Borrow table with due dates and Return Book action |
| `/login` | Public | Email/password, Forgot Password display, Google sign-in, Register link |
| `/register` | Public | Name, email, photo URL, password, validation, Google sign-in |
| `/profile` | Private | Auth-session name, image, email; no additional Express endpoint |
| Not Found | Public | Dedicated 404 with Back to Home |

**Navbar:** BookBar logo/wordmark on left. Always Home and All Books. Private links only when signed in. Logged-out users see Login/Register. Logged-in users see a profile image dropdown containing name, My Profile and Logout. Global Navbar/Footer appear in all normal app routes and the custom 404. Page titles follow `BookBar | All Books`, with the appropriate route label.

**Homepage:** At least three fully authored Swiper slides with working Browse Books buttons. New Arrivals uses `GET /books?sort=latest&limit=6`; display exactly six or the available number, newest first. Two static sections: **How Borrowing Works** and **Browse by Category**.

**Cards:** Cover, title, author, category and View Details. Three columns desktop, two tablet where space allows, one mobile. Equal-height card shells and fixed image aspect ratio; reasonable fallbacks for broken images.

**Add Book form:** Title, author, category (`Fiction`, `Science`, `History`, `Kids`, `Others`), book image file, description, `Total Copies`, readonly signed-in name/email, Add Book. Filename/mime/size validation and upload failure toast. On success save `createdAt` server-side.

**Details and borrowing:** Details are private even though books listing is public. Show the count available and `Not Available` when zero. Borrow modal contains readonly member name/email and a Confirm Borrow control. Recheck on server, even if button appears enabled.

**My Books:** Query only signed-in user's own data (do not rely on client-side hiding). Edit modal pre-fills existing values. Delete uses shadcn AlertDialog; disable/return a clear error if active borrows exist.

**My Borrows:** Show cover, book title, borrow date, return date and a Return Book button. Confirm return with loading state and refresh listings after success.

### 4.2 Premium visual direction (owner-requested customization)

**Concept:** Midnight Editorial — a premium independent bookshop aesthetic with deep navy, crisp porcelain surfaces, copper details, expressive serif headings, and clean sans-serif body text. This replaces the previous forest green, warm ivory, and gold proposal. The owner requested a premium redesign; the specific palette and typography below are implementation defaults.

| Token | Value | Usage |
|---|---|---|
| Midnight navy | `#14213D` | Main CTA, navigation, footer, and selected feature panels |
| Porcelain | `#F7F8FC` | Main page background |
| Paper white | `#FFFFFF` | Cards, forms, and dialogs |
| Burnished copper | `#A65F46` | Small decorative rules, category accents, and focus rings |
| Graphite | `#202637` | Main body text |
| Slate | `#5F687A` | Secondary text and form hints |
| Mist gray | `#E2E6EF` | Borders and subtle dividers |

**Typography:** Use a literary serif such as `DM Serif Display` for the wordmark and display headings, paired with `Manrope` for body text, labels, and controls. Keep paragraph text comfortable to read and use a consistent heading scale. Verify font availability during implementation and supply appropriate serif/sans-serif fallbacks.

**Composition:** Use a navy feature area with porcelain text, generous whitespace, an editorial grid, prominent book covers, fine borders, and restrained shadows. Use modest corner radii (about 10–16 px for cards and dialogs) and clear, consistent buttons. Keep copper accents sparse so book covers remain the visual focus.

**Interaction and accessibility:** Use accessible focus indicators, readable form labels, skeleton/spinner loading, and subtle hover states. Use white text on navy primary buttons; keep secondary text readable on porcelain/white. Check all actual text, focus, error, and disabled-state color combinations during P07. Use the modern X logo for the X social link (not the old Twitter bird). Optional theme switch and motion come after mandatory functionality.

**Design research:** During P01, review current bookshop/editorial design references as the assignment requests, then produce an original BookBar composition using these tokens rather than copying a reference layout.

**Responsive testing widths:** 360/390 px mobile, 768 px tablet, 1280/1440 px desktop. These are test targets, not fixed breakpoints.

---

# 05 | MongoDB data contract, validation & indexes

### 5.1 Collections

**Better Auth-managed:** `user`, `session`, `account`, plus other plugin collections including `jwks` as required by the installed version. Do not hand-code authentication schemas when the adapter handles them.

**Book document** (proposed additional fields explicitly marked):

```ts
type Category = 'Fiction' | 'Science' | 'History' | 'Kids' | 'Others';
type Book = {
  _id: ObjectId;
  title: string;
  author: string;
  category: Category;
  imageUrl: string;
  description: string;
  addedByUserId: string;      // identity bound to Better Auth user.id
  addedByName: string;        // display snapshot
  addedByEmail: string;       // display snapshot; not authorization input
  totalCopies: number;       // integer >= 1
  copies: number;            // integer 0..totalCopies; available copies
  createdAt: Date;
  updatedAt: Date;
}
```

**Active borrow document:**

```ts
type Borrow = {
  _id: ObjectId;
  bookId: ObjectId;
  bookTitle: string;
  bookImage: string;
  userId: string;             // verified auth identity
  userEmail: string;          // snapshot for assignment display
  borrowDate: Date;
  returnDate: Date;           // due date, not actual return timestamp
}
```

The assignment requests only the active borrowing workflow and `DELETE /borrows/:id` as return; keeping borrow records only while active is the cleanest mapping. Do not claim return history exists unless separately implemented later.

### 5.2 Proposed validation rules

- Trim title and author; reject empty and absurdly long strings; category must be one of the five values.
- `description`: required, sensible maximum length; prevent HTML rendering injection.
- `totalCopies`: finite positive integer; when adding, set `copies = totalCopies` server-side.
- On edit, if changing total copies, preserve outstanding borrow count; do not allow new total below number currently borrowed. Use a transaction or safe atomic concurrency approach.
- User email/name are read-only in UI but never trusted as client authorization fields.
- Validate every ObjectId; return 400 for malformed IDs, 404 for missing records.

### 5.3 Indexes

- `books.createdAt` descending for latest-six queries.
- `books.addedByUserId` for My Books.
- `borrows.userId` for My Borrows.
- **Unique index:** `borrows: { bookId: 1, userId: 1 }, unique: true` to prevent simultaneous active duplicate borrows.

The `borrows` collection stores only active items; deleting on return frees the unique pair for a future borrow. Use transactional operations with a MongoDB Atlas replica set/sharded cluster to avoid decrement-without-insert or delete-without-increment inconsistencies.

### 5.4 Borrowing policy (PROPOSED DEFAULT)

**Due period = 7 calendar days** from borrow time, computed server-side. The assignment says “a few days” but gives no explicit interval. This is a documented default; changing it does not change the core assignment. No late fees, renewals or reservation queues are in scope.

---

# 06 | Exactly eight Express API endpoints

All responses use a consistent JSON envelope, such as `{ success: boolean, data?: ..., message?: string, error?: { code, details? } }`. Exact naming is implementation-defined; document and test one stable contract.

| Method | Path | Auth | Input / behavior / notable outcomes |
|---|---|---|---|
| GET | `/books` | Public; JWT required for `mine=true` | Query `sort=latest&limit=6`, optional `mine=true`; return only requested data; sort/limit performed in MongoDB |
| GET | `/books/:id` | REQUIRED | Validate ObjectId, fetch full book including owner display; 400/401/404 |
| POST | `/books` | REQUIRED | Validate fields, derive owner from JWT, `totalCopies=copies` initially; 201 |
| PATCH | `/books/:id` | REQUIRED, owner | Editable fields only; check owner and inventory invariants; 200/403/404/409 |
| DELETE | `/books/:id` | REQUIRED, owner | Confirm in UI; reject if active borrows; 200 or 204 /403/409 |
| POST | `/borrows` | REQUIRED | Body: `bookId`; derive user identity and book snapshot server-side; transaction + no duplicate + copies decrement; 201/409 |
| GET | `/borrows` | REQUIRED | Query current user's borrows based on verified JWT only; 200 |
| DELETE | `/borrows/:id` | REQUIRED, borrower | Transactionally delete active borrow and `$inc` book copies by +1; 200 or 204 /403/404 |

**Do not add** `/my-books`, `/latest-books`, `/return-book`, `/upload` to the Express server. Use query parameters, the existing routes and Next.js's own built-in auth or Server Actions where applicable.

### 6.1 Error contract

| HTTP code | Example condition | UI behavior |
|---|---|---|
| 400 | Malformed id, bad form input, invalid category | Inline field error or toast |
| 401 | Missing / expired / invalid JWT | Prompt session recheck and login if necessary |
| 403 | User editing someone else's book | Clear forbidden toast; no mutation |
| 404 | Book or borrow record missing | Friendly not-found state |
| 409 | Zero copies, duplicate borrow, active-borrow delete, conflicting count edit | Specific conflict toast |
| 500 | Unexpected server failure | Generic error; detailed server-side logs only |

Never leak credentials, MongoDB URI, internal stack traces or JWTs in responses or logs.

---

# 07 | Authentication, JWT, session & route logic

### 7.1 Auth ownership

Implement Better Auth **inside Next.js** using `@better-auth/mongo-adapter`; mount `toNextJsHandler(auth)` at `/api/auth/[...all]/route.ts`. Sessions live in Better Auth-managed persistence. Express remains separate.

### 7.2 Registration

- Fields: Name, Email, Photo URL, Password; real validation and accessible errors.
- Required password policy is **length ≥ 6, uppercase and lowercase** on both UI and server.
- **Important integration detail:** Better Auth's documented default minimum password length is 8. Set `emailAndPassword.minPasswordLength: 6` explicitly and enforce upper/lowercase using validated server-side sign-up handling compatible with the installed Better Auth version. Do not rely exclusively on client-side Zod.
- Turn `emailAndPassword.autoSignIn = false` so successful email/password sign-up redirects to `/login` as assignment requires.
- Do not enable email verification; do not implement actual forgot-password flow for this assignment.
- Google signup/sign-in from register page should authenticate and go to Home as requested; Google from login should honor safe intended callback route when possible.

### 7.3 Login & Google OAuth

- Email/password login displays toast/inline error for failures, never browser `alert()`.
- Show `Forgot Password` text or an explanatory disabled UI control **without a broken promise of functionality**.
- Google is the only social provider. Better Auth uses Google client ID and client secret; callback URLs are based on the Next.js auth origin (normally `/api/auth/callback/google`).
- For login redirects, use a safe same-origin relative `callbackUrl` / `callbackURL`; prevent open redirects to external domains.

### 7.4 Private pages & refresh

- Use server-side session checks wherever possible in private App Router layouts/pages, with proper loading/hydration transitions where client navigation requires them.
- Do not redirect before auth session state is known.
- Preserve the originally requested private route; after login return there, otherwise Home.
- Test a **hard reload** of `/add-book`, `/my-books`, `/my-borrows`, `/books/[id]`, `/profile` while signed in and signed out.

### 7.5 JWT for Express

1. Configure Better Auth `jwt()` on auth server, `jwtClient()` in auth client.
2. For protected Express requests, obtain a **service JWT** via `authClient.token()`; never pass Better Auth session cookie as though it were the JWT plugin token.
3. Send `Authorization: Bearer <JWT>` to Express. Token should not be committed, printed, or stored in long-lived localStorage by default.
4. Express uses `createRemoteJWKSet` + `jwtVerify` from `jose` pointing to Next's JWKS; validate signature, `iss`, `aud`, expiration and expected user identifier.
5. Authorize patch/delete based on `sub`/verified user ID. For user filtering use verified user ID; never a `?email=` parameter.
6. On token failure, do not perform the operation. Handle session renewal/re-login safely on the client.

### 7.6 Image uploads

The assignment allows imgbb/postimage. Proposed implementation is **imgbb using a protected Next.js Server Action** that validates logged-in session, MIME type and file size, then makes a server-side API request. The API key lives only in Next.js server environment (`IMGBB_API_KEY`), not `NEXT_PUBLIC_*` and not Express's eighth-route budget. Save the returned image URL into book documents. Use sensible upload limits and error feedback.

---

# 08 | Critical borrowing and inventory logic

### 8.1 Borrow algorithm (transactional)

```text
POST /borrows  { bookId }
  1. Verify JWT and parse ObjectId.
  2. Begin MongoDB transaction (required for multi-document consistency).
  3. Confirm no active borrow for (bookId, verifiedUserId).
  4. Atomically change books where {_id: bookId, copies: {$gt: 0}}
       with {$inc: {copies: -1}}; if no match -> NOT_AVAILABLE.
  5. Insert active borrows document with book snapshot + user identity,
       borrowDate = now, returnDate = now + 7 days.
  6. Commit. On duplicate unique key or transaction write conflict,
       rollback/retry only when safe, then return a precise 409 as needed.
  7. UI invalidates books, details and My Borrows caches.
```

**Why both filters and index?** `$inc` plus `copies > 0` prevents decrementing below zero; a unique `{bookId,userId}` index prevents two active borrows by the same user; a transaction ensures inventory and borrow document update together. Handle MongoDB's supported retryable transaction errors carefully and cap retries.

### 8.2 Return algorithm (transactional)

```text
DELETE /borrows/:id
  1. Verify JWT and parse borrow ID.
  2. Begin transaction.
  3. Find active borrow and verify its userId is the caller.
  4. Delete that borrow exactly once.
  5. {$inc: {copies: +1}} on the referenced book.
  6. Commit; refresh UI. Reject missing/non-owned borrow.
```

Deletion of a book with active borrows is blocked to prevent the return path referencing a removed book. `totalCopies` must not change when a copy is borrowed or returned.

### 8.3 Required edge-case tests

- Two users borrow the last available copy at once: **one succeeds, other gets 409**.
- One user makes two concurrent borrows for the same book: **only one active borrow** and **only one decrement**.
- Returning the same borrow twice: only first succeeds; copy count never exceeds total.
- User B cannot update/delete user A's book or return user A's borrow.
- Failed insert/delete rolls back stock adjustment.
- Editing totalCopies below active borrowed count is blocked.

---

# 09 | Configuration matrix & manual owner setup

**Safety:** Credentials must be entered into environment variables on the owner's computer or provider dashboards. The agent should request **the existence/status** of sensitive values, not ask for those secret values to be pasted into chat. Keep `.env.local` and `.env` gitignored; commit `.env.example` with dummy placeholders only.

### 9.1 Client `.env.example`

```dotenv
# Non-secret URLs (replace for each environment)
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# Server-only; supply privately in .env.local / Vercel dashboard
BETTER_AUTH_SECRET=REPLACE_LOCALLY_WITH_STRONG_RANDOM_SECRET
MONGODB_URI=REPLACE_LOCALLY
MONGODB_DB_NAME=bookbar
GOOGLE_CLIENT_ID=REPLACE_LOCALLY
GOOGLE_CLIENT_SECRET=REPLACE_LOCALLY
IMGBB_API_KEY=REPLACE_LOCALLY
```

### 9.2 Server `.env.example`

```dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=REPLACE_LOCALLY
MONGODB_DB_NAME=bookbar
CLIENT_ORIGIN=http://localhost:3000
BETTER_AUTH_JWKS_URL=http://localhost:3000/api/auth/jwks
BETTER_AUTH_ISSUER=http://localhost:3000
BETTER_AUTH_AUDIENCE=http://localhost:3000
```

Environment names are the proposed contract for **our code**, except framework/library recognized names (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`) which must follow current docs. JWT issuer/audience can be customized, but Next and Express values must match exactly.

### 9.3 Owner manual handoff inventory

| Gate | Who does what | Agent can check after owner says DONE |
|---|---|---|
| MongoDB Atlas | Owner creates project/cluster, database user, permitted network access; puts Mongo URI into both local env files | Connect, ping, write/read probe; index creation (without revealing URI) |
| Better Auth secret | Owner locally generates strong secret and stores in client env | Auth server starts; sign-up/session check |
| Google OAuth | Owner creates Google Cloud OAuth Web client, consent settings, local + production redirect URIs, fills client ID/secret privately | Google sign-in callback and user persistence |
| imgbb | Owner creates API key, stores client-server-only env | Authenticated upload from Server Action and URL response |
| GitHub | Owner provides repo access via local git auth or creates two empty remote repos | Agent commits and pushes only with permitted access |
| Vercel | Owner creates/selects Vercel project, configures client env and app origin | Build, deployed URL, auth routes, hard reload |
| Render | Owner creates/selects Render Web Service and configures server env, startup command and network policy | API health via existing route, CORS, DB, deployed API calls |
| Production OAuth | Owner adds final Vercel domain to Google authorized origins/callback list | End-to-end Google login from live app |

**Network access note:** MongoDB Atlas access lists and hosting egress policies are an account/security decision. Never automatically suggest broad public access without explaining the trade-off; prefer the narrowest workable setup for the chosen hosting provider.

### 9.4 Manual handoff protocol — mandatory behavior for Codex

When blocked by a human-controlled account, credential, provider console or permission:

```text
STATUS: BLOCKED_MANUAL
PHASE / TASK: [e.g., P03 Google OAuth]
WHAT I FINISHED: [specific code/files/tests completed]
WHY I CANNOT CONTINUE: [the real blocking dependency]
OWNER ACTIONS:
  1. [exact website/dashboard path and steps]
  2. [exact env variable names and where to set them]
  3. [configuration to verify, such as callback URL]
DO NOT SHARE IN CHAT: [MongoDB password, secret, API key, private URI]
SAFE RESPONSE TO SEND: 'DONE - Google OAuth configured locally'
AFTER OWNER REPLIES: [exact verification to run]
NEXT STEP: [resume at the blocked task, not from scratch]
```

**Rules:** Ask only for a genuinely blocked human action. If another non-dependent coding task is safe, complete it first. Never forge secrets, pretend to have used provider consoles, silently skip integration, or mark a phase complete before its live/manual verification. If the owner does not have an account yet, provide a short step-by-step setup guide and pause that dependent task.

---

# 10 | Security, reliability & quality gates

- Validate all API input on the server; validate permissions on every protected route.
- JWT verification must use trusted JWKS and expected issuer/audience; do not merely decode token claims.
- Strict CORS allowlist for the real frontend origin; use environment-specific origins and avoid a wildcard with credentials.
- Server-side only database and image host credentials; never hard-code keys or commit `.env`.
- Basic abuse protections: upload file size/type checks, reasonable input size caps, auth-system rate limits or appropriate safe defaults.
- All user content displayed as text, not injected HTML; ensure generated messages are properly escaped.
- Robust error boundaries, empty states, retryable UX, and consistent structured server errors.
- Use real text, not lorem ipsum; no browser `alert`/`confirm`; use toast and accessible AlertDialog.
- Run lint, typecheck, production build, endpoint tests and mobile checks before finalizing each relevant phase.
- Avoid any claim of a passed test unless it was executed; note environment constraints in the status report.

---

# 11 | Phase-by-phase build plan (agent execution contract)

**Gate rule:** Every phase has an exit criterion. An agent may implement a phase, run its verifications, write a progress log and propose the next phase. It must pause at a required manual gate, resume from the checkpoint after owner action, and never skip mandatory acceptance checks.

### P00 — Discovery, repositories and baseline (client + server)

**Objective:** Inspect working directory; identify existing code and git state, then initialize missing client/server projects without overwriting user work. Create `docs/DECISIONS.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/MANUAL_HANDOFFS.md`, `docs/TEST_REPORT.md`, `.gitignore`, `.env.example`, root READMEs and scripts (`dev`, `build`, `lint`, `typecheck`, `test`).

**Acceptance:** Two apps boot locally with placeholder/health UI; README and config conventions exist; versions recorded; no secrets committed. Git commits meaningful and descriptive. **Owner gate:** GitHub remote creation/push only if agent lacks authorization.

**Agent phase instruction:** "Complete P00 only. First inspect repository state. Initialize the two allowed repositories and documentation. Do not configure fake external credentials. Execute available checks and report exact output summary and next handoff."

### P01 — Design system, app shell and public pages (client)

**Objective:** Tailwind/shadcn setup; tokens; Navbar/Footer; responsive home and All Books page; 3 Swiper slides; 2 static sections; book cards; loading/empty states; custom 404; per-route metadata. Use typed mock data **only until real API hookup**, with obvious removal tasks tracked.

**Acceptance:** 360/768/1440 layouts have no horizontal overflow; navigation works; no lorem ipsum; all cards consistent; Swiper works. Dynamic New Arrivals is not claimed complete until P05/P06.

**Owner gate:** None unless owner asks for visual brand approval. **Agent phase instruction:** "Implement P01 UI foundation without misrepresenting mock data as live. Include screenshots if supported, or a list of routes to manually inspect. Run lint/typecheck/build."

### P02 — MongoDB Atlas and data layer (server + auth storage)

**Objective:** Build MongoDB connection singletons in server processes, schema validation and indexes for books/borrows; define types and API response conventions. Verify Atlas deployment supports transactions. Build safe test data approach.

**Owner gate: MANUAL-MONGO-01:** Owner creates Atlas cluster, database user/network access, adds `MONGODB_URI` to both local env files, confirms setup **without sharing secret URI in chat**.

**Acceptance:** DB connection test succeeds, indexes exist (including unique pair), transaction capability validated, no secrets printed. **Agent phase instruction:** "Finish non-dependent DB scaffolding; then stop with precise Atlas handoff if missing. Once owner says DONE, test connectivity and indexes before declaring P02 complete."

### P03 — Better Auth, email login, registration and Google OAuth (client)

**Objective:** Next auth handler, Mongo adapter, session provider/server guard, form validations, register-to-login behavior, Google sign-in, navbar account dropdown, profile page and redirect-back logic.

**Owner gates:** `MANUAL-AUTH-01` generate local `BETTER_AUTH_SECRET`; `MANUAL-GOOGLE-01` Google OAuth consent screen/client, local callback, ID/secret placed locally.

**Acceptance:** Register rejects missing upper/lower or fewer than 6 chars on client/server; register success takes user to Login; email login works; Google login works after human provider setup; refresh maintains private session; signed-out redirect works.

**Agent phase instruction:** "Implement P03 with Better Auth current official API; explicitly set minPasswordLength=6 and autoSignIn=false; never implement password reset or email verification. Pause for OAuth secrets, then verify a complete browser login."

### P04 — JWT middleware and eight Express CRUD/borrow contracts (server)

**Objective:** Implement Express app, exact eight route declarations, validation, error middleware, JWT verification via Next's JWKS, protected authorization; complete `GET/POST/PATCH/DELETE /books` and basic structured borrow endpoint handlers in place, without prematurely claiming borrow correctness.

**Owner gate:** Next auth app must be running to serve JWKS; no fresh secret needed if P03 passed.

**Acceptance:** Anonymous mutation blocked; invalid JWT blocked; valid JWT accepted; owner edit/delete enforced; public books listing works; details private; invalid IDs return 400; full endpoint contract tested.

**Agent phase instruction:** "Implement P04 only, without a ninth Express API. `GET /books?mine=true` must require JWT. Use `jose` signature + issuer/audience verification; do not trust decoded payloads. Test 401/403/404 flows."

### P05 — Inventory and borrow transactions (server)

**Objective:** Implement borrow/return using transactions, `$inc`, unique borrow index, server-generated due date and ownership check. Prevent deleting books with active borrow records; ensure total-copy edits do not contradict borrowed counts.

**Acceptance:** No negative copies, no stock inflation, duplicate-active borrow blocked, concurrent-last-copy test passes, rollback works and My Borrows filters by verified current user.

**Owner gate:** Transactions require a suitable Atlas cluster configuration; return to `MANUAL-MONGO-01` if not available. **Agent phase instruction:** "Implement P05 with real database transactions and concurrency tests. Do not replace atomic behavior with client-only checks."

### P06 — Connect complete UI to live APIs and secure image upload (client)

**Objective:** Replace mock data with TanStack Query endpoints; image upload via private Next.js Server Action; Add Book, Book Details, My Books edit/delete confirmation, borrow modal, My Borrows/Return; correct loading and toast states.

**Owner gate: MANUAL-IMAGE-01:** Owner registers imgbb API key and saves `IMGBB_API_KEY` to client local server env. No secret in chat.

**Acceptance:** End-to-end add→view→borrow→return works against real MongoDB; six latest sorted from DB; three-column All Books desktop; every form works; cache updates after writes.

**Agent phase instruction:** "Implement P06; do not use `NEXT_PUBLIC_IMGBB_API_KEY` or add an Express upload endpoint. Report blocked external API credential clearly."

### P07 — QA, edge cases, accessibility and responsive validation

**Objective:** Run lint, typecheck, build, API unit/integration tests, borrow concurrency tests, real browser route-refresh test, mobile/tablet/desktop audit, Google auth flow, image error handling, modal accessibility, metadata, X icon.

**Acceptance:** All required tests logged as pass or explicit blocked; no major console error; no broken route refresh; protected API rejects unauthorized operations; UI works without default alerts/confirm. Fix failures before proceeding.

**Owner gate:** Manual browser confirmation if agent lacks a browser or can't complete OAuth interactively. **Agent phase instruction:** "Complete P07 using the Section 12 test matrix; don't mark unrun checks as passed."

### P08 — Production deployment (Vercel + Render)

**Objective:** Deploy server and client; configure environment variables, cross-origin CORS, Google production callbacks, MongoDB network permissions and production trusted origins; verify cookies/session, live protected routes, uploads, return flow.

**Owner gates:** `MANUAL-DEPLOY-01` Vercel dashboard/project setup, `MANUAL-DEPLOY-02` Render service/vars, `MANUAL-GOOGLE-PROD-01` Google final callback/origin, and secure MongoDB production network setup where dashboard access is unavailable.

**Acceptance:** Live website and Express endpoint publicly reachable; Next auth works on production origin; no hard-reload 404/redirect errors; no secret exposure; Render availability policies understood and the app tested after cold start if applicable.

**Agent phase instruction:** "Complete P08, stop at each missing dashboard/account permission; once owner finishes, inspect deployment logs and run real production smoke tests before claiming done."

### P09 — Submission audit, README and GitHub delivery

**Objective:** Verify commit counts (15+ client, 8+ server), meaningful commit messages, client README with site title, live link, setup instructions and 5+ features; server README, dependencies, .env examples, sample screenshots optional. Produce final submission message with client repo, server repo and live URL.

**Acceptance:** Three actual working links, no secrets pushed, no missing compulsory items; `docs/TEST_REPORT.md` records what was verified. **Owner gate:** Repo pushing permissions if not already connected.

**Agent phase instruction:** "Finish P09, perform final requirements traceability audit against `B14-A8-Cat_Ron.md`, include shortcomings rather than hiding them, and produce exact submit-ready links."

---

# 12 | Test plan / acceptance matrix

| ID | Scenario | Expected behavior |
|---|---|---|
| AUTH-01 | Register with password `Abcde1` | Pass (6 chars, upper/lower); server allows correct required policy |
| AUTH-02 | Register `abcdef`, `ABCDEF`, `Abc` | Each fails before account creation |
| AUTH-03 | Valid email registration | Redirect to Login, not automatically signed in |
| AUTH-04 | Login with wrong password | Toast/inline error; no browser alert |
| AUTH-05 | Google login | User session created; callback goes intended safe route/Home |
| AUTH-06 | Refresh signed-in private route | Stays on route without false login redirect |
| AUTH-07 | Anonymous visits `/books/:id` | Redirects to Login; returns after login |
| BOOK-01 | Add book | Database createdAt set; owner identity derived from JWT; copies initialized |
| BOOK-02 | New Arrivals | Latest six sorted in MongoDB descending |
| BOOK-03 | Public All Books | Responsive grid and every View Details CTA functional |
| BOOK-04 | User B edits/deletes user A book | 403; no database modification |
| BOOK-05 | Owner deletes book with active borrow | 409; book preserved |
| BORROW-01 | Borrow available book | copies decremented by exactly 1; active borrow saved |
| BORROW-02 | Same user borrows same book again | 409 with duplicate-borrow message |
| BORROW-03 | Two users compete for last copy | Exactly one success; copies stays >=0 |
| BORROW-04 | Borrow book with 0 copies | UI disabled; server also returns 409 |
| BORROW-05 | Return once then retry | Single increment only; second request fails cleanly |
| BORROW-06 | User B returns user A borrow | 403; no count change |
| API-01 | Missing, tampered, expired JWT | 401; no mutation |
| API-02 | Wrong issuer/audience | 401; no mutation |
| UI-01 | 360/768/1440 widths | No unintended overflow or unusable dialogs |
| UI-02 | Loading/empty/error states | Spinner/skeleton, readable empty state and toast |
| DEPLOY-01 | Hard refresh live private route | No 404 and session preserved |
| DEPLOY-02 | Production OAuth + imgbb + MongoDB | Real end-to-end operation succeeds |

**Testing discipline:** Record each as `PASS / FAIL / BLOCKED / NOT RUN`, date, environment, command/browser evidence and fixes. Mock data tests do not replace live database tests.

---

# 13 | Git and documentation practice

### 13.1 Commit strategy (minimum counts, not busywork)

**Client suggested 18 meaningful commits:** initial Next app; UI library/tokens; Navbar/Footer; home slider; public book cards; static sections; auth adapter; registration; login+Google; route guards; JWT API client; book image upload; add-book form; details+borrow UI; My Books; My Borrows; QA/responsiveness; README/deploy fixes.

**Server suggested 10 meaningful commits:** bootstrap; Mongo connection; collections/indexes; API validation/errors; JWT middleware; books read/create; books edit/delete; borrow transaction; return transaction; tests/docs/deploy.

One commit per coherent, tested change; do not fabricate commit history, artificially split one line into meaningless commits, or push secrets. Provide `git log --oneline` and counts in final audit.

### 13.2 Documentation files the agent maintains

- `docs/IMPLEMENTATION_LOG.md`: phase status, changes made, tests actually run, next task.
- `docs/DECISIONS.md`: any deviation/assumption, reason, assignment impact, owner approval.
- `docs/MANUAL_HANDOFFS.md`: pending/completed external setup and verification (never credentials).
- `docs/TEST_REPORT.md`: scenario evidence, failures, deployment smoke-test results.
- `.env.example`: variable names with placeholders only.
- `README.md`: install, run, architecture, features, URLs and deployment requirements.

---

# 14 | Pre-agreed decisions & unresolved items

| Decision | Status | Why / constraint |
|---|---|---|
| Product name = BookBar | OWNER-APPROVED CUSTOMIZATION | Owner explicitly replaces the assignment's BookNook branding; functional requirements remain applicable |
| Premium Midnight Editorial direction | OWNER-REQUESTED CUSTOMIZATION / PROPOSED DEFAULT | Owner requests a different premium style; navy, porcelain, copper, and editorial typography are the selected implementation defaults |
| Borrowing due period = 7 days | PROPOSED DEFAULT | Assignment doesn't prescribe number of days |
| Book delete blocked if active borrows | PROPOSED SAFETY RULE | Avoid orphaned returns and stock corruption |
| `GET /books?mine=true` | PROPOSED API DESIGN | Keep exactly eight Express endpoints |
| Profile reads Better Auth session | PROPOSED API DESIGN | No ninth Express user endpoint |
| imgbb upload through Next Server Action | PROPOSED DESIGN | API key stays private; no new Express API |
| Client/server both use TypeScript | PROPOSED TECH | Type safety, within assignment choices |
| Registration sign-up auto-login disabled | ASSIGNMENT ALIGNMENT | Email registration must go to Login |
| No email verification or password reset implementation | ASSIGNMENT REQUIRED | Explicit examiner instruction |
| Optional dark mode/animation | OPTIONAL | Add only after required features pass |

Agent should proceed with proposed defaults unless they break an assignment requirement or the owner explicitly changes them. Record changes rather than repeatedly asking low-value preferences.

---

# 15 | Official references checked when planning

Consult these live URLs again during implementation, as dependencies and provider UIs change:

1. Better Auth Next.js integration — https://better-auth.com/docs/integrations/next
2. Better Auth MongoDB adapter — https://better-auth.com/docs/adapters/mongo
3. Better Auth JWT / JWKS — https://better-auth.com/docs/plugins/jwt
4. Better Auth password options — https://better-auth.com/docs/reference/options
5. Better Auth Google OAuth — https://better-auth.com/docs/concepts/oauth
6. Better Auth installation/environment — https://better-auth.com/docs/installation
7. MongoDB transactions — https://www.mongodb.com/docs/manual/core/transactions/
8. Next.js authentication guide — https://nextjs.org/docs/app/guides/authentication

This blueprint was planned against the attached assignment file. Provider/dashboard details are external implementation guidance; they are **not** new assignment requirements.

---

# 16 | Copy/paste Master Agent Prompt (Codex / AI coding agent)

Paste the following into a new coding-agent conversation **after attaching or adding this blueprint and the original assignment to its workspace**.

```text
You are the senior full-stack engineer and implementation agent for BookBar.

READ FIRST:
1) B14-A8-Cat_Ron.md (assignment; highest authority for requirements)
2) BookBar_Master_Blueprint.md (architecture, phase plan, verification and defaults)
3) AGENTS.md (repository operational rules, if present)

MISSION:
Build BookBar from the supplied library assignment using two separate code repositories:
Next.js App Router/TypeScript + shadcn/Tailwind + Better Auth/MongoDB adapter
and Express/TypeScript + MongoDB with exactly eight assigned Express routes.
Use Better Auth JWT plugin/JWKS for API auth; implement transactional borrowing,
no double borrowing and available-copy controls.

WORKFLOW:
A. Inspect the workspace, git status, package versions and existing files first.
B. Follow P00 -> P09 in sequence. Complete one phase, run available checks,
   write docs/IMPLEMENTATION_LOG.md, and report acceptance status.
C. Use the attached assignment as the source of truth; apply the explicit
   BookBar naming override documented in docs/DECISIONS.md. Clearly distinguish
   assignment requirements, owner-approved changes, proposed defaults and
   optional enhancements.
D. Do not claim a phase COMPLETE until its objective and required tests pass.
   If a test cannot run, mark it BLOCKED or NOT RUN, not PASS.
E. Do not add extra Express routes, use fake persistence, trust client identity,
   expose secrets, fake screenshots, pretend an API call succeeded, or create
   commits without the corresponding meaningful changes.
F. When external owner-only setup is required (MongoDB, Google OAuth, imgbb,
   GitHub, Vercel, Render), STOP that dependent task and issue the EXACT
   BLOCKED_MANUAL template from section 9.4. Include dashboard path, fields,
   safe local env names, and how to confirm completion. Never request a secret
   pasted into chat. Continue independent coding only if safe.
G. When I respond 'DONE - [setup name]', inspect non-secret configuration
   presence, verify behavior, and RESUME THE SAME BLOCKED TASK. Do not restart.
H. Maintain DECISIONS, MANUAL_HANDOFFS, IMPLEMENTATION_LOG and TEST_REPORT.
I. At each phase report:
   STATUS: DONE / IN_PROGRESS / BLOCKED_MANUAL / BLOCKED_TECHNICAL
   FILES CHANGED, COMMANDS RUN, TESTS PASS/FAIL/NOT RUN, GIT COMMIT,
   OWNER ACTION REQUIRED (if any), NEXT PHASE.
J. Prioritize mandatory assignment requirements over optional polish.

START NOW WITH P00. Do not ask me non-blocking preference questions; use the
blueprint defaults. Ask only for required human-controlled setup when needed.
```

### 16.1 Generic resume prompt

```text
Resume BookBar from the latest docs/IMPLEMENTATION_LOG.md and
MANUAL_HANDOFFS.md. I have completed the requested manual step:
[DONE - EXACT GATE NAME].

Verify it safely without displaying secrets. Continue from the last blocked
acceptance item; do not reset, rewrite, or skip phases. Report actual checks.
```

### 16.2 Phase-specific prompt shortcut

```text
Read BookBar_Master_Blueprint.md section 11. Execute only phase [PXX].
Follow all dependencies, manual handoff rules and acceptance criteria.
Do not move to the next phase until the current phase is verified or
explicitly blocked. Update implementation log and provide a concise report.
```

---

# 17 | Final handoff checklist for the project owner

Before submission the agent must provide **actual**, not placeholder, links to the client GitHub repository, server GitHub repository, and production website; a summary of all P00–P09 statuses; client/server commit counts; API/borrow concurrency test outcome; Google OAuth production check; a list of known limitations; and confirmation that no secrets appear in committed files.

**Owner note (বাংলা):** Agent যখন `BLOCKED_MANUAL` বলবে, তুমি account/dashboard-এ নির্দেশিত কাজ করবে, `.env`-এ প্রয়োজনীয় secret নিজে বসাবে, তারপর শুধু `DONE - <gate name>` লিখবে। Agent verification চালিয়ে সেই জায়গা থেকেই development resume করবে। Assignment শেষ করার জন্য তোমাকে নিয়মিত code লিখতে হবে না; কেবল account setup, permission ও dashboard configuration-এর মতো human-only কাজগুলো করতে হবে।
