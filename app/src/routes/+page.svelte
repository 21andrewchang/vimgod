<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import RankUp from '$lib/components/RankUp.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import MatchResults from '$lib/components/MatchResults.svelte';
	import { createMatchController, type MatchState } from '$lib/match/match';
	import { blur } from 'svelte/transition';
	import {
		clearDodgeSnapshot,
		DODGE_LP_PENALTY,
		DODGE_STORAGE_KEY,
		type DodgeSnapshot
	} from '$lib/reloadGuard';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';
	import { getContext, onDestroy, onMount } from 'svelte';
	import { user } from '$lib/stores/auth';
	import '$lib/stores/auth';

	let signedIn = $derived(!!$user);
	let showRankup = $state(false);
	let displayRank = $state('');
	const match = createMatchController({ totalRounds: 20 });

	let deltaApplied = $state(false);
	const resetDeltaApplied = (): void => {
		deltaApplied = false;
	};
	const rankUp = (newRank: string): void => {
		displayRank = newRank;
		deltaApplied = true;
		showRankup = true;
	};

	onMount(() => {
		if (!browser) return;
		const stored = localStorage.getItem(DODGE_STORAGE_KEY);
		if (!stored) return;
		try {
			const parsed = JSON.parse(stored) as DodgeSnapshot;
			if (parsed?.type === 'dodge' && parsed.state) {
				match.replaceState(parsed.state as MatchState);
			}
		} catch (error) {
			console.warn('failed to hydrate dodge snapshot', error);
		} finally {
			clearDodgeSnapshot();
		}
	});

	type ReloadGuardContext = {
		enable: (
			snapshotProvider?: () => DodgeSnapshot | null,
			finalizer?: (snapshot: DodgeSnapshot | null) => void
		) => void;
		disable: () => void;
		disableBlocking: (value: boolean) => void;
	};

	const reloadGuard = getContext<ReloadGuardContext | undefined>('reload-guard');

	const shouldProtectStatuses = new Set<MatchState['status']>(['ready', 'running']);

	const cloneRounds = (rounds: MatchState['completed']) =>
		rounds.map((round) => ({
			...round,
			keys: round.keys.map((entry) => ({ ...entry }))
		}));

	const createDodgeSnapshot = (): DodgeSnapshot | null => {
		const state = get(match);
		if (!shouldProtectStatuses.has(state.status)) return null;
		const endTime = Date.now();
		const completed = cloneRounds(state.completed);
		const penaltyTotal = -Math.abs(DODGE_LP_PENALTY);
		const snapshotState: MatchState = {
			...state,
			status: 'complete',
			active: null,
			completed,
			endTime,
			roundIndex: Math.min(completed.length, state.scoringRounds),
			totalPoints: penaltyTotal,
			outcome: 'dodge',
			undoCount: state.undoCount ?? 0
		};
		return {
			type: 'dodge',
			version: 1,
			penalty: Math.abs(penaltyTotal),
			storedAt: endTime,
			state: snapshotState
		};
	};

	const finalizeDodge = (snapshot: DodgeSnapshot | null) => {
		if (!snapshot) return;
		match.replaceState(snapshot.state as MatchState);
	};

	const startNewMatch = () => {
		match.reset();
		if (!signedIn) {
			match.start();
		}
	};

	$effect(() => {
		if (!reloadGuard) return;

		const status = $match.status;

		if (!signedIn) {
			reloadGuard.disableBlocking(true);
			reloadGuard.disable();
		} else if (shouldProtectStatuses.has(status)) {
			reloadGuard.disableBlocking(false);
			reloadGuard.enable(createDodgeSnapshot, finalizeDodge);
		} else {
			reloadGuard.disableBlocking(false);
			reloadGuard.enable(undefined, (_snapshot) => startNewMatch());
		}
	});

	onDestroy(() => {
		reloadGuard?.disable();
	});
</script>

<svelte:head>
	<title>vimgod</title>
	<meta name="description" content="vimgod - ranked vim. gg." />
	<style>
		html,
		body {
			height: 100%;
			overflow: hidden;
		} /* no scroll anywhere */
	</style>
</svelte:head>

<main
	class="relative flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-6 bg-black py-8"
>
	{#if $match.status !== 'complete'}
		<div class="rounded-xl border border-white/20">
			<Editor {match} />
		</div>
	{:else}
		<MatchResults {match} {rankUp} {deltaApplied} {resetDeltaApplied} />
	{/if}
	<RankUp
		closeRankup={() => {
			showRankup = false;
		}}
		rank={displayRank}
		visible={showRankup}
	/>
	<Footer />
</main>

<style>
	::selection {
		background: transparent;
	}
</style>
