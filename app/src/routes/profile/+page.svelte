<script lang="ts">
    import type { PageData } from './$types';
    const { data } = $props<{ data: PageData }>();

    const { profileUser, motionsGrid, motionCounts, rawMatchHistory, history, totals, personalBests } = data;

    // Generate dailyCounts on client side using user's local timezone
    const dailyCounts: Record<string, number> = {};
    
    // Helper function to format date as YYYY-MM-DD in user's local timezone
    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    // Generate daily counts for the same range as heatmap (53 weeks = 371 days)
    const heatmapDays = 53 * 7; // 371 days to match heatmap
    for (let d = 0; d < heatmapDays; d++) {
        const day = new Date();
        day.setDate(day.getDate() - d);
        const iso = formatLocalDate(day);
        dailyCounts[iso] = 0;
    }

    // Count matches per day - convert UTC timestamps to user's local timezone
    if (rawMatchHistory) {
        rawMatchHistory.forEach((match: any) => {
            // Parse UTC timestamp and convert to user's local timezone
            const utcDate = new Date(match.created_at);
            const matchDate = formatLocalDate(utcDate);
            
            if (dailyCounts[matchDate] !== undefined) {
                dailyCounts[matchDate]++;
            }
        });
    }

	import StatCard from '$lib/components/StatCard.svelte';
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import { page } from '$app/stores';

    const normalizeName = (value?: string | null) => {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    };

const layoutUser = $derived($page.data?.user ?? null);

const profileDisplayName = $derived<string>(
    normalizeName(layoutUser?.name) ??
    normalizeName(profileUser.displayName ?? profileUser.name ?? null) ??
    normalizeName(layoutUser?.user_metadata?.name ?? null) ??
    layoutUser?.email?.split?.('@')[0] ??
    'Player'
);

    const rating = profileUser.elo ?? 0;

    const { rankId, next, span, lp } = lpForRating(rating);
    const nextId = next !== null ? rankIdFromRating(next) : null;

    const lpMax = span ?? 100;
    const lpPercent = lpMax ? Math.min(100, Math.round((lp / lpMax) * 100)) : 100;

    function familyFromRankId(id: string): string {
        if (id === 'nova' || id === 'supernova' || id === 'singularity') {
        return id.charAt(0).toUpperCase() + id.slice(1);
        }
        const m = id.match(/(bronze|silver|gold|platinum|diamond)/i);
        return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : 'Unranked';
    }

    function textClassByRank(id: string) {
        const family = familyFromRankId(id);
        const tokens = (colorByRank[family] ?? '').split(' ');
        const textToken = tokens.find((t) => t.startsWith('text-'));
        
        if (!textToken) return 'text-neutral-300';
        
        // Static mapping of lighter text colors (100 intensity levels lighter)
        const lighterTextColors: Record<string, string> = {
            'text-neutral-800': 'text-neutral-300',
            'text-white': 'text-neutral-200',
            'text-slate-900': 'text-slate-400',
            'text-yellow-700': 'text-yellow-400',
            'text-teal-600': 'text-teal-400',
            'text-blue-700': 'text-blue-400',
            'text-rose-600': 'text-rose-400',
            'text-violet-50': 'text-violet-200',
            'text-neutral-900': 'text-neutral-300'
        };
        
        return lighterTextColors[textToken] || textToken;
    }

    const currentTextClass = $derived(textClassByRank(rankId));
    const nextTextClass = $derived(nextId ? textClassByRank(nextId) : '');

    const leftProgressLabel = nextId ? `${abbrevFromRankId(rankId)} → ${abbrevFromRankId(nextId)}` : `${abbrevFromRankId(rankId)}`;

    // console.log('leftProgressLabel', leftProgressLabel);

    const statItems = [
        // { label: 'rank', value: `${profileUser.elo}` },
        { label: 'wins', value: `${totals.wins} (${totals.winRate}%)` },
        { label: 'avg apm', value: `${totals.avgAPM}` }
        // { label: 'coverage', value: `${Math.round(totals.coverage * 100)}%` }
    ];

    const personalBestItems = [
        {
            label: 'fastest avg speed',
            value: personalBests.fastestAvgSpeedMs !== null
                ? `${(personalBests.fastestAvgSpeedMs / 1000).toFixed(2)}s`
                : '—',
            percentile: personalBests.fastestAvgSpeedPercentile
        },
        {
            label: 'highest apm',
            value: personalBests.highestApm !== null
                ? `${Math.round(personalBests.highestApm)}`
                : '—',
            percentile: personalBests.highestApmPercentile
        },
        {
            label: 'fastest reaction',
            value: personalBests.fastestReactionMs !== null
                ? `${Math.round(personalBests.fastestReactionMs)}ms`
                : '—',
            percentile: personalBests.fastestReactionPercentile
        }
    ];

    const percentileBadgeStyle = (percentile: number | null): string => {
        if (percentile !== null && percentile <= 5) {
            return `background: linear-gradient(120deg, rgba(255,248,255,0.92), rgba(206,182,255,0.95), rgba(255,224,247,0.9));
color: transparent;
-webkit-background-clip: text;
background-clip: text;
text-shadow: 0 0 6px rgba(206, 182, 255, 0.5), 0 0 12px rgba(255, 248, 255, 0.4);
`;        }
        return "color:#c9ced6;";
    };
    
    import RankBadge from '$lib/components/RankBadge.svelte';
    import TopMotions from '$lib/components/TopMotions.svelte';
    import MotionsGrid from '$lib/components/MotionsGrid.svelte';
    import ContributionHeatmap from '$lib/components/ContributionHeatmap.svelte';
    import MatchHistory from '$lib/components/MatchHistory.svelte';
    import BgDarkTiles from '$lib/components/BgDarkTiles.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import { lpForRating, rankIdFromRating, nextRankId, abbrevFromRankId, prettyRank, colorByRank } from '$lib/data/ranks';
