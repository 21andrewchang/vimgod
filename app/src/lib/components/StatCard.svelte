<script lang="ts">
    // Svelte 5 runes props
    import CardIcon from '$lib/components/CardIcon.svelte';
    const { label, value, description, class: className = '' } =
      $props<{ label: string; value?: string | number; description?: string; class?: string }>();
    
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

    <div class="absolute top-3 right-3 z-20">
        <slot name="corner" />
    </div>
  
    <div class="p-4 flex flex-col justify-center h-full relative z-10 item-center">
      {#if value !== undefined}
        <div class="mt-2 mb-2 text-[11px] tracking-[0.08em]" style="color:#c9ced6; font-family:
            'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
            {label}
        </div>
        <div
            class="mt-1 text-[1.30rem] font-light"
            style="color:#e8e8e8; font-family:
            'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
        >
            {value}
        </div>
      {:else}
        <div
            class="mt-2 text-[11px] tracking-[0.08em]"
            style="top: 1px; color:#c9ced6; font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
        >
            {label}
        </div>
        <div>
            <slot />
        </div>
      {/if}
      {#if description}
        <div class="mt-2 text-sm" style="color:#a8b0b8;">{description}</div>
      {/if}

      {#if value === undefined}
        <div class="mt-3">
            <slot name="footer" />
        </div>
      {/if}
    </div>
</div>
