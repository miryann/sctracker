# sctracker

Qantas Frequent Flyer status credits planner and tracker.
Target: Platinum (1,400 SCs/year, 1 Jul–30 Jun).

## Stack
- SvelteKit 2.20.6 + Svelte 4 + Vite 5
- better-sqlite3 (SQLite at `data/sctracker.db`)
- Tailwind CSS 3
- @sveltejs/adapter-node (Docker deployment)

## Architecture
- Self-hosted Docker container. No cloud. Home lab only.
- SvelteKit handles both frontend and API routes in one process.
- SQLite is the permanent datastore (no Postgres migration planned).
- Gap/velocity calculations are client-side in Svelte reactive stores.

## Key domain rules
- Status year: 1 Jul–30 Jun
- Platinum threshold: 1,400 SCs
- Ground earning SCs: max 140/year (Feb 2026 program), capped server-side
- Rollover SC: max 500 for Platinum, display-only in v1
- "What if" toggle only applies to `planned` flights (booked always included)
- SC lookup priority: exact route+cabin+fare_class → route+cabin → route_type+cabin → manual entry

## Dev
```bash
npm run dev       # local dev server
npm run build     # production build
npm run seed      # seed SC earning rules (run once, verify values first!)
npm run migrate   # run DB migrations (also runs on app startup)
```

## Deploy
```bash
docker compose up -d --build
```
Data persists in Docker volume `sctracker-data`.

## SC rules
Seeded from Qantas earning tables. Verify values before relying on them:
https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables.html

Edit via `src/lib/db/seed.ts`, then `npm run seed`.
SC rules UI is read-only in v1.

## User preferences
- Self-hosted home lab. No cloud dependencies ever.
- Direct, no softening. State problems plainly.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
