<script lang="ts">
	import type { Summary } from '$lib/stores.js';

	export let summary: Summary | null;

	// Build the two-line velocity chart:
	// Line A (red): required SCs/day from each past day to year_end
	// Line B (green): rolling 30-day average of SCs earned per day
	// For now we render the forward-looking portion only (today → year_end)
	// since we don't have per-day history in the DB yet (future enhancement).

	type Point = { x: number; y: number };

	let width = 600;
	let height = 160;
	const padL = 40;
	const padR = 16;
	const padT = 12;
	const padB = 28;
	const chartW = width - padL - padR;
	const chartH = height - padT - padB;

	function buildLines(s: Summary): { lineA: Point[]; lineB: Point[]; maxY: number; days: number } {
		const today = new Date();
		const yearStart = new Date(s.year_start);
		const yearEnd = new Date(s.year_end);
		const totalDays = Math.max(1, Math.ceil((yearEnd.getTime() - yearStart.getTime()) / 86400000));
		const daysElapsed = Math.max(0, Math.ceil((today.getTime() - yearStart.getTime()) / 86400000));

		// Line A: required SCs/day at each future day
		// At day d (from year_start), required rate = (target - earned_so_far) / (totalDays - d)
		// We approximate earned_so_far as constant (today's earned + ground)
		const earnedNow = s.earned + s.ground_sc;

		const lineA: Point[] = [];
		for (let d = daysElapsed; d <= totalDays; d++) {
			const daysLeft = totalDays - d;
			const rate = daysLeft > 0 ? (s.target_sc - earnedNow) / daysLeft : 0;
			lineA.push({ x: d, y: Math.max(0, rate) });
		}

		// Line B: current actual pace (flat line at earned/daysElapsed)
		const actualRate = daysElapsed > 0 ? earnedNow / daysElapsed : 0;
		const lineB: Point[] = [
			{ x: daysElapsed, y: actualRate },
			{ x: totalDays, y: actualRate }
		];

		const maxY = Math.max(
			...lineA.map((p) => p.y),
			actualRate,
			1
		);

		return { lineA, lineB, maxY, days: totalDays };
	}

	function toSVG(points: Point[], days: number, maxY: number): string {
		if (points.length === 0) return '';
		return points
			.map((p) => {
				const x = padL + (p.x / days) * chartW;
				const y = padT + chartH - (p.y / maxY) * chartH;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	$: data = summary ? buildLines(summary) : null;
	$: lineAPoints = data ? toSVG(data.lineA, data.days, data.maxY) : '';
	$: lineBPoints = data ? toSVG(data.lineB, data.days, data.maxY) : '';

	// Today marker x
	$: todayX = data && summary
		? padL + (Math.ceil((new Date().getTime() - new Date(summary.year_start).getTime()) / 86400000) / data.days) * chartW
		: padL;
</script>

<div class="rounded-xl bg-white border border-slate-200 p-4">
	<div class="flex items-center justify-between mb-3">
		<p class="text-sm font-semibold text-slate-900">Credit Velocity</p>
		<div class="flex gap-4 text-xs text-slate-500">
			<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-4 bg-red-400"></span>Required pace</span>
			<span class="flex items-center gap-1"><span class="inline-block h-0.5 w-4 bg-emerald-500"></span>Actual pace</span>
		</div>
	</div>

	{#if data && lineAPoints}
		<svg viewBox="0 0 {width} {height}" class="w-full" aria-label="Credit velocity chart">
			<!-- Y-axis labels -->
			{#each [0, 0.25, 0.5, 0.75, 1] as frac}
				{@const y = padT + chartH - frac * chartH}
				{@const label = (frac * data.maxY).toFixed(1)}
				<text x={padL - 4} y={y + 4} text-anchor="end" class="fill-slate-400 text-[9px]" font-size="9">{label}</text>
				<line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e8f0" stroke-width="0.5" />
			{/each}

			<!-- Today marker -->
			<line x1={todayX} y1={padT} x2={todayX} y2={padT + chartH} stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,3" />
			<text x={todayX + 3} y={padT + 10} class="fill-slate-400" font-size="9">today</text>

			<!-- Line A: required rate (red) -->
			<polyline
				points={lineAPoints}
				fill="none"
				stroke="#f87171"
				stroke-width="2"
				stroke-linejoin="round"
			/>

			<!-- Line B: actual rate (green) -->
			<polyline
				points={lineBPoints}
				fill="none"
				stroke="#10b981"
				stroke-width="2"
				stroke-dasharray="6,3"
			/>
		</svg>

		<p class="mt-2 text-xs text-slate-500">
			{#if summary && summary.required_rate_per_day <= (data ? (summary.earned + summary.ground_sc) / Math.max(1, Math.ceil((new Date().getTime() - new Date(summary.year_start).getTime()) / 86400000)) : 999)}
				<span class="text-emerald-600 font-medium">On track.</span> Your actual pace exceeds what's required.
			{:else}
				<span class="text-amber-500 font-medium">Behind pace.</span> You need {summary?.required_rate_per_day} SCs/day — book more flights to close the gap.
			{/if}
		</p>
	{:else}
		<div class="h-32 flex items-center justify-center text-slate-400 text-sm">No data yet — add some flights</div>
	{/if}
</div>
