import type Database from 'better-sqlite3';

export type Summary = {
	earned: number;
	booked: number;
	planned_included: number;
	planned_excluded: number;
	ground_sc: number;
	rollover_sc: number;
	target_sc: number;
	gap: number;
	gap_with_booked: number;
	days_remaining: number;
	required_rate_per_day: number;
	year_start: string;
	year_end: string;
};

export function getSummary(db: Database.Database): Summary {
	const config = db
		.prepare(`SELECT * FROM year_config WHERE id = 1`)
		.get() as {
		target_sc: number;
		year_start: string;
		year_end: string;
		ground_sc_earned: number;
		rollover_sc: number;
	};

	const ground_sc = Math.min(config.ground_sc_earned, 140);
	const rollover_sc = config.rollover_sc;

	// Sum flown SCs (date within status year)
	const earnedRow = db
		.prepare(
			`SELECT COALESCE(SUM(sc_value), 0) as total FROM flights
       WHERE status = 'flown' AND date >= ? AND date <= ?`
		)
		.get(config.year_start, config.year_end) as { total: number };

	// Sum booked SCs (always included)
	const bookedRow = db
		.prepare(
			`SELECT COALESCE(SUM(sc_value), 0) as total FROM flights
       WHERE status = 'booked' AND date >= ? AND date <= ?`
		)
		.get(config.year_start, config.year_end) as { total: number };

	// Sum planned SCs (only included ones)
	const plannedIncRow = db
		.prepare(
			`SELECT COALESCE(SUM(sc_value), 0) as total FROM flights
       WHERE status = 'planned' AND included_in_projection = 1
       AND date >= ? AND date <= ?`
		)
		.get(config.year_start, config.year_end) as { total: number };

	// Sum planned SCs (toggled off)
	const plannedExcRow = db
		.prepare(
			`SELECT COALESCE(SUM(sc_value), 0) as total FROM flights
       WHERE status = 'planned' AND included_in_projection = 0
       AND date >= ? AND date <= ?`
		)
		.get(config.year_start, config.year_end) as { total: number };

	const earned = earnedRow.total;
	const booked = bookedRow.total;
	const planned_included = plannedIncRow.total;
	const planned_excluded = plannedExcRow.total;

	// Days remaining in status year
	const today = new Date().toISOString().split('T')[0];
	const yearEnd = new Date(config.year_end);
	const todayDate = new Date(today);
	const msPerDay = 1000 * 60 * 60 * 24;
	const days_remaining = Math.max(0, Math.ceil((yearEnd.getTime() - todayDate.getTime()) / msPerDay));

	// gap = what's needed from all future flights (earned+ground is what we have now)
	const gap = Math.max(0, config.target_sc - earned - ground_sc);
	// gap_with_booked = what's still needed after accounting for booked+planned flights
	const gap_with_booked = Math.max(
		0,
		config.target_sc - earned - booked - planned_included - ground_sc
	);

	const required_rate_per_day =
		days_remaining > 0 ? Math.round((gap_with_booked / days_remaining) * 10) / 10 : 0;

	return {
		earned,
		booked,
		planned_included,
		planned_excluded,
		ground_sc,
		rollover_sc,
		target_sc: config.target_sc,
		gap,
		gap_with_booked,
		days_remaining,
		required_rate_per_day,
		year_start: config.year_start,
		year_end: config.year_end
	};
}
