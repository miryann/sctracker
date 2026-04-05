<script lang="ts">
	import { onMount } from 'svelte';
	import { parseFlightyCsv } from '$lib/import/parse-flighty-csv.js';
	import type { ParsedFlight } from '$lib/import/parse-flighty-csv.js';

	type Config = {
		id: number;
		target_sc: number;
		year_start: string;
		year_end: string;
		ground_sc_earned: number;
		rollover_sc: number;
	};

	type SCRule = {
		id: number;
		route: string | null;
		route_type: string | null;
		cabin: string;
		fare_class: string | null;
		sc_value: number;
	};

	let config: Config | null = null;
	let rules: SCRule[] = [];
	let saving = false;
	let saved = false;
	let groundWarning = false;

	// Import state
	type PreviewRow = ParsedFlight & { sc_value: number | null; _rowError?: string };
	let importFile: FileList | undefined;
	let previewRows: PreviewRow[] = [];
	let parseErrors: { row: number; message: string }[] = [];
	let importStatus: string = '';
	let importing = false;
	let lookingUp = false;

	onMount(async () => {
		const [configRes, rulesRes] = await Promise.all([
			fetch('/api/year-config'),
			fetch('/api/sc-rules')
		]);
		if (configRes.ok) config = await configRes.json();
		if (rulesRes.ok) rules = await rulesRes.json();
	});

	async function saveConfig() {
		if (!config) return;
		saving = true;
		saved = false;
		const res = await fetch('/api/year-config', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				target_sc: config.target_sc,
				year_start: config.year_start,
				year_end: config.year_end,
				ground_sc_earned: config.ground_sc_earned,
				rollover_sc: config.rollover_sc
			})
		});
		if (res.ok) {
			config = await res.json();
			saved = true;
			setTimeout(() => (saved = false), 2000);
		}
		saving = false;
	}

	function checkGround(val: number) {
		groundWarning = val > 140;
	}

	// Export
	async function handleExport() {
		const res = await fetch('/api/export');
		if (!res.ok) return;
		const data = await res.json();
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `sctracker-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Import: parse CSV on file selection
	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		importStatus = '';
		previewRows = [];
		parseErrors = [];

		const text = await file.text();
		const { flights, errors } = parseFlightyCsv(text);

		if (errors.length > 0) {
			parseErrors = errors;
			return;
		}

		// Deduplicate lookup calls by unique (route, cabin) pairs
		lookingUp = true;
		const scCache = new Map<string, number | null>();
		const uniquePairs = [...new Set(
			flights
				.filter((f) => f.cabin !== null)
				.map((f) => `${f.route}|${f.cabin}`)
		)];

		try {
			await Promise.allSettled(
				uniquePairs.map(async (pair) => {
					const [route, cabin] = pair.split('|');
					const params = new URLSearchParams({ route, cabin });
					const res = await fetch(`/api/sc-lookup?${params}`);
					if (res.ok) {
						const data = await res.json();
						scCache.set(pair, data.sc_value);
					}
				})
			);
		} finally {
			lookingUp = false;
		}

		previewRows = flights.map((f) => ({
			...f,
			sc_value: f.cabin ? (scCache.get(`${f.route}|${f.cabin}`) ?? null) : null
		}));
	}

	$: amberCount = previewRows.filter((r) => r.cabin === null || r.sc_value === null).length;
	$: canImport = previewRows.length > 0 && amberCount === 0;

	async function handleImport() {
		if (!canImport) return;
		importing = true;
		importStatus = '';

		const res = await fetch('/api/flights/import', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(previewRows)
		});

		if (res.ok) {
			const { imported, skipped } = await res.json();
			importStatus = `Imported ${imported} flight${imported !== 1 ? 's' : ''}${skipped > 0 ? `, skipped ${skipped} (already exist)` : ''}.`;
			previewRows = [];
		} else {
			const data = await res.json().catch(() => ({}));
			importStatus = `Import failed: ${data.message ?? 'Unknown error'}`;
		}
		importing = false;
	}

	function setCabin(i: number, cabin: string) {
		previewRows[i] = { ...previewRows[i], cabin: cabin as 'economy' | 'business' | 'first', sc_value: null };
		// Re-fetch SC for this row's new cabin; ignore response if cabin changed again
		const route = previewRows[i].route;
		const params = new URLSearchParams({ route, cabin });
		fetch(`/api/sc-lookup?${params}`).then((r) => r.json()).then((data) => {
			// Guard against stale response if user changed cabin again before this resolved
			if (previewRows[i]?.cabin === cabin) {
				previewRows[i] = { ...previewRows[i], sc_value: data.sc_value };
				previewRows = [...previewRows]; // trigger reactivity
			}
		}).catch(() => { /* ignore network errors — row stays amber */ });
	}
</script>

<h1 class="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

{#if config}
	<form on:submit|preventDefault={saveConfig} class="space-y-6">
		<!-- Year config -->
		<section class="rounded-xl bg-white border border-slate-200 p-5">
			<h2 class="text-sm font-semibold text-slate-900 mb-4">Status Year</h2>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="block text-xs text-slate-500 mb-1" for="year_start">Year start</label>
					<input
						id="year_start"
						type="date"
						bind:value={config.year_start}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
				<div>
					<label class="block text-xs text-slate-500 mb-1" for="year_end">Year end</label>
					<input
						id="year_end"
						type="date"
						bind:value={config.year_end}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
				<div>
					<label class="block text-xs text-slate-500 mb-1" for="target_sc">Target SCs</label>
					<input
						id="target_sc"
						type="number"
						bind:value={config.target_sc}
						min="1"
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
					<p class="text-xs text-slate-400 mt-1">Platinum = 1,400 · Gold = 700 · Silver = 350</p>
				</div>
				<div>
					<label class="block text-xs text-slate-500 mb-1" for="rollover_sc">Rollover SCs <span class="text-slate-400">(carried forward)</span></label>
					<input
						id="rollover_sc"
						type="number"
						bind:value={config.rollover_sc}
						min="0"
						max="500"
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
					<p class="text-xs text-slate-400 mt-1">Max 500 for Platinum (Feb 2026 program)</p>
				</div>
			</div>
		</section>

		<!-- Ground earning -->
		<section class="rounded-xl bg-white border border-slate-200 p-5">
			<h2 class="text-sm font-semibold text-slate-900 mb-1">Ground Earning SCs</h2>
			<p class="text-xs text-slate-500 mb-4">Bonus SCs from everyday spending (groceries, dining, etc.). Max 140/year — Feb 2026 program addition.</p>
			<div>
				<label class="block text-xs text-slate-500 mb-1" for="ground_sc">SCs earned from ground spending this year</label>
				<input
					id="ground_sc"
					type="number"
					bind:value={config.ground_sc_earned}
					on:input={(e) => checkGround(Number(e.currentTarget.value))}
					min="0"
					max="200"
					class="w-full rounded-lg bg-white border {groundWarning ? 'border-amber-600' : 'border-slate-300'} px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
				/>
				{#if groundWarning}
					<p class="text-xs text-amber-400 mt-1">Maximum is 140 SCs/year. The API will cap this automatically on save.</p>
				{/if}
			</div>
		</section>

		<button
			type="submit"
			disabled={saving}
			class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-500 disabled:opacity-50 transition-colors"
		>{saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}</button>
	</form>

	<!-- Export / Import -->
	<section class="rounded-xl bg-white border border-slate-200 p-5">
		<h2 class="text-sm font-semibold text-slate-900 mb-1">Data</h2>
		<p class="text-xs text-slate-500 mb-4">Export all flights as JSON, or import from a Flighty CSV export.</p>

		<div class="flex gap-3 mb-5">
			<button
				type="button"
				on:click={handleExport}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
			>Export JSON</button>
		</div>

		<div>
			<label class="block text-xs font-medium text-slate-600 mb-2" for="flighty-import">Import from Flighty CSV</label>
			<input
				id="flighty-import"
				type="file"
				accept=".csv"
				on:change={handleFileChange}
				class="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
			/>
		</div>

		{#if lookingUp}
			<p class="mt-3 text-sm text-slate-400">Looking up SC values…</p>
		{/if}

		{#if parseErrors.length > 0}
			<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
				<p class="text-sm font-semibold text-red-700 mb-1">Parse error</p>
				{#each parseErrors as e}
					<p class="text-xs text-red-600">{e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}</p>
				{/each}
			</div>
		{/if}

		{#if previewRows.length > 0}
			<div class="mt-4">
				<p class="text-xs text-slate-500 mb-2">
					{previewRows.length} flights parsed.
					{#if amberCount > 0}
						<span class="text-amber-600 font-medium">{amberCount} need cabin / SC value before import.</span>
					{/if}
				</p>
				<div class="overflow-x-auto rounded-lg border border-slate-200">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-slate-200 bg-slate-50">
								<th class="px-3 py-2 text-left text-slate-500 font-medium">Route</th>
								<th class="px-3 py-2 text-left text-slate-500 font-medium">Date</th>
								<th class="px-3 py-2 text-left text-slate-500 font-medium">Cabin</th>
								<th class="px-3 py-2 text-left text-slate-500 font-medium">Status</th>
								<th class="px-3 py-2 text-right text-slate-500 font-medium">SCs</th>
								<th class="px-3 py-2 text-left text-slate-500 font-medium">Notes</th>
							</tr>
						</thead>
						<tbody class="bg-white">
							{#each previewRows as row, i}
								{@const amber = row.cabin === null || row.sc_value === null}
								<tr class="border-b border-slate-200/50 last:border-0 {amber ? 'bg-amber-50' : ''}">
									<td class="px-3 py-2 font-mono text-slate-900">{row.route}</td>
									<td class="px-3 py-2 text-slate-600">{row.date}</td>
									<td class="px-3 py-2">
										{#if row.cabin === null}
											<select
												class="rounded border border-amber-300 bg-white px-2 py-0.5 text-xs text-slate-700"
												on:change={(e) => setCabin(i, e.currentTarget.value)}
											>
												<option value="">— select</option>
												<option value="economy">Economy</option>
												<option value="business">Business</option>
												<option value="first">First</option>
											</select>
										{:else}
											<span class="capitalize text-slate-600">{row.cabin}</span>
										{/if}
									</td>
									<td class="px-3 py-2 text-slate-600 capitalize">{row.status}</td>
									<td class="px-3 py-2 text-right font-semibold tabular-nums {amber ? 'text-amber-500' : 'text-slate-900'}">
										{#if row.cabin !== null && row.sc_value === null}
											<input
												type="number"
												min="1"
												placeholder="SC?"
												class="w-16 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 text-right"
												on:change={(e) => {
													const v = parseInt(e.currentTarget.value);
													if (v > 0) { previewRows[i] = { ...previewRows[i], sc_value: v }; previewRows = [...previewRows]; }
												}}
											/>
										{:else}
											{row.sc_value ?? '—'}
										{/if}
									</td>
									<td class="px-3 py-2 text-slate-400 max-w-[160px] truncate" title={row.notes}>{row.notes || '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-3 flex items-center gap-4">
					<button
						type="button"
						on:click={handleImport}
						disabled={!canImport || importing}
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
					>{importing ? 'Importing…' : `Import ${previewRows.length} flights`}</button>
					{#if !canImport && amberCount > 0}
						<p class="text-xs text-amber-600">Fill cabin and SC value for all amber rows first.</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if importStatus}
			<p class="mt-3 text-sm {importStatus.startsWith('Import failed') ? 'text-red-500' : 'text-green-600'}">{importStatus}</p>
		{/if}
	</section>

	<!-- SC Rules (read-only) -->
	<section class="mt-8 rounded-xl bg-white border border-slate-200 p-5">
		<h2 class="text-sm font-semibold text-slate-900 mb-1">SC Earning Rules</h2>
		<p class="text-xs text-slate-500 mb-4">Read-only. Edit via <code class="bg-slate-100 px-1 rounded text-slate-700">npx tsx src/lib/db/seed.ts</code> and re-seed.</p>
		{#if rules.length === 0}
			<p class="text-sm text-slate-400">No rules seeded yet. Run <code class="bg-slate-100 px-1 rounded">npm run seed</code>.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="border-b border-slate-200">
							<th class="pb-2 text-left text-slate-400 font-medium pr-4">Route</th>
							<th class="pb-2 text-left text-slate-400 font-medium pr-4">Type</th>
							<th class="pb-2 text-left text-slate-400 font-medium pr-4">Cabin</th>
							<th class="pb-2 text-left text-slate-400 font-medium pr-4">Fare class</th>
							<th class="pb-2 text-right text-slate-400 font-medium">SCs</th>
						</tr>
					</thead>
					<tbody>
						{#each rules as rule}
							<tr class="border-b border-slate-200/40 last:border-0">
								<td class="py-1.5 pr-4 font-mono text-slate-900">{rule.route ?? '—'}</td>
								<td class="py-1.5 pr-4 text-slate-500">{rule.route_type ?? '—'}</td>
								<td class="py-1.5 pr-4 text-slate-500 capitalize">{rule.cabin}</td>
								<td class="py-1.5 pr-4 text-slate-500">{rule.fare_class ?? 'any'}</td>
								<td class="py-1.5 text-right font-semibold text-slate-900 tabular-nums">{rule.sc_value}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
{:else}
	<div class="flex items-center justify-center h-32 text-slate-400">Loading…</div>
{/if}
