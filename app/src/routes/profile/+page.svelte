<script lang="ts">
    import type { PageData } from './$types';
    const { data } = $props<{ data: PageData }>();

    const { user, motionsGrid, motionCounts, dailyCounts, history, totals } = data;
    
    let isHeaderHovered = $state(false);
    
    function handleHeaderMouseEnter() {
        isHeaderHovered = true;
    }
    
    function handleHeaderMouseLeave() {
        isHeaderHovered = false;
    }
    
    function handleHeaderClick() {
        window.location.href = '/';
    }

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
        <div class="flex items-center gap-2 cursor-pointer" onmouseenter={handleHeaderMouseEnter} onmouseleave={handleHeaderMouseLeave} onclick={handleHeaderClick}>
          <span class="text-4xl font-normal" style="color:#bc93f9; font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);">{`>`}</span>
          <span class="text-3xl font-medium" style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500;">vimgod</span>
          <span 
            class="text-3xl font-medium" 
            style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500; transform: translateX(-8px); animation: {isHeaderHovered ? 'blink 1s infinite' : 'none'};"
          >_</span>
        </div>
    </header>
  
    <!-- Stats row -->
    <div class="grid grid-cols-1 md:grid-cols-11 gap-4">
        <div class="md:col-span-5">
            <ProfileCard 
                userName={user.name} 
                rank={user.rank} 
                level={user.level || 420} 
                experience={user.experience || 67} 
                maxExperience={user.maxExperience || 100} 
            />
        </div>
        <div class="md:col-span-6 flex gap-4">
            {#each statItems as s}
              <div class="flex-1">
                <StatCard label={s.label} value={s.value} />
              </div>
            {/each}
        </div>
    </div>
  
    <!-- Heatmap -->
    <section>
      <ContributionHeatmap {dailyCounts} weeks={53} />
    </section>

    <!-- Top motions -->
    <section>
      <h2 class="text-lg font-semibold mb-2" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">most used motions</h2>
      <TopMotions {motionCounts} limit={4} />
    </section>

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