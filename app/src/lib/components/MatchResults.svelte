<script lang="ts">
	import NextTestButton from '$lib/components/NextTestButton.svelte';
	import Graph from '$lib/components/Graph.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { scale, slide } from 'svelte/transition';
	import { get } from 'svelte/store';
	import type { MatchController, MatchState } from '$lib/match/match';
	import { supabase } from '$lib/supabaseClient';
	import { user, signInWithGoogle, increaseXp } from '$lib/stores/auth';
	import { profile, refreshProfile } from '$lib/stores/profile';
	import { matchStatus } from '$lib/stores/matchStatus';
	import { Tween, prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import RollingNumber from '$lib/components/RollingNumber.svelte';
	import { levelFromXP } from '$lib/utils';
	import { lpForRating, rankIdFromRating, prettyRank } from '$lib/data/ranks';

	const { match } = $props<{ match: MatchController }>();

	const signedIn = $derived(!!$user);

	const rating = $derived($profile?.rating ?? null);
	const hasPlacementRating = $derived(rating !== null);
	const placementMode = $derived(signedIn && !hasPlacementRating);
	const elo = $derived(hasPlacementRating ? (rating as number) : 0);
	const rankId = $derived(hasPlacementRating ? rankIdFromRating(elo) : null);
	const startRank = $derived(rankId ? prettyRank(rankId) : 'Unranked');
	const rank = $derived(rankId ? prettyRank(rankId) : 'Unranked');

	const eloTween = new Tween<number>(0);
	let eloAnimated = false;
	let eloStartTimer: ReturnType<typeof setTimeout> | null = null;

	const xpTween = new Tween<number>(0);
	const xpStats = $derived(computeXpStats(xpTween.current));
	let xpBaseline = 0;
	let xpAnimationRan = false;
	let visibleLevel = xpStats.level;
	let slideLevels: [number, number] = [visibleLevel, visibleLevel + 1];
	let hasInitialLevel = false;
	let levelSliding = false;
	let levelSlideKey = 0;
	let levelSlideTimer: ReturnType<typeof setTimeout> | null = null;
	const LEVEL_SLIDE_DURATION = 240;
	const MATCH_XP_REWARD = 10;

	function computeXpStats(current: number) {
		const { level, experience, maxExperience } = levelFromXP(current);
		const percent =
			maxExperience > 0 ? Math.min(100, Math.max(0, (experience / maxExperience) * 100)) : 0;
		console.log('xpTween', current);
		console.log('xp', experience);
		return { level, experience, maxExperience, percent };
	}

	const START_DELAY_MS = 200;
	const BASE_MS = 1200;
	const EXTRA_PER_POINT = 140;
	const MIN_MS = 1600;
	const MAX_MS = 5000;
	const DURATION_POWER = 0.6;

	function clamp(n: number, min: number, max: number) {
		return Math.min(Math.max(n, min), max);
	}

	function scheduleEloAnimation(start: number, end: number) {
		eloTween.set(start, { duration: 0 });

		const duration = clamp(
			BASE_MS + Math.pow(Math.abs(end - start), DURATION_POWER) * EXTRA_PER_POINT,
			MIN_MS,
			MAX_MS
		);

		if (eloStartTimer) {
			clearTimeout(eloStartTimer);
		}

		eloStartTimer = setTimeout(() => {
			eloTween.set(end, { duration, easing: cubicOut });
			eloStartTimer = null;
		}, START_DELAY_MS);
	}

	function twoDigits(n: number) {
		const mod = ((Math.floor(n) % 100) + 100) % 100;
		return String(mod).padStart(2, '0');
	}

	let state: MatchState = get(match);
	const unsubscribe = match.subscribe((value: MatchState) => (state = value));
	onDestroy(unsubscribe);

	onDestroy(() => {
		if (levelSlideTimer) {
			clearTimeout(levelSlideTimer);
			levelSlideTimer = null;
		}
		matchStatus.set('idle');
	});

	onMount(() => {
		matchStatus.set('complete');
		eloTween.set($profile?.rating ?? 0, { duration: 0 });
		void refreshProfile();
	});

	const completedRounds = $derived(state.completed.filter((round) => round.index > 0));
	const wins = $derived(completedRounds.filter((round) => round.succeeded).length);
	const losses = $derived(completedRounds.length - wins);
	const matchOutcome = $derived(
		state.outcome === 'dodge'
			? 'Dodge '
			: wins > losses
				? 'Victory'
				: wins < losses
					? 'Defeat'
					: 'Draw'
	);
	const lpDelta = $derived(state.totalPoints);

	const averageMs = $derived(
		completedRounds.length
			? completedRounds.reduce((s, r) => s + r.durationMs, 0) / completedRounds.length
			: 0
	);

	const totalKeys = $derived(completedRounds.reduce((s, r) => s + r.keys.length, 0));
	const totalDurationMs = $derived(completedRounds.reduce((s, r) => s + r.durationMs, 0));
	const averageKeys = $derived(completedRounds.length ? totalKeys / completedRounds.length : 0);
	const apm = $derived(totalDurationMs > 0 ? (totalKeys / totalDurationMs) * 60000 : 0);
	const roundsWithKeys = $derived(completedRounds.filter((round) => round.keys.length > 0));
	const averageReaction = $derived(
		roundsWithKeys.length
			? roundsWithKeys.reduce(
					(sum, round) => sum + Math.max(0, round.keys[0].at - round.startedAt),
					0
				) / roundsWithKeys.length
			: 0
	);
	const undoCount = $derived(state.undoCount ?? 0);

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

	const keyFrequency = $derived(
		completedRounds.reduce<Record<string, number>>((acc, round) => {
			round.keys.forEach((entry) => {
				if (!isTrackableKey(entry.key)) return;
				acc[entry.key] = (acc[entry.key] ?? 0) + 1;
			});
			return acc;
		}, {})
	);
	const mostUsedKey = $derived(
		Object.entries(keyFrequency).reduce<{ key: string; count: number } | null>(
			(current, [key, count]) => {
				if (!current || count > current.count) return { key, count };
				return current;
			},
			null
		)
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

	const PLACEMENT_CAP = RANK_VALUES.gold1;
	const lsKey = (uid: string | null) => `mh:last:${uid ?? 'anon'}`;

	function placementEloForAverageSpeed(avgSpeed: number): number {
		const band =
			rankBands.find((candidate) => avgSpeed <= candidate.maxMs) ?? rankBands[rankBands.length - 1];
		return Math.min(band.value, PLACEMENT_CAP);
	}

	const PLACEMENT_MATCH_GOAL = 5;
	let placementMatchCount = 0;

	function formatPlacementProgress(count: number): string {
		console.log('from function: ', count);
		const clamped = Math.min(PLACEMENT_MATCH_GOAL, Math.max(0, count));
		const display = clamped === 0 ? 1 : clamped;
		return `${display} / ${PLACEMENT_MATCH_GOAL}`;
	}

	function buildSignature(state: MatchState, uid: string | null) {
		const rounds = state.completed.filter((r) => r.index > 0);
		const firstStart = rounds[0]?.startedAt ?? state.startTime ?? 0;
		const lastDone = state.endTime ?? rounds.at(-1)?.completedAt ?? 0;
		return JSON.stringify({
			uid,
			rounds: rounds.length,
			firstStart,
			lastDone,
			totalPoints: state.totalPoints,
			timeLimitMs: state.timeLimitMs
		});
	}

	function getOrCreateMatchId(signature: string, uid: string | null) {
		try {
			const key = lsKey(uid);
			const saved = localStorage.getItem(key);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed?.signature === signature && parsed?.match_id) {
					return parsed.match_id as string; // reuse on reload
				}
			}
			const match_id =
				crypto?.randomUUID?.() ??
				`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
			localStorage.setItem(key, JSON.stringify({ signature, match_id }));
			return match_id;
		} catch {
			return (
				crypto?.randomUUID?.() ??
				`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
			);
		}
	}

	$effect(() => {
		if (!hasPlacementRating) {
			eloAnimated = false;
			if (eloStartTimer) {
				clearTimeout(eloStartTimer);
				eloStartTimer = null;
			}
			eloTween.set(0, { duration: 0 });
			return;
		}

		if (state.status === 'complete' && !eloAnimated) {
			eloAnimated = true;

			const startElo = lpForRating(elo).lp ?? 0;
			let endElo = startElo + (lpDelta ?? 0);

			scheduleEloAnimation(startElo, endElo);
		}

		if (state.status !== 'complete') {
			eloAnimated = false;
			if (eloStartTimer) {
				clearTimeout(eloStartTimer);
				eloStartTimer = null;
			}
			eloTween.set(lpForRating(elo).lp ?? 0, { duration: 0 });
		}
	});

	onMount(() => {
		xpBaseline = $profile?.xp ?? 0;
		xpTween.set(xpBaseline, { duration: 0 });
		xpAnimationRan = false;
		visibleLevel = xpStats.level;
		slideLevels = [visibleLevel, visibleLevel + 1];
		hasInitialLevel = true;
		levelSliding = false;
	});

	$effect(() => {
		if (!signedIn) {
			xpBaseline = 0;
			xpAnimationRan = false;
			xpTween.set(0, { duration: 0 });
			visibleLevel = 0;
			slideLevels = [0, 1];
			hasInitialLevel = false;
			levelSliding = false;
			if (levelSlideTimer) {
				clearTimeout(levelSlideTimer);
				levelSlideTimer = null;
			}
			return;
		}

		const profileXp = $profile?.xp ?? 0;

		if (state.status === 'complete' && state.outcome !== 'dodge') {
			if (!xpAnimationRan) {
				xpAnimationRan = true;
				xpBaseline = profileXp;
				const targetXp = xpBaseline + MATCH_XP_REWARD;
				xpTween.set(xpBaseline, { duration: 0 });
				// xpTween.set(targetXp, { duration: 1000, easing: cubicOut, delay: 3000 });
			} else if (profileXp >= xpBaseline + MATCH_XP_REWARD) {
				xpBaseline = profileXp;
				xpTween.set(profileXp, { duration: 0 });
			}
		}
		// } else {
		// 	const targetXp = xpBaseline + MATCH_XP_REWARD;
		// 	xpTween.set(targetXp, { duration: 700, easing: cubicOut });
		// }
		return;
	});

	$effect(() => {
		const currentLevel = xpStats.level;

		if (!hasInitialLevel) {
			visibleLevel = currentLevel;
			slideLevels = [currentLevel, currentLevel + 1];
			hasInitialLevel = true;
			return;
		}

		if (state.status !== 'complete') {
			if (currentLevel !== visibleLevel) {
				visibleLevel = currentLevel;
				slideLevels = [currentLevel, currentLevel + 1];
			}
			levelSliding = false;
			if (levelSlideTimer) {
				clearTimeout(levelSlideTimer);
				levelSlideTimer = null;
			}
			return;
		}

		if (currentLevel > visibleLevel && !levelSliding) {
			slideLevels = [visibleLevel, currentLevel];
			levelSliding = true;
			levelSlideKey += 1;
			if (levelSlideTimer) {
				clearTimeout(levelSlideTimer);
			}
			levelSlideTimer = setTimeout(() => {
				visibleLevel = currentLevel;
				slideLevels = [visibleLevel, visibleLevel + 1];
				levelSliding = false;
				levelSlideTimer = null;
			}, LEVEL_SLIDE_DURATION);
		} else if (currentLevel < visibleLevel) {
			visibleLevel = currentLevel;
			slideLevels = [currentLevel, currentLevel + 1];
			levelSliding = false;
			if (levelSlideTimer) {
				clearTimeout(levelSlideTimer);
				levelSlideTimer = null;
			}
		}
	});

	let wroteHistoryOnce = false;

	async function writeHistoryIdempotent(): Promise<number | null> {
		if (wroteHistoryOnce) return null;
		if (state.status !== 'complete') return null;

		const uid = $user?.id ?? null;

		const signature = buildSignature(state, uid);
		const match_id = getOrCreateMatchId(signature, uid);

		const currentRating = $profile?.rating ?? null;
		const isPlacementMatch = uid !== null && currentRating === null;
		const isDodge = state.outcome === 'dodge';
		let startElo: number | null = currentRating;
		let endEloToStore: number | null = null;
		let lpDeltaToStore: number | null = null;

		if (isPlacementMatch) {
			type PlacementMatch = { avg_speed: number | null; is_dodge: boolean | null };
			const { data: placementHistory, error: placementError } = await supabase
				.from('match_history')
				.select('avg_speed, is_dodge')
				.eq('player_id', uid)
				.is('end_elo', null)
				.neq('match_id', match_id)
				.order('created_at', { ascending: true });

			if (placementError) {
				console.error('Failed to load placement history', placementError);
			}

			const historyRows = (placementHistory as PlacementMatch[] | null) ?? [];
			const nonDodgeMatches = historyRows.filter((match) => match?.is_dodge !== true);
			const priorCount = nonDodgeMatches.length;
			placementMatchCount = Math.min(PLACEMENT_MATCH_GOAL, priorCount + (isDodge ? 0 : 1));
			console.log('count: ', placementMatchCount);

			if (!isDodge && priorCount >= PLACEMENT_MATCH_GOAL - 1) {
				const priorAverageSum = nonDodgeMatches.reduce((sum, match) => {
					const speed = typeof match.avg_speed === 'number' ? match.avg_speed : 0;
					return sum + speed;
				}, 0);
				const combinedAverage = (priorAverageSum + averageMs) / (priorCount + 1);
				endEloToStore = placementEloForAverageSpeed(combinedAverage);
			}

			startElo = null;
		} else if (currentRating !== null) {
			placementMatchCount = 0;
			const baseline = currentRating;
			startElo = baseline;
			const delta = lpDelta ?? 0;
			endEloToStore = baseline + delta;
			lpDeltaToStore = delta;
		} else {
			placementMatchCount = 0;
			startElo = null;
			endEloToStore = null;
			lpDeltaToStore = null;
		}

		const row = {
			match_id,
			player_id: uid,
			avg_speed: averageMs,
			efficiency: averageKeys,
			most_used: mostUsedKey?.key ?? null,
			undos: undoCount,
			apm: Math.round(apm),
			reaction_time: averageReaction,
			start_elo: startElo,
			end_elo: endEloToStore,
			lp_delta: lpDeltaToStore,
			is_dodge: isDodge,
			motion_counts: Object.keys(keyFrequency).length ? keyFrequency : {}
		};

		const { data, error } = await supabase
			.from('match_history')
			.upsert([row], { onConflict: 'match_id' })
			.select('end_elo')
			.single();

		if (error) {
			console.error('match_history upsert failed', error);
			return null;
		}

		wroteHistoryOnce = true;

		if (signedIn && state.outcome !== 'dodge') {
			try {
				const updatedXp = await increaseXp(10);
				profile.update((p) => (p ? { ...p, xp: updatedXp } : p));
			} catch (xpErr) {
				console.error('Failed to award XP', xpErr);
			}
		}

		const endElo = typeof data?.end_elo === 'number' ? data.end_elo : endEloToStore;

		if (typeof endElo === 'number') {
			profile.update((p) => (p ? { ...p, rating: endElo } : p));
		}

		void refreshProfile();

		return endElo;
	}

	$effect(() => {
		if (state.status === 'complete') {
			void writeHistoryIdempotent();
		}
	});

	// graph data
	const roundDurations = $derived(completedRounds.map((r) => r.durationMs));
	const samples = $derived(roundDurations.map((duration, index) => ({ x: index, y: duration })));
	const dashed = $derived(
		roundDurations.length
			? roundDurations.map((_, index) => ({ x: index, y: state.timeLimitMs }))
			: null
	);

	type Sign = '+' | '-' | '';

	export const formatPoints = (value: number): { sign: Sign; number: string } => {
		const rounded = Math.round(value * 100) / 100;

		// sign: always '+' or '-' for nonzero; '' for exact zero
		const sign: Sign = rounded > 0 ? '+' : rounded < 0 || Object.is(rounded, -0) ? '-' : '';

		// magnitude without sign
		const mag = Math.abs(rounded);
		const number = Number.isInteger(mag) ? mag.toString() : mag.toFixed(2);

		return { sign, number };
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

		eloAnimated = false;
		if (eloStartTimer) {
			clearTimeout(eloStartTimer);
			eloStartTimer = null;
		}
		eloTween.set($profile?.rating ?? 0, { duration: 0 });

		const resetXp = $profile?.xp ?? 0;
		xpBaseline = resetXp;
		xpTween.set(resetXp, { duration: 0 });
		xpAnimationRan = false;
		if (levelSlideTimer) {
			clearTimeout(levelSlideTimer);
			levelSlideTimer = null;
		}
		visibleLevel = xpStats.level;
		slideLevels = [visibleLevel, visibleLevel + 1];
		levelSliding = false;
	};

	const graphHeight = 200;
</script>

<div class="mb-12 w-full max-w-7xl rounded-xl px-20 text-white shadow-lg backdrop-blur">
	{#if signedIn}
		<div class="mb-12 w-full">
			<div
				class="flex w-full items-center font-mono text-[11px] uppercase tracking-[0.28em] text-neutral-400"
			>
				{#if xpStats.level === slideLevels[1]}
					<div in:scale={{ start: 0.4, duration: 100 }}>Lvl {xpStats.level}</div>
				{:else}
					<span>Lvl {xpStats.level}</span>
				{/if}
				<span class="ml-auto text-[10px] text-neutral-500"
					>{Math.round(xpStats.experience)} / {xpStats.maxExperience}</span
				>
			</div>
			<div class="relative mt-2 h-px w-full overflow-hidden rounded-full bg-neutral-900/70">
				<div
					class="absolute inset-0 left-0 bg-neutral-500"
					style={`width:${xpStats.percent}%;`}
				></div>
			</div>
		</div>
	{/if}
	{#if state.status === 'complete'}
		<div class=" flex items-center gap-16">
			<div class="mb-2 flex items-center justify-center">
				{#if !signedIn}
					<div
						class=" absolute flex flex-col items-center p-20 px-0 font-mono text-xs text-neutral-400"
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-3 self-center text-neutral-400"
							aria-hidden="true"
						>
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
							onclick={signInWithGoogle}
							class="z-50 underline transition hover:text-neutral-200"
						>
							sign in
						</button>
						<div class="w-full">to play ranked</div>
					</div>
				{/if}

				<div
					class="w-30 relative box-border flex h-full select-none flex-col justify-between gap-10 rounded-md transition"
					class:blur-sm={!signedIn}
					class:opacity-50={!signedIn}
					aria-hidden={!signedIn}
				>
					<div>
						{#if placementMode}
							<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">
								Placements
							</div>
						{:else}
							<div
								class="flex items-center gap-1 font-mono text-xs uppercase tracking-widest text-neutral-400"
							>
								{#if eloTween.current > 100 || eloTween.current < 0}
									<div in:scale={{ start: 0.4, duration: 200 }}>{rank}</div>
								{:else}
									<div>{startRank}</div>
								{/if}
								{#if startRank !== rank}
									{#if lpDelta < 0}
										<svg
											class="mb-0.5 h-2 w-2 rotate-180 text-red-400"
											viewBox="0 0 12 12"
											fill="none"
											aria-hidden="true"
										>
											<path
												d="M2 7 L6 3 L10 7"
												stroke="currentColor"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									{:else}
										<svg
											viewBox="0 0 12 12"
											fill="none"
											class="h-2 w-2 text-emerald-300"
											aria-hidden="true"
										>
											<path
												d="M2 7 L6 3 L10 7"
												stroke="currentColor"
												stroke-width="1"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</svg>
									{/if}
								{/if}
							</div>
						{/if}
						{#if placementMode}
							<div class="flex flex-row gap-2">
								<div class="mt-2 font-mono text-4xl tracking-tighter text-slate-100 transition">
									{placementMatchCount}/5
								</div>
							</div>
						{:else}
							<div class="flex flex-row items-end gap-2">
								<div
									class="font-mono text-5xl text-slate-100 transition"
									class:opacity-60={!signedIn}
								>
									{twoDigits(Math.round(eloTween.current))}
								</div>
								<div class="mb-1 font-mono text-xs text-neutral-600">LP</div>
							</div>
						{/if}
					</div>

					<div>
						<div class="font-mono text-xs uppercase tracking-widest text-neutral-400">
							{matchOutcome}
						</div>
						<div class="flex flex-row items-end gap-2">
							{#if placementMode}
								<div class="mt-4 font-mono text-5xl text-neutral-500" class:opacity-60={!signedIn}>
									-
								</div>
							{:else}
								<div class="flex items-center gap-0.5">
									<div
										class={`font-mono text-2xl transition ${lpDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
										class:opacity-60={!signedIn}
									>
										{formatPoints(lpDelta).sign}
									</div>
									<div
										class={`font-mono text-5xl transition ${lpDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}
										class:opacity-60={!signedIn}
									>
										{formatPoints(lpDelta).number}
									</div>
								</div>
								<div class="mb-1 font-mono text-xs text-neutral-600">LP</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
			<div class="relative flex h-full min-w-0 flex-1 items-center">
				{#if matchOutcome === 'Dodge '}
					<div class="pointer-events-none absolute inset-0 z-10 grid place-items-center">
						<div class="z-50 mb-6 font-mono text-xs text-neutral-400">stats not available</div>
					</div>
				{/if}
				<div
					class="flex h-full min-w-0 flex-1 items-center"
					class:blur-[2px]={matchOutcome === 'Dodge '}
					class:opacity-80={matchOutcome === 'Dodge '}
				>
					<Graph {samples} target={dashed} height={graphHeight} yMin={0} />
				</div>
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
				<div class="mt-1 font-mono text-2xl">
					{matchOutcome === 'Dodge ' ? '-' : formatSeconds(averageMs)}
				</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">efficiency</div>
				<div class="mt-1 font-mono text-2xl">
					{matchOutcome === 'Dodge ' ? '-' : formatNumber(averageKeys, 1)}
				</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">most used</div>
				<div class="mt-1 font-mono text-2xl">
					{matchOutcome === 'Dodge ' ? '-' : (mostUsedKey?.key ?? '-')}
				</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">undos</div>
				<div class="mt-1 font-mono text-2xl">{matchOutcome === 'Dodge ' ? '-' : undoCount}</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">apm</div>
				<div class="mt-1 font-mono text-2xl">
					{matchOutcome === 'Dodge ' ? '-' : formatNumber(apm, 0)}
				</div>
			</div>
			<div class="items-center rounded-lg p-4">
				<div class="font-mono text-xs text-neutral-400">reaction time</div>
				<div class="mt-1 font-mono text-2xl">
					{matchOutcome === 'Dodge ' ? '-' : formatSeconds(averageReaction)}
				</div>
			</div>
		</div>

		<div class="mt-4 flex justify-center">
			<NextTestButton onClick={playAgain} />
		</div>
	{/if}
</div>

<style>
	.level-roller {
		height: 1.2rem;
		overflow: hidden;
		position: relative;
		width: fit-content;
	}

	.level-track {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		transform: translateY(0);
		transition: transform 0.22s ease-out;
	}

	.level-roller.is-animating .level-track {
		transform: translateY(-100%);
	}

	.level-track span {
		display: block;
		line-height: 1.1rem;
	}
</style>
