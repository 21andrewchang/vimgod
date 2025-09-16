# Repository Guidelines

## Project Structure & Module Organization
App code lives in `src/`. Route-driven features go under `src/routes` (e.g., `profile/+page.svelte`, `waitlist/+page.ts`) while reusable UI stays in `src/lib/components` and shared helpers in `src/lib/utils.ts`. Supabase access flows through `src/lib/supabaseClient.ts`; update environment values there. Drop static assets and fonts into `static/`, and keep Playwright scenarios in `e2e/` so feature work and acceptance checks remain side-by-side.

## Build & Development Workflow
Run `npm run dev` for the Vite dev server; pass `-- --open` when you want a browser tab instantly. Ship bundles with `npm run build` and smoke-test them using `npm run preview` right before deploying. Use `npm run check` to confirm the TypeScript and SvelteKit graph looks healthy, but skip it when moving fast and fixing visuals—prioritize unblocking feature delivery. `npm run lint` and `npm run format` are available when code churn slows down.

## Rapid Delivery Principles
Favor iteration speed over ceremony. Start by scaffolding UI/UX in `src/routes`, wire data quickly via Supabase helpers, and push rough edges behind TODO comments rather than blocking a merge. Capture the product direction in PR descriptions so collaborators stay aligned. If you uncover ideas for later polish, open issues or leave breadcrumbs in code comments instead of stretching timelines.

## Lightweight Quality Checks
Manual verification is the baseline: click through the feature path, confirm core interactions, and note gaps in the PR body. Trigger `npm run test:e2e` only when flows stabilize or before demos; unit suites (`*.spec.ts`) are optional and can be deferred unless debugging a tricky regression. When skipping automated checks, call it out explicitly so reviewers know the current risk level.

## Commit & Pull Request Guidelines
Follow the Conventional Commit prefixes already in history (`feat:`, `fix:`, `chore:`) and keep each commit scoped to a shippable slice (`feat: profile badge hover state`). Draft PRs early, include a short narrative of what the feature enables, attach screenshots or clips for UI, and list any corners left for follow-up. Mark PRs ready once you've done a manual walkthrough and ensured `.env` expectations are documented.
