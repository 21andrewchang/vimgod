<script lang="ts">
    import type { PageData } from './$types';
    const { data } = $props<{ data: PageData }>();

    const { profileUser, motionsGrid, motionCounts, dailyCounts, history, totals } = data;

	import StatCard from '$lib/components/StatCard.svelte';
	import ProfileCard from '$lib/components/ProfileCard.svelte';


    const { span: lpMax, lp } = lpForRating(profileUser.elo);
    const lpPercent = lpMax ? Math.min(100, Math.round((lp / lpMax) * 100)) : 100;

    const statItems = [
        // { label: 'rank', value: `${profileUser.elo}` },
        { label: 'wins', value: `${totals.wins} (${totals.winRate}%)` },
        { label: 'avg accuracy', value: `${totals.avgAccuracy}%` }
        // { label: 'coverage', value: `${Math.round(totals.coverage * 100)}%` }
    ];
    
    import RankBadge from '$lib/components/RankBadge.svelte';
    import TopMotions from '$lib/components/TopMotions.svelte';
    import MotionsGrid from '$lib/components/MotionsGrid.svelte';
    import ContributionHeatmap from '$lib/components/ContributionHeatmap.svelte';
    import MatchTable from '$lib/components/MatchTable.svelte';
    import BgDarkTiles from '$lib/components/BgDarkTiles.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { lpForRating } from '$lib/data/ranks';
</script>
  

<BgDarkTiles />

<div
  class="w-full relative overflow-hidden"
>
  <div class="relative z-[2] px-6 pt-24 pb-4 max-w-6xl mx-auto space-y-8">
    <!-- Stats row -->
    <div class="grid grid-cols-1 md:grid-cols-11 gap-4">
        <div class="md:col-span-5">
            <ProfileCard 
                userName={profileUser.name} 
                rank={profileUser.rank} 
                level={profileUser.level}
                experience={profileUser.experience} 
                maxExperience={profileUser.maxExperience} 
            />
        </div>
        <div class="md:col-span-6 flex gap-4">

            <div class="flex-[1.4] min-w-[120px]">
                <StatCard label="rank" class="w-full">
                  <!-- Top-right badge with extra padding handled in the card -->
                  <svelte:fragment slot="corner">
                    <!-- <RankBadge rank={profileUser.rank} /> -->
                  </svelte:fragment>
      
                  <!-- (Optional) main content area can be empty or show rating -->
                  <!-- <div class="text-neutral-300 text-sm">Rating {profileUser.elo}</div> -->
      
                  <!-- Footer: LP label (right) + progress bar at the bottom -->
                  <svelte:fragment slot="footer">
                    <div class="flex flex-col gap-2">
                      <div
                        class="text-xs text-right"
                        style="color: #c9ced6; font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
                      >
                        {lpMax ? `${lp}/${lpMax} LP` : `${lp}+ LP`}
                      </div>
                      <div class="w-full bg-zinc-800/60 rounded-full h-2 overflow-hidden">
                        <div
                          class="h-2 rounded-full bg-pearlescent shiny-glow"
                          style={`width: ${lpPercent}%;`}
                        />
                      </div>
                    </div>
                  </svelte:fragment>
                </StatCard>
              </div>

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
    <section class="pb-16">
      <h2 class="text-lg font-semibold mb-2" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">most used motions</h2>
      <TopMotions {motionCounts} limit={4} />
    </section>

    <!-- Motions unlocked/locked -->
    <!-- <section>
      <h2 class="text-lg font-semibold mb-2">Motions</h2>
      <p class="text-sm text-neutral-500 mb-3">Unlocked vs locked (locked shows "unlock at rank …")</p>
      <MotionsGrid items={motionsGrid} />
    </section> -->
  
    <!-- Match history -->
    <!-- <section>
      <h2 class="text-lg font-semibold mb-2">Recent matches</h2>
      <MatchTable {history} />
    </section> -->
  </div>
  
  <!-- Animated background -->

</div>

<Footer />