import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';
import { lookupSC } from '$lib/db/sc-lookup.js';

export const GET: RequestHandler = ({ url }) => {
	const db = getDb();
	const status = url.searchParams.get('status');
	const after = url.searchParams.get('after');
	const before = url.searchParams.get('before');

	let query = `SELECT * FROM flights WHERE 1=1`;
	const params: (string | number)[] = [];

	if (status) {
		query += ` AND status = ?`;
		params.push(status);
	}
	if (after) {
		query += ` AND date >= ?`;
		params.push(after);
	}
	if (before) {
		query += ` AND date <= ?`;
		params.push(before);
	}

	query += ` ORDER BY date ASC, id ASC`;

	const flights = db.prepare(query).all(...params);
	return json(flights);
};

export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const body = await request.json();

	const { route, date, cabin, fare_class, sc_value, status, notes } = body;

	if (!route || !date || !cabin || !status) {
		throw error(400, 'Missing required fields: route, date, cabin, status');
	}
	if (!['flown', 'booked', 'planned'].includes(status)) {
		throw error(400, 'status must be flown, booked, or planned');
	}
	if (!['economy', 'business', 'first'].includes(cabin)) {
		throw error(400, 'cabin must be economy, business, or first');
	}

	// Resolve SC value: use provided value, or look up from rules
	let resolvedSC: number;
	if (typeof sc_value === 'number' && sc_value > 0) {
		resolvedSC = sc_value;
	} else {
		const looked = lookupSC(db, route, cabin, fare_class ?? null);
		if (looked === null) {
			// Signal to client that manual entry is required
			return json({ needsManualSC: true, route, cabin, fare_class }, { status: 422 });
		}
		resolvedSC = looked;
	}

	const result = db
		.prepare(
			`INSERT INTO flights (route, date, cabin, fare_class, sc_value, status, notes)
       VALUES (@route, @date, @cabin, @fare_class, @sc_value, @status, @notes)`
		)
		.run({
			route: route.toUpperCase(),
			date,
			cabin,
			fare_class: fare_class ?? null,
			sc_value: resolvedSC,
			status,
			notes: notes ?? null
		});

	const flight = db.prepare(`SELECT * FROM flights WHERE id = ?`).get(result.lastInsertRowid);
	return json(flight, { status: 201 });
};
