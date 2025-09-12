<script lang="ts">
    export let items: { motion: string; familyLabel: string; unlocked: boolean; unlockAt: string }[];
</script>
  
<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
    {#each items as it}
      <div class={`rounded-lg border p-2 text-sm flex items-center justify-between ${it.unlocked ? 'bg-white' : 'bg-neutral-50 opacity-70'}`}>
        <div>
          <div class="font-mono">{it.motion}</div>
          <div class="text-[11px] text-neutral-500">{it.familyLabel}</div>
        </div>
        {#if it.unlocked}
          <span class="text-xs text-emerald-600">unlocked</span>
        {:else}
          <span class="flex items-center gap-1 text-xs text-neutral-500">
            🔒 <span>unlock at {it.unlockAt}</span>
          </span>
        {/if}
      </div>
    {/each}
</div>