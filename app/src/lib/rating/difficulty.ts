// src/lib/rating/difficulty.ts
import type { Opponent } from './glicko2';

// Equal difficulty for all rounds:
export const baselineOpponent: Opponent = { R: 1500, RD: 80 };

// Later you can swap to tiers or per-motion without touching game code:
// export function opponentForTarget(target:Target):Opponent { ... }