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
		<div class="mt-4 flex justify-center">
			<NextTestButton onClick={playAgain} />
		</div>
	{/if}
</div>
