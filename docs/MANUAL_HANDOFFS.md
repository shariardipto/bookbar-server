# BookBar Manual Handoffs

Updated: 05 November 2026 (Asia/Dhaka).

No manual owner action is required for local P00/P01. Neither app needs provider credentials for its current baseline/collection preview. No private `.env` file or real provider credentials have been generated.

| Gate | Relevant phase | Status |
| --- | --- | --- |
| MANUAL-MONGO-01 — Atlas cluster, user, network access, private URI in both apps | P02 | NOT REQUESTED |
| MANUAL-AUTH-01 — Private Better Auth secret | P03 | NOT REQUESTED |
| MANUAL-GOOGLE-01 — Google OAuth client and local callbacks | P03 | NOT REQUESTED |
| MANUAL-IMAGE-01 — Private imgbb key | P06 | NOT REQUESTED |
| MANUAL-DEPLOY-01 — Vercel project/environment | P08 | NOT REQUESTED |
| MANUAL-DEPLOY-02 — Render service/environment | P08 | NOT REQUESTED |
| MANUAL-GOOGLE-PROD-01 — Final production OAuth origin/callback | P08 | NOT REQUESTED |
| GitHub repository access / publication | Before the next remote push is needed | Local `origin` remotes/tracking branches are now present; no push performed or access test requested in P01 |
| Public contact address and BookBar social profile URLs | Before final public delivery | NOT REQUESTED; honest coming-soon notices/platform links used in P01, no invented contact/profile |

At each relevant dependency, follow the exact handoff template in `AGENTS.md`. Secrets belong in ignored local environment files or provider dashboards, never chat. A gate is complete only after the corresponding real integration check, not merely after a value is present. Resume from the same checkpoint after owner setup.
