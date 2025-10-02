// src/lib/rating/service.ts
import { supabase } from '$lib/supabaseClient';
import {
  type Glicko2,
  type Opponent,
  glicko2Update,
  glicko2UpdateEqualOpp,
  performanceScore
} from './glicko2';

export type RoundForRating = {
  timeLimitMs: number;
  durationMs: number;
  succeeded: boolean;            // you can pass true/false; we'll turn into 0..1 via performanceScore
  index?: number;
  targetId?: string | null;
};

export type HiddenState = Glicko2;


export type UpdateAfterMatchOptions =
  | {
      mode: 'equal';
      phase?: 'placements' | 'ranked'; // NEW: tells us whether to throttle
      opponent?: Opponent;
      tau?: number;
      sigmaMin?: number;
      alphaPerf?: number;   // blend perf vs win-rate
      scoreGain?: number;   // damp extremes toward 0.5
      Nmax?: number;        // cap rounds only in ranked
      smoothBeta?: number;  // momentum blend (ranked only)
      softCap?: number;     // tanh soft cap (ranked only)
    }
  | {
      mode: 'perRound';
      phase?: 'placements' | 'ranked';
      opponentForRound: (r: RoundForRating) => Opponent;
      tau?: number;
      sigmaMin?: number;
    };

function isFinitePos(n: unknown) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function sanitizePlayerState(db: { hidden_mmr?: any; hidden_mmr_rd?: any; hidden_mmr_sigma?: any }): HiddenState {
  let R = Number(db.hidden_mmr);
  let RD = Number(db.hidden_mmr_rd);
  let sigma = Number(db.hidden_mmr_sigma);

  if (!Number.isFinite(R)) R = 400;
  if (!isFinitePos(RD)) RD = 180;
  if (!isFinitePos(sigma)) sigma = 0.06;

  // hard clamps for solver stability
  RD = Math.min(Math.max(RD, 1e-3), 1000);
  sigma = Math.min(Math.max(sigma, 1e-4), 1);

  return { R, RD, sigma };
}

function sanitizeRounds(rounds: RoundForRating[]) {
  return rounds
    .filter(
      (r) =>
        Number.isFinite(r.timeLimitMs) &&
        Number.isFinite(r.durationMs) &&
        r.timeLimitMs > 0 &&
        r.durationMs >= 0
    )
    .map((r) => ({
      timeLimitMs: r.timeLimitMs,
      durationMs: r.durationMs,
      succeeded: !!r.succeeded
    }));
}

async function loadHidden(uid: string): Promise<HiddenState> {
  const { data } = await supabase
    .from('users')
    .select('hidden_mmr, hidden_mmr_rd, hidden_mmr_sigma')
    .eq('id', uid)
    .maybeSingle();

  return sanitizePlayerState(data ?? {});
}

/**
 * Main entry called from your UI.
 * - mode 'equal': treats all rounds as equal difficulty using one baseline Opponent
 * - mode 'perRound': lets you provide an opponent for each round
 * Returns: { before, updated, sBar }  (sBar only for 'equal' mode; average performance)
 */
export async function updateAfterMatch(
  uid: string,
  rounds: RoundForRating[],
  opts: UpdateAfterMatchOptions = { mode: 'equal' }
): Promise<{ before: HiddenState; updated: HiddenState; sBar?: number }> {
  const before = await loadHidden(uid);
  const clean = sanitizeRounds(rounds);

  // No valid rounds? Return decay-only update (handled by glicko2Update with games.length=0)
  if (clean.length === 0) {
    const updated = glicko2Update(before, []);
    return { before, updated };
  }

  const tau = ('tau' in opts && typeof opts.tau === 'number') ? opts.tau : 0.5;
  const sigmaMin = ('sigmaMin' in opts && typeof opts.sigmaMin === 'number') ? opts.sigmaMin : 0.03;

  if (opts.mode === 'equal') {
    const phase = (opts as any).phase === 'placements' ? 'placements' : 'ranked';

    // Tunables
    const tauRanked      = typeof (opts as any).tau === 'number' ? (opts as any).tau : 0.60;
    const tauPlacements  = typeof (opts as any).tauPlacements === 'number' ? (opts as any).tauPlacements : 0.90;
    const sigmaMin       = typeof (opts as any).sigmaMin === 'number' ? (opts as any).sigmaMin : 0.03;

    // Build perf + win-rate
    const perfScores = clean.map((r) => performanceScore(r.timeLimitMs, r.durationMs));
    const sPerf = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;
    const wins  = clean.filter((r) => r.succeeded).length;
    const sWin  = wins / clean.length;

    const alphaPerfRanked     = typeof (opts as any).alphaPerf === 'number' ? (opts as any).alphaPerf : 0.60;
    const alphaPerfPlacements = typeof (opts as any).alphaPerfPlacements === 'number' ? (opts as any).alphaPerfPlacements : 0.75;

    const scoreGainRanked     = typeof (opts as any).scoreGain === 'number' ? (opts as any).scoreGain : 0.85;
    const scoreGainPlacements = 1.0; // no damp on placements

    const alphaPerf = phase === 'placements' ? alphaPerfPlacements : alphaPerfRanked;
    const scoreGain = phase === 'placements' ? scoreGainPlacements : scoreGainRanked;

    const sMix = alphaPerf * sPerf + (1 - alphaPerf) * sWin;
    const sEff = 0.5 + scoreGain * (sMix - 0.5);

    // Opponent centered on player; higher RD during placements to keep impact strong
    const rawOpp = ((opts as any).opponent ?? {}) as Partial<Opponent>;
    const oppRDPlacements = typeof (opts as any).opponentRDPlacements === 'number' ? (opts as any).opponentRDPlacements : 200;
    const opponent: Opponent = {
        R: Number.isFinite(rawOpp.R as number) ? (rawOpp.R as number) : before.R,
        RD: phase === 'placements'
        ? oppRDPlacements
        : (typeof rawOpp.RD === 'number' && rawOpp.RD > 0 ? rawOpp.RD! : 90)
    };

    // Effective rounds: never cap during placements
    const NmaxRanked = typeof (opts as any).Nmax === 'number' ? (opts as any).Nmax : 16;
    const N_eff = phase === 'placements' ? clean.length : Math.min(clean.length, NmaxRanked);

    // Glicko update
    const tau = phase === 'placements' ? tauPlacements : tauRanked;
    const updatedRaw = glicko2UpdateEqualOpp(before, N_eff, sEff, opponent, tau, sigmaMin);

    // ----- Placements: NO smoothing/caps on MMR movement, but keep RD high for a few games -----
    if (phase === 'placements') {
        const rawR   = Number.isFinite(updatedRaw.R)   ? updatedRaw.R   : before.R;
        const rawRD  = Number.isFinite(updatedRaw.RD)  ? updatedRaw.RD  : before.RD;
        const rawSig = Number.isFinite(updatedRaw.sigma)? updatedRaw.sigma: before.sigma;

        const updated: HiddenState = { R: rawR, RD: rawRD, sigma: rawSig };
        return { before, updated, sBar: sEff };
    }

    // ----- Ranked (post-placements): gentle smoothing only -----
    const rawR   = Number.isFinite(updatedRaw.R)   ? updatedRaw.R   : before.R;
    const rawRD  = Number.isFinite(updatedRaw.RD)  ? updatedRaw.RD  : before.RD;
    const rawSig = Number.isFinite(updatedRaw.sigma)? updatedRaw.sigma: before.sigma;

    // Soft-clip & momentum (ranked only)
    const softCap   = typeof (opts as any).softCap === 'number' ? (opts as any).softCap : 30;
    const beta      = typeof (opts as any).smoothBeta === 'number' ? (opts as any).smoothBeta : 0.75;
    const RD_beta   = 0.45;

    const dR       = rawR - before.R;
    const dR_soft  = softCap * Math.tanh(dR / softCap);
    const R_smooth = before.R + beta * dR_soft;
    const RD_smooth= before.RD + RD_beta * (rawRD - before.RD);

    const updated: HiddenState = { R: R_smooth, RD: RD_smooth, sigma: rawSig };
    return { before, updated, sBar: sEff };

    // Smooth per-round score based on timing; average to sBar
    // const scores = clean.map((r) => performanceScore(r.timeLimitMs, r.durationMs));
    // const sBar = scores.reduce((a,b)=>a+b, 0) / scores.length;

    // const winRate = clean.filter(r => r.succeeded).length / clean.length;
    // // mix timing and binary success (tune alpha)
    // const alpha = 0.6;
    // const sMix = alpha * sBar + (1 - alpha) * winRate;

    // const updated = glicko2UpdateEqualOpp(before, clean.length, sMix, opponent, tau, sigmaMin);

    // Guard against NaN from math—fallback to previous values if needed
    // const safeUpdated: HiddenState = {
    //   R: Number.isFinite(updated.R) ? updated.R : before.R,
    //   RD: Number.isFinite(updated.RD) ? updated.RD : before.RD,
    //   sigma: Number.isFinite(updated.sigma) ? updated.sigma : before.sigma
    // };

    // return { before, updated: safeUpdated, sBar };
  } else {
    // Per-round, each with its own opponent
    const games = clean.map((r) => {
      const opp = opts.opponentForRound(r);
      const s = performanceScore(r.timeLimitMs, r.durationMs);
      return { opp, s };
    });

    const updated = glicko2Update(before, games, tau, sigmaMin);

    const safeUpdated: HiddenState = {
      R: Number.isFinite(updated.R) ? updated.R : before.R,
      RD: Number.isFinite(updated.RD) ? updated.RD : before.RD,
      sigma: Number.isFinite(updated.sigma) ? updated.sigma : before.sigma
    };

    return { before, updated: safeUpdated };
  }
}
