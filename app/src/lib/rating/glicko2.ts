// src/lib/rating/glicko2.ts

export type Glicko2 = { R: number; RD: number; sigma: number };
export type Opponent = { R: number; RD: number };

const SCALE = 173.7178;
const RD_MAX = 220;         // standard public cap
const EPS = 1e-6;           // solver tolerance
const MAX_ITERS = 60;       // solver safety cap
const MAX_EXPAND = 50;      // bracket expansion safety cap

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

const toMu   = (R: number)   => (R - 1500) / SCALE;
const toPhi  = (RD: number)  => RD / SCALE;
const fromMu = (mu: number)  => 1500 + SCALE * mu;
const fromPhi= (phi: number) => clamp(SCALE * phi, 0, RD_MAX);

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x)); // logistic in (0,1)

/**
 * Smooth "score" from timing. Returns a value in (0,1).
 * - k controls steepness (default 8)
 * - dead is a deadband around the threshold where we don't reward/punish tiny misses
 */
export function performanceScore(
  timeLimitMs: number,
  durationMs: number,
  k = 8,
  dead = 0.02
) {
  const m = (timeLimitMs - durationMs) / Math.max(1, timeLimitMs);
  const md = Math.abs(m) < dead ? 0 : m;
  return sigmoid(k * md); // 0..1
}

/** Robust, bounded volatility solve. Returns new sigma. */
function solveVolatility(phi: number, v: number, Delta: number, sigma: number, tau: number, sigmaMin: number) {
  // a = ln(sigma^2)
  const a = Math.log(sigma * sigma);

  const f = (x: number) => {
    const ex = Math.exp(x);
    const phi2 = phi * phi + v + ex;
    return (ex * (Delta * Delta - phi2)) / (2 * phi2 * phi2) - (x - a) / (tau * tau);
  };

  // Initial bracket
  let A = a;
  let B: number;

  if (Delta * Delta > (phi * phi + v)) {
    B = Math.log(Delta * Delta - phi * phi - v);
  } else {
    // step downward until f(B) < 0
    let k = 1;
    B = a - k * Math.sqrt(tau * tau);
    while (f(B) >= 0 && k < MAX_EXPAND) {
      k += 1;
      B = a - k * Math.sqrt(tau * tau);
    }
  }

  let fA = f(A);
  let fB = f(B);

  // Ensure bracket sign condition f(A) >= 0 >= f(B)
  let expandCount = 0;
  while (!(fA >= 0 && fB <= 0) && expandCount < MAX_EXPAND) {
    const step = Math.max(1, expandCount + 1) * Math.sqrt(tau * tau);
    A = Math.min(A, B) - step;
    B = Math.max(A, B) + step;
    fA = f(A);
    fB = f(B);
    expandCount++;
  }

  // If still not bracketed, bail: keep sigma unchanged (prevents freezes)
  if (!(fA >= 0 && fB <= 0)) {
    return clamp(sigma, sigmaMin, 1);
  }

  // Bisection with safety cap
  let iters = 0;
  while (Math.abs(B - A) > EPS && iters < MAX_ITERS) {
    const C = A + (B - A) / 2;
    const fC = f(C);
    if (fC > 0) {
      A = C;
      fA = fC;
    } else {
      B = C;
      fB = fC;
    }
    iters++;
  }

  const x = (A + B) / 2;
  const sigmaPrime = Math.sqrt(Math.exp(x));
  return clamp(sigmaPrime, sigmaMin, 1);
}

// Full Glicko-2 update (array of games with arbitrary opponents)
// s may be in [0,1] here (we accept smooth performance), classic is {0,0.5,1}
export function glicko2Update(
  player: Glicko2,
  games: { opp: Opponent; s: number }[],
  tau = 0.5,
  sigmaMin = 0.03
): Glicko2 {
  let mu = toMu(player.R);
  let phi = toPhi(player.RD);
  let sigma = clamp(player.sigma, sigmaMin, 1);

  if (!Number.isFinite(mu) || !Number.isFinite(phi) || phi <= 0) {
    mu = 0;                      // 1500
    phi = toPhi(RD_MAX);         // max uncertain
    sigma = clamp(sigma, sigmaMin, 1);
  }

  if (games.length === 0) {
    // No games: only RD increases due to volatility; clamp to RD_MAX
    const phiPrime = Math.min(Math.sqrt(phi * phi + sigma * sigma), toPhi(RD_MAX));
    return { R: fromMu(mu), RD: fromPhi(phiPrime), sigma };
  }

  let vDen = 0;
  let deltaNum = 0;

  for (const { opp, s } of games) {
    const muj = toMu(opp.R);
    const phij = toPhi(opp.RD);
    const gj = g(phij);
    const Ej = sigmoid(gj * (mu - muj)); // in (0,1)
    vDen += gj * gj * Ej * (1 - Ej);
    deltaNum += gj * (s - Ej);
  }

  // Guard: if vDen ~ 0 (e.g., pathological inputs), skip change
  if (!(vDen > 0) || !Number.isFinite(vDen)) {
    return { R: fromMu(mu), RD: fromPhi(clamp(phi, 0, toPhi(RD_MAX))), sigma };
  }

  const v = 1 / vDen;
  const Delta = v * deltaNum;

  // volatility update
  const sigmaPrime = solveVolatility(phi, v, Delta, sigma, tau, sigmaMin);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaNum;

  return {
    R: fromMu(muPrime),
    RD: fromPhi(phiPrime),
    sigma: sigmaPrime
  };
}

// Optimized version for N equal opponents
export function glicko2UpdateEqualOpp(
  player: Glicko2,
  N: number,
  sBar: number,
  opp: Opponent = { R: 1500, RD: 80 },
  tau = 0.5,
  sigmaMin = 0.03
): Glicko2 {
  if (N <= 0) {
    return glicko2Update(player, [], tau, sigmaMin);
  }

  let mu = toMu(player.R);
  let phi = toPhi(player.RD);
  let sigma = clamp(player.sigma, sigmaMin, 1);

  if (!Number.isFinite(mu) || !Number.isFinite(phi) || phi <= 0) {
    mu = 0;
    phi = toPhi(RD_MAX);
    sigma = clamp(sigma, sigmaMin, 1);
  }

  const mu0 = toMu(opp.R);
  const phi0 = toPhi(opp.RD);
  const g0 = g(phi0);
  const E0 = sigmoid(g0 * (mu - mu0));
  const v = 1 / (N * g0 * g0 * E0 * (1 - E0));

  if (!Number.isFinite(v) || v <= 0) {
    return { R: fromMu(mu), RD: fromPhi(clamp(phi, 0, toPhi(RD_MAX))), sigma };
  }

  const Delta = v * (N * g0 * (sBar - E0));

  const sigmaPrime = solveVolatility(phi, v, Delta, sigma, tau, sigmaMin);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * (N * g0 * (sBar - E0));

  return {
    R: fromMu(muPrime),
    RD: fromPhi(phiPrime),
    sigma: sigmaPrime
  };
}
