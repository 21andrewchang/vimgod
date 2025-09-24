<script lang="ts">
	import NextTestButton from '$lib/components/NextTestButton.svelte';
	import { goto } from '$app/navigation';
	import Graph from '$lib/components/Graph.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import type { MatchController, MatchState } from '$lib/match/match';
	import { supabase } from '$lib/supabaseClient';
	import { user, signInWithGoogle, setInitialRank, increaseXp } from '$lib/stores/auth';
	import { profile, refreshProfile } from '$lib/stores/profile';
    import { Tween, prefersReducedMotion } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import RollingNumber from '$lib/components/RollingNumber.svelte';

	const { match } = $props<{ match: MatchController }>();

	// Keep using the auth store for "signed in"
	const signedIn = $derived(!!$user);

	const elo = $derived($profile?.rating ?? 67);
	const xp = $derived($profile?.xp ?? 0);

    const eloTween = new Tween<number>(0);
    let eloAnimated = false;
    let eloStartTimer: ReturnType<typeof setTimeout> | null = null;

    const START_DELAY_MS = 750;
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

        if (prefersReducedMotion.current) {
            eloTween.set(end, { duration: 0 });
            return;
        }

        const duration = clamp(BASE_MS + Math.pow(Math.abs(end - start), DURATION_POWER) * EXTRA_PER_POINT, MIN_MS, MAX_MS);
        
        if (eloStartTimer) {
            clearTimeout(eloStartTimer);
        }

        eloStartTimer = setTimeout(() => {
            eloTween.set(end, { duration, easing: cubicOut });
            eloStartTimer = null;
        }, START_DELAY_MS);
    }

	let state: MatchState = get(match);
	const unsubscribe = match.subscribe((value: MatchState) => (state = value));
	onDestroy(unsubscribe);

	// ensure we have fresh profile once this mounts (no-op if already fresh)
	onMount(() => {
        eloTween.set($profile?.rating ?? 0, { duration: 0 });
		void refreshProfile();
	});

	// ---- stats derived from match state ----
	const completedRounds = $derived(state.completed.filter((round) => round.index > 0));
	const wins = $derived(completedRounds.filter((round) => round.succeeded).length);
	const losses = $derived(completedRounds.length - wins);
	const matchOutcome = $derived(
		state.outcome === 'dodge' ? 'Dodge' : wins > losses ? 'Win' : wins < losses ? 'Loss' : 'Draw'
	);
	const lpDelta = $derived(state.totalPoints);

	const averageMs = $derived(completedRounds.length
		? completedRounds.reduce((s, r) => s + r.durationMs, 0) / completedRounds.length
		: 0);

	const totalKeys = $derived(completedRounds.reduce((s, r) => s + r.keys.length, 0));
	const totalDurationMs = $derived(completedRounds.reduce((s, r) => s + r.durationMs, 0));
	const averageKeys = $derived(completedRounds.length ? totalKeys / completedRounds.length : 0);
	const apm = $derived(totalDurationMs > 0 ? (totalKeys / totalDurationMs) * 60000 : 0);
	const roundsWithKeys = $derived(completedRounds.filter((round) => round.keys.length > 0));
	const averageReaction = $derived(roundsWithKeys.length
		? roundsWithKeys.reduce(
				(sum, round) => sum + Math.max(0, round.keys[0].at - round.startedAt),
				0
			) / roundsWithKeys.length
		: 0);
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

	const keyFrequency = $derived(completedRounds.reduce<Record<string, number>>((acc, round) => {
		round.keys.forEach((entry) => {
			if (!isTrackableKey(entry.key)) return;
			acc[entry.key] = (acc[entry.key] ?? 0) + 1;
		});
		return acc;
	}, {}));
	const mostUsedKey = $derived(Object.entries(keyFrequency).reduce<{ key: string; count: number } | null>(
		(current, [key, count]) => {
			if (!current || count > current.count) return { key, count };
			return current;
		},
		null
	));

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
	const lsKey = (uid: string | null) => `mh:last:${uid ?? 'anon'}`;

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

	const projectedRankValue = $derived(completedRounds.length
		? (rankBands.find((band) => averageMs <= band.maxMs) ?? rankBands[rankBands.length - 1]).value
		: null);
	const placementRankValue = $derived(
		projectedRankValue === null ? null : Math.min(projectedRankValue, PLACEMENT_CAP)
	);

	let triedInitialRank = false;

	$effect(() => {
		if (
			!triedInitialRank &&
			state.status === 'complete' &&
			$user &&
			projectedRankValue !== null &&
			placementRankValue !== null
		) {
			triedInitialRank = true;
			setInitialRank(projectedRankValue, placementRankValue).catch((e) =>
				console.error('Failed to set initial rank', e)
			);
		}
	});

    $effect(() => {
        if (state.status === 'complete' && !eloAnimated) {
            eloAnimated = true;

            const startElo = $profile?.rating ?? 0;
            const endElo = startElo + (lpDelta ?? 0);
            scheduleEloAnimation(startElo, endElo);
        }

        if (state.status !== 'complete') {
            eloAnimated = false;
            if (eloStartTimer) {
                clearTimeout(eloStartTimer);
                eloStartTimer = null;
            }
            eloTween.set($profile?.rating ?? 0, { duration: 0 });
        }
    });

	let wroteHistoryOnce = false;

	async function writeHistoryIdempotent(): Promise<number | null> {
		if (wroteHistoryOnce) return null;
		if (state.status !== 'complete') return null;

		const uid = $user?.id ?? null;

		const signature = buildSignature(state, uid);
		const match_id = getOrCreateMatchId(signature, uid);

		// Use server-truth rating at the time of write
		const startElo = $profile?.rating ?? 0;
		const computedEndElo = startElo + (lpDelta ?? 0);

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
			end_elo: computedEndElo,
			lp_delta: lpDelta,
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

		// Award XP for completed ranked matches (skip dodges)
		if (signedIn && state.outcome !== 'dodge') {
			try {
				const updatedXp = await increaseXp(10);
				profile.update((p) => (p ? { ...p, xp: updatedXp } : p));
			} catch (xpErr) {
				console.error('Failed to award XP', xpErr);
			}
		}

		// ---- keep UI in sync immediately, then reconcile with DB ----
		const endElo = typeof data?.end_elo === 'number' ? data.end_elo : computedEndElo;

		// 1) Optimistic update: bump the profile store's rating now
		if (typeof endElo === 'number') {
			profile.update((p) => (p ? { ...p, rating: endElo } : p));
		}

		// 2) Fire a refresh so the store exactly matches what’s in DB
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
	const dashed = $derived(roundDurations.length
		? roundDurations.map((_, index) => ({ x: index, y: state.timeLimitMs }))
		: null);

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

        eloAnimated = false;
        if (eloStartTimer) {
            clearTimeout(eloStartTimer);
            eloStartTimer = null;
        }
        eloTween.set($profile?.rating ?? 0, { duration: 0 });
	};

	const graphHeight = 200;
</script>

<div class="w-full max-w-7xl rounded-xl px-20 py-4 text-white shadow-lg backdrop-blur">
	{#if state.status === 'complete'}
		<div class="flex items-center gap-16">
			<div class="flex items-center justify-center">
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
							on:click={signInWithGoogle}
							class="z-50 underline transition hover:text-neutral-200"
						>
							sign in
						</button>
						<div class="w-full">to play ranked</div>
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
							{Math.round(eloTween.current)}
                            <!-- {#key state.endTime}
                                <RollingNumber
                                    from={$profile?.rating ?? 0}
                                    to={($profile?.rating ?? 0) + (lpDelta ?? 0)}
                                    minDigits={4}
                                    delay={800}
                                    baseDuration={1400}
                                    stepMs={140}
                                    stagger={90}
                                    direction="auto"
                                />
                            {/key} -->
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
