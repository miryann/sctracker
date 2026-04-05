import { describe, it, expect } from 'vitest';
import { parseFlightyCsv } from './parse-flighty-csv.js';

const HEADER = 'Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID';

function makeRow(overrides: Record<string, string> = {}): string {
	const defaults: Record<string, string> = {
		Date: '2026-01-15',
		Airline: 'QFA',
		Flight: '407',
		From: 'SYD',
		To: 'MEL',
		'Dep Terminal': '',
		'Dep Gate': '',
		'Arr Terminal': '',
		'Arr Gate': '',
		Canceled: 'false',
		'Diverted To': '',
		'Gate Departure (Scheduled)': '',
		'Gate Departure (Actual)': '',
		'Take off (Scheduled)': '',
		'Take off (Actual)': '',
		'Landing (Scheduled)': '',
		'Landing (Actual)': '',
		'Gate Arrival (Scheduled)': '',
		'Gate Arrival (Actual)': '',
		'Aircraft Type Name': '',
		'Tail Number': '',
		PNR: '',
		Seat: '',
		'Seat Type': '',
		'Cabin Class': 'Economy',
		'Flight Reason': '',
		Notes: '',
		'Flight Flighty ID': '',
		'Airline Flighty ID': '',
		'Departure Airport Flighty ID': '',
		'Arrival Airport Flighty ID': '',
		'Diverted To Airport Flighty ID': '',
		'Aircraft Type Flighty ID': ''
	};

	const merged = { ...defaults, ...overrides };
	const headerCols = HEADER.split(',');
	return headerCols.map((col) => merged[col] ?? '').join(',');
}

function csv(...rows: string[]): string {
	return [HEADER, ...rows].join('\n');
}

describe('parseFlightyCsv', () => {
	it('parses a basic row', () => {
		const { flights, errors } = parseFlightyCsv(csv(makeRow()));
		expect(errors).toHaveLength(0);
		expect(flights).toHaveLength(1);
		expect(flights[0].route).toBe('SYD-MEL');
		expect(flights[0].date).toBe('2026-01-15');
		expect(flights[0].cabin).toBe('economy');
		expect(flights[0].fare_class).toBeNull();
	});

	it('derives status from date (past=flown, future=booked)', () => {
		const past = makeRow({ Date: '2020-01-01' });
		const future = makeRow({ Date: '2099-12-31' });
		const { flights } = parseFlightyCsv(csv(past, future));
		expect(flights[0].status).toBe('flown');
		expect(flights[1].status).toBe('booked');
	});

	it('skips cancelled rows', () => {
		const cancelled = makeRow({ Canceled: 'true' });
		const normal = makeRow();
		const { flights } = parseFlightyCsv(csv(cancelled, normal));
		expect(flights).toHaveLength(1);
		expect(flights[0].route).toBe('SYD-MEL');
	});

	it('maps Premium Economy to economy', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ 'Cabin Class': 'Premium Economy' })));
		expect(flights[0].cabin).toBe('economy');
	});

	it('maps Business to business', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ 'Cabin Class': 'Business' })));
		expect(flights[0].cabin).toBe('business');
	});

	it('maps First to first', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ 'Cabin Class': 'First' })));
		expect(flights[0].cabin).toBe('first');
	});

	it('sets cabin to null when Cabin Class is empty', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ 'Cabin Class': '' })));
		expect(flights[0].cabin).toBeNull();
	});

	it('uses Flighty Notes when non-empty', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ Notes: 'status run' })));
		expect(flights[0].notes).toBe('status run');
	});

	it('falls back to Airline + Flight when Notes is empty', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ Airline: 'QFA', Flight: '1489', Notes: '' })));
		expect(flights[0].notes).toBe('QFA 1489');
	});

	it('uppercases airport codes in route', () => {
		const { flights } = parseFlightyCsv(csv(makeRow({ From: 'syd', To: 'mel' })));
		expect(flights[0].route).toBe('SYD-MEL');
	});

	it('rejects CSV missing required columns', () => {
		const { flights, errors } = parseFlightyCsv('Date,Airline,Flight\n2026-01-01,QFA,407');
		expect(flights).toHaveLength(0);
		expect(errors[0].message).toMatch(/Missing required column/);
	});

	it('returns row-level error for invalid date', () => {
		const bad = makeRow({ Date: 'not-a-date' });
		const { errors } = parseFlightyCsv(csv(bad));
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/Invalid date/);
	});

	it('returns row-level error for unknown cabin class', () => {
		const bad = makeRow({ 'Cabin Class': 'PremiumFirst' });
		const { errors } = parseFlightyCsv(csv(bad));
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/Unknown cabin class/);
	});

	it('skips blank lines without error', () => {
		const { flights, errors } = parseFlightyCsv(csv(makeRow(), '', makeRow({ From: 'MEL', To: 'BNE' })));
		expect(errors).toHaveLength(0);
		expect(flights).toHaveLength(2);
	});

	it('returns empty flights for empty file', () => {
		const { flights, errors } = parseFlightyCsv('');
		expect(flights).toHaveLength(0);
		expect(errors.length).toBeGreaterThan(0);
	});
});
