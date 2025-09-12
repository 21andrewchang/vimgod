<script lang="ts">
    export let dailyCounts: Record<string, number>;
    export let weeks = 16; // ~112 days
  
    // Build date cells oldest→newest
    function daysBack(n:number){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-n); return d; }
    const cells: { iso: string; value: number }[] = [];
    for (let i=weeks*7-1; i>=0; i--) {
      const d = daysBack(i);
      const iso = d.toISOString().slice(0,10);
      cells.push({ iso, value: dailyCounts[iso] ?? 0 });
    }
  
    const cols = weeks, rows = 7, cell = 12, gap = 2;
    const width = (cell+gap)*cols, height = (cell+gap)*rows;
  
    function color(v:number){
      if (v<=0) return '#e5e7eb';     // gray-200
      if (v===1) return '#bae6fd';    // sky-200
      if (v===2) return '#7dd3fc';    // sky-300
      if (v===3) return '#38bdf8';    // sky-400
      return '#0ea5e9';               // sky-500
    }
</script>
  
<svg {width} {height} viewBox={`0 0 ${width} ${height}`} class="rounded-lg border border-neutral-200 bg-white">
    {#each Array(cols) as _, c}
      {#each Array(rows) as __, r}
        {#if cells[c*rows + r]}
          {#key c*rows+r}
            <rect
              x={c*(cell+gap)} y={r*(cell+gap)} width={cell} height={cell}
              rx="2" ry="2" fill={color(cells[c*rows+r].value)}>
              <title>{cells[c*rows+r].iso}: {cells[c*rows+r].value} games</title>
            </rect>
          {/key}
        {/if}
      {/each}
    {/each}
</svg>