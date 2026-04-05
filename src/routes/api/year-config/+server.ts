import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';

export const GET: RequestHandler = () => {
	const db = getDb();
	const config = db.prepare(`SELECT * FROM year_config WHERE id = 1`).get();
	return json(config);
};

export const PUT: RequestHandler = async ({ request }) => {
	const db = getDb();
	const body = await request.json();

	const allowed = ['target_sc', 'year_start', 'year_end', 'ground_sc_earned', 'rollover_sc'];
	const updates: Record<string, unknown> = {};
	for (const key of allowed) {
		if (key in body) updates[key] = body[key];
	}

	if (Object.keys(updates).length === 0) throw error(400, 'No valid fields to update');

	// Cap ground_sc_earned at 140
	if ('ground_sc_earned' in updates) {
		updates.ground_sc_earned = Math.min(Number(updates.ground_sc_earned), 140);
	}

	const setClauses = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
	db.prepare(`UPDATE year_config SET ${setClauses} WHERE id = 1`).run(updates);

	const config = db.prepare(`SELECT * FROM year_config WHERE id = 1`).get();
	return json(config);
};
