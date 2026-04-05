export const FLIGHTY_REQUIRED_COLS = ['Date', 'Airline', 'Flight', 'From', 'To', 'Cabin Class', 'Canceled'] as const;

export type ParsedFlight = {
	route: string;
	date: string;
	cabin: 'economy' | 'business' | 'first' | null;
	fare_class: null;
	status: 'flown' | 'booked';
	notes: string;
};

export type ParseError = {
	row: number;
	message: string;
};

export type ParseResult = {
	flights: ParsedFlight[];
	errors: ParseError[];
};

const CABIN_MAP: Record<string, 'economy' | 'business' | 'first' | null> = {
	Economy: 'economy',
	'Premium Economy': 'economy',
	Business: 'business',
	First: 'first'
};

/**
 * Parse a Flighty CSV export into sctracker flight rows.
 *
 * Returns { flights, errors }. If errors is non-empty the caller should
 * surface them before proceeding (row-level validation failures).
 * Cancelled rows are silently skipped (not counted as errors).
 */
export function parseFlightyCsv(csvText: string): ParseResult {
	const lines = csvText.split('\n').map((l) => l.trimEnd());
	if (lines.length < 2) {
		return { flights: [], errors: [{ row: 0, message: 'File is empty or has no data rows.' }] };
	}

	// Parse header
	const header = parseCsvLine(lines[0]);
	for (const col of FLIGHTY_REQUIRED_COLS) {
		if (!header.includes(col)) {
			return {
				flights: [],
				errors: [{ row: 0, message: `Missing required column: "${col}". Is this a Flighty export?` }]
			};
		}
	}

	const idx = (col: string) => header.indexOf(col);

	const flights: ParsedFlight[] = [];
	const errors: ParseError[] = [];
	const today = new Date().toISOString().slice(0, 10);

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		const cols = parseCsvLine(line);
		const rowNum = i + 1; // 1-based for user-facing errors

		const canceled = cols[idx('Canceled')]?.trim() ?? '';
		if (canceled.toLowerCase() === 'true') continue;

		const date = cols[idx('Date')]?.trim() ?? '';
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			errors.push({ row: rowNum, message: `Invalid date: "${date}"` });
			continue;
		}

		const from = cols[idx('From')]?.trim().toUpperCase() ?? '';
		const to = cols[idx('To')]?.trim().toUpperCase() ?? '';
		if (!from || !to) {
			errors.push({ row: rowNum, message: `Missing From or To airport code.` });
			continue;
		}

		const cabinRaw = cols[idx('Cabin Class')]?.trim() ?? '';
		const cabin = cabinRaw ? (CABIN_MAP[cabinRaw] ?? null) : null;
		if (cabinRaw && !(cabinRaw in CABIN_MAP)) {
			errors.push({ row: rowNum, message: `Unknown cabin class: "${cabinRaw}"` });
			continue;
		}

		const airline = cols[idx('Airline')]?.trim() ?? '';
		const flightNum = cols[idx('Flight')]?.trim() ?? '';
		const notesRaw = cols[idx('Notes')]?.trim() ?? '';
		const notes = notesRaw || `${airline} ${flightNum}`.trim();

		const status: 'flown' | 'booked' = date < today ? 'flown' : 'booked';

		flights.push({
			route: `${from}-${to}`,
			date,
			cabin,
			fare_class: null,
			status,
			notes
		});
	}

	return { flights, errors };
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i < line.length) {
		if (line[i] === '"') {
			// Quoted field
			i++;
			let field = '';
			while (i < line.length) {
				if (line[i] === '"' && line[i + 1] === '"') {
					field += '"';
					i += 2;
				} else if (line[i] === '"') {
					i++;
					break;
				} else {
					field += line[i++];
				}
			}
			fields.push(field);
			if (line[i] === ',') i++;
		} else {
			// Unquoted field
			const end = line.indexOf(',', i);
			if (end === -1) {
				fields.push(line.slice(i));
				break;
			} else {
				fields.push(line.slice(i, end));
				i = end + 1;
			}
		}
	}
	return fields;
}
