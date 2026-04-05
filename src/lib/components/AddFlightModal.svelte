<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher();

	let route = '';
	let date = '';
	let cabin: 'economy' | 'business' | 'first' = 'economy';
	let fareClass = '';
	let status: 'flown' | 'booked' | 'planned' = 'booked';
	let notes = '';
	let dsc = false;
	let manualSC: number | null = null;
	let needsManualSC = false;
	let saving = false;
	let err = '';

	// Live SC preview
	let previewSC: number | null = null;
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

	$: if (route || cabin || fareClass) scheduleLookup();

	$: displaySC = previewSC !== null ? (dsc ? previewSC * 2 : previewSC) : null;

	onDestroy(() => { if (lookupTimer) clearTimeout(lookupTimer); });

	async function submit() {
		err = '';
		if (!route || !date || !cabin || !status) { err = 'Route, date, cabin and status are required.'; return; }

		saving = true;
		const body: Record<string, unknown> = {
			route: route.toUpperCase(),
			date,
			cabin,
			fare_class: fareClass || null,
			status,
			notes: notes || null
		};

		if (needsManualSC && manualSC !== null) {
			body.sc_value = dsc ? manualSC * 2 : manualSC;
		} else if (previewSC !== null && dsc) {
			body.sc_value = previewSC * 2;
		}

		const res = await fetch('/api/flights', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (res.status === 422) {
			const data = await res.json();
			if (data.needsManualSC) {
				needsManualSC = true;
				manualSC = null;
				saving = false;
				err = 'No SC rule found for this route/cabin. Enter the SC value manually.';
				return;
			}
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
<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-flight-title">
	<div class="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
		<div class="flex items-center justify-between mb-5">
			<h2 id="add-flight-title" class="text-lg font-bold text-slate-900">Add flight</h2>
			{#if displaySC !== null}
				<div class="flex items-center gap-2">
					{#if dsc}
						<span class="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">2× DSC</span>
					{/if}
					<span class="text-lg font-bold text-blue-600">{displaySC} <span class="text-sm font-normal text-slate-400">SCs</span></span>
				</div>
			{/if}
		</div>

		<form on:submit|preventDefault={submit} class="space-y-4">
			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="route">Route</label>
					<input
						id="route"
						bind:value={route}
						placeholder="MEL-SYD"
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 uppercase focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="date">Date</label>
					<input
						id="date"
						type="date"
						bind:value={date}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="cabin">Cabin</label>
					<select
						id="cabin"
						bind:value={cabin}
						class="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					>
						<option value="economy">Economy</option>
						<option value="business">Business</option>
						<option value="first">First</option>
					</select>
				</div>
				<div>
					<label class="block text-xs font-medium text-slate-600 mb-1" for="fare_class">Fare class <span class="text-slate-400 font-normal">(optional)</span></label>
					<select
						id="fare_class"
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

			<!-- DSC toggle -->
			<label class="flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors {dsc ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}">
				<input
					type="checkbox"
					bind:checked={dsc}
					class="h-4 w-4 rounded border-slate-300 accent-amber-500"
				/>
				<div class="flex-1">
					<span class="text-sm font-medium text-slate-800">Double Status Credits offer</span>
					<span class="block text-xs text-slate-400">Booked during a DSC promo — SCs × 2</span>
				</div>
				{#if previewSC !== null && dsc}
					<span class="text-xs font-semibold text-amber-600 tabular-nums">{previewSC} → {previewSC * 2}</span>
				{/if}
			</label>

			{#if needsManualSC}
				<div>
					<label class="block text-xs font-medium text-amber-600 mb-1" for="manual_sc">
						SC value — manual entry{dsc ? ' (will be doubled for DSC)' : ''}
					</label>
					<input
						id="manual_sc"
						type="number"
						bind:value={manualSC}
						min="1"
						placeholder="e.g. 15"
						class="w-full rounded-lg bg-white border border-amber-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
					/>
					{#if manualSC !== null && dsc}
						<p class="text-xs text-amber-600 mt-1">With DSC: {manualSC * 2} SCs</p>
					{/if}
				</div>
			{/if}

			<div>
				<label class="block text-xs font-medium text-slate-600 mb-1" for="notes">Notes <span class="text-slate-400 font-normal">(optional)</span></label>
				<input
					id="notes"
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
				>{saving ? 'Saving…' : 'Add flight'}</button>
			</div>
		</form>
	</div>
</div>
