import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from './migrate.js';
import { classifyRoute, lookupSC } from './sc-lookup.js';

// Minimal seed for lookup tests — only what's needed to exercise all 4 steps.
function seedMinimal(db: Database.Database) {
	db.exec(`
    -- MEL-SYD: step 1 (exact tier) + step 2 (NULL fallback)
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES ('MEL-SYD', null, 'economy', 'discount',  10);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES ('MEL-SYD', null, 'economy', 'economy',   15);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES ('MEL-SYD', null, 'economy', 'flexible',  15);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES ('MEL-SYD', null, 'economy', null,        10);

    -- Type-level tier rows (step 2.5)
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES (null, 'trans_tasman',  'economy', 'discount',  20);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES (null, 'trans_tasman',  'economy', 'economy',   25);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES (null, 'trans_tasman',  'economy', 'flexible',  40);

    -- Type-level NULL fallback rows (step 3)
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES (null, 'trans_tasman',  'economy',  null, 20);
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value) VALUES (null, 'international', 'economy',  null, 45);
  `);
}

describe('classifyRoute', () => {
	it('domestic: AU–AU', () => {
		expect(classifyRoute('MEL-SYD')).toBe('domestic');
		expect(classifyRoute('SYD-PER')).toBe('domestic');
	});

	it('trans_tasman: AU–NZ and NZ–AU', () => {
		expect(classifyRoute('SYD-AKL')).toBe('trans_tasman');
		expect(classifyRoute('AKL-SYD')).toBe('trans_tasman');
		expect(classifyRoute('MEL-CHC')).toBe('trans_tasman');
	});

	it('international: everything else', () => {
		expect(classifyRoute('MEL-SIN')).toBe('international');
		expect(classifyRoute('SYD-LAX')).toBe('international');
	});

	it('unknown single code → international', () => {
		expect(classifyRoute('XYZ')).toBe('international');
	});
});

describe('lookupSC', () => {
	let db: Database.Database;

	beforeEach(() => {
		db = new Database(':memory:');
		migrate(db);
		seedMinimal(db);
	});

	it('step 1 — exact route + cabin + fare_class', () => {
		expect(lookupSC(db, 'MEL-SYD', 'economy', 'economy')).toBe(15);
		expect(lookupSC(db, 'MEL-SYD', 'economy', 'flexible')).toBe(15);
		expect(lookupSC(db, 'MEL-SYD', 'economy', 'discount')).toBe(10);
	});

	it('step 2 — route + cabin NULL fallback (no fare_class)', () => {
		expect(lookupSC(db, 'MEL-SYD', 'economy', null)).toBe(10);
	});

	it('step 2.5 — type-level tier fallback for unseeded route', () => {
		// SYD-CHC is trans_tasman but not seeded per-route
		expect(lookupSC(db, 'SYD-CHC', 'economy', 'flexible')).toBe(40);
		expect(lookupSC(db, 'SYD-CHC', 'economy', 'economy')).toBe(25);
		expect(lookupSC(db, 'SYD-CHC', 'economy', 'discount')).toBe(20);
	});

	it('step 3 — type-level NULL fallback for unseeded route with no fare_class', () => {
		expect(lookupSC(db, 'SYD-CHC', 'economy', null)).toBe(20);
	});

	it('step 4 — no match returns null', () => {
		// business class has no type-level rows in the minimal seed
		expect(lookupSC(db, 'XYZ-ABC', 'business', null)).toBeNull();
	});

	it('step 3 — international NULL fallback', () => {
		expect(lookupSC(db, 'MEL-LAX', 'economy', null)).toBe(45);
	});
});
