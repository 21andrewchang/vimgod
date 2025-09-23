<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    
    const { motion, count } = $props<{ motion: string; count: number }>();
    
    // Function to create separate keycaps for each keystroke
    function getKeycaps(motion: string): string[] {
        if (motion === 'Escape') {
            return ['esc'];
        }
        // Handle {motion} patterns - split operator and {motion}
        if (motion.includes('{motion}')) {
            const operator = motion.replace('{motion}', '');
            return [operator, '{motion}'];
        }
        // Split motion into individual keystrokes (preserve original casing)
        return motion.split('');
    }
    
    let isHovered = $state(false);
    
    function handleMouseEnter() {
        isHovered = true;
    }
    
    function handleMouseLeave() {
        isHovered = false;
    }
</script>

<div
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
    
    <div class="p-6 flex flex-col items-center text-center space-y-4 min-h-[140px]">
        <!-- Motion name -->
        <div class="text-lg font-medium" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
            {motion}
        </div>
        
        <!-- Keycaps visual -->
        <div class="flex items-center justify-center gap-2">
            {#each getKeycaps(motion) as keycap}
                <div class="bg-zinc-800 border border-zinc-700 rounded px-4 py-4 text-lg h-12 flex items-center justify-center transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-lg" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2), 0 3px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(255, 255, 255, 0.2), 0 2px 6px rgba(255, 255, 255, 0.2), 0 1px 2px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05); width: {keycap.includes('{motion}') ? 'auto' : '48px'}; min-width: {keycap.includes('{motion}') ? '80px' : '48px'};">
                    {keycap}
                </div>
            {/each}
        </div>
        
        <!-- Usage count -->
        <div class="text-lg font-light" style="color:#e8e8e8; font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
            {count} times
        </div>
    </div>
</div>
