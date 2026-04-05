import { json } from '@sveltejs/kit';
import { getDb } from '$lib/db/client.js';

export function GET() {
	const db = getDb();
	const rules = db.prepare(`SELECT * FROM sc_rules ORDER BY route_type, route, cabin, fare_class`).all();
	return json(rules);
}
