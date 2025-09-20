
import { writable, type Writable } from 'svelte/store';

export type MatchStatus = 'idle' | 'ready' | 'running' | 'complete';

export type Position = {
  row: number;
  col: number;
};

export type LineSelection = {
  type: 'line';
  startRow: number;
  endRow: number;
};

export type CharSelection = {
  type: 'char';
  start: Position;
  end: Position;
};

export type HighlightSelection = LineSelection | CharSelection;

export type MatchTarget =
  | {
      kind: 'move';
      row: number;
      col: number;
      sequence: string[];
    }
  | {
      kind: 'highlight';
      selection: HighlightSelection;
    }
  | {
      kind: 'manipulate';
      selection: HighlightSelection;
      action: 'delete';
      snapshot: string;
      expectedDocument: string;
    };

export type PlayerSelection = HighlightSelection;

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
  points: number;
  timeLimitMs: number;
  succeeded: boolean;
}

export interface ActiveRound {
  index: number;
  target: MatchTarget;
  startedAt: number | null;
  keys: MatchKeypress[];
  isWarmup: boolean;
}

export type MatchOutcome = 'dodge';

export interface MatchState {
  status: MatchStatus;
  totalRounds: number;
  scoringRounds: number;
  roundIndex: number;
  active: ActiveRound | null;
  completed: MatchRoundResult[];
  startTime?: number;
  endTime?: number;
  timeLimitMs: number;
  totalPoints: number;
  maxPoints: number;
  pointsPerRound: number;
  undoCount: number;
  outcome?: MatchOutcome;
}

export type MatchTargetGenerator = () => MatchTarget;

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface MatchControllerOptions {
  totalRounds?: number;
  now?: () => number;
  timeLimitMs?: number;
  maxPoints?: number;
}

interface StartOptions {
  generator?: MatchTargetGenerator;
  skipWarmup?: boolean;
}

interface InitialConfig {
  totalRounds: number;
  scoringRounds: number;
  timeLimitMs: number;
  maxPoints: number;
  pointsPerRound: number;
}

const createInitialState = (config: InitialConfig): MatchState => ({
  status: 'idle',
  totalRounds: config.totalRounds,
  scoringRounds: config.scoringRounds,
  roundIndex: 0,
  active: null,
  completed: [],
  startTime: undefined,
  endTime: undefined,
  timeLimitMs: config.timeLimitMs,
  totalPoints: 0,
  maxPoints: config.maxPoints,
  pointsPerRound: config.pointsPerRound,
  undoCount: 0,
  outcome: undefined
});

export const createMatchController = (options: MatchControllerOptions = {}) => {
  const rawScoringRounds = options.totalRounds ?? 20;
  const scoringRounds = Math.max(1, rawScoringRounds);
  const totalRounds = scoringRounds + 1;
  let timeLimitMs = options.timeLimitMs ?? 5000;
  const maxPoints = options.maxPoints ?? 20;
  const pointsPerRound = maxPoints / scoringRounds;
  const now = options.now ?? defaultNow;

  const initialState = createInitialState({
    totalRounds,
    scoringRounds,
    timeLimitMs,
    maxPoints,
    pointsPerRound
  });
  const store: Writable<MatchState> = writable(initialState);

  let generator: MatchTargetGenerator | null = null;

  const start = (opts: StartOptions = {}) => {
    if (opts.generator) generator = opts.generator;
    if (!generator) throw new Error('match target generator not configured');

    const target = generator();

    const skipWarmup = opts.skipWarmup ?? false;
    const activeIndex = skipWarmup ? 1 : 0;
    const isWarmup = !skipWarmup;

    store.set({
      status: 'ready',
      totalRounds,
      scoringRounds,
      roundIndex: 0,
      active: {
        index: activeIndex,
        target,
        startedAt: null,
        keys: [],
        isWarmup
      },
      completed: [],
      startTime: undefined,
      endTime: undefined,
      timeLimitMs,
      totalPoints: 0,
      maxPoints,
      pointsPerRound,
      undoCount: 0,
      outcome: undefined
    });
  };

  const setGenerator = (fn: MatchTargetGenerator) => {
    generator = fn;
  };

  const setTimeLimit = (ms: number) => {
    timeLimitMs = Math.max(300, Math.floor(ms));
    store.update((state) => ({ ...state, timeLimitMs }));
  };

  const recordKey = (key: string, at = now()) => {
    store.update((state) => {
      if ((state.status !== 'running' && state.status !== 'ready') || !state.active) return state;
      const isWarmup = state.active.isWarmup;
      const startedAt = state.active.startedAt ?? at;
      const keys = [...state.active.keys, { key, at }];
      const wasReady = state.status === 'ready';
      return {
        ...state,
        status: wasReady ? 'running' : state.status,
        startTime: isWarmup ? state.startTime : state.startTime ?? startedAt,
        active: {
          ...state.active,
          startedAt,
          keys
        }
      };
    });
  };

  const setUndoCount = (count: number) => {
    store.update((state) => ({ ...state, undoCount: Math.max(0, count) }));
  };

  interface PlayerState {
    cursor: Position;
    selection: PlayerSelection | null;
    manipulated?: boolean;
  }

  const positionsEqual = (a: Position, b: Position) => a.row === b.row && a.col === b.col;

  const selectionMatches = (target: HighlightSelection, selection: PlayerSelection | null) => {
    if (!selection) return false;
    if (target.type === 'line' && selection.type === 'line') {
      return target.startRow === selection.startRow && target.endRow === selection.endRow;
    }
    if (target.type === 'char' && selection.type === 'char') {
      return (
        positionsEqual(target.start, selection.start) &&
        positionsEqual(target.end, selection.end)
      );
    }
    return false;
  };

  const targetSatisfied = (target: MatchTarget, player: PlayerState) => {
    if (target.kind === 'move') {
      return target.row === player.cursor.row && target.col === player.cursor.col;
    }
    if (target.kind === 'highlight') {
      return selectionMatches(target.selection, player.selection);
    }
    return player.manipulated === true;
  };

  const evaluate = (player: PlayerState, at = now()) => {
    let completed = false;
    store.update((state) => {
      if (state.status !== 'running' || !state.active) return state;
      const target = state.active.target;
      if (!targetSatisfied(target, player)) return state;

      if (state.active.isWarmup) {
        if (!generator) return state;

        let nextTarget = generator();
        let safety = 0;
        while (nextTarget && targetSatisfied(nextTarget, player) && safety < 5) {
          nextTarget = generator();
          safety += 1;
        }

        if (!nextTarget) {
          return {
            ...state,
            status: 'complete',
            active: null,
            completed: [],
            roundIndex: 0,
            endTime: at
          };
        }

        return {
          ...state,
          status: 'running',
          startTime: state.startTime ?? at,
          roundIndex: 0,
          active: {
            index: 1,
            target: nextTarget,
            startedAt: at,
            keys: [],
            isWarmup: false
          }
        };
      }

      const roundStartedAt = state.active.startedAt ?? state.active.keys[0]?.at ?? at;
      const durationMs = Math.max(0, at - roundStartedAt);
      const succeeded = durationMs <= state.timeLimitMs;
      const delta = succeeded ? state.pointsPerRound : -state.pointsPerRound;
      const nextPoints = clamp(state.totalPoints + delta, -state.maxPoints, state.maxPoints);

      const finished: MatchRoundResult = {
        index: state.active.index,
        target,
        startedAt: roundStartedAt,
        completedAt: at,
        durationMs,
        keys: state.active.keys,
        points: delta,
        timeLimitMs: state.timeLimitMs,
        succeeded
      };
      const results = [...state.completed, finished];
      completed = true;

      if (results.length >= state.scoringRounds || !generator) {
        return {
          ...state,
          status: 'complete',
          active: null,
          completed: results,
          roundIndex: Math.min(results.length, state.scoringRounds),
          endTime: at,
          totalPoints: nextPoints
        };
      }

      let nextTarget = generator();
      let safety = 0;
      while (nextTarget && targetSatisfied(nextTarget, player) && safety < 5) {
        nextTarget = generator();
        safety += 1;
      }

      if (!nextTarget || targetSatisfied(nextTarget, player)) {
        return {
          ...state,
          status: 'complete',
          active: null,
          completed: results,
          roundIndex: Math.min(results.length, state.scoringRounds),
          endTime: at,
          totalPoints: nextPoints
        };
      }

      return {
        ...state,
        completed: results,
        roundIndex: Math.min(results.length, state.scoringRounds),
        totalPoints: nextPoints,
        active: {
          index: results.length + 1,
          target: nextTarget,
          startedAt: at,
          keys: [],
          isWarmup: false
        }
      };
    });
    return completed;
  };

  const reset = (keepGenerator = true) => {
    store.set(
      createInitialState({
        totalRounds,
        scoringRounds,
        timeLimitMs,
        maxPoints,
        pointsPerRound
      })
    );
    if (!keepGenerator) generator = null;
  };

  const replaceState = (nextState: MatchState) => {
    store.set(nextState);
  };

  return {
    subscribe: store.subscribe,
    start,
    setGenerator,
    recordKey,
    evaluate,
    reset,
    setTimeLimit,
    setUndoCount,
    replaceState
  };
};

export type MatchController = ReturnType<typeof createMatchController>;
