<script lang="ts">
    export let history: {
      id: string; date: string; result: 'win'|'loss';
      eloDelta: number; accuracy?: number; durationSec?: number;
    }[];
  
    function fmtDate(iso:string){
      const d=new Date(iso);
      return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    }
</script>
  
<div class="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
    <table class="min-w-full text-sm">
      <thead class="bg-neutral-50 text-neutral-600">
        <tr>
          <th class="text-left p-2">Date</th>
          <th class="text-left p-2">Result</th>
          <th class="text-right p-2">Elo Δ</th>
          <th class="text-right p-2">Accuracy</th>
          <th class="text-right p-2">Duration</th>
        </tr>
      </thead>
      <tbody>
        {#each history as m}
          <tr class="border-t">
            <td class="p-2">{fmtDate(m.date)}</td>
            <td class="p-2">
              <span class={m.result==='win' ? 'text-emerald-600' : 'text-rose-600'}>{m.result}</span>
            </td>
            <td class="p-2 text-right">
              <span class={m.eloDelta>=0 ? 'text-emerald-600' : 'text-rose-600'}>
                {m.eloDelta>=0 ? '+' : ''}{m.eloDelta}
              </span>
            </td>
            <td class="p-2 text-right">{m.accuracy ?? '—'}{m.accuracy !== undefined ? '%' : ''}</td>
            <td class="p-2 text-right">{m.durationSec ? `${Math.round(m.durationSec/60)}m` : '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
</div>