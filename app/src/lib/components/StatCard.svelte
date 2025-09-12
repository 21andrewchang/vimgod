<script lang="ts">
    // Svelte 5 runes props
    import CardIcon from '$lib/components/CardIcon.svelte';
    const { label, value, description } =
      $props<{ label: string; value: string | number; description?: string }>();
</script>
  
<div
    class="relative rounded-sm border border-dashed dark:border-zinc-700 border-zinc-400"
    style="background:#0f0f0f;"
>
    <!-- corner pins -->
    <CardIcon class="-top-2 -left-2" />
    <CardIcon class="-top-2 -right-2" />
    <CardIcon class="-bottom-2 -left-2" />
    <CardIcon class="-bottom-2 -right-2" />
  
    <div class="p-5">
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
