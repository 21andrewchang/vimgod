
<script lang="ts">
    import MotionCard from '$lib/components/MotionCard.svelte';
    
    const { motionCounts, limit = 4 } = $props<{ motionCounts: Record<string, number>; limit?: number }>();
    type Entry = [motion: string, count: number];
    const entries = Object.entries(motionCounts) as Entry[];

    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, limit);
</script>

<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    {#each sorted as [motion, count]}
        <MotionCard {motion} {count} />
    {/each}
</div>