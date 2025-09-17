<script lang="ts">
	import Graph from '$lib/components/Graph.svelte';
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

	$: completedRounds = state.completed.filter((round) => round.index > 0);

	$: averageMs = completedRounds.length
		? completedRounds.reduce((sum, round) => sum + round.durationMs, 0) / completedRounds.length
		: 0;

	$: totalKeys =
		completedRounds.reduce((sum, round) => sum + round.keys.length, 0) +
		(state.active && !state.active.isWarmup ? state.active.keys.length : 0);

	const formatPoints = (value: number) => {
		const rounded = Math.round(value * 100) / 100;
		const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
		return `${rounded > 0 ? '+' : ''}${formatted}`;
	};

	const speeds = state.completed.map((r) => 60000 / Math.max(1, r.durationMs));
	const samples = speeds.map((y, i) => ({ x: i, y }));
	const avg = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
	const dashed = speeds.map((_, i) => ({ x: i, y: avg }));
	const playAgain = () => {
		match.reset();
		match.start();
	};
</script>

<div class="w-full max-w-3xl rounded-xl px-5 py-4 text-white shadow-lg backdrop-blur">
	{#if state.status === 'complete'}
		<Graph {samples} target={dashed} height={200} yMin={0} />
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
					{#each completedRounds as round}
						<tr class="border-b border-white/5">
							<td class="px-3 py-2 font-mono text-slate-100/90">{round.index}</td>
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
		<div class="mt-4 flex justify-center">
			<button
				type="button"
				class="rounded-md border border-emerald-400/60 bg-emerald-400/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-400/30"
				on:click={playAgain}
			>
				Play again
			</button>
		</div>
	{/if}
</div>
