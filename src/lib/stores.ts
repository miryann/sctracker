import { writable, derived } from 'svelte/store';

export type Flight = {
	id: number;
	route: string;
	date: string;
	cabin: 'economy' | 'business' | 'first';
	fare_class: string | null;
	sc_value: number;
	status: 'flown' | 'booked' | 'planned';
	included_in_projection: 0 | 1;
	notes: string | null;
	created_at: string;
};

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

export const flights = writable<Flight[]>([]);
export const summary = writable<Summary | null>(null);

export async function loadFlights() {
	const res = await fetch('/api/flights');
	if (res.ok) flights.set(await res.json());
}

export async function loadSummary() {
	const res = await fetch('/api/summary');
	if (res.ok) summary.set(await res.json());
}

export async function toggleProjection(flight: Flight) {
	const newVal = flight.included_in_projection === 1 ? 0 : 1;
	const res = await fetch(`/api/flights/${flight.id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ included_in_projection: newVal })
	});
	if (res.ok) {
		flights.update((fs) =>
			fs.map((f) => (f.id === flight.id ? { ...f, included_in_projection: newVal } : f))
		);
		await loadSummary();
	}
}

export async function updateFlight(id: number, updates: Partial<Omit<Flight, 'id' | 'created_at'>>) {
	const res = await fetch(`/api/flights/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});
	if (res.ok) {
		const updated = await res.json() as Flight;
		flights.update((fs) => fs.map((f) => (f.id === id ? updated : f)));
		await loadSummary();
	}
	return res;
}

export async function deleteFlight(id: number) {
	await fetch(`/api/flights/${id}`, { method: 'DELETE' });
	flights.update((fs) => fs.filter((f) => f.id !== id));
	await loadSummary();
}
