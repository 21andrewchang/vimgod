<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    
    const { history } = $props<{
      history: {
        id: string; date: string; result: 'win'|'loss'|'draw';
        eloDelta: number; avgSpeed?: number; apm?: number;
      }[];
    }>();

    let cardElement: HTMLDivElement;
    let isHovered = $state(false);

    function handleMouseEnter() {
        isHovered = true;
    }

    function handleMouseLeave() {
        isHovered = false;
    }
  
    function fmtDate(iso:string){
      const d=new Date(iso);
      return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    }
</script>
  
<div
    bind:this={cardElement}
    class="relative border border-dashed border-zinc-400 transition-all duration-300 dark:border-zinc-700 overflow-hidden"
    style="background:#0a0a0a; position: relative;"
    role="presentation"
    onmouseenter={handleMouseEnter}
    onmouseleave={handleMouseLeave}
>
    <!-- Solid border overlay that appears on hover -->
    <div 
        class="absolute inset-0 border border-solid dark:border-zinc-700 border-zinc-400 transition-opacity duration-300 pointer-events-none"
        style="opacity: {isHovered ? 1 : 0}; margin: -1px;"
    ></div>
    
    <!-- Corner pins -->
    <CardIcon class="-top-2 -left-2" />
    <CardIcon class="-top-2 -right-2" />
    <CardIcon class="-bottom-2 -left-2" />
    <CardIcon class="-bottom-2 -right-2" />

    <div class="relative z-10 overflow-x-auto">
        <table class="min-w-full text-sm" style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
            <thead>
                <tr style="color:#c9ced6;">
                    <th class="text-left p-3 text-[11px] tracking-[0.08em]">date</th>
                    <th class="text-left p-3 text-[11px] tracking-[0.08em]">result</th>
                    <th class="text-right p-3 text-[11px] tracking-[0.08em]">elo Δ</th>
                    <th class="text-right p-3 text-[11px] tracking-[0.08em]">avg speed</th>
                    <th class="text-right p-3 text-[11px] tracking-[0.08em]">apm</th>
                </tr>
            </thead>
            <tbody>
                {#each history as m}
                    <tr class="border-t border-zinc-800">
                        <td class="p-3 text-xs" style="color:#e8e8e8;">{fmtDate(m.date)}</td>
                        <td class="p-3 text-xs">
                            <span class={m.result==='win' ? 'text-emerald-400' : m.result==='loss' ? 'text-rose-400' : 'text-yellow-400'}>{m.result}</span>
                        </td>
                        <td class="p-3 text-right text-xs">
                            <span class={m.eloDelta>=0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {m.eloDelta>=0 ? '+' : ''}{m.eloDelta}
                            </span>
                        </td>
                        <td class="p-3 text-right text-xs" style="color:#e8e8e8;">{m.avgSpeed ? `${(m.avgSpeed / 1000).toFixed(2)}s` : '—'}</td>
                        <td class="p-3 text-right text-xs" style="color:#e8e8e8;">{m.apm || '—'}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>