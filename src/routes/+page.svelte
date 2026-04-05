<script lang="ts">
	import { onMount } from 'svelte';
	import { summary, loadSummary } from '$lib/stores.js';
	import VelocityChart from '$lib/components/VelocityChart.svelte';
	import AddFlightModal from '$lib/components/AddFlightModal.svelte';

	let showAddModal = false;

	onMount(loadSummary);

	function pct(n: number, total: number) {
		return Math.min(100, Math.round((n / total) * 100));
	}

	function fmtDate(iso: string) {
		return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

{#if $summary}
	{@const s = $summary}
	{@const earnedPct = pct(s.earned + s.ground_sc, s.target_sc)}
	{@const bookedPct = pct(s.booked, s.target_sc)}
	{@const plannedPct = pct(s.planned_included, s.target_sc)}

	<!-- Header -->
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">Status Year {s.year_start.slice(0,4)}–{s.year_end.slice(2,4)}</h1>
			<p class="mt-1 text-sm text-slate-500">{fmtDate(s.year_start)} → {fmtDate(s.year_end)} · {s.days_remaining} days remaining</p>
		</div>
		<button
			on:click={() => showAddModal = true}
			class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-500 transition-colors"
		>+ Add flight</button>
	</div>

	<!-- Big numbers -->
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
		<div class="rounded-xl bg-white p-5 border border-slate-200">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Earned</p>
			<p class="text-3xl font-bold text-slate-900">{s.earned + s.ground_sc}</p>
			<p class="text-xs text-slate-500 mt-1">of {s.target_sc} target{s.rollover_sc > 0 ? ` · +${s.rollover_sc} rollover` : ''}</p>
		</div>
		<div class="rounded-xl bg-white p-5 border border-slate-200">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Booked</p>
			<p class="text-3xl font-bold text-blue-400">{s.booked}</p>
			<p class="text-xs text-slate-500 mt-1">confirmed future flights</p>
		</div>
		<div class="rounded-xl bg-white p-5 border border-slate-200">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Still needed</p>
			<p class="text-3xl font-bold {s.gap_with_booked > 0 ? 'text-amber-400' : 'text-green-400'}">{s.gap_with_booked}</p>
			<p class="text-xs text-slate-500 mt-1">beyond what's booked</p>
		</div>
		<div class="rounded-xl bg-white p-5 border border-slate-200">
			<p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Required pace</p>
			<p class="text-3xl font-bold {s.required_rate_per_day > 5 ? 'text-red-400' : 'text-green-400'}">{s.required_rate_per_day}</p>
			<p class="text-xs text-slate-500 mt-1">SCs / day needed</p>
		</div>
	</div>

	<!-- Progress bar -->
	<div class="mb-6">
		<div class="flex items-center justify-between mb-2">
			<span class="text-xs text-slate-500">Progress to Platinum ({s.target_sc} SCs)</span>
			<span class="text-xs text-slate-500">{earnedPct + bookedPct + plannedPct}% projected</span>
		</div>
		<div class="relative h-4 w-full overflow-hidden rounded-full bg-slate-200">
			<!-- Earned (solid green) -->
			<div
				class="absolute left-0 top-0 h-full bg-green-500 transition-all"
				style="width: {earnedPct}%"
			></div>
			<!-- Booked (solid blue, offset) -->
			<div
				class="absolute top-0 h-full bg-blue-500 transition-all"
				style="left: {earnedPct}%; width: {bookedPct}%"
			></div>
			<!-- Planned (dashed purple, offset) -->
			<div
				class="absolute top-0 h-full bg-purple-500 opacity-60 transition-all"
				style="left: {earnedPct + bookedPct}%; width: {plannedPct}%"
			></div>
		</div>
		<div class="flex gap-4 mt-2">
			<span class="flex items-center gap-1 text-xs text-slate-500"><span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>Flown {s.earned}{s.ground_sc > 0 ? ` (+${s.ground_sc} ground)` : ''}</span>
			<span class="flex items-center gap-1 text-xs text-slate-500"><span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span>Booked {s.booked}</span>
			<span class="flex items-center gap-1 text-xs text-slate-500"><span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span>Planned {s.planned_included}</span>
		</div>
	</div>

	<!-- Velocity chart -->
	<VelocityChart summary={$summary} />

	<!-- Ground earning quick-set -->
	{#if s.ground_sc < 140}
		<div class="mt-6 rounded-xl bg-white border border-slate-200 p-4 flex items-center gap-4">
			<div class="flex-1">
				<p class="text-sm font-medium text-slate-900">Ground earning SCs</p>
				<p class="text-xs text-slate-500 mt-0.5">Bonus SCs from everyday spending (max 140/year, Feb 2026)</p>
			</div>
			<span class="text-lg font-bold text-slate-700">{s.ground_sc} / 140</span>
			<a href="/settings" class="text-xs text-blue-400 hover:text-blue-300 py-2 px-1">Update →</a>
		</div>
	{/if}

{:else}
	<div class="flex items-center justify-center h-64 text-slate-500">Loading...</div>
{/if}

{#if showAddModal}
	<AddFlightModal
		on:close={() => showAddModal = false}
		on:saved={async () => { showAddModal = false; await loadSummary(); }}
	/>
{/if}
