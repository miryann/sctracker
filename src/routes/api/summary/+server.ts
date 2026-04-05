import { json } from '@sveltejs/kit';
import { getDb } from '$lib/db/client.js';
import { getSummary } from '$lib/db/summary.js';

export function GET() {
	const db = getDb();
	const summary = getSummary(db);
	return json(summary);
}
