<script lang="ts">
	import { get } from 'svelte/store';
	import { onDestroy } from 'svelte';
	import type { MatchController, MatchState } from '$lib/match/match';

	export let match: MatchController;

	let state: MatchState = get(match);
	const unsubscribe = match.subscribe((value) => {
		state = value;
	});

	onDestroy(() => {
		unsubscribe();
	});

	$: averageMs = state.completed.length
		? state.completed.reduce((sum, round) => sum + round.durationMs, 0) / state.completed.length
		: 0;

	$: totalKeys =
		state.completed.reduce((sum, round) => sum + round.keys.length, 0) +
		(state.active ? state.active.keys.length : 0);

	const formatPoints = (value: number) => {
		const rounded = Math.round(value * 100) / 100;
		const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
		return `${rounded > 0 ? '+' : ''}${formatted}`;
	};

	$: timeLimit = state.timeLimitMs ?? (state.completed[0]?.timeLimitMs ?? 5000);
	$: roundTimes = state.completed.map((round) => round.durationMs);
	$: maxTime = roundTimes.length ? Math.max(timeLimit, ...roundTimes) : timeLimit || 1;
	$: chartPoints = roundTimes.length
		? roundTimes.map((duration, idx) => {
			const x = roundTimes.length === 1 ? 50 : (idx / Math.max(1, roundTimes.length - 1)) * 100;
			const bounded = Math.min(duration, maxTime);
			const y = maxTime > 0 ? 100 - (bounded / maxTime) * 100 : 100;
			return { x, y, duration };
		})
		: [];
	$: polylinePoints = chartPoints.length ? chartPoints.map(({ x, y }) => `${x},${y}`).join(' ') : '';
	$: limitLineY = maxTime > 0 ? 100 - (Math.min(timeLimit, maxTime) / maxTime) * 100 : 100;
	$: totalPointsState = state.totalPoints ?? 0;

	const playAgain = () => {
		match.reset();
		match.start();
	};
</script>

<div class="w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-white shadow-lg backdrop-blur">
	{#if state.status === 'complete'}
		<div class="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<div>
				<h2 class="text-lg font-semibold tracking-tight">Match Results</h2>
				<p class="text-sm text-slate-200/80">
					20 motions sprint complete — review your pace below.
				</p>
			</div>
			<div class="text-right text-sm text-slate-200/70">
				<div>Avg split: {averageMs.toFixed(0)} ms</div>
				<div>Total keys: {totalKeys}</div>
				<div>Points: {formatPoints(totalPointsState)}</div>
			</div>
		</div>
		<div class="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
			<table class="min-w-full text-sm">
				<thead class="text-left text-slate-300/80">
					<tr class="border-b border-white/10">
						<th class="px-3 py-2 font-medium">Round</th>
						<th class="px-3 py-2 font-medium">Sequence</th>
						<th class="px-3 py-2 text-right font-medium">Keys</th>
						<th class="px-3 py-2 text-right font-medium">Time (ms)</th>
						<th class="px-3 py-2 text-right font-medium">Points</th>
					</tr>
				</thead>
				<tbody>
					{#each state.completed as round}
						<tr class="border-b border-white/5">
							<td class="px-3 py-2 font-mono text-slate-100/90">{round.index + 1}</td>
							<td class="px-3 py-2 font-mono text-slate-100"
								>{round.target.sequence.join(' ') || '—'}</td
							>
							<td class="px-3 py-2 text-right font-mono text-slate-200/80">{round.keys.length}</td>
							<td class="px-3 py-2 text-right font-mono text-emerald-200"
								>{round.durationMs.toFixed(0)}</td
							>
							<td
								class={`px-3 py-2 text-right font-mono ${round.points >= 0 ? 'text-emerald-200' : 'text-rose-300'}`}
							>
								{formatPoints(round.points)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if chartPoints.length}
			<div class="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
				<div class="mb-2 flex items-center justify-between text-xs text-slate-200/70">
					<span>Round times</span>
					<span>Limit: {(timeLimit / 1000).toFixed(1)}s</span>
				</div>
				<svg viewBox="0 0 100 100" class="h-40 w-full">
					{#if polylinePoints}
						<polyline
							points={polylinePoints}
							fill="none"
							stroke="#38bdf8"
							stroke-width="2"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>
					{/if}
					{#each chartPoints as point}
						<circle cx={point.x} cy={point.y} r="1.8" fill="#c4b5fd" />
					{/each}
					<line
						x1="0"
						x2="100"
						y1={limitLineY}
						y2={limitLineY}
						stroke="rgba(248, 113, 113, 0.6)"
						stroke-dasharray="4 4"
						stroke-width="1"
					/>
				</svg>
			</div>
		{/if}
		<div class="mt-4 flex justify-center">
			<button
				type="button"
				class="rounded-md border border-emerald-400/60 bg-emerald-400/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-400/30"
				on:click={playAgain}
			>
				Play again
			</button>
		</div>
	{:else}
		<div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<div>
				<h2 class="text-lg font-semibold tracking-tight">Sprint Warmup</h2>
				<p class="text-sm text-slate-200/80">
					Complete 20 generated motions to log a match. Start whenever you&rsquo;re ready.
				</p>
			</div>
			<div class="text-right text-sm text-slate-200/70">
				<div>Round {Math.min(state.roundIndex + 1, state.totalRounds)} / {state.totalRounds}</div>
				<div>Keys so far: {totalKeys}</div>
			</div>
		</div>
	{/if}
</div>
