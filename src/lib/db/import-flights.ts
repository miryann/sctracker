import type Database from 'better-sqlite3';
import { lookupSC } from './sc-lookup.js';

export type ImportRow = {
	route: string;
	date: string;
	cabin: string | null;
	fare_class: string | null;
	status: string;
	notes: string | null;
	sc_value?: number | null;
};

export type ImportResult = {
	imported: number;
	skipped: number;
};

export type ImportValidationError = {
	row: number;
	message: string;
};

const VALID_CABINS = new Set(['economy', 'business', 'first']);
const VALID_STATUSES = new Set(['flown', 'booked', 'planned']);

/**
 * Validate and batch-import flights into the DB.
 * Server re-validates all fields regardless of client preview.
 * Duplicates (same route + date) are skipped and counted.
 * Throws an error (with row info) if any row fails validation.
 */
export function importFlights(db: Database.Database, rows: ImportRow[]): ImportResult {
	// Validate all rows first — fail fast before touching the DB
	for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const rowNum = i + 1;
		if (!r.route || typeof r.route !== 'string') {
			throw new Error(`Row ${rowNum}: route is required.`);
		}
		if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
			throw new Error(`Row ${rowNum}: invalid date "${r.date}".`);
		}
		if (!r.cabin || !VALID_CABINS.has(r.cabin)) {
			throw new Error(`Row ${rowNum}: cabin must be economy, business, or first.`);
		}
		if (!r.status || !VALID_STATUSES.has(r.status)) {
			throw new Error(`Row ${rowNum}: status must be flown, booked, or planned.`);
		}
	}

	const insertStmt = db.prepare(
		`INSERT INTO flights (route, date, cabin, fare_class, sc_value, status, notes)
     VALUES (@route, @date, @cabin, @fare_class, @sc_value, @status, @notes)`
	);

	const dupCheckStmt = db.prepare(
		`SELECT id FROM flights WHERE route = ? AND date = ? LIMIT 1`
	);

	let imported = 0;
	let skipped = 0;

	const doImport = db.transaction(() => {
		for (const r of rows) {
			const routeUpper = r.route.toUpperCase();
			const dup = dupCheckStmt.get(routeUpper, r.date);
			if (dup) {
				skipped++;
				continue;
			}

			let sc_value: number;
			if (typeof r.sc_value === 'number' && r.sc_value > 0) {
				sc_value = r.sc_value;
			} else {
				const looked = lookupSC(db, routeUpper, r.cabin as string, r.fare_class ?? null);
				sc_value = looked ?? 0;
			}

			insertStmt.run({
				route: routeUpper,
				date: r.date,
				cabin: r.cabin,
				fare_class: r.fare_class ?? null,
				sc_value,
				status: r.status,
				notes: r.notes ?? null
			});
			imported++;
		}
	});

	doImport();

	return { imported, skipped };
}
