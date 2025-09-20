<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    import RankBadge from '$lib/components/RankBadge.svelte';

    import { lpForRating, rankIdFromRating, abbrevFromRankId, colorByRank } from '$lib/data/ranks';
    
    const { 
        userName = "Player", 
        rank = "Bronze", 
        rankName = "Bronze",
        level = 420, 
        experience = 67, 
        maxExperience = 100
    } = $props<{ 
        userName?: string; 
        rank?: string; 
        rankName?: string;
        level?: number; 
        experience?: number; 
        maxExperience?: number; 
    }>();
    
    const progressPercentage = (experience / maxExperience) * 100;
    
    let cardElement: HTMLDivElement;
    let isHovered = $state(false);
    
    function handleMouseEnter() {
        isHovered = true;
    }
    
    function handleMouseLeave() {
        isHovered = false;
    }
</script>

<div
    bind:this={cardElement}
    class="relative border border-dashed w-full transition-all duration-300 dark:border-zinc-700 border-zinc-400"
    style="background:#0a0a0a; position: relative;"
    role="presentation"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
>
    <!-- Solid border overlay that appears on hover -->
    <div 
        class="absolute inset-0 border-solid dark:border-zinc-700 border-zinc-400 transition-opacity duration-300 pointer-events-none"
        style="opacity: {isHovered ? 1 : 0}; margin: -1px; border-width: 1px;"
    ></div>
    <!-- corner pins -->
    <CardIcon class="-top-2 -left-2" />
    <CardIcon class="-top-2 -right-2" />
    <CardIcon class="-bottom-2 -left-2" />
    <CardIcon class="-bottom-2 -right-2" />
  
    <div class="p-5">
        <!-- Top row: User Name (left) and Rank Badge (right) -->
        <div class="flex justify-between items-start mb-3">
            <div class="text-lg font-medium" style="color:#e8e8e8; font-family:
                'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                {userName}
            </div>
            <RankBadge rank={rank} rankName={rankName} />
        </div>
        
        <!-- Level Progress -->
        <div class="space-y-2">
            <div class="flex justify-between text-xs" style="color:#c9ced6; font-family:
                'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                <span>Level {level}</span>
                <span>{experience}/{maxExperience} XP</span>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-full bg-zinc-800/60 rounded-full h-2 overflow-hidden">
                <div
                  class="h-2 rounded-full transition-all duration-300 bg-pearlescent shiny-glow xp-pearlescent"
                  style={`width: ${progressPercentage}%`}
                ></div>
              </div>
        </div>
    </div>
</div>

<style>

    /* XP-specific tweaks so the shine fits a 2–6px bar */
    :global(.xp-pearlescent) {
    position: relative;
    isolation: isolate;
    /* Softer aura so it doesn't bloom too much at small heights */
    box-shadow:
        0 0 4px hsla(220,100%,80%,0.25),
        0 0 10px hsla(230,100%,78%,0.18);
    }

    /* Subtle top gloss */
    :global(.xp-pearlescent)::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    mix-blend-mode: screen;
    background: linear-gradient(to bottom,
        rgba(255,255,255,0.45) 0%,
        rgba(255,255,255,0.12) 55%,
        rgba(255,255,255,0.00) 100%);
    }

    /* Thin specular sweep */
    :global(.xp-pearlescent)::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
        linear-gradient(115deg,
        rgba(255,255,255,0) 46%,
        rgba(255,255,255,0.75) 50%,
        rgba(255,255,255,0) 54%) no-repeat;
    background-size: 220% 220%;
    opacity: 0.6;
    }

    @media (prefers-reduced-motion: no-preference) {
    :global(.xp-pearlescent)::after {
        animation: xpShine 3.2s linear infinite;
    }
    @keyframes xpShine {
        0%   { background-position: -60% -60%; }
        100% { background-position: 160% 160%; }
    }
    }
</style>