# TODOS

## P2 — SC values freshness verification

**What:** Add a last-verified date comment to `seed.ts` and a process for re-verifying SC values after any Qantas program change.

**Why:** Qantas changed their earning structure in Feb 2026. The seed values are user-verified as of 2026-03-30. If Qantas changes again (likely — they do this periodically), there is no mechanism that flags the seed data as potentially stale. Wrong SC values silently corrupt all future flight records.

**Pros:** Easy to implement (just a comment + a note to check). Creates a forcing function for data freshness.

**Cons:** Manual process, not automated. A script to scrape Qantas earning tables would be more reliable but much more effort.

**Context:** The current seed data was verified by the user against Qantas earning tables on 2026-03-30. Add `// Last verified: 2026-03-30` at the top of the seed rules in `seed.ts`. Create a habit of re-running `npm run seed` only after verifying against https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables.html.

**Where to start:** Add a comment block to `src/lib/db/seed.ts` above the route data with the verification date and a reminder URL.

**Effort:** XS (human: 5 min / CC: 1 min)
**Priority:** P2
**Depends on:** This plan (seed.ts rewrite)

---

## P3 — EditFlightModal: handle 404 gracefully

**What:** If a flight is deleted while EditFlightModal is open, the PUT returns 404. Currently this would be a silent failure (no error shown, modal just closes or hangs).

**Why:** Currently a silent failure — user edits a flight, clicks Save, nothing happens, no error shown. Rare in practice (single-user tool), but jarring.

**Pros:** Simple fix. One extra `if (res.status === 404)` branch in EditFlightModal's submit handler.

**Cons:** Extremely rare race condition on a single-user app. Low priority.

**Context:** EditFlightModal calls `PUT /api/flights/[id]`. If the flight was concurrently deleted (different tab), the server returns 404. The AddFlightModal equivalent doesn't have this issue (POST creates new). Just add: `if (res.status === 404) { err = 'This flight no longer exists.'; saving = false; return; }` in the submit handler.

**Where to start:** `src/lib/components/EditFlightModal.svelte` — submit function, after the fetch call.

**Effort:** XS (human: 5 min / CC: 1 min)
**Priority:** P3
**Depends on:** EditFlightModal implementation (v2)
