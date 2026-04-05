<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import type { Flight } from '$lib/stores.js';
	import { updateFlight } from '$lib/stores.js';

	export let flight: Flight;

	const dispatch = createEventDispatcher();

	let route = flight.route;
	let date = flight.date;
	let cabin: 'economy' | 'business' | 'first' = flight.cabin;
	let fareClass = flight.fare_class ?? '';
	let status: 'flown' | 'booked' | 'planned' = flight.status;
	let notes = flight.notes ?? '';
	let manualSC: number | null = null;
	let needsManualSC = false;
	let saving = false;
	let err = '';

	// Live SC preview
	let previewSC: number | null = flight.sc_value;
	let lookupTimer: ReturnType<typeof setTimeout> | null = null;

	const statusOptions = ['flown', 'booked', 'planned'] as const;
	function setStatus(s: string) { status = s as typeof status; }

	function scheduleLookup() {
		if (lookupTimer) clearTimeout(lookupTimer);
		lookupTimer = setTimeout(doLookup, 250);
	}

	async function doLookup() {
		if (!route || !cabin) { previewSC = null; return; }
		const params = new URLSearchParams({ route: route.toUpperCase(), cabin });
		if (fareClass) params.set('fare_class', fareClass);
		const res = await fetch(`/api/sc-lookup?${params}`);
		if (res.ok) {
			const data = await res.json();
			previewSC = data.sc_value;
			if (data.sc_value !== null) needsManualSC = false;
		}
	}

	// Only trigger SC lookup when route/cabin/fareClass changes (not on initial render)
	let initialized = false;
	onMount(() => { initialized = true; });
	$: if (initialized && (route || cabin || fareClass)) scheduleLookup();

	onDestroy(() => { if (lookupTimer) clearTimeout(lookupTimer); });

	async function submit() {
		err = '';
		if (!route || !date || !cabin || !status) { err = 'Route, date, cabin and status are required.'; return; }

		saving = true;
		const updates: Record<string, unknown> = {
			route: route.toUpperCase(),
			date,
			cabin,
			fare_class: fareClass || null,
			status,
			notes: notes || null
		};

		if (needsManualSC && manualSC !== null) {
			updates.sc_value = manualSC;
		} else if (previewSC !== null) {
			updates.sc_value = previewSC;
		}

		const res = await updateFlight(flight.id, updates as Parameters<typeof updateFlight>[1]);

		if (res.status === 404) {
			err = 'This flight no longer exists.';
			saving = false;
			return;
		}

		if (res.status === 422) {
			needsManualSC = true;
			manualSC = null;
			saving = false;
			err = 'No SC rule found for this route/cabin. Enter the SC value manually.';
			return;
		}

		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			err = data.message ?? 'Failed to save flight.';
			saving = false;
			return;
		}

		saving = false;
		dispatch('saved');
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" on:click={() => dispatch('close')}></div>

<!-- Modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="edit-flight-title">
	<div class="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
		<div class="flex items-center justify-between mb-5">
			<h2 id="edit-flight-title" class="text-lg font-bold text-slate-900">Edit flight</h2>
			{#if previewSC !== null}
				<span class="text-lg font-bold text-blue-600">{previewSC} <span class="text-sm font-normal text-slate-400">SCs</span></span>
			{/if}
		</div>

		<form on:submit|preventDefault={submit} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="edit-route">Route</label>
					<input
						id="edit-route"
						bind:value={route}
						placeholder="MEL-SYD"
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="edit-date">Date</label>
					<input
						id="edit-date"
						type="date"
						bind:value={date}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="edit-cabin">Cabin</label>
					<select
						id="edit-cabin"
						bind:value={cabin}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					>
						<option value="economy">Economy</option>
						<option value="business">Business</option>
						<option value="first">First</option>
					</select>
				</div>
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="edit-fare_class">Fare class <span class="text-slate-400 font-normal">(optional)</span></label>
					<select
						id="edit-fare_class"
						bind:value={fareClass}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					>
						<option value="">— not specified</option>
						<option value="discount">Discount</option>
						<option value="economy">Economy</option>
						<option value="flexible">Flexible</option>
					</select>
				</div>
			</div>

			<div>
				<label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
				<div class="flex gap-2">
					{#each statusOptions as s}
						<button
							type="button"
							on:click={() => setStatus(s)}
							class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors {status === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
						>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
					{/each}
				</div>
			</div>

			{#if needsManualSC}
				<div>
					<label class="block text-xs font-medium text-amber-600 mb-1" for="edit-manual_sc">SC value — manual entry</label>
					<input
						id="edit-manual_sc"
						type="number"
						bind:value={manualSC}
						min="1"
						placeholder="e.g. 15"
						class="w-full rounded-lg bg-white border border-amber-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
					/>
				</div>
			{/if}

			<div>
				<label class="block text-xs font-medium text-slate-600 mb-1" for="edit-notes">Notes <span class="text-slate-400 font-normal">(optional)</span></label>
				<input
					id="edit-notes"
					bind:value={notes}
					placeholder="e.g. QF407, status run"
					class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
				/>
			</div>

			{#if err}
				<p class="text-sm text-red-500">{err}</p>
			{/if}

			<div class="flex gap-3 pt-1">
				<button
					type="button"
					on:click={() => dispatch('close')}
					class="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
				>Cancel</button>
				<button
					type="submit"
					disabled={saving}
					class="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
				>{saving ? 'Saving…' : 'Save changes'}</button>
			</div>
		</form>
	</div>
</div>
