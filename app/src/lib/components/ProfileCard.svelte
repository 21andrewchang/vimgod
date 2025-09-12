<script lang="ts">
    import CardIcon from '$lib/components/CardIcon.svelte';
    import RankBadge from '$lib/components/RankBadge.svelte';
    
    const { 
        userName = "Player", 
        rank = "Bronze", 
        level = 1, 
        experience = 0, 
        maxExperience = 100 
    } = $props<{ 
        userName?: string; 
        rank?: string; 
        level?: number; 
        experience?: number; 
        maxExperience?: number; 
    }>();
    
    const progressPercentage = (experience / maxExperience) * 100;
</script>

<div
    class="relative border border-dashed dark:border-zinc-700 border-zinc-400 w-full"
    style="background:#0a0a0a;"
>
    <!-- corner pins -->
    <CardIcon class="-top-2 -left-2" />
    <CardIcon class="-top-2 -right-2" />
    <CardIcon class="-bottom-2 -left-2" />
    <CardIcon class="-bottom-2 -right-2" />
  
    <div class="p-5">
        <!-- Top row: User Name (left) and Rank Badge (right) -->
        <div class="flex justify-between items-start mb-3">
            <div class="text-lg font-medium" style="color:#e8e8e8; font-family:
                'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                {userName}
            </div>
            <RankBadge rank={rank} />
        </div>
        
        <!-- Level Progress -->
        <div class="space-y-2">
            <div class="flex justify-between text-xs" style="color:#c9ced6; font-family:
                'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;">
                <span>Level {level}</span>
                <span>{experience}/{maxExperience} XP</span>
            </div>
            
            <!-- Progress Bar -->
            <div class="w-full bg-zinc-800 rounded-full h-2">
                <div 
                    class="h-2 rounded-full transition-all duration-300" 
                    style="background: linear-gradient(90deg, #BC93F9 0%, #8B5CF6 100%); width: {progressPercentage}%"
                ></div>
            </div>
        </div>
    </div>
</div>
