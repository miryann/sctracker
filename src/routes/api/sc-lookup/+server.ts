import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getDb } from '$lib/db/client.js';
import { lookupSC } from '$lib/db/sc-lookup.js';

export const GET: RequestHandler = ({ url }) => {
	const route = url.searchParams.get('route') ?? '';
	const cabin = url.searchParams.get('cabin') ?? '';
	const fare_class = url.searchParams.get('fare_class') || null;

	if (!route || !cabin) {
		return json({ sc_value: null });
	}

	const db = getDb();
	const sc = lookupSC(db, route.toUpperCase(), cabin, fare_class);
	return json({ sc_value: sc });
};
