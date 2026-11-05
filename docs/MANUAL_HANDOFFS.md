# BookBar Manual Handoffs

Updated: 05 November 2026 (Asia/Dhaka).

No manual owner action is required for local P00. Neither app needs provider credentials to run its baseline. No private `.env` file or real provider credentials have been generated.

| Gate | Relevant phase | Status |
| --- | --- | --- |
| MANUAL-MONGO-01 — Atlas cluster, user, network access, private URI in both apps | P02 | NOT REQUESTED |
| MANUAL-AUTH-01 — Private Better Auth secret | P03 | NOT REQUESTED |
| MANUAL-GOOGLE-01 — Google OAuth client and local callbacks | P03 | NOT REQUESTED |
| MANUAL-IMAGE-01 — Private imgbb key | P06 | NOT REQUESTED |
| MANUAL-DEPLOY-01 — Vercel project/environment | P08 | NOT REQUESTED |
| MANUAL-DEPLOY-02 — Render service/environment | P08 | NOT REQUESTED |
| MANUAL-GOOGLE-PROD-01 — Final production OAuth origin/callback | P08 | NOT REQUESTED |
| GitHub repository access / publication | Before the first remote push is needed | NOT REQUESTED |

At each relevant dependency, follow the exact handoff template in `AGENTS.md`. Secrets belong in ignored local environment files or provider dashboards, never chat. A gate is complete only after the corresponding real integration check, not merely after a value is present. Resume from the same checkpoint after owner setup.
