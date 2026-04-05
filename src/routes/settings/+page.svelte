<script lang="ts">
	import { onMount } from 'svelte';

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
