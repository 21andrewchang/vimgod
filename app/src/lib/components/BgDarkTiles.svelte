<script lang="ts">
    import { cn } from "$lib/utils";
    import { Motion } from "svelte-motion";
  
    let className: any = "";
    export { className as class };
    export let r = 5;
    export let c = 5;
    let rows = new Array(r).fill(1);
    let cols = new Array(c).fill(1);
  </script>
  
  <div class=""
     style="--tile: rgba(55,55,55,0.22); /* sky-400 @ 22% */">
  <div class={cn("relative z-0 flex w-full h-full justify-center", className)}>
    {#each rows as _, i}
      <Motion let:motion>
        <div class="md:w-9 sm:h-9 w-6 h-6 dark:border-neutral-900/60 border-neutral-700/60" use:motion>
          {#each cols as _, j}
            <Motion
              initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
              whileHover={{
                backgroundColor: 'var(--tile)',
                transition: { duration: 0 }
              }}
              animate={{
                backgroundColor: 'rgba(0,0,0,0)',       
                transition: { duration: 0.2 }
              }}
              let:motion
            >
              <div
                class="md:w-9 sm:h-9 w-6 h-6 border-r border-t dark:border-neutral-900/60 border-neutral-700/60 relative"
                use:motion
              />
            </Motion>
          {/each}
        </div>
      </Motion>
    {/each}
  </div>
</div>