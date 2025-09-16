import { writable, type Writable } from 'svelte/store';

export type MatchStatus = 'idle' | 'running' | 'complete';

export interface MatchTarget {
  row: number;
  col: number;
  sequence: string[];
}

export interface MatchKeypress {
  key: string;
  at: number;
}

export interface MatchRoundResult {
  index: number;
  target: MatchTarget;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  keys: MatchKeypress[];
}

export interface ActiveRound {
  index: number;
  target: MatchTarget;
  startedAt: number;
  keys: MatchKeypress[];
}

export interface MatchState {
  status: MatchStatus;
  totalRounds: number;
  roundIndex: number;
  active: ActiveRound | null;
  completed: MatchRoundResult[];
  startTime?: number;
  endTime?: number;
}

export type MatchTargetGenerator = () => MatchTarget;

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface MatchControllerOptions {
  totalRounds?: number;
  now?: () => number;
}

interface StartOptions {
  generator?: MatchTargetGenerator;
}

const createInitialState = (totalRounds: number): MatchState => ({
  status: 'idle',
  totalRounds,
  roundIndex: 0,
  active: null,
  completed: [],
  startTime: undefined,
  endTime: undefined
});

export const createMatchController = (options: MatchControllerOptions = {}) => {
  const totalRounds = options.totalRounds ?? 20;
  const now = options.now ?? defaultNow;

  const initialState = createInitialState(totalRounds);
  const store: Writable<MatchState> = writable(initialState);

  let generator: MatchTargetGenerator | null = null;

  const start = (opts: StartOptions = {}) => {
    if (opts.generator) generator = opts.generator;
    if (!generator) throw new Error('match target generator not configured');

    const startTs = now();
    const target = generator();

    store.set({
      status: 'running',
      totalRounds,
      roundIndex: 0,
      active: {
        index: 0,
        target,
        startedAt: startTs,
        keys: []
      },
      completed: [],
      startTime: startTs,
      endTime: undefined
    });
  };

  const setGenerator = (fn: MatchTargetGenerator) => {
    generator = fn;
  };

  const recordKey = (key: string, at = now()) => {
    store.update((state) => {
      if (state.status !== 'running' || !state.active) return state;
      const keys = [...state.active.keys, { key, at }];
      return {
        ...state,
        active: {
          ...state.active,
          keys
        }
      };
    });
  };

  const evaluate = (cursor: { row: number; col: number }, at = now()) => {
    let completed = false;
    store.update((state) => {
      if (state.status !== 'running' || !state.active) return state;
      const target = state.active.target;
      if (cursor.row !== target.row || cursor.col !== target.col) return state;

      const finished: MatchRoundResult = {
        index: state.active.index,
        target,
        startedAt: state.active.startedAt,
        completedAt: at,
        durationMs: Math.max(0, at - state.active.startedAt),
        keys: state.active.keys
      };
      const results = [...state.completed, finished];
      completed = true;

      if (results.length >= state.totalRounds || !generator) {
        return {
          ...state,
          status: 'complete',
          active: null,
          completed: results,
          roundIndex: results.length,
          endTime: at
        };
      }

      let nextTarget = generator();
      let safety = 0;
      while (
        nextTarget &&
        nextTarget.row === cursor.row &&
        nextTarget.col === cursor.col &&
        safety < 5
      ) {
        nextTarget = generator();
        safety += 1;
      }

      if (!nextTarget || (nextTarget.row === cursor.row && nextTarget.col === cursor.col)) {
        return {
          ...state,
          status: 'complete',
          active: null,
          completed: results,
          roundIndex: results.length,
          endTime: at
        };
      }

      return {
        ...state,
        completed: results,
        roundIndex: results.length,
        active: {
          index: results.length,
          target: nextTarget,
          startedAt: at,
          keys: []
        }
      };
    });
    return completed;
  };

  const reset = (keepGenerator = true) => {
    store.set(createInitialState(totalRounds));
    if (!keepGenerator) generator = null;
  };

  return {
    subscribe: store.subscribe,
    start,
    setGenerator,
    recordKey,
    evaluate,
    reset
  };
};

export type MatchController = ReturnType<typeof createMatchController>;
