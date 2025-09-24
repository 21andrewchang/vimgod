import type { MatchState } from '$lib/match/match';

export const DODGE_STORAGE_KEY = 'vimgod:dodge-result';

export function clearDodgeSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DODGE_STORAGE_KEY);
  } catch (error) {
    console.warn('failed to clear dodge snapshot', error);
  }
}
export const DODGE_LP_PENALTY = 20;

export type DodgeSnapshot = {
  type: 'dodge';
  version: 1;
  penalty: number;
  storedAt: number;
  state: MatchState;
};
