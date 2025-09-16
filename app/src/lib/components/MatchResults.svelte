<script lang="ts">
  import { get } from 'svelte/store';
  import { onDestroy } from 'svelte';
  import type { MatchController, MatchState } from '$lib/match/match';

  export let match: MatchController;

  let state: MatchState = get(match);
  const unsubscribe = match.subscribe((value) => {
    state = value;
  });

  onDestroy(() => {
    unsubscribe();
  });

  $: averageMs = state.completed.length
    ? state.completed.reduce((sum, round) => sum + round.durationMs, 0) / state.completed.length
    : 0;

  $: totalKeys = state.completed.reduce((sum, round) => sum + round.keys.length, 0) + (state.active ? state.active.keys.length : 0);

  const playAgain = () => {
    match.reset();
  };
</script>

<div class="w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-white shadow-lg backdrop-blur">
  {#if state.status === 'complete'}
    <div class="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Match Results</h2>
        <p class="text-sm text-slate-200/80">20 motions sprint complete — review your pace below.</p>
      </div>
      <div class="text-right text-sm text-slate-200/70">
        <div>Avg split: {averageMs.toFixed(0)} ms</div>
        <div>Total keys: {totalKeys}</div>
      </div>
    </div>
    <div class="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/30">
      <table class="min-w-full text-sm">
        <thead class="text-left text-slate-300/80">
          <tr class="border-b border-white/10">
            <th class="px-3 py-2 font-medium">Round</th>
            <th class="px-3 py-2 font-medium">Sequence</th>
            <th class="px-3 py-2 font-medium text-right">Keys</th>
            <th class="px-3 py-2 font-medium text-right">Time (ms)</th>
          </tr>
        </thead>
        <tbody>
          {#each state.completed as round}
            <tr class="border-b border-white/5">
              <td class="px-3 py-2 font-mono text-slate-100/90">{round.index + 1}</td>
              <td class="px-3 py-2 font-mono text-slate-100">{round.target.sequence.join(' ') || '—'}</td>
              <td class="px-3 py-2 text-right font-mono text-slate-200/80">{round.keys.length}</td>
              <td class="px-3 py-2 text-right font-mono text-emerald-200">{round.durationMs.toFixed(0)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex justify-end">
      <button
        type="button"
        class="rounded-md border border-emerald-400/60 bg-emerald-400/20 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-400/30"
        on:click={playAgain}
      >
        Play again
      </button>
    </div>
  {:else}
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Sprint Warmup</h2>
        <p class="text-sm text-slate-200/80">Complete 20 generated motions to log a match. Start whenever you&rsquo;re ready.</p>
      </div>
      <div class="text-right text-sm text-slate-200/70">
        <div>Round {Math.min(state.roundIndex + 1, state.totalRounds)} / {state.totalRounds}</div>
        <div>Keys so far: {totalKeys}</div>
      </div>
    </div>
  {/if}
</div>
