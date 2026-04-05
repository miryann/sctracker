import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';

function freshDb() {
	const db = new Database(':memory:');
	migrate(db);
	return db;
}

// Mirror of GET /api/export logic — tested directly against DB
function exportData(db: Database.Database) {
	const flights = db.prepare(`SELECT * FROM flights ORDER BY date ASC, id ASC`).all();
	const year_config = db.prepare(`SELECT * FROM year_config LIMIT 1`).get();
	return { flights, year_config };
}

describe('export', () => {
	let db: Database.Database;

	beforeEach(() => { db = freshDb(); });

	it('returns empty flights array when no flights exist', () => {
		const { flights } = exportData(db);
		expect(flights).toEqual([]);
	});

	it('returns year_config in correct shape', () => {
		const { year_config } = exportData(db) as { year_config: Record<string, unknown> };
		expect(year_config).toBeDefined();
		expect(year_config).toHaveProperty('target_sc');
		expect(year_config).toHaveProperty('year_start');
		expect(year_config).toHaveProperty('year_end');
		expect(year_config).toHaveProperty('ground_sc_earned');
		expect(year_config).toHaveProperty('rollover_sc');
	});

	it('includes all inserted flights ordered by date', () => {
		db.exec(`
      INSERT INTO flights (route, date, cabin, sc_value, status) VALUES ('MEL-BNE', '2026-03-01', 'economy', 10, 'flown');
      INSERT INTO flights (route, date, cabin, sc_value, status) VALUES ('SYD-MEL', '2026-01-15', 'economy', 10, 'booked');
    `);
		const { flights } = exportData(db) as { flights: Array<{ route: string; date: string }> };
		expect(flights).toHaveLength(2);
		expect(flights[0].date).toBe('2026-01-15');
		expect(flights[1].date).toBe('2026-03-01');
	});

	it('export shape has both flights and year_config keys', () => {
		const data = exportData(db);
		expect(Object.keys(data)).toContain('flights');
		expect(Object.keys(data)).toContain('year_config');
	});
});
