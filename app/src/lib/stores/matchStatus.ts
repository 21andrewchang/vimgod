import { derived, writable } from 'svelte/store';
import type { MatchStatus } from '$lib/match/match';

const statusStore = writable<MatchStatus>('idle');

export const matchStatus = {
	subscribe: statusStore.subscribe,
	set: statusStore.set
};

export const matchIsActive = derived(statusStore, (status) => status === 'ready' || status === 'running');
