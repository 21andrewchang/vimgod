<script lang="ts">
  import TutorialEditor, { type TutorialStep } from '$lib/components/TutorialEditor.svelte';
  import tutorialText from '$lib/tutorial.svelte.txt?raw';

  const tutorialSteps: TutorialStep[] = [
    { kind: 'move', row: 0, col: 0 },
    { kind: 'move', row: 0, col: 5 },
    { kind: 'move', row: 1, col: 5 }
  ];
</script>

<div class="relative flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-6 bg-black py-8">
  <div class="rounded-xl border border-white/20">
    <TutorialEditor steps={tutorialSteps} initialText={tutorialText} />
  </div>
</div>
