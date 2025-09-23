<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    
    const { dailyCounts, weeks = 53 } = $props<{ 
        dailyCounts: Record<string, number>; 
        weeks?: number; 
    }>();
    
    let cardElement: HTMLDivElement;
    let isHovered = $state(false);
    let tooltip = $state({ show: false, x: 0, y: 0, text: '' });
    
    function handleMouseEnter() {
        isHovered = true;
    }
    
    function handleMouseLeave() {
        isHovered = false;
    }
    
    function handleCellMouseEnter(event: MouseEvent, cellData: { iso: string; value: number }) {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        
        // Parse the date in local timezone to avoid UTC conversion issues
        const [year, month, day] = cellData.iso.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const dayNum = date.getDate();
        
        
        tooltip = {
            show: true,
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
            text: `${cellData.value} games played on ${monthName} ${dayNum}`
        };
    }
    
    function handleCellMouseLeave() {
        tooltip.show = false;
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
    
    
    // Helper function to format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Build the grid from start date, only including past dates
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      
      // Only include dates that are today or in the past
      if (d <= today) {
        const iso = formatLocalDate(d);
        const value = dailyCounts[iso] ?? 0;
        
        
        cells.push({ iso, value });
      } else {
        // Stop adding cells for future dates
        break;
      }
    }
    
    const dayLabels = [' ', 'mon', ' ', 'wed', ' ', 'fri', ' '];
    
    
    const cols = weeks, rows = 7, cell = 16, gap = 3.5;
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
    
    <div class="p-5 pb-5">
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
        
        <div class="overflow-x-auto">
            <table class="border-separate border-spacing-1" style="border-spacing: {gap}px; table-layout: fixed; min-width: 100%; width: {width + 26}px;">
                <tbody>
                    <!-- Month labels row -->
                    <tr>
                        <td style="width: 26px !important; min-width: 26px !important; max-width: 26px !important; padding: 0 !important;"></td> <!-- Empty cell for day labels column -->
                        {#each Array(Math.ceil(cells.length / rows)) as _, c}
                            {@const cellIndex = c * rows}
                            {@const cell = cells[cellIndex]}
                            {#if cell}
                                {@const date = new Date(cell.iso)}
                                {@const month = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase()}
                                {@const isFirstOfMonth = c === 0 || (cells[(c-1) * rows] && new Date(cells[(c-1) * rows]!.iso).getMonth() !== date.getMonth())}
                                <td class="text-xs text-center" style="color: #c9ced6; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace; padding: 0; height: 16px; width: {cell}px; min-width: {cell}px; max-width: {cell}px;">
                                    {#if isFirstOfMonth}
                                        {month}
                                    {/if}
                                </td>
                            {/if}
                        {/each}
                    </tr>
                    
                    <!-- Day labels and heatmap rows -->
                    {#each Array(rows) as _, r}
                        <tr>
                            <!-- Day label cell -->
                            <td class="text-xs text-right" style="color: #e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace; padding: 0 2px 0 0 !important; width: 26px !important; min-width: 26px !important; max-width: 26px !important; height: {cell}px !important; min-height: {cell}px !important; max-height: {cell}px !important; box-sizing: border-box; overflow: hidden; line-height: {cell}px; vertical-align: middle;">
                                {dayLabels[r]}
                            </td>
                            
                            <!-- Heatmap cells -->
                            {#each Array(Math.ceil(cells.length / rows)) as _, c}
                                {@const cellIndex = c * rows + r}
                                {@const cellData = cells[cellIndex]}
                                {#if cellData}
                                    <td 
                                        class="rounded-sm cursor-pointer" 
                                        style="
                                            width: {cell}px !important; 
                                            height: {cell}px !important; 
                                            min-width: {cell}px !important; 
                                            max-width: {cell}px !important; 
                                            min-height: {cell}px !important; 
                                            max-height: {cell}px !important; 
                                            background-color: {color(cellData.value)}; 
                                            padding: 0 !important;
                                            box-sizing: border-box;
                                        "
                                        onmouseenter={(e) => handleCellMouseEnter(e, cellData)}
                                        onmouseleave={handleCellMouseLeave}
                                    ></td>
                                {/if}
                            {/each}
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
    
    <!-- Custom Tooltip -->
    {#if tooltip.show}
        <div 
            class="fixed z-50 px-3 py-2 text-xs rounded-md shadow-lg pointer-events-none transition-all duration-200 ease-out"
            style="
                left: {tooltip.x}px; 
                top: {tooltip.y}px; 
                transform: translateX(-50%) translateY(-100%);
                background-color: #1a1a1a;
                color: #e8e8e8;
                font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;
                border: 1px solid #404040;
                white-space: nowrap;
            "
        >
            {tooltip.text}
        </div>
    {/if}
</div>