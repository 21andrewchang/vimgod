<script lang="ts">
    const { class: className = '' } = $props<{ class?: string }>();
</script>
  
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="15" height="15"
    stroke="currentColor" fill="none"
    stroke-width="1" stroke-linecap="round" stroke-linejoin="round"
    class={"absolute " + className}
    style="color:#e8e8e8"
>
    <path d="M12 6v12m6-6H6" />
</svg>