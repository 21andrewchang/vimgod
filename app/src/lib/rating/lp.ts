export type Division = {
    /** Lower and upper MMR bounds for this division (hidden rating scale) */
    L: number;
    U: number;
    /** Optional label for logging/telemetry */
    name?: string;
  };
  
  export function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
  }
  
  /** Map hidden MMR → target LP within the current division (0..100). */
  export function targetLP(R: number, div: Division): number {
    const span = Math.max(1, div.U - div.L);
    return (100 * (R - div.L)) / span;
  }
  
  /** Apply an LP delta and report promotions/demotions in 100-LP chunks. */
  export function applyLp(currentLP: number, lpDelta: number): {
    lp: number; // remainder LP within [0, 100)
    promote: number; // +1 per division to promote
    demote: number; // +1 per division to demote
  } {
    let lp = currentLP + lpDelta;
    let promote = 0,
      demote = 0;
  
    while (lp >= 100) {
      lp -= 100;
      promote += 1;
    }
    while (lp < 0) {
      lp += 100;
      demote += 1;
    }
  
    // normalize small float noise
    lp = Math.round(lp * 100) / 100;
  
    return { lp, promote, demote };
  }
  
  /** Optional hysteresis gates near borders so micro jitter doesn’t flip ranks. */
  export function meetsPromotionMMR(R: number, div: Division, hysteresis = 10): boolean {
    return R >= div.U - hysteresis;
  }
  export function meetsDemotionMMR(R: number, div: Division, hysteresis = 10): boolean {
    return R < div.L + hysteresis;
  }
  
  // ───────────────────────────────────────────────────────────────────────────────
  // LoL-ish LP (result-centric with MMR bias) — unchanged
  // ───────────────────────────────────────────────────────────────────────────────
  
  export type LpParams = {
    /** Base LP gain/loss on win/loss before biases */
    baseWin: number;
    baseLoss: number;
    /** How strongly hidden-MMR offset biases win/loss LP */
    wSlope: number;
    lSlope: number;
    /** Performance kicker weight, where perf ∈ [0,1] and we use (perf-0.5) */
    perfK: number;
    /** Clamps for the final per-match LP delta */
    minWin: number;
    maxWin: number;
    minLoss: number;
    maxLoss: number;
  };
  
  export const defaultLpParams: LpParams = {
    baseWin: 16,
    baseLoss: 16,
    wSlope: 12,
    lSlope: 12,
    perfK: 6,
    minWin: 6,
    maxWin: 32,
    minLoss: -32,
    maxLoss: -6
  };
  
  /**
   * "LoL-ish" LP delta:
   * - If hidden MMR is high for the division, wins give more and losses hurt less.
   * - If low, wins give less and losses hurt more.
   * - Optional performance kicker using avg perf score s̄ ∈ [0,1].
   */
  export function lpDeltaFromMatch(
    R: number,
    div: Division,
    didWin: boolean,
    sBar: number, // average performance score across the match, 0..1
    p: LpParams = defaultLpParams
  ): number {
    const A = (div.L + div.U) / 2;
    const span = Math.max(1, div.U - div.L);
    // normalized offset inside the division (±1 ≈ full division span)
    const delta = clamp((R - A) / span, -1.5, 1.5);
  
    const perf = p.perfK * (sBar - 0.5);
  
    if (didWin) {
      const biased = p.baseWin + p.wSlope * delta + perf;
      return clamp(Math.round(biased), p.minWin, p.maxWin);
    } else {
      const biased = -(p.baseLoss + p.lSlope * -delta - perf);
      return clamp(Math.round(biased), p.minLoss, p.maxLoss);
    }
  }
  
  /** Gentle reconciliation: nudge visible LP toward the LP implied by hidden MMR. */
  export function nudgeTowardTargetLP(
    currentLP: number,
    R: number,
    div: Division,
    zeta = 0.2, // fraction of the gap to move
    cap = 8 // max absolute LP change applied
  ): number {
    const t = targetLP(R, div);
    const gap = t - currentLP;
    return clamp(zeta * gap, -cap, cap);
  }
  
  // ───────────────────────────────────────────────────────────────────────────────
  // Valorant-ish LP — symmetric (wins/losses equally affected), low magnitude
  // ───────────────────────────────────────────────────────────────────────────────
  
  export type ValorantParams = {
    // A) Symmetric base on result (same magnitude win/loss)
    base: number;
  
    // B) Symmetric performance weight (uses sBar in [0,1], centered at 0.5)
    perfScale: number;
  
    // C) Round margin weight (wins - losses normalized by total rounds)
    marginScale: number;
  
    // D) Gentle, symmetric MMR reconciliation (toward target LP from hidden R)
    mmrZeta: number; // fraction of gap on wins & losses
    mmrCap: number;  // max |MMR nudge| on wins & losses
  
    // Draw-specific nudge (usually smaller)
    drawZeta: number;
    drawCap: number;
  
    // Final clamps per outcome (min/max after everything)
    winClamp: [number, number];
    lossClamp: [number, number];
    drawClamp: [number, number];
  
    // Protection floors
    closeLossFloor: number; // if margin is small and perf good, don't go below this
    drawFloor: number;      // never worse than this on draws
  
    // Global scale to keep LP small for short matches
    globalScale: number;    // multiply the final LP by this (e.g., 0.8)
  };
  
  export const defaultValorantParams: ValorantParams = {
    base: 6,               // symmetric base (win = +8, loss = -8)
    perfScale: 18,         // same perf impact for win & loss
    marginScale: 14,        // margin effect (±), modest
    mmrZeta: 0.07,         // gentle symmetric nudge toward MMR
    mmrCap: 5,             // at most 4 LP from MMR on win/loss
    drawZeta: 0.06,        // smaller nudge on draws
    drawCap: 6,
    winClamp: [8, 25],     // smaller gains (short matches)
    lossClamp: [-25, -8],  // smaller losses
    drawClamp: [-8, 8],    // draws barely move
    closeLossFloor: -8,    // protect close losses with good perf
    drawFloor: -5,
    globalScale: 1      // reduce all LP magnitudes ~15%
  };
  
  const clampNum = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  
  /**
   * Valorant-like LP delta (symmetric):
   *   LP = base(result) + perfTerm + marginTerm + mmrNudge  (then clamped, scaled & protected)
   *
   * R:          hidden MMR
   * div:        current 100-LP division bounds {L,U}
   * lpInDiv:    visible LP within the division [0..100)
   * sBar:       average performance score in [0,1] (your timing-based score or blend)
   * wins/losses: round counts for margin signal
   */
  export function lpDeltaValorantStyle(
    R: number,
    div: Division,
    lpInDiv: number,
    sBar: number,
    wins: number,
    losses: number,
    p: ValorantParams = defaultValorantParams
  ): number {
    const total = Math.max(1, wins + losses);
    const margin = wins - losses;
    const marginNorm = clampNum(margin / total, -1, 1); // [-1..+1]
  
    const outcome: 'win' | 'loss' | 'draw' =
      margin > 0 ? 'win' : margin < 0 ? 'loss' : 'draw';
  
    // A) Symmetric base on result
    let lp = outcome === 'win' ? +p.base : outcome === 'loss' ? -p.base : 0;
  
    // B) Symmetric performance around neutral 0.5
    const perf = sBar - 0.5; // [-0.5..+0.5]
    // For draws, keep half impact (optional; remove *0.5 to make draws fully symmetric too)
    const perfTerm =
      (outcome === 'draw' ? 0.5 : 1.0) * (p.perfScale * perf);
    lp += perfTerm;
  
    // C) Round margin (positive on wins, negative on losses)
    const marginTerm = p.marginScale * marginNorm;
    lp += marginTerm;
  
    // D) Gentle symmetric MMR reconciliation (toward target LP for hidden R)
    const span = Math.max(1, div.U - div.L);
    const target = (100 * (R - div.L)) / span; // target LP within division
    const gap = target - lpInDiv;              // positive if MMR > LP
  
    const zeta = outcome === 'draw' ? p.drawZeta : p.mmrZeta;
    const cap  = outcome === 'draw' ? p.drawCap  : p.mmrCap;
  
    const mmrNudge = clampNum(zeta * gap, -cap, cap);
    lp += mmrNudge;
  
    // Final clamps per outcome
    const [lo, hi] =
      outcome === 'win' ? p.winClamp : outcome === 'loss' ? p.lossClamp : p.drawClamp;
    lp = clampNum(lp, lo, hi);
  
    // Global scaling to keep per-match LP small (short matches)
    lp = lp * p.globalScale;
  
    // Protection: close losses with good perf, and draws
    if (outcome === 'loss' && Math.abs(margin) <= 2 && sBar >= 0.6) {
      lp = Math.max(lp, p.closeLossFloor);
    }
    if (outcome === 'draw') {
      lp = Math.max(lp, p.drawFloor);
    }
  
    // Return integer LP delta
    return Math.round(lp);
  }
  