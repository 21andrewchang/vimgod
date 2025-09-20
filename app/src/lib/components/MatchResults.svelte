<script lang="ts">
	import NextTestButton from '$lib/components/NextTestButton.svelte';
	import { goto } from '$app/navigation';
	import Graph from '$lib/components/Graph.svelte';
	import { get } from 'svelte/store';
	import { onDestroy } from 'svelte';
	import type { MatchController, MatchState } from '$lib/match/match';
	import { supabase } from '$lib/supabaseClient';
	import {
		user,
		signInWithGoogle,
		setInitialRank,
		applyRatingDelta,
		increaseXp
	} from '$lib/stores/auth';
	import { page } from '$app/stores';

	export let match: MatchController;

	let wroteHistory = false;
	let elo = $page.data?.user?.rating ?? 67;
	let xp = $page.data?.user?.xp ?? 0;
	$: signedIn = !!$user;

	let state: MatchState = get(match);
	const unsubscribe = match.subscribe((value) => (state = value));
	onDestroy(unsubscribe);

	$: completedRounds = state.completed.filter((round) => round.index > 0);
	$: wins = completedRounds.filter((round) => round.succeeded).length;
	$: losses = completedRounds.length - wins;
	$: matchOutcome =
		state.outcome === 'dodge' ? 'Dodge' : wins > losses ? 'Win' : wins < losses ? 'Loss' : 'Draw';
	$: lpDelta = state.totalPoints;

	$: averageMs = completedRounds.length
		? completedRounds.reduce((s, r) => s + r.durationMs, 0) / completedRounds.length
		: 0;

	$: totalKeys = completedRounds.reduce((s, r) => s + r.keys.length, 0);
	$: totalDurationMs = completedRounds.reduce((s, r) => s + r.durationMs, 0);
	$: averageKeys = completedRounds.length ? totalKeys / completedRounds.length : 0;
	$: apm = totalDurationMs > 0 ? (totalKeys / totalDurationMs) * 60000 : 0;
	$: roundsWithKeys = completedRounds.filter((round) => round.keys.length > 0);
	$: averageReaction = roundsWithKeys.length
		? roundsWithKeys.reduce(
				(sum, round) => sum + Math.max(0, round.keys[0].at - round.startedAt),
				0
			) / roundsWithKeys.length
		: 0;
	$: undoCount = state.undoCount ?? 0;

	const IGNORED_KEYS = new Set([
		'Alt',
		'AltGraph',
		'AltLeft',
		'AltRight',
		'CapsLock',
		'Control',
		'ControlLeft',
		'ControlRight',
		'Meta',
		'MetaLeft',
		'MetaRight',
		'Shift',
		'ShiftLeft',
		'ShiftRight',
		'Tab',
		'Enter',
		'Backspace'
	]);
	const isTrackableKey = (key: string) => {
		if (!key) return false;
		if (IGNORED_KEYS.has(key)) return false;
		if (key.length === 1 && /[0-9]/.test(key)) return false;
		return true;
	};

	$: keyFrequency = completedRounds.reduce<Record<string, number>>((acc, round) => {
		round.keys.forEach((entry) => {
			if (!isTrackableKey(entry.key)) return;
			acc[entry.key] = (acc[entry.key] ?? 0) + 1;
		});
		return acc;
	}, {});
	$: mostUsedKey = Object.entries(keyFrequency).reduce<{ key: string; count: number } | null>(
		(current, [key, count]) => {
			if (!current || count > current.count) return { key, count };
			return current;
		},
		null
	);

	const RANK_VALUES = {
		bronze4: 0,
		bronze3: 100,
		bronze2: 200,
		bronze1: 300,
		silver4: 400,
		silver3: 500,
		silver2: 600,
		silver1: 700,
		gold4: 800,
		gold3: 900,
		gold2: 1000,
		gold1: 1100,
		platinum4: 1200,
		platinum3: 1300,
		platinum2: 1400,
		platinum1: 1500,
		diamond4: 1600,
		diamond3: 1700,
		diamond2: 1800,
		diamond1: 1900,
		nova: 2000,
		supernova: 2200,
		singularity: 2500
	} as const;

	const rankBands = [
		{ label: 'Masters+', maxMs: 900, value: RANK_VALUES.nova },
		{ label: 'Diamond 1', maxMs: 1000, value: RANK_VALUES.diamond1 },
		{ label: 'Platinum 1', maxMs: 2000, value: RANK_VALUES.platinum1 },
		{ label: 'Gold 1', maxMs: 3000, value: RANK_VALUES.gold1 },
		{ label: 'Silver 1', maxMs: 4000, value: RANK_VALUES.silver1 },
		{ label: 'Bronze 1', maxMs: 5000, value: RANK_VALUES.bronze1 },
		{ label: 'Bronze 4', maxMs: Number.POSITIVE_INFINITY, value: RANK_VALUES.bronze4 }
	] as const;

	const PLACEMENT_CAP = RANK_VALUES.gold4;

	$: projectedRankValue = completedRounds.length
		? (rankBands.find((band) => averageMs <= band.maxMs) ?? rankBands[rankBands.length - 1]).value
		: null;
	$: placementRankValue =
		projectedRankValue === null ? null : Math.min(projectedRankValue, PLACEMENT_CAP);
	$: projectedRankValue !== null &&
		console.log('Projected rank (avg ms):', {
			averageMs,
			projectedRankValue,
			placementRankValue
		});

	let triedInitialRank = false;

	$: if (
		!triedInitialRank &&
		state.status === 'complete' &&
		$user &&
		projectedRankValue !== null &&
		placementRankValue !== null
	) {
		triedInitialRank = true;
		setInitialRank(projectedRankValue, placementRankValue)
			.then(({ updated }) => {
				if (updated) {
					console.log('Initial rank set successfully', {
						hiddenMmr: projectedRankValue,
						rating: placementRankValue
					});
				} else {
					console.log('Initial rank already set');
				}
			})
			.catch((error) => {
				console.error('Failed to set initial rank', error);
			});
	}

	let prevWasComplete = false; // rising-edge detector

	async function writeMatchHistory() {
		try {
			const uid = $user.id;
			const { error } = await supabase.from('match_history').insert([
				{
					player_id: uid,
					avg_speed: averageMs,
					efficiency: averageKeys,
					most_used: mostUsedKey?.key ?? null,
					undos: undoCount,
					apm: Math.round(apm),
					reaction_time: averageReaction,
					start_elo: elo,
					end_elo: elo + lpDelta,
					lp_delta: lpDelta
				}
			]);
			if (error) {
				console.error('match_history insert failed', error);
				wroteHistory = false;
			}
		} catch (e) {
			console.error('match_history insert threw', e);
			wroteHistory = false;
		}
	}

	// Rising-edge effect: runs exactly once when status flips to 'complete'
	$: {
		const isComplete = state.status === 'complete' && !!$user;
		if (isComplete && !prevWasComplete && !wroteHistory) {
			prevWasComplete = true; // lock the edge
			wroteHistory = true; // prevent double fire
			// Important: do NOT mutate `state` or `$user` here
			void writeMatchHistory();
		}
		if (!isComplete) prevWasComplete = false; // reset if user leaves results
	}

	$: roundDurations = completedRounds.map((r) => r.durationMs);
	$: samples = roundDurations.map((duration, index) => ({ x: index, y: duration }));
	$: dashed = roundDurations.length
		? roundDurations.map((_, index) => ({ x: index, y: state.timeLimitMs }))
		: null;

	const formatPoints = (value: number) => {
		const rounded = Math.round(value * 100) / 100;
		const formatted = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2);
		return `${rounded > 0 ? '+' : ''}${formatted}`;
	};
	const formatSeconds = (value: number) => `${(value / 1000).toFixed(2)}s`;
	const formatNumber = (value: number, digits = 1) => {
		if (!Number.isFinite(value)) return digits > 0 ? `0.${'0'.repeat(digits)}` : '0';
		return value.toFixed(digits);
	};

	const playAgain = () => {
		match.reset();
		if (!signedIn) {
			match.start();
		}
		triedInitialRank = false;
	};

	const graphHeight = 200;
	console.log('page.data', $page.data);
</script>

<div class="w-full max-w-7xl rounded-xl px-20 py-4 text-white shadow-lg backdrop-blur">
	{#if state.status === 'complete'}
		<div class="flex items-center gap-16">
			<div class="flex items-center justify-center">
				{#if !signedIn}
					<div class=" absolute flex flex-col items-center p-20 font-mono text-xs text-neutral-400">
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-3 self-center text-neutral-400"
							aria-hidden="true"
						>
							<!-- Heroicons solid: lock-closed -->
							<path
								fill="currentColor"
								fill-rule="evenodd"
								d="M12 1.5A5.25 5.25 0 0 0 6.75 6.75V9
       A2.25 2.25 0 0 0 4.5 11.25v6A2.25 2.25 0 0 0 6.75 19.5h10.5
       A2.25 2.25 0 0 0 19.5 17.25v-6A2.25 2.25 0 0 0 17.25 9V6.75
       A5.25 5.25 0 0 0 12 1.5zm-3 7.5V6.75a3 3 0 1 1 6 0V9H9z"
								clip-rule="evenodd"
							/>
						</svg>
						<button
							on:click={signInWithGoogle}
							class="z-50 underline transition hover:text-neutral-200"
						>
							sign in
						</button>
						<div>to play ranked</div>
					</div>
				{/if}

				<div
					class="relative box-border flex h-full select-none flex-col justify-between gap-10 rounded-md transition"
					class:blur-sm={!signedIn}
					class:opacity-50={!signedIn}
					aria-hidden={!signedIn}
				>
					<div>
						<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">ELO</div>
						<div class="font-mono text-5xl text-slate-100 transition" class:opacity-60={!signedIn}>
							{elo}
						</div>
					</div>

					<div>
						<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">
							{matchOutcome}
						</div>
						<div
							class={`font-mono text-5xl transition ${lpDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
							class:opacity-60={!signedIn}
						>
							{formatPoints(lpDelta)}
						</div>
						{#if state.outcome === 'dodge'}
							<div class="mt-2 font-mono text-[0.7rem] uppercase tracking-widest text-rose-300">
								dodge penalty applied ({formatPoints(Math.abs(lpDelta) * -1)} lp)
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- RIGHT: graph -->
			<div class="flex h-full min-w-0 flex-1 items-center">
				<Graph {samples} target={dashed} height={graphHeight} yMin={0} />
			</div>
		</div>

		<div
			class="mt-6 grid grid-cols-1 gap-x-8 gap-y-0 text-neutral-200
	 sm:grid-cols-3 sm:gap-x-40
         lg:grid-cols-6 lg:gap-x-8"
			aria-hidden={!signedIn}
		>
			<div class="items-center rounded-lg p-4">
				<div class=" font-mono text-xs text-neutral-400">avg speed</div>
				<div class="mt-1 font-mono text-2xl">{formatSeconds(averageMs)}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">efficiency</div>
				<div class="mt-1 font-mono text-2xl">{formatNumber(averageKeys, 1)}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">most used</div>
				<div class="mt-1 font-mono text-2xl">{mostUsedKey ? mostUsedKey.key : '—'}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">undos</div>
				<div class="mt-1 font-mono text-2xl">{undoCount}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">apm</div>
				<div class="mt-1 font-mono text-2xl">{formatNumber(apm, 0)}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">reaction time</div>
				<div class="mt-1 font-mono text-2xl">{formatSeconds(averageReaction)}</div>
			</div>
		</div>

		<div class="mt-4 flex justify-center">
			<NextTestButton onClick={playAgain} />
		</div>
	{/if}
</div>
