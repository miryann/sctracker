# Changelog

All notable changes to sctracker are documented here.

## [0.1.0.0] - 2026-04-05

### Added
- **Edit flights**: click the ✎ button on any flight row to edit route, date, cabin, fare class, status, notes, or SC value. Status transitions work in both directions (planned ↔ booked ↔ flown). SC re-lookups automatically on route/cabin/fare class change.
- **Pace alert banner**: dashboard now shows an urgent alert when you still need more than 10 SC/day to hit Platinum. Dismisses per-rate (resets when you book more flights, so it can't be permanently ignored).
- **Notes column**: planner table shows flight notes, truncated to 30 chars with full text on hover. Empty notes show `—`.
- **JSON export**: Settings → Export JSON downloads all flights + year config as a dated backup file.
- **Flighty CSV import**: Settings → Import from Flighty CSV. Parses your Flighty export, shows a preview table with SC values looked up automatically. Amber rows (missing cabin or no SC rule) require cabin selection or manual SC entry before import. Duplicate flights (same route + date) are skipped and counted.

### Changed
- Planner table now includes an edit button and notes column per flight row.
- Dashboard layout updated with pace alert banner slot above the stats cards.
- Settings page expanded with Data section (export + import).

## [0.0.0.0] - 2026-03-30

### Added
- Initial release: Qantas SC tracker v1. 162 SC rules, 16/16 tests, Docker deployment.
