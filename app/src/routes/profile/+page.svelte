<script lang="ts">
    import type { PageData } from './$types';
    const { data } = $props<{ data: PageData }>();

    const { user, motionsGrid, motionCounts, dailyCounts, history, totals } = data;

    import StatCard from '$lib/components/StatCard.svelte';
    import ProfileCard from '$lib/components/ProfileCard.svelte';

    const statItems = [
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
  <div class="relative z-[2] px-6 pt-2 pb-8 max-w-6xl mx-auto space-y-8">
    <header class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-4xl font-normal" style="color:#bc93f9; font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);">{`>`}</span>
          <span class="text-3xl font-medium" style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500;">vimgod</span>
        </div>
    </header>
  
    <!-- Stats row -->
    <div class="grid grid-cols-1 md:grid-cols-11 gap-4">
        <div class="md:col-span-5">
            <ProfileCard 
                userName={user.name} 
                rank={user.rank} 
                level={user.level || 1} 
                experience={user.experience || 0} 
                maxExperience={user.maxExperience || 100} 
            />
        </div>
        <div class="md:col-span-6 flex gap-6">
            {#each statItems as s}
              <div class="flex-1">
                <StatCard label={s.label} value={s.value} />
              </div>
            {/each}
        </div>
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