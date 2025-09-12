
<script lang="ts">
    const { motionCounts, limit = 10 } = $props<{ motionCounts: Record<string, number>; limit?: number }>();
    type Entry = [motion: string, count: number];
    const entries = Object.entries(motionCounts) as Entry[];

    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
    const max = Math.max(1, ...sorted.map(([, v]) => v));
</script>
  
<ul class="space-y-2">
    {#each sorted as [motion, count]}
      <li class="flex items-center gap-3">
        <span class="w-16 font-mono text-sm">{motion}</span>
        <div class="flex-1 h-2 bg-neutral-200 rounded">
          <div class="h-2 rounded" style={`width:${(count/max)*100}%`}></div>
        </div>
        <span class="w-10 text-right text-sm tabular-nums">{count}</span>
      </li>
    {/each}
</ul>
  
<style>
    /* the inner bar inherits current color from parent; default is fine */
    div > div { background-color: currentColor; }
</style>