<script lang="ts">
    import { onMount } from 'svelte';
    import { prefersReducedMotion } from 'svelte/motion';
  
    const { from, to, minDigits = 4, delay = 650, baseDuration = 1600, stepMs = 120, stagger = 80, direction = 'auto' } =
      $props<{
        from: number; to: number;
        minDigits?: number; delay?: number;
        baseDuration?: number; stepMs?: number; stagger?: number;
        direction?: 'auto' | 'up' | 'down';
      }>();
  
    // Build repeated reel 0..9 so we can scroll multiple steps
    const RINGS = 2;                // how many full 0..9 loops on either side
    const DIGITS = 10;
    const PREFIX = RINGS * DIGITS;  // center start inside the reel (e.g., 20)
    const REEL_LEN = (RINGS * 2 + 1) * DIGITS;  // e.g., 50 rows tall
    const REEL = Array.from({ length: REEL_LEN }, (_, i) => i % 10);
  
    function toDigits(n: number, width: number) {
      const s = Math.max(0, Math.floor(n)).toString().padStart(width, '0');
      return s.split('').map((c) => Number(c));
    }
  
    // Layout
    const widthDigits = Math.max(minDigits, Math.max(from, to).toString().length);
    const fromDigits = toDigits(from, widthDigits);
    const toDigitsArr = toDigits(to, widthDigits);
  
    // Per-digit animation state
    let offsets = fromDigits.map((d) => PREFIX + d); // in "rows" (1em per row)
    let durs = fromDigits.map(() => 0);
  
    function stepsBetween(a: number, b: number, dir: 'up' | 'down') {
      if (dir === 'up')   return (b - a + 10) % 10;   // 0..9
      if (dir === 'down') return (a - b + 10) % 10;   // 0..9
    }
  
    function animate() {
      const diff = to - from;
      const dir: 'up' | 'down' = direction === 'auto' ? (diff >= 0 ? 'up' : 'down') : direction;
  
      if (prefersReducedMotion.current) {
        // snap straight to target
        offsets = toDigitsArr.map((d) => PREFIX + d);
        durs = durs.map(() => 0);
        return;
      }
  
      // Stagger from rightmost → leftmost for slot feel
      const last = offsets.length - 1;
      offsets = [...offsets]; // copy so Svelte sees the change
  
      for (let i = last; i >= 0; i--) {
        const a = fromDigits[i];
        const b = toDigitsArr[i];
        const steps = stepsBetween(a, b, dir) ?? 0;
        const ms = steps === 0 ? 0 : Math.max(200, baseDuration + stepMs * steps);
        durs[i] = ms;
  
        const apply = () => {
          offsets[i] = offsets[i] + (dir === 'up' ? steps : -steps);
        };
  
        setTimeout(apply, delay + (last - i) * stagger);
      }
    }
  
    onMount(animate);
  
    // Re-run if props change (e.g., keyed per match)
    $effect(() => {
      // reset to FROM instantly if the inputs change
      offsets = fromDigits.map((d) => PREFIX + d);
      durs = fromDigits.map(() => 0);
      // (re)start the animation
      animate();
    });
  </script>
  
  <style>
    .rolling { 
        display: inline-flex; 
        gap: 0.1ch; 
        font-variant-numeric: tabular-nums;
    }

    .wheel {
        overflow: hidden;
        height: 1em;
        width: 1ch;
        border: 1px dashed rgba(255,255,255,0.2);
    }

    .strip {
        display: block;
        transition-property: transform;
        will-change: transform;
        /* transform: none !important; */
    }

    .cell {
        display: block;
        height: 1em;
        line-height: 1em;
        width: 1ch;           /* reserve digit width so it doesn’t compress */
        text-align: center;
    }
  </style>
  
  <span class="rolling" aria-label={to}>
    {#each offsets as off, i}
      <span class="wheel">
        <span
          class="strip"
          style="
            transform: translateY(-{off}em);
            transition-duration: {durs[i]}ms;
            transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1); /* easeOutQuint-ish */
            display: inline-block;"
        >
          {#each REEL as d}
            <span class="cell">{d}</span>
          {/each}
        </span>
      </span>
    {/each}
  </span>