<script lang="ts">
    import { colorByRank } from '$lib/data/ranks';
    
    const { rank, rankName, elo, lp } = $props<{ rank?: string; rankName?: string; elo?: number; lp?: number }>();
</script>
  
<div class="flex items-center gap-3">
    <div class={`px-3 py-1 rounded-xl text-sm font-regular ${colorByRank[rankName] ?? 'bg-neutral-200'}`} style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
      {rank}
    </div>
    {#if elo !== undefined}
      <span class="text-sm text-neutral-600" style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">Elo {elo}{lp !== undefined ? ` · ${lp} LP` : ''}</span>
    {/if}
</div>

<style>
    /* —— Pearlescent base (blue, seam-less) —— */
    :global(.bg-pearlescent) {
    background:
        /* soft radial highlight */
        radial-gradient(120% 120% at 12% 18%,
        rgba(255,255,255,0.95) 0%,
        rgba(255,255,255,0.55) 35%,
        rgba(255,255,255,0) 60%),
        /* conic layer A (blue/violet) — off-center */
        conic-gradient(from 30deg at 28% 42%,
        rgba(231,246,255,0.70) 0deg,
        rgba(230,233,255,0.70) 90deg,
        rgba(240,232,255,0.70) 180deg,
        rgba(233,238,255,0.70) 270deg,
        rgba(231,246,255,0.70) 360deg),
        /* conic layer B (lighter, different center) — offsets A’s seam */
        conic-gradient(from -15deg at 78% 58%,
        rgba(244,248,255,0.45) 0deg,
        rgba(228,236,255,0.45) 120deg,
        rgba(238,232,255,0.45) 240deg,
        rgba(244,248,255,0.45) 360deg),
        /* neutral base */
        linear-gradient(120deg, #f7f9ff 0%, #edf1fa 100%);
    background-blend-mode: screen, normal, normal, normal;
    border: 1px solid rgba(255,255,255,0.65);
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.85),
        inset 0 -1px 0 rgba(255,255,255,0.4),
        0 2px 6px rgba(0,0,0,0.08);
    }

    /* —— Blue glow (no green) —— */
    :global(.shiny-glow) {
    position: relative;
    isolation: isolate;
    box-shadow:
        0 0 8px  hsla(220,100%,80%,0.30),
        0 0 18px hsla(230,100%,78%,0.24),
        0 0 36px hsla(210,100%,70%,0.20);
    }

    /* Gloss */
    :global(.shiny-glow)::before {
    content: "";
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    pointer-events: none;
    mix-blend-mode: screen;
    background: linear-gradient(to bottom,
        rgba(255,255,255,0.60) 0%,
        rgba(255,255,255,0.15) 35%,
        rgba(255,255,255,0.00) 65%);
    opacity: 0.9;
    }

    /* Specular streak */
    :global(.shiny-glow)::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background:
        linear-gradient(125deg,
        rgba(255,255,255,0) 42%,
        rgba(255,255,255,0.75) 47%,
        rgba(255,255,255,0.0) 52%) no-repeat;
    background-size: 220% 220%;
    filter: blur(0.4px);
    opacity: 0.7;
    }

    /* Motion */
    @media (prefers-reduced-motion: no-preference) {
    :global(.bg-pearlescent) {
        background-size: 200% 200%, 100% 100%, 100% 100%, 100% 100%;
        animation: pearlShift 14s ease-in-out infinite alternate;
    }
    :global(.shiny-glow)::after {
        animation: shineSweep 3.6s linear infinite;
    }
    @keyframes pearlShift {
        0%   { background-position: 0% 0%,  50% 50%, 50% 50%, 0% 0%; }
        100% { background-position: 100% 100%, 58% 42%, 42% 58%, 0% 0%; }
    }
    @keyframes shineSweep {
        0%   { background-position: -60% -60%; }
        100% { background-position: 160% 160%; }
    }
    }

    /* Optional: a bit more pop on hover */
    :global(.shiny-glow:hover),
    :global(.shiny-glow:focus-visible) {
    box-shadow:
        0 0 10px hsla(220,100%,80%,0.38),
        0 0 22px hsla(230,100%,78%,0.28),
        0 0 44px hsla(210,100%,70%,0.22);
    }
  </style>