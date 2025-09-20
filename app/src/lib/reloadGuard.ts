import type { MatchState } from '$lib/match/match';

export const DODGE_STORAGE_KEY = 'vimgod:dodge-result';
export const DODGE_LP_PENALTY = 20;

export type DodgeSnapshot = {
  type: 'dodge';
  version: 1;
  penalty: number;
  storedAt: number;
  state: MatchState;
};
