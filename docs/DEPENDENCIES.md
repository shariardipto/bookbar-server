# BookBar Dependency Baseline

Recorded: 05 November 2026 (Asia/Dhaka). Node.js 24.22.2; npm 11.19.1.

Direct versions below are exact in each package.json; package-lock.json records the complete resolved graph. Development setup uses npm ci --include=dev.

## bookbar-client (P01)

| Package | Version | Kind |
| --- | --- | --- |
| @fontsource/dm-serif-display | 5.3.0 | runtime |
| @fontsource/manrope | 5.3.0 | runtime |
| class-variance-authority | 0.7.1 | runtime |
| cn | 0.5.2 | runtime |
| lucide-react | 1.69.0 | runtime |
| next | 16.4.5 | runtime |
| radix-ui | 1.8.1 | runtime |
| react | 19.3.1 | runtime |
| react-dom | 19.3.1 | runtime |
| swiper | 14.4.0 | runtime |
| tw-animate-css | 1.4.0 | runtime |
| @axe-core/playwright | 4.14.0 | development |
| @playwright/test | 1.64.1 | development |
| @tailwindcss/postcss | 4.3.4 | development |
| @types/node | 24.19.2 | development |
| @types/react | 19.3.0 | development |
| @types/react-dom | 19.3.0 | development |
| eslint | 9.39.5 | development |
| eslint-config-next | 16.4.5 | development |
| postcss | 8.5.32 | development |
| tailwindcss | 4.3.4 | development |
| typescript | 6.0.3 | development |
| vitest | 5.1.0 | development |

## bookbar-server

| Package | Version | Kind |
| --- | --- | --- |
| cors | 2.8.6 | runtime |
| dotenv | 18.0.9 | runtime |
| express | 5.3.0 | runtime |
| helmet | 8.3.0 | runtime |
| zod | 4.6.7 | runtime |
| @eslint/js | 10.0.1 | development |
| @types/cors | 2.8.19 | development |
| @types/express | 5.0.6 | development |
| @types/node | 24.19.2 | development |
| @types/supertest | 7.2.1 | development |
| eslint | 10.14.0 | development |
| supertest | 7.3.1 | development |
| tsx | 4.23.15 | development |
| typescript | 6.0.3 | development |
| typescript-eslint | 8.72.1 | development |
| vitest | 5.1.0 | development |

## Compatibility notes

The client uses ESLint 9.39.5 because the Next.js preset includes React/import/accessibility plugins whose peer ranges exclude ESLint 10. npm marks this ESLint line deprecated; revisit when the preset plugins support a maintained major. The server uses ESLint 10. Both repositories override the affected typescript-estree minimatch dependency to patched 11.0.4; the server also overrides the affected ESLint/config-array dependencies. These overrides are scoped to the affected tooling packages, preserving older minimatch APIs needed by other dependencies. Lint/build/test checks verify the resulting local tooling. The overrides address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) and should be removed once upstream ranges resolve a patched version without them.

Future phases add and verify their feature dependencies when used.

## P01 additions

Swiper 14 provides the three-slide hero; Radix/shadcn source components implement the controls and mobile navigation. Fontsource assets are served locally through next/font/local. The shadcn CLI shared CSS was ejected, and its CLI package removed from application dependencies. Playwright/axe are development-only verification tools. Final P01 npm audit reports zero vulnerabilities.
