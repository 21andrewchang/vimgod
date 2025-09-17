<script lang="ts">
    import { cn } from "$lib/utils";
  
    let className: any = "";
    export { className as class };
    
    // Fixed grid size - won't change with zoom or resize
    const rows = 50;
    const cols = 200;
    const rowsArray = new Array(rows).fill(1);
    const colsArray = new Array(cols).fill(1);
  </script>
  
  <div class={cn("fixed inset-0 z-0 flex w-full h-full justify-center", className)}>
    {#each rowsArray as _, i}
      <div class="md:w-9 sm:h-9 w-6 h-6 dark:border-neutral-900/60 border-neutral-700/60">
        {#each colsArray as _, j}
          <div
            class="md:w-9 sm:h-9 w-6 h-6 border-r border-t dark:border-neutral-900/60 border-neutral-700/60 relative"
          />
        {/each}
      </div>
    {/each}
  </div>