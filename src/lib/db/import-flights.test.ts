import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';
import { importFlights } from './import-flights.js';

// Minimal seed so lookupSC has something to fall back on
function seedMinimal(db: Database.Database) {
	db.exec(`
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value)
    VALUES (null, 'domestic', 'economy', null, 10);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value)
    VALUES (null, 'domestic', 'business', null, 40);
  `);
}

function freshDb() {
	const db = new Database(':memory:');
	migrate(db);
	seedMinimal(db);
	return db;
}

const base = {
	route: 'SYD-MEL',
	date: '2026-01-15',
	cabin: 'economy' as const,
	fare_class: null,
	status: 'flown' as const,
	notes: 'QFA 407'
};

describe('importFlights', () => {
	let db: Database.Database;

	beforeEach(() => { db = freshDb(); });

	it('inserts valid rows and returns correct counts', () => {
		const result = importFlights(db, [base]);
		expect(result).toEqual({ imported: 1, skipped: 0 });
		const row = db.prepare(`SELECT * FROM flights WHERE route = 'SYD-MEL'`).get() as Record<string, unknown>;
		expect(row.cabin).toBe('economy');
		expect(row.status).toBe('flown');
	});

	it('skips duplicate route+date and counts skipped', () => {
		importFlights(db, [base]);
		const result = importFlights(db, [base, { ...base, route: 'MEL-BNE' }]);
		expect(result).toEqual({ imported: 1, skipped: 1 });
	});

	it('dedup key is route+date, not status', () => {
		importFlights(db, [base]);
		// Same route+date but different status — should still be skipped
		const result = importFlights(db, [{ ...base, status: 'booked' }]);
		expect(result.skipped).toBe(1);
	});

	it('uses provided sc_value when given', () => {
		importFlights(db, [{ ...base, sc_value: 99 }]);
		const row = db.prepare(`SELECT sc_value FROM flights WHERE route = 'SYD-MEL'`).get() as { sc_value: number };
		expect(row.sc_value).toBe(99);
	});

	it('looks up sc_value from rules when not provided', () => {
		importFlights(db, [{ ...base, sc_value: null }]);
		const row = db.prepare(`SELECT sc_value FROM flights WHERE route = 'SYD-MEL'`).get() as { sc_value: number };
		expect(row.sc_value).toBe(10); // domestic economy fallback
	});

	it('throws on missing route', () => {
		expect(() => importFlights(db, [{ ...base, route: '' }])).toThrow(/route is required/);
	});

	it('throws on invalid date format', () => {
		expect(() => importFlights(db, [{ ...base, date: '15-01-2026' }])).toThrow(/invalid date/i);
	});

	it('throws on invalid cabin', () => {
		expect(() => importFlights(db, [{ ...base, cabin: 'premium' as 'economy' }])).toThrow(/cabin must be/);
	});

	it('throws on invalid status', () => {
		expect(() => importFlights(db, [{ ...base, status: 'cancelled' as 'flown' }])).toThrow(/status must be/);
	});

	it('inserts multiple rows in one call', () => {
		const rows = [
			base,
			{ ...base, route: 'MEL-BNE', date: '2026-02-01', notes: 'QFA 677' },
			{ ...base, route: 'BNE-SYD', date: '2026-03-01', notes: 'QFA 500' }
		];
		const result = importFlights(db, rows);
		expect(result).toEqual({ imported: 3, skipped: 0 });
	});

	it('uppercases route before dedup check', () => {
		importFlights(db, [base]); // SYD-MEL is stored uppercase
		const result = importFlights(db, [{ ...base, route: 'syd-mel' }]);
		expect(result.skipped).toBe(1);
	});
});
