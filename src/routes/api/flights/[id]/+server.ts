import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';

export const PUT: RequestHandler = async ({ params, request }) => {
	const db = getDb();
	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid flight id');

	const flight = db.prepare(`SELECT * FROM flights WHERE id = ?`).get(id);
	if (!flight) throw error(404, 'Flight not found');

	const body = await request.json();
	const allowed = ['route', 'date', 'cabin', 'fare_class', 'sc_value', 'status', 'included_in_projection', 'notes'];
	const updates: Record<string, unknown> = {};
	for (const key of allowed) {
		if (key in body) updates[key] = body[key];
	}

	if (Object.keys(updates).length === 0) throw error(400, 'No valid fields to update');

	const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
	db.prepare(`UPDATE flights SET ${setClauses} WHERE id = @id`).run({ ...updates, id });

	const updated = db.prepare(`SELECT * FROM flights WHERE id = ?`).get(id);
	return json(updated);
};

export const DELETE: RequestHandler = ({ params }) => {
	const db = getDb();
	const id = parseInt(params.id);
	if (isNaN(id)) throw error(400, 'Invalid flight id');

	const flight = db.prepare(`SELECT * FROM flights WHERE id = ?`).get(id);
	if (!flight) throw error(404, 'Flight not found');

	db.prepare(`DELETE FROM flights WHERE id = ?`).run(id);
	return new Response(null, { status: 204 });
};
