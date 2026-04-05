import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';
import { seedDB, EXPECTED_ROW_COUNT } from './seed.js';

function freshDB() {
	const db = new Database(':memory:');
	migrate(db);
	return db;
}

describe('seedDB', () => {
	it('seeds exactly 162 rows on first run', () => {
		const db = freshDB();
		const count = seedDB(db);
		expect(count).toBe(EXPECTED_ROW_COUNT);
	});

	it('idempotent — 162 rows after two runs (DELETE+INSERT in transaction)', () => {
		const db = freshDB();
		seedDB(db);
		const count = seedDB(db);
		expect(count).toBe(EXPECTED_ROW_COUNT);
	});

	it('108 route-level tier rows (36 routes × 3 tiers)', () => {
		const db = freshDB();
		seedDB(db);
		const { count } = db
			.prepare(`SELECT COUNT(*) as count FROM sc_rules WHERE fare_class IS NOT NULL AND route IS NOT NULL`)
			.get() as { count: number };
		expect(count).toBe(108);
	});

	it('36 route-level NULL fallback rows', () => {
		const db = freshDB();
		seedDB(db);
		const { count } = db
			.prepare(`SELECT COUNT(*) as count FROM sc_rules WHERE fare_class IS NULL AND route IS NOT NULL`)
			.get() as { count: number };
		expect(count).toBe(36);
	});

	it('18 type-level rows (9 tier + 9 NULL fallback)', () => {
		const db = freshDB();
		seedDB(db);
		const { count } = db
			.prepare(`SELECT COUNT(*) as count FROM sc_rules WHERE route IS NULL`)
			.get() as { count: number };
		expect(count).toBe(18);
	});

	it('MEL-SYD economy tier values match verified data', () => {
		const db = freshDB();
		seedDB(db);
		const rows = db
			.prepare(`SELECT fare_class, sc_value FROM sc_rules WHERE route = 'MEL-SYD' AND cabin = 'economy' ORDER BY fare_class`)
			.all() as { fare_class: string | null; sc_value: number }[];
		const byTier = Object.fromEntries(rows.map((r) => [r.fare_class ?? 'null', r.sc_value]));
		expect(byTier['discount']).toBe(10);
		expect(byTier['economy']).toBe(15);
		expect(byTier['flexible']).toBe(15);
		expect(byTier['null']).toBe(10); // NULL fallback = discount
	});
});
