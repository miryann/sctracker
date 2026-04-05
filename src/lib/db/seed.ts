/**
 * Seed Qantas SC earning rules.
 * Run once: npm run seed
 *
 * SC values sourced from Qantas earning tables. Verify before relying on them:
 * https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables.html
 *
 * Last verified: 2026-03-30 (after Feb 2026 program change)
 * Re-verify after any Qantas program change before re-seeding.
 *
 * All SCs are one-way per sector, Economy cabin unless noted.
 * Business class not seeded per-route — type-level fallbacks apply.
 */

import type Database from 'better-sqlite3';

export type SeedRule = {
	route: string | null;
	route_type: string | null;
	cabin: string;
	fare_class: string | null;
	sc_value: number;
};

// ─── Route-level economy rules ─────────────────────────────────────────────────
// 18 pairs × 2 directions = 36 directional routes
// Each route: 3 tier rows (discount/economy/flexible) + 1 NULL fallback = 4 rows
// 36 × 4 = 144 route-level rows

type RouteSpec = { route: string; discount: number; economy: number; flexible: number };

const ROUTES: RouteSpec[] = [
	// ── Domestic ──────────────────────────────────────────────────────────────
	{ route: 'MEL-SYD', discount: 10, economy: 15, flexible: 15 },
	{ route: 'SYD-MEL', discount: 10, economy: 15, flexible: 15 },
	{ route: 'MEL-CBR', discount: 10, economy: 15, flexible: 15 },
	{ route: 'CBR-MEL', discount: 10, economy: 15, flexible: 15 },
	{ route: 'MEL-BNE', discount: 10, economy: 15, flexible: 20 },
	{ route: 'BNE-MEL', discount: 10, economy: 15, flexible: 20 },
	{ route: 'MEL-PER', discount: 15, economy: 20, flexible: 30 },
	{ route: 'PER-MEL', discount: 15, economy: 20, flexible: 30 },
	{ route: 'SYD-PER', discount: 15, economy: 20, flexible: 30 },
	{ route: 'PER-SYD', discount: 15, economy: 20, flexible: 30 },
	{ route: 'SYD-BNE', discount: 10, economy: 15, flexible: 15 },
	{ route: 'BNE-SYD', discount: 10, economy: 15, flexible: 15 },
	// ── Trans-Tasman ──────────────────────────────────────────────────────────
	{ route: 'SYD-AKL', discount: 20, economy: 25, flexible: 40 },
	{ route: 'AKL-SYD', discount: 20, economy: 25, flexible: 40 },
	{ route: 'SYD-WLG', discount: 20, economy: 25, flexible: 40 },
	{ route: 'WLG-SYD', discount: 20, economy: 25, flexible: 40 },
	{ route: 'BNE-AKL', discount: 20, economy: 25, flexible: 40 },
	{ route: 'AKL-BNE', discount: 20, economy: 25, flexible: 40 },
	{ route: 'BNE-WLG', discount: 20, economy: 25, flexible: 40 },
	{ route: 'WLG-BNE', discount: 20, economy: 25, flexible: 40 },
	{ route: 'MEL-AKL', discount: 20, economy: 25, flexible: 40 },
	{ route: 'AKL-MEL', discount: 20, economy: 25, flexible: 40 },
	{ route: 'MEL-WLG', discount: 20, economy: 25, flexible: 40 },
	{ route: 'WLG-MEL', discount: 20, economy: 25, flexible: 40 },
	// ── International ─────────────────────────────────────────────────────────
	{ route: 'MEL-SIN', discount: 30, economy: 45, flexible: 60 },
	{ route: 'SIN-MEL', discount: 30, economy: 45, flexible: 60 },
	{ route: 'PER-SIN', discount: 30, economy: 45, flexible: 60 },
	{ route: 'SIN-PER', discount: 30, economy: 45, flexible: 60 },
	{ route: 'BNE-SIN', discount: 30, economy: 45, flexible: 60 },
	{ route: 'SIN-BNE', discount: 30, economy: 45, flexible: 60 },
	{ route: 'MEL-LAX', discount: 45, economy: 60, flexible: 90 },
	{ route: 'LAX-MEL', discount: 45, economy: 60, flexible: 90 },
	{ route: 'PER-LAX', discount: 60, economy: 80, flexible: 120 },
	{ route: 'LAX-PER', discount: 60, economy: 80, flexible: 120 },
	{ route: 'BNE-LAX', discount: 45, economy: 60, flexible: 90 },
	{ route: 'LAX-BNE', discount: 45, economy: 60, flexible: 90 },
];

// ─── Type-level fallback rows ──────────────────────────────────────────────────
// 9 tier rows (economy only, for unseeded routes that specify a fare tier)
// 9 NULL rows (all cabins, for when no fare tier is specified)
// Total: 18 type-level rows

const TYPE_LEVEL_RULES: SeedRule[] = [
	// Tier rows — step 2.5 in sc-lookup (discount/economy/flexible for economy cabin)
	{ route: null, route_type: 'domestic',      cabin: 'economy', fare_class: 'discount',  sc_value: 10 },
	{ route: null, route_type: 'domestic',      cabin: 'economy', fare_class: 'economy',   sc_value: 15 },
	{ route: null, route_type: 'domestic',      cabin: 'economy', fare_class: 'flexible',  sc_value: 20 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'economy', fare_class: 'discount',  sc_value: 20 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'economy', fare_class: 'economy',   sc_value: 25 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'economy', fare_class: 'flexible',  sc_value: 40 },
	{ route: null, route_type: 'international', cabin: 'economy', fare_class: 'discount',  sc_value: 30 },
	{ route: null, route_type: 'international', cabin: 'economy', fare_class: 'economy',   sc_value: 45 },
	{ route: null, route_type: 'international', cabin: 'economy', fare_class: 'flexible',  sc_value: 60 },
	// NULL fallback rows — step 3 in sc-lookup (conservative estimate, all cabins)
	{ route: null, route_type: 'domestic',      cabin: 'economy',  fare_class: null, sc_value: 10 },
	{ route: null, route_type: 'domestic',      cabin: 'business', fare_class: null, sc_value: 20 },
	{ route: null, route_type: 'domestic',      cabin: 'first',    fare_class: null, sc_value: 30 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'economy',  fare_class: null, sc_value: 20 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'business', fare_class: null, sc_value: 60 },
	{ route: null, route_type: 'trans_tasman',  cabin: 'first',    fare_class: null, sc_value: 90 },
	{ route: null, route_type: 'international', cabin: 'economy',  fare_class: null, sc_value: 45 },
	{ route: null, route_type: 'international', cabin: 'business', fare_class: null, sc_value: 80 },
	{ route: null, route_type: 'international', cabin: 'first',    fare_class: null, sc_value: 120 },
];

export const EXPECTED_ROW_COUNT = 162; // 144 route + 18 type-level

/**
 * Seed all SC rules into the given database.
 * Idempotent: DELETE + INSERT inside a single transaction.
 */
export function seedDB(db: Database.Database): number {
	const insert = db.prepare(`
    INSERT INTO sc_rules (route, route_type, cabin, fare_class, sc_value)
    VALUES (@route, @route_type, @cabin, @fare_class, @sc_value)
  `);

	const seedAll = db.transaction((rules: SeedRule[]) => {
		db.prepare('DELETE FROM sc_rules').run();
		for (const rule of rules) insert.run(rule);
	});

	const rules: SeedRule[] = [];

	for (const r of ROUTES) {
		rules.push({ route: r.route, route_type: null, cabin: 'economy', fare_class: 'discount',  sc_value: r.discount });
		rules.push({ route: r.route, route_type: null, cabin: 'economy', fare_class: 'economy',   sc_value: r.economy });
		rules.push({ route: r.route, route_type: null, cabin: 'economy', fare_class: 'flexible',  sc_value: r.flexible });
		rules.push({ route: r.route, route_type: null, cabin: 'economy', fare_class: null,        sc_value: r.discount });
	}

	for (const r of TYPE_LEVEL_RULES) {
		rules.push(r);
	}

	seedAll(rules);

	const { count } = db.prepare('SELECT COUNT(*) as count FROM sc_rules').get() as { count: number };
	if (count !== EXPECTED_ROW_COUNT) {
		console.warn(`⚠️  Expected ${EXPECTED_ROW_COUNT} rows, got ${count}. Check seed data.`);
	}
	return count;
}

// ─── Script entry point ────────────────────────────────────────────────────────
// Run via: npm run seed
if (process.argv[1]?.match(/seed\.(ts|js)$/)) {
	const { default: BetterSqlite3 } = await import('better-sqlite3');
	const { default: path } = await import('path');
	const { mkdirSync } = await import('fs');
	const { migrate } = await import('./migrate.js');

	const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'sctracker.db');
	mkdirSync(path.dirname(dbPath), { recursive: true });

	const db = new BetterSqlite3(dbPath);
	migrate(db);
	const count = seedDB(db);
	console.log(`Seeded ${count} SC rules into ${dbPath}`);
	console.log('Re-verify values after any Qantas program change:');
	console.log('https://www.qantas.com/au/en/frequent-flyer/earn-points/airline-earning-tables.html');
	db.close();
}
