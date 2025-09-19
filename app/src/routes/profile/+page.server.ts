import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
  MOTIONS,
  FAMILY_MOTIONS,
  FAMILY_LABEL,
  FAMILY_UNLOCK_RANK,
  MOTION_FAMILY,
  type Motion,
  type RankName,
  type Mastery,
  coverage,
  coverageByFamily,
  knownSet,
  rankFromInputs
} from '$lib/data/ranks';


function mockMastery(): Mastery {
  // start with zeros
  const M: Mastery = {};
  // seed higher mastery on common/high-ROI motions
  const boost: Motion[] = [
    'h','j','k','l','w','b','e','0','$','^',
    'gg','G','yy','dd','p','u','/','n','N',
    'f','t','d{motion}','c{motion}','y{motion}','viw','ciw','.'
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
    ['w','e','0','$','f{char}','t{char}'].forEach((m) => (M[m as Motion] = 0.74));
  }
  // commands >= 0.25
  if ((fam.commands ?? 0) < 0.25) {
    ['d','c','y','x','p'].forEach((m) => (M[m as Motion] = 0.75));
  }
  // combos >= 0.20
  if ((fam.combos ?? 0) < 0.2) {
    ['d{motion}','c{motion}','y{motion}','viw','ciw','.'].forEach(
      (m) => (M[m as Motion] = 0.72)
    );
  }
  return M;
}

export const load: PageServerLoad = async ({ locals }) => {
    // server can see the session via cookies (set in hooks.server)
    const { data: { session }, error } = await locals.supabase.auth.getSession();
    if (error || !session?.user) throw redirect(302, '/login');
  
    const { data: userData, error: userError } = await locals.supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();
  
    if (userError || !userData) throw redirect(302, '/login');
  
    const user = {
      id: userData.id,
      name: userData.name || session.user.email?.split('@')[0] || 'User',
      elo: userData.rating || 1500,
      lp:  userData.hidden_mmr || 1500
    };
  
    const mastery = mockMastery();
    const inputs = { mastery, skillIndex: 76, skillStdDev: 6 };
    const resolvedRank: RankName = 'Singularity'; // or rankFromInputs(inputs)
    const cov = coverage(mastery);
    const known = knownSet(mastery);
    const isKnown = (m: Motion) => known.has(m);
  
    const motionCounts: Record<string, number> = {};
    for (const m of MOTIONS) {
      motionCounts[m] = (isKnown(m) ? 30 + Math.floor(Math.random() * 90) : Math.floor(Math.random() * 12));
    }
  
    const dailyCounts: Record<string, number> = {};
    for (let d = 0; d < 112; d++) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      const iso = day.toISOString().slice(0, 10);
      const weekday = day.getDay();
      const base = [0,2,3,3,2,1,0][weekday];
      dailyCounts[iso] = Math.max(0, base + Math.floor(Math.random() * 2) - (weekday === 0 ? 1 : 0));
    }
  
    const history = Array.from({ length: 18 }).map((_, i) => {
      const date = new Date(); date.setDate(date.getDate() - i);
      const win = Math.random() > 0.3;
      const eloDelta = win ? 12 + Math.floor(Math.random() * 10) : -(8 + Math.floor(Math.random() * 10));
      return {
        id: `m-${i}`,
        date: date.toISOString(),
        result: win ? 'win' as const : 'loss' as const,
        eloDelta,
        accuracy: 88 + Math.floor(Math.random() * 8) - (win ? 0 : 4),
        durationSec: 210 + Math.floor(Math.random() * 80)
      };
    });
  
    const totals = {
      games: history.length,
      wins: history.filter(h => h.result === 'win').length,
      losses: history.filter(h => h.result === 'loss').length,
      winRate: 0,
      avgAccuracy: Math.round(history.reduce((s,h)=>s+(h.accuracy??0),0)/history.length),
      coverage: cov
    };
    totals.winRate = Math.round((totals.wins / Math.max(1, totals.games)) * 100);
  
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
      user: { ...user, rank: resolvedRank },
      mastery,
      knownList: Array.from(known),
      motionCounts,
      motionsGrid,
      dailyCounts,
      history,
      totals
    };
};