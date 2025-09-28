import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  MOTIONS,
  FAMILY_MOTIONS,
  FAMILY_LABEL,
  FAMILY_UNLOCK_RANK,
  MOTION_FAMILY,
  type Motion,
  type Mastery,
  coverage,
  coverageByFamily,
  knownSet,
  rankIdFromRating,
  prettyRank
} from '$lib/data/ranks';
import { levelFromXP } from '$lib/utils';


function mockMastery(): Mastery {
  // start with zeros
  const M: Mastery = {};
  // seed higher mastery on common/high-ROI motions
  const boost: Motion[] = [
    'h', 'j', 'k', 'l', 'w', 'b', 'e', '0', '$', '^',
    'gg', 'G', 'yy', 'dd', 'p', 'u', '/', 'n', 'N',
    'f', 't', 'd{motion}', 'c{motion}', 'y{motion}', 'viw', 'ciw', '.'
  ].filter((m): m is Motion => MOTIONS.includes(m as Motion));

  // base noise
  for (const m of MOTIONS) M[m] = Math.random() * 0.35; // 0..0.35

  // boost known/common
  for (const m of boost) M[m] = 0.7 + Math.random() * 0.25; // 0.7..0.95

  // ensure floors roughly met by nudging some families
  const fam = coverageByFamily(M);
  // searching >= 0.30
  if ((fam.searching ?? 0) < 0.3) {
    ['/', '*', '#', 'n', 'N'].forEach((m) => (M[m as Motion] = 0.75));
  }
  // horizontalMovement >= 0.25
  if ((fam.horizontalMovement ?? 0) < 0.25) {
    ['w', 'e', '0', '$', 'f{char}', 't{char}'].forEach((m) => (M[m as Motion] = 0.74));
  }
  // commands >= 0.25
  if ((fam.commands ?? 0) < 0.25) {
    ['d', 'c', 'y', 'x', 'p'].forEach((m) => (M[m as Motion] = 0.75));
  }
  // combos >= 0.20
  if ((fam.combos ?? 0) < 0.2) {
    ['d{motion}', 'c{motion}', 'y{motion}', 'viw', 'ciw', '.'].forEach(
      (m) => (M[m as Motion] = 0.72)
    );
  }
  return M;
}

export const load: PageServerLoad = async ({ locals }) => {
  // server can see the session via cookies (set in hooks.server)
  const { data: { user }, error } = await locals.supabase.auth.getUser();
  if (error || !user) throw redirect(302, '/login');

  let { data: userData, error: userError } = await locals.supabase
    .from('users')
    .select('id, name, rating, hidden_mmr, xp')
    .eq('id', user.id)
    .maybeSingle();

  if (!userData) {
    const inserted = await locals.supabase
      .from('users')
      .insert({ id: user.id })
      .select('id, name, rating, hidden_mmr, xp')
      .single();

    if (inserted.error) throw redirect(302, '/login');
    userData = inserted.data;
  }

  const normalizedName = userData.name?.trim() || null;
  const fallbackName = user.user_metadata?.name ?? user.email?.split('@')[0] ?? 'Player';
  const displayName = normalizedName ?? fallbackName;
  const xp = userData.xp ?? 0;
  const { level, experience, maxExperience } = levelFromXP(xp);
  const rankId = rankIdFromRating(userData.rating);
  const rank = prettyRank(rankId);
  const rankName = rank.split(' ')[0];



  const appUser = {
    id: userData.id,
    name: displayName,
    elo: userData.rating,
    lp: userData.hidden_mmr,
    rankId,
    rank,
    rankName,
    level,
    experience,
    maxExperience
  };

  const mastery = mockMastery();
  const inputs = { mastery, skillIndex: 76, skillStdDev: 6 };
  const cov = coverage(mastery);
  const known = knownSet(mastery);
  const isKnown = (m: Motion) => known.has(m);

  // Fetch match history from database
  const { data: matchHistory, error: historyError } = await locals.supabase
    .from('match_history')
    .select('*')
    .eq('player_id', user.id)
    .order('created_at', { ascending: false });

  if (historyError) {
    console.error('Error fetching match history:', historyError);
  }

  const { data: globalMatchData, error: globalError } = await locals.supabase
    .from('match_history')
    .select('avg_speed, apm, reaction_time, is_dodge');

  if (globalError) {
    console.error('Error fetching global match metrics:', globalError);
  }

  const globalAvgSpeedValues = (globalMatchData ?? [])
    .filter((match) => match?.is_dodge !== true)
    .map((match) => (typeof match.avg_speed === 'number' ? match.avg_speed : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const globalApmValues = (globalMatchData ?? [])
    .filter((match) => match?.is_dodge !== true)
    .map((match) => (typeof match.apm === 'number' ? match.apm : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const globalReactionValues = (globalMatchData ?? [])
    .filter((match) => match?.is_dodge !== true)
    .map((match) => (typeof match.reaction_time === 'number' ? match.reaction_time : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);


  // Send raw match history to client for client-side date processing
  const rawMatchHistory = matchHistory || [];

  // Work with the 50 most recent matches consistently
  const recentMatches = (matchHistory || []).slice(0, 50);

  const personalBests = (() => {
    const allMatches = matchHistory ?? [];

    const fastestAvgSpeed = allMatches.reduce<number | null>((best, match) => {
      if (match?.is_dodge) return best;
      const value = typeof match.avg_speed === 'number' ? match.avg_speed : null;
      if (value === null || !Number.isFinite(value) || value <= 0) return best;
      return best === null || value < best ? value : best;
    }, null);

    const highestApm = allMatches.reduce<number | null>((best, match) => {
      if (match?.is_dodge) return best;
      const value = typeof match.apm === 'number' ? match.apm : null;
      if (value === null || !Number.isFinite(value) || value <= 0) return best;
      return best === null || value > best ? value : best;
    }, null);

    const fastestReaction = allMatches.reduce<number | null>((best, match) => {
      if (match?.is_dodge) return best;
      const value = typeof match.reaction_time === 'number' ? match.reaction_time : null;
      if (value === null || !Number.isFinite(value) || value <= 0) return best;
      return best === null || value < best ? value : best;
    }, null);

    const percentile = (
      bestValue: number | null,
      values: number[],
      direction: 'lower' | 'higher'
    ): number | null => {
      if (bestValue === null || values.length === 0) return null;
      const total = values.length;
      const count = values.reduce((acc, val) => {
        if (!Number.isFinite(val) || val <= 0) return acc;
        if (direction === 'lower') {
          return acc + (val <= bestValue ? 1 : 0);
        }
        return acc + (val >= bestValue ? 1 : 0);
      }, 0);
      if (count === 0) return null;
      const percent = (count / total) * 100;
      const clamped = Math.min(100, Math.max(0, percent));
      return clamped;
    };

    return {
      fastestAvgSpeedMs: fastestAvgSpeed,
      fastestAvgSpeedPercentile: percentile(fastestAvgSpeed, globalAvgSpeedValues, 'lower'),
      highestApm,
      highestApmPercentile: percentile(highestApm, globalApmValues, 'higher'),
      fastestReactionMs: fastestReaction,
      fastestReactionPercentile: percentile(fastestReaction, globalReactionValues, 'lower')
    } as const;
  })();

  // Aggregate motion counts from recent matches (motion_counts column)
  const motionCounts: Record<string, number> = {};
  for (const m of MOTIONS) motionCounts[m] = 0;
  for (const match of recentMatches) {
    if (match?.is_dodge) continue;
    const counts = match.motion_counts as Record<string, number> | null | undefined;
    if (!counts || typeof counts !== 'object') continue;
    for (const [motion, value] of Object.entries(counts)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      motionCounts[motion] = (motionCounts[motion] ?? 0) + value;
    }
  }

  // Convert match history to history format (limit to 50 most recent matches)
  const history = recentMatches.map((match, index) => {
    let result: 'win' | 'loss' | 'draw' | 'placement';
    if (match.lp_delta > 0) {
      result = 'win';
    } else if (match.lp_delta < 0) {
      result = 'loss';
    } else if (match.lp_delta == 0) {
      result = 'draw';
    } else {
      result = 'placement';
    }

    return {
      id: match.match_id,
      date: match.created_at,
      result,
      eloDelta: match.lp_delta,
      avgSpeed: match.avg_speed || 0, // Keep as milliseconds
      apm: match.apm || 0
    };
  });

  // Calculate totals from actual data
  const wins = history.filter(h => h.result === 'win').length;
  const losses = history.filter(h => h.result === 'loss').length;
  const draws = history.filter(h => h.result === 'draw').length;

  // Calculate average APM from past 25 games (excluding dodged matches with apm = 0)
  const validMatches = recentMatches.filter(match => !match?.is_dodge && match.apm && match.apm > 0);
  const totalAPM = validMatches.reduce((sum, match) => sum + match.apm, 0);

  const totals = {
    games: history.length,
    wins,
    losses,
    draws,
    winRate: history.length > 0 ? Math.round((wins / history.length) * 100) : 0,
    avgAPM: validMatches.length > 0 ? Math.round(totalAPM / validMatches.length) : 0,
    coverage: cov
  };

  const motionsGrid = MOTIONS.map((m) => {
    const family = MOTION_FAMILY[m];
    return {
      motion: m,
      familyLabel: FAMILY_LABEL[family],
      unlocked: isKnown(m),
      unlockAt: FAMILY_UNLOCK_RANK[family]
    };
  });

  return {
    profileUser: {
      ...appUser,
      displayName: normalizedName,
      fallbackName
    },
    mastery,
    knownList: Array.from(known),
    motionCounts,
    motionsGrid,
    rawMatchHistory,
    history,
    totals,
    personalBests
  };
};