</script>
  

<BgDarkTiles />

<div
  class="w-full relative overflow-hidden"
>
  <div class="relative z-[2] px-6 pt-16 pb-4 max-w-6xl mx-auto space-y-8">
    <!-- Stats row -->
    <div class="grid grid-cols-1 md:grid-cols-11 gap-4">
        <div class="md:col-span-5">
            <ProfileCard 
                userName={profileDisplayName} 
                rank={profileUser.rank}
                rankName={profileUser.rankName}
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
                    <div class="mb-2 flex w-full justify-between">
                        <div class="text-xs font-mono flex items-center gap-1">
                        <span class={currentTextClass}>{abbrevFromRankId(rankId)}</span>
                        {#if nextId}
                            <span class="text-white">→</span>
                            <span class={nextTextClass}>{abbrevFromRankId(nextId)}</span>
                        {/if}
                        </div>

                        <div class="text-xs font-mono text-right" style="color:#c9ced6;">
                        {lpMax ? `${lp}/${lpMax} LP` : `${lp}+ LP`}
                        </div>
                    </div>

                    <div class="w-full bg-zinc-800/60 rounded-full h-2 overflow-hidden">
                        <div class="h-2 rounded-full bg-pearlescent shiny-glow" style={`width:${lpPercent}%;`}></div>
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

    <!-- Personal bests -->
    <section>
      <h2 class="text-lg font-semibold mb-2" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">personal bests</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        {#each personalBestItems as item}
          <StatCard label={item.label} value={item.value} class="pb-card-compact" >
            <div
              slot="corner"
              class="absolute inset-y-0 right-3 flex items-center text-[12px] uppercase tracking-[0.12em]"
              class:hidden={item.percentile === null}
              style={`${percentileBadgeStyle(item.percentile)} font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;`}
            >
              {#if item.percentile !== null}
                <span>top&nbsp;{item.percentile.toFixed(1)}%</span>
              {/if}
            </div>
          </StatCard>
        {/each}
      </div>
    </section>

    <!-- Top motions -->
    <section>
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
    <section class="pb-16">
        <h2 class="text-lg font-semibold mb-2" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">match history</h2>
      <MatchHistory {history} />
    </section>
  </div>
  
  <!-- Animated background -->

</div>

<Footer fixed={false} />

<style>
  :global(.pb-card-compact .statcard-label) {
    margin-bottom: 0.25rem;
  }

  :global(.pb-card-compact .statcard-value) {
    margin-top: 0;
  }
</style>