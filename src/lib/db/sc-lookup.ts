import type Database from 'better-sqlite3';

// Australian airport IATA codes (Qantas domestic network)
const AU_AIRPORTS = new Set([
	'SYD', 'MEL', 'BNE', 'PER', 'ADL', 'CBR', 'OOL', 'CNS', 'HBA',
	'DRW', 'TSV', 'MKY', 'ROK', 'EMD', 'HTI', 'LST', 'NTL', 'ARM',
	'BWT', 'MCY', 'PPP', 'ZNE', 'KTA', 'PHE', 'BME', 'MJK', 'GET',
	'ALH', 'GEX', 'MIM', 'TMW', 'OAG', 'WGA', 'ABX', 'AVV', 'MQL',
	'MEB', 'PQQ', 'CFS', 'DBO', 'OAG'
]);

// New Zealand airport IATA codes
const NZ_AIRPORTS = new Set([
	'AKL', 'WLG', 'CHC', 'ZQN', 'DUD', 'HLZ', 'NPE', 'NSN', 'PMR',
	'ROT', 'TRG', 'WHK', 'IVC', 'GIS', 'KKE', 'MFN', 'MHB', 'MZP',
	'PCN', 'PPQ', 'RAG', 'SZS', 'TKZ', 'TMZ', 'WHO', 'WRE'
]);

export type RouteType = 'domestic' | 'trans_tasman' | 'international';

export function classifyRoute(route: string): RouteType {
	const parts = route.toUpperCase().split('-');
	if (parts.length < 2) return 'international';
	const [origin, dest] = parts;
	const originAU = AU_AIRPORTS.has(origin);
	const destAU = AU_AIRPORTS.has(dest);
	if (originAU && destAU) return 'domestic';
	const originNZ = NZ_AIRPORTS.has(origin);
	const destNZ = NZ_AIRPORTS.has(dest);
	if ((originAU && destNZ) || (originNZ && destAU)) return 'trans_tasman';
	return 'international';
}

/**
 * Look up SC value for a flight.
 *
 * Priority:
 *   1. route + cabin + fare_class          (exact per-route tier match)
 *   2. route + cabin + fare_class IS NULL  (per-route NULL fallback → discount SCs)
 *   2.5 route_type + cabin + fare_class    (type-level tier match for unseeded routes)
 *   3. route_type + cabin + fare_class IS NULL  (type-level NULL fallback)
 *   4. null → manual entry prompt
 */
export function lookupSC(
	db: Database.Database,
	route: string,
	cabin: string,
	fareClass: string | null
): number | null {
	// 1. Exact: route + cabin + fare_class
	if (fareClass) {
		const row = db
			.prepare(
				`SELECT sc_value FROM sc_rules
         WHERE route = ? AND cabin = ? AND fare_class = ?
         LIMIT 1`
			)
			.get(route, cabin, fareClass) as { sc_value: number } | undefined;
		if (row) return row.sc_value;
	}

	// 2. route + cabin (fare_class IS NULL = cabin-level fallback)
	const row2 = db
		.prepare(
			`SELECT sc_value FROM sc_rules
       WHERE route = ? AND cabin = ? AND fare_class IS NULL
       LIMIT 1`
		)
		.get(route, cabin) as { sc_value: number } | undefined;
	if (row2) return row2.sc_value;

	// Compute route type once — used for both 2.5 and 3
	const routeType = classifyRoute(route);

	// 2.5 route_type + cabin + fare_class (type-level tier fallback for unseeded routes)
	if (fareClass) {
		const row = db
			.prepare(
				`SELECT sc_value FROM sc_rules
         WHERE route IS NULL AND route_type = ? AND cabin = ? AND fare_class = ?
         LIMIT 1`
			)
			.get(routeType, cabin, fareClass) as { sc_value: number } | undefined;
		if (row) return row.sc_value;
	}

	// 3. route_type + cabin (NULL fallback)
	const row3 = db
		.prepare(
			`SELECT sc_value FROM sc_rules
       WHERE route IS NULL AND route_type = ? AND cabin = ? AND fare_class IS NULL
       LIMIT 1`
		)
		.get(routeType, cabin) as { sc_value: number } | undefined;
	if (row3) return row3.sc_value;

	// 4. No match — caller must prompt user for manual entry
	return null;
}
