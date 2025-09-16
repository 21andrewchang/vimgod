<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    
    const { dailyCounts, weeks = 53 } = $props<{ 
        dailyCounts: Record<string, number>; 
        weeks?: number; 
    }>();
    
    let cardElement: HTMLDivElement;
    let isHovered = $state(false);
    
    function handleMouseEnter() {
        isHovered = true;
    }
    
    function handleMouseLeave() {
        isHovered = false;
    }
  
    // Build date cells for last 12 months (53 weeks) with Sunday at top
    const cells: ({ iso: string; value: number } | null)[] = [];
    
    // Find the most recent Sunday
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToSubtract = dayOfWeek;
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - daysToSubtract);
    
    // Start from 52 weeks before the last Sunday (to include current week)
    const startDate = new Date(lastSunday);
    startDate.setDate(lastSunday.getDate() - ((weeks - 1) * 7));
    
    // Build the grid from start date, only including past dates
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      
      // Only include dates that are today or in the past
      if (d <= today) {
        const iso = d.toISOString().slice(0, 10);
        cells.push({ iso, value: dailyCounts[iso] ?? 0 });
      } else {
        // Push null for future dates so we maintain grid structure
        cells.push(null);
      }
    }
    
    // Day labels for Mon, Wed, Fri
    const dayLabels = ['', 'mon', '', 'wed', '', 'fri', ''];
    
    const cols = weeks, rows = 7, cell = 10, gap = 3;
    const width = (cell+gap)*cols, height = (cell+gap)*rows;
    
    // Calculate month labels and their positions
    const monthLabels: { label: string; position: number }[] = [];
    const uniqueMonths: string[] = [];
    let firstMonthPosition = 0;
    
    // Collect all unique months and find first month position
    for (let c = 0; c < cols; c++) {
        const cellIndex = c * rows; // First day of the week (Sunday)
        const cell = cells[cellIndex];
        if (cell) {
            const date = new Date(cell.iso);
            const month = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
            
            if (uniqueMonths.length === 0) {
                firstMonthPosition = c;
            }
            
            if (!uniqueMonths.includes(month)) {
                uniqueMonths.push(month);
            }
        } else {
            break;
        }
    }
    
    // Position first month at its actual position, then space others evenly
    if (uniqueMonths.length > 0) {
        monthLabels.push({ label: uniqueMonths[0], position: firstMonthPosition });
        
        if (uniqueMonths.length > 1) {
            const remainingWidth = width - (firstMonthPosition * (cell + gap));
            const spacing = remainingWidth / (uniqueMonths.length - 1) * 1.5; // Increase spacing by 50%
            
            for (let i = 1; i < uniqueMonths.length; i++) {
                const position = firstMonthPosition + (spacing * i) / (cell + gap);
                monthLabels.push({ label: uniqueMonths[i], position });
            }
        }
    }
  
    // Calculate max contributions for proportional coloring (excluding null cells)
    const maxContributions = Math.max(...cells.filter(cell => cell !== null).map(cell => cell.value));
    
    // Calculate total games played
    const totalGames = cells.filter(cell => cell !== null).reduce((sum, cell) => sum + cell.value, 0);
    
    function color(v:number){
      if (v <= 0) return '#181818';     // 0 contributions - dark gray
      if (v <= maxContributions * 0.33) return '#2c2c2c';    // 0-33% of max
      if (v <= maxContributions * 0.66) return '#4a4a4a';     // 33-66% of max
      if (v <= maxContributions * 0.85) return '#8c8c8c';    // 66-85% of max
      return '#ffffff';                 // 85-100% of max - white
    }
</script>
  
<div
    bind:this={cardElement}
    class="relative border border-dashed transition-all duration-300 dark:border-zinc-700 border-zinc-400"
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
    
    <!-- corner pins -->
    <CardIcon class="-top-2 -left-2" />
    <CardIcon class="-top-2 -right-2" />
    <CardIcon class="-bottom-2 -left-2" />
    <CardIcon class="-bottom-2 -right-2" />
    
    <div class="p-5">
        <!-- Header with summary and legend -->
        <div class="flex justify-between items-center mb-4">
            <div class="text-sm" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                {totalGames} games played in the last year
            </div>
            
            <!-- Legend -->
            <div class="flex items-center gap-2">
                <span class="text-xs" style="color:#c9ced6; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">less</span>
                <div class="flex gap-1">
                    <div class="w-3 h-3 rounded-sm" style="background-color: #181818;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #2c2c2c;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #4a4a4a;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #8c8c8c;"></div>
                    <div class="w-3 h-3 rounded-sm" style="background-color: #ffffff;"></div>
                </div>
                <span class="text-xs" style="color:#c9ced6; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">more</span>
            </div>
        </div>
        
        <div class="flex items-start gap-2">
            <!-- Day labels -->
            <div class="flex flex-col" style="width: 20px; gap: {cell}px; transform: translateY(1px);">
                {#each dayLabels as label, r}
                    <div class="text-xs" style="height: {cell}px; display: flex; align-items: center; color: #e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                        {label}
                    </div>
                {/each}
            </div>
            
            <!-- Heatmap SVG -->
            <svg {width} {height} viewBox={`0 0 ${width} ${height}`} class="w-full h-auto max-w-full" style="background:#0a0a0a;">
                {#each Array(cols) as _, c}
                  {#each Array(rows) as __, r}
                    {#if cells[c*rows + r] !== null}
                      {#key c*rows+r}
                        {@const cellData = cells[c*rows + r]!}
                        <rect
                          x={c*(cell+gap)} y={r*(cell+gap)} width={cell} height={cell}
                          rx="2" ry="2" fill={color(cellData.value)}>
                          <title>{cellData.iso}: {cellData.value} games</title>
                        </rect>
                      {/key}
                    {/if}
                  {/each}
                {/each}
            </svg>
        </div>
        
        <!-- Month labels -->
        <div class="flex items-start gap-2 mt-1 mb-3">
            <!-- Spacer for day labels column -->
            <div style="width: 20px;"></div>
            
            <!-- Month labels positioned relative to columns -->
            <div class="relative" style="width: {width}px; padding-left: 2px;">
                {#each monthLabels as monthLabel}
                    <div 
                        class="absolute text-xs" 
                        style="
                            left: {monthLabel.position * (cell + gap - 1) + 2*cell}px; 
                            color: #c9ced6; 
                            font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;
                        "
                    >
                        {monthLabel.label}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>