import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';
import { importFlights } from '$lib/db/import-flights.js';

export const POST: RequestHandler = async ({ request }) => {
	const db = getDb();
	const body = await request.json();

	if (!Array.isArray(body)) {
		throw error(400, 'Request body must be an array of flight objects.');
	}

	try {
		const result = importFlights(db, body);
		return json(result);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Import failed.';
		throw error(400, msg);
	}
};
