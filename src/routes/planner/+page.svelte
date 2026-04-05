<script lang="ts">
	import { onMount } from 'svelte';
	import { flights, summary, loadFlights, loadSummary, toggleProjection, deleteFlight } from '$lib/stores.js';
	import type { Flight } from '$lib/stores.js';
	import AddFlightModal from '$lib/components/AddFlightModal.svelte';
	import EditFlightModal from '$lib/components/EditFlightModal.svelte';

	let showAddModal = false;
	let editingFlight: Flight | null = null;

	onMount(async () => {
		await Promise.all([loadFlights(), loadSummary()]);
	});

	function groupedFlights(fs: typeof $flights) {
		const order = ['flown', 'booked', 'planned'] as const;
		return order.map((status) => ({
			status,
			flights: fs.filter((f) => f.status === status).sort((a, b) => a.date.localeCompare(b.date))
		})).filter((g) => g.flights.length > 0);
	}

	const statusLabel: Record<string, string> = {
		flown: 'Flown',
		booked: 'Booked',
		planned: 'Planned'
	};

	const statusColor: Record<string, string> = {
		flown: 'text-green-400',
		booked: 'text-blue-400',
		planned: 'text-purple-400'
	};

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
	}

	function truncateNotes(s: string | null, max = 30): string {
		if (!s) return '—';
		return s.length > max ? s.slice(0, max) + '…' : s;
	}

	async function handleDelete(id: number) {
		if (!confirm('Delete this flight?')) return;
		await deleteFlight(id);
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<h1 class="text-2xl font-bold text-slate-900">Flight Planner</h1>
	<button
		on:click={() => showAddModal = true}
		class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-500 transition-colors"
	>+ Add flight</button>
</div>

{#if $summary}
	<div class="mb-4 flex gap-6 text-sm text-slate-500">
		<span>Still needed: <strong class="text-amber-400">{$summary.gap_with_booked} SCs</strong></span>
		<span>Days remaining: <strong class="text-slate-900">{$summary.days_remaining}</strong></span>
		<span>Required pace: <strong class="{$summary.required_rate_per_day > 5 ? 'text-red-400' : 'text-green-400'}">{$summary.required_rate_per_day} SC/day</strong></span>
	</div>
{/if}

{#if $flights.length === 0}
	<div class="rounded-xl bg-white border border-slate-200 p-12 text-center">
		<p class="text-slate-500">No flights yet. Add your first flight to start tracking.</p>
	</div>
{:else}
	{#each groupedFlights($flights) as group}
		<div class="mb-8">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wider {statusColor[group.status]}">
				{statusLabel[group.status]} · {group.flights.reduce((s, f) => s + f.sc_value, 0)} SCs
			</h2>
			<div class="rounded-xl border border-slate-200 overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-200 bg-white/50">
							<th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Route</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Date</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Cabin</th>
							<th class="px-4 py-2 text-left text-xs font-medium text-slate-500">Notes</th>
							<th class="px-4 py-2 text-right text-xs font-medium text-slate-500">SCs</th>
							{#if group.status === 'planned'}
								<th class="px-4 py-2 text-center text-xs font-medium text-slate-500">Include?</th>
							{/if}
							<th class="px-4 py-2 text-right text-xs font-medium text-slate-500"></th>
						</tr>
					</thead>
					<tbody class="bg-white">
						{#each group.flights as flight (flight.id)}
							<tr class="border-b border-slate-200/50 last:border-0 hover:bg-slate-50 transition-colors {group.status === 'planned' && flight.included_in_projection === 0 ? 'opacity-50' : ''}">
								<td class="px-4 py-3 font-mono font-semibold text-slate-900">{flight.route}</td>
								<td class="px-4 py-3 text-slate-700">{fmtDate(flight.date)}</td>
								<td class="px-4 py-3 text-slate-500 capitalize">{flight.cabin}{flight.fare_class ? ` · ${flight.fare_class}` : ''}</td>
								<td class="px-4 py-3 text-slate-500 max-w-[180px]" title={flight.notes ?? ''}>{truncateNotes(flight.notes)}</td>
								<td class="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{flight.sc_value}</td>
								{#if group.status === 'planned'}
									<td class="px-4 py-3 text-center">
										<button
											on:click={() => toggleProjection(flight)}
											title={flight.included_in_projection ? 'Toggle off (what if?)' : 'Toggle on'}
											aria-pressed={flight.included_in_projection ? 'true' : 'false'}
											aria-label={flight.included_in_projection ? 'Exclude from projection' : 'Include in projection'}
											class="text-xs px-3 py-1 rounded {flight.included_in_projection ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'} hover:opacity-80 transition-opacity"
										>{flight.included_in_projection ? 'On' : 'Off'}</button>
									</td>
								{/if}
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<button
											on:click={() => editingFlight = flight}
											aria-label="Edit flight"
											class="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-blue-50 text-xs"
										>✎</button>
										<button
											on:click={() => handleDelete(flight.id)}
											aria-label="Delete flight"
											class="p-2.5 text-slate-300 hover:text-red-400 transition-colors rounded-lg hover:bg-red-50"
										>×</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/each}
{/if}

{#if showAddModal}
	<AddFlightModal
		on:close={() => showAddModal = false}
		on:saved={async () => { showAddModal = false; await Promise.all([loadFlights(), loadSummary()]); }}
	/>
{/if}

{#if editingFlight}
	<EditFlightModal
		flight={editingFlight}
		on:close={() => editingFlight = null}
		on:saved={async () => { editingFlight = null; await Promise.all([loadFlights(), loadSummary()]); }}
	/>
{/if}
