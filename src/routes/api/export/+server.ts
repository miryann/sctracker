import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';

export const GET: RequestHandler = () => {
	const db = getDb();
	const flights = db.prepare(`SELECT * FROM flights ORDER BY date ASC, id ASC`).all();
	const year_config = db.prepare(`SELECT * FROM year_config LIMIT 1`).get();
	return json({ flights, year_config });
};
