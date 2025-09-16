<script lang="ts">
    // Svelte 5 runes props
    import CardIcon from '$lib/components/CardIcon.svelte';
    const { label, value, description } =
      $props<{ label: string; value: string | number; description?: string }>();
    
    let cardElement: HTMLDivElement;
    let isHovered = $state(false);
    
    function handleMouseEnter() {
        isHovered = true;
    }
    
    function handleMouseLeave() {
        isHovered = false;
    }
</script>
  
<div
    bind:this={cardElement}
    class="relative border border-dashed h-full transition-all duration-300 dark:border-zinc-700 border-zinc-400"
    style="background:#0a0a0a; position: relative;"
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
  
    <div class="p-5 flex flex-col justify-center h-full">
      <div class="text-[11px] tracking-[0.08em]" style="color:#c9ced6; font-family:
          'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
        {label}
      </div>
      <div
        class="mt-1 text-[1.45rem] font-light"
        style="color:#e8e8e8; font-family:
          'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
      >
        {value}
      </div>
      {#if description}
        <div class="mt-2 text-sm" style="color:#a8b0b8;">{description}</div>
      {/if}
    </div>
</div>
