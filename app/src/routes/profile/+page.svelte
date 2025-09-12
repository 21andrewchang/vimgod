<script lang="ts">
    import type { PageData } from './$types';
    const { data } = $props<{ data: PageData }>();

    const { user, motionsGrid, motionCounts, dailyCounts, history, totals } = data;

    import StatCard from '$lib/components/StatCard.svelte';

    const statItems = [
        { label: 'rank', value: user.rank },
        { label: 'games', value: totals.games },
        { label: 'wins', value: `${totals.wins} (${totals.winRate}%)` },
        { label: 'avg accuracy', value: `${totals.avgAccuracy}%` },
        { label: 'coverage', value: `${Math.round(totals.coverage * 100)}%` }
    ];
    
    import RankBadge from '$lib/components/RankBadge.svelte';
    import TopMotions from '$lib/components/TopMotions.svelte';
    import MotionsGrid from '$lib/components/MotionsGrid.svelte';
    import ContributionHeatmap from '$lib/components/ContributionHeatmap.svelte';
    import MatchTable from '$lib/components/MatchTable.svelte';
    import BgDarkTiles from '$lib/components/BgDarkTiles.svelte';
</script>
  

<BgDarkTiles r={40} c={80} />

<div
  class="w-full min-h-screen relative overflow-hidden"
>
  <div class="relative z-[2] px-6 py-8 max-w-6xl mx-auto space-y-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{user.name}</h1>
        <p class="text-sm text-neutral-500">ID: {user.id}</p>
      </div>
      <RankBadge rank={user.rank} elo={user.elo} lp={user.lp} />
    </header>
  
    <!-- Stats row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        {#each statItems as s}
          <StatCard label={s.label} value={s.value} />
        {/each}
    </div>
  
    <!-- Heatmap + Top motions -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2">
        <h2 class="text-lg font-semibold mb-2">Play activity</h2>
        <ContributionHeatmap {dailyCounts} weeks={16} />
      </div>
      <div>
        <h2 class="text-lg font-semibold mb-2">Most used motions</h2>
        <TopMotions {motionCounts} limit={10} />
      </div>
    </div>
  
    <!-- Motions unlocked/locked -->
    <section>
      <h2 class="text-lg font-semibold mb-2">Motions</h2>
      <p class="text-sm text-neutral-500 mb-3">Unlocked vs locked (locked shows "unlock at rank …")</p>
      <MotionsGrid items={motionsGrid} />
    </section>
  
    <!-- Match history -->
    <section>
      <h2 class="text-lg font-semibold mb-2">Recent matches</h2>
      <MatchTable {history} />
    </section>
  </div>
  
  <!-- Animated background -->

</div>