<script lang="ts">
    const { rank = 'Unranked', elo, lp } = $props<{ rank?: string; elo?: number; lp?: number }>();
  
    const colorByRank: Record<string, string> = {
      Unranked:'bg-neutral-300 text-neutral-800',
      Iron:'bg-stone-700 text-white',
      Bronze:'bg-amber-700 text-white',
      Silver:'bg-slate-300 text-slate-900',
      Gold:'bg-yellow-400 text-yellow-900',
      Plat:'bg-cyan-500 text-cyan-900',
      Diamond:'bg-sky-500 text-sky-900',
      Nova:'bg-indigo-500 text-indigo-50',
      Supernova:'bg-violet-500 text-violet-50',
      Singularity:'bg-emerald-500 text-emerald-50'
    };
</script>
  
<div class="flex items-center gap-3">
    <div class={`px-3 py-1 rounded-xl text-sm font-regular ${colorByRank[rank] ?? 'bg-neutral-200'}`} style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
      {rank}
    </div>
    {#if elo !== undefined}
      <span class="text-sm text-neutral-600" style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">Elo {elo}{lp !== undefined ? ` · ${lp} LP` : ''}</span>
    {/if}
</div>