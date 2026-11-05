# AGENTS.md — BookBar Coding-Agent Contract

> Put this file at the workspace root, alongside `BookBar_Master_Blueprint.md` and `B14-A8-Cat_Ron.md`. Read all three and `docs/DECISIONS.md` before changing code.

## Mission
Build **BookBar**, based on the supplied library assignment, as **two separate repositories**: Next.js App Router client (TypeScript, Better Auth MongoDB adapter, JWT client, Tailwind/shadcn UI) and Express API server (TypeScript, MongoDB, JWT JWKS verifier). The source assignment is the grading authority. The owner explicitly renamed the product from BookNook to BookBar; this recorded branding override applies to all product copy, page titles, and submission materials. The blueprint is the architecture, defaults, tests and ordered implementation plan. Use its Midnight Editorial premium visual direction (navy, porcelain, copper, and editorial typography).

## Non-negotiable working rules

1. Run through phases **P00 -> P09** in `BookBar_Master_Blueprint.md` section 11. Don't skip required phase exits.
2. Inspect current directories and git status; do not overwrite existing owner changes or delete untracked work.
3. Express implements **exactly 8 assigned API endpoints**. Better Auth route handlers belong to Next.js, not Express. Use a Next.js Server Action for authenticated imgbb image uploads rather than another Express route.
4. Sessions are owned by Better Auth in Next.js. Express verifies service JWT signature, issuer, audience and expiry through Next's JWKS using `jose`, and derives user identity from verified JWT, never from request body/email.
5. Email registration must enforce assignment minimum **6 characters + uppercase + lowercase**, including server-side validation; set Better Auth minimum length to 6, disable email sign-up auto-login, and redirect to login. Do not implement email verification or password reset.
6. Borrow/return must use MongoDB transactions and `$inc`. Use unique active borrows index `(bookId,userId)` and reject duplicate active borrow, zero copies, unauthorized return and deleting a book with active borrows.
7. Maintain meaningful Git commits (client >=15; server >=8), current `README.md`, `.env.example`, and `docs/{DECISIONS,IMPLEMENTATION_LOG,MANUAL_HANDOFFS,TEST_REPORT}.md`.
8. No `alert()`, browser `confirm()`, lorem ipsum, fabricated test passes, fake provider credentials, fake repos or placeholders presented as completed integrations.
9. Run relevant lint/typecheck/build/tests and report actual results; mark anything unrun `NOT RUN` or `BLOCKED`.
10. Keep secrets out of source control, logs, screenshots and chat. Never ask the owner to paste Mongo URI/password, Better Auth secret, Google client secret or imgbb API key into a conversation. Request the owner enter them in private local `.env` or provider settings.
11. If a requirement conflicts with a proposed decision, the assignment wins, except for the explicit owner-approved BookBar naming override recorded in `docs/DECISIONS.md`. Record consequential changes in that file. Avoid unnecessary preference questions; use documented defaults.

## Manual handoff protocol

When owner-only provider/dashboard work is blocking, respond:

```text
STATUS: BLOCKED_MANUAL
PHASE / TASK: ...
WHAT I FINISHED: ...
WHY I CANNOT CONTINUE: ...
OWNER ACTIONS:
  1. [Dashboard website + exact navigation]
  2. [Exact variable names and where to enter them privately]
  3. [Callback URLs / allowed origins / network access if applicable]
DO NOT SHARE IN CHAT: [secrets relevant to this gate]
SAFE RESPONSE: DONE - [GATE NAME]
AFTER OWNER REPLIES: [verification commands/checks]
NEXT STEP: [precise blocked task to resume]
```

Owner manual setup gates: `MANUAL-MONGO-01`, `MANUAL-AUTH-01`, `MANUAL-GOOGLE-01`, `MANUAL-IMAGE-01`, `MANUAL-DEPLOY-01`, `MANUAL-DEPLOY-02`, `MANUAL-GOOGLE-PROD-01`. GitHub access may need a separate gate. Continue safe independent work, but **do not call the dependent phase complete** without verifying the setup.

If owner says `DONE - [GATE NAME]`, resume from the corresponding checkpoint, check environment variable presence without echoing values, run a real smoke test and update the handoff log. Do not restart the project.

## Each phase response format

```text
PHASE: PXX
STATUS: DONE / IN_PROGRESS / BLOCKED_MANUAL / BLOCKED_TECHNICAL
IMPLEMENTED: [specific files and user-visible functionality]
COMMANDS RUN: [actual command list]
TEST RESULTS: [PASS / FAIL / NOT RUN / BLOCKED]
GIT COMMIT: [actual hash or 'not yet committed']
MANUAL OWNER ACTION: [precise action or 'none']
NEXT STEP: [PXX task / next phase]
```

## First action

Read the current code, all three documents and the phase log. If there is no existing implementation, begin **P00**; otherwise determine the earliest incomplete phase and continue. Don't ask for credentials before a feature actually requires them.
