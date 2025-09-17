<script lang="ts">
	import NextTestButton from '$lib/components/NextTestButton.svelte';
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
	$: wins = completedRounds.filter((round) => round.succeeded).length;
	$: losses = completedRounds.length - wins;
	$: matchOutcome = wins > losses ? 'Win' : wins < losses ? 'Loss' : 'Draw';
	$: lpDelta = state.totalPoints;

	$: averageMs = completedRounds.length
		? completedRounds.reduce((sum, round) => sum + round.durationMs, 0) / completedRounds.length
		: 0;

	$: totalKeys =
		completedRounds.reduce((sum, round) => sum + round.keys.length, 0) +
		(state.active && !state.active.isWarmup ? state.active.keys.length : 0);
	$: roundDurations = completedRounds.map((round) => round.durationMs);
	$: samples = roundDurations.map((duration, index) => ({ x: index, y: duration }));
	$: dashed = roundDurations.length
		? roundDurations.map((_, index) => ({ x: index, y: state.timeLimitMs }))
		: null;

	const formatPoints = (value: number) => {
		const rounded = Math.round(value * 100) / 100;
		const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
		return `${rounded > 0 ? '+' : ''}${formatted}`;
	};
	const playAgain = () => {
		match.reset();
		match.start();
	};
	const graphHeight = 200;
	const elo = 1500;
</script>

<div class="w-full rounded-xl px-20 py-4 text-white shadow-lg backdrop-blur">
	{#if state.status === 'complete'}
		<div class="flex items-center gap-10">
			<div class="box-border flex h-full flex-col justify-between gap-10 rounded-md">
				<div>
					<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">ELO</div>
					<div class="font-mono text-5xl text-slate-100">{elo}</div>
				</div>
				<div>
					<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">{matchOutcome}</div>
					<div class={`font-mono text-5xl ${lpDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
						{formatPoints(lpDelta)}
					</div>
				</div>
			</div>

			<!-- Graph fills remaining width and centers vertically just in case -->
				<div class="flex h-full min-w-0 flex-1 items-center">
					<Graph {samples} target={dashed} height={graphHeight} yMin={0} />
				</div>
		</div>

		<div class="mt-4 flex justify-center">
			<NextTestButton onClick={playAgain} />
		</div>
	{/if}
</div>
