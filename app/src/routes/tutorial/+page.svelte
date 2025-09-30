<script lang="ts">
	import RankUp from '$lib/components/RankUp.svelte';
	import TutorialEditor, { type TutorialStep } from '$lib/components/TutorialEditor.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { goto } from '$app/navigation';

	const tutorialText = [
		'Welcome to vimgod, 10x dev.',
		'',
		'You should know how to move but if you dont,',
		'you can use h, j, k, and l to move',
		'left, down, up, and right, respectively.',
		'',
		'As you level up, you will unlock new vim motions.',
		'The Library is in the top right corner.',
		'',
		'Try it out - your current location is that white box.',
		'Move it around and try to reach the purple box.'
	].join('\n');

	const advancedMovementText = [
		"You don't have to move one character at a time.",
		'',
		'Try pressing a number key and then h, j, k, or l.',
		'',
		'Pretty sick, right?',
		'You can move any number of lines or characters like that.',
		'',
		'Use the relative line numbers on the left to',
		'quickly figure out how many lines to move up/down.'
	].join('\n');

	const horizontalMovementText = [
		'Spamming the l key was kinda dumb.',
		'',
		'Try pressing w to move forward a word.',
		'Or try pressing b to move backwards a word.',
		'Or try pressing e to move to the end of a word.',
		'',
		'Much easier horizontal movement, huh?'
	].join('\n');

	const highlightLessonText = [
		'Highlighting lets you manipulate text quickly.',
		'',
		"Press 'v' to enter visual mode and",
		'move with h, j, k, and l to grow the selection.',
		'',
		'Highlight the first word on this line.',
		'Press escape to cancel a selection.',
		'Highlight the second word on this line.'
	].join('\n');

	const deletionLessonText = [
		'Deleting text removes whatever you have selected.',
		'',
		"Highlight text and press 'd' to delete it.",
		'',
		'At any point, if you accidentally delete something,',
		'you can press u to undo.',
		'',
		'Delete the first word on this line.',
		'Leave this line alone.',
		'Delete the second word on this line.'
	].join('\n');

	const gameSystemText = [
		'In the real game, each match consists of multiple rounds,',
		'where a round is defined as one MOVE/SELECT/DELETE task.',
		'',
		'The top left will contain a box showing current round.',
		'It will also contain a circular timer.',
		'If you beat the timer, you win that round.',
		'If the timer runs out, you lose that round.',
		'',
		'Your rank is based on your performance from each round.',
		'The key is speed.',
		'',
		'Good luck in the terminal. Become a vimgod.'
	].join('\n');

	function lineIndex(text: string, fragment: string): number {
		return text.split('\n').findIndex((line) => line.includes(fragment));
	}

	function findWordBounds(line: string, wordIndex: number): { start: number; end: number } | null {
		const regex = /[^\s]+/g;
		let match: RegExpExecArray | null;
		let currentIndex = 0;
		while ((match = regex.exec(line))) {
			if (currentIndex === wordIndex) {
				const start = match.index;
				const end = start + match[0].length;
				return { start, end };
			}
			currentIndex += 1;
		}
		return null;
	}

	function buildHighlightWordSteps(
		text: string,
		descriptors: Array<{ marker: string; wordIndex: number }>
	): TutorialStep[] {
		const lines = text.split('\n');
		const steps: TutorialStep[] = [];
		for (const descriptor of descriptors) {
			const row = lines.findIndex((line) => line.includes(descriptor.marker));
			if (row === -1) continue;
			const bounds = findWordBounds(lines[row] ?? '', descriptor.wordIndex);
			if (!bounds) continue;
			steps.push({
				kind: 'highlight',
				selection: {
					type: 'char',
					start: { row, col: bounds.start },
					end: { row, col: bounds.end }
				}
			});
		}
		return steps;
	}

	function removeWordForExpected(line: string, bounds: { start: number; end: number }): string {
		const before = line.slice(0, bounds.start);
		const after = line.slice(bounds.end);

		// If it's the first word, keep whatever leading whitespace naturally remains.
		if (bounds.start === 0) {
			return after;
		}
		return before + after;
	}

	function buildDeletionWordSteps(
		text: string,
		descriptors: Array<{ marker: string; wordIndex: number }>
	): TutorialStep[] {
		let lines = text.split('\n');
		const steps: TutorialStep[] = [];
		for (const descriptor of descriptors) {
			const row = lines.findIndex((line) => line.includes(descriptor.marker));
			if (row === -1) continue;
			const bounds = findWordBounds(lines[row] ?? '', descriptor.wordIndex);
			if (!bounds) continue;

			const selection = {
				type: 'char' as const,
				start: { row, col: bounds.start },
				end: { row, col: bounds.end }
			};

			const updatedLine = removeWordForExpected(lines[row] ?? '', bounds);
			const updatedLines = [...lines];
			updatedLines[row] = updatedLine;

			const expectedDocument = updatedLines.join('\n');
			steps.push({ kind: 'delete', selection, expectedDocument });

			lines = updatedLines; // carry forward for subsequent steps
		}
		return steps;
	}

	const highlightSteps = buildHighlightWordSteps(highlightLessonText, [
		{ marker: 'Highlight the first word on this line.', wordIndex: 0 },
		{ marker: 'Highlight the second word on this line.', wordIndex: 1 }
	]);

	const deletionSteps = buildDeletionWordSteps(deletionLessonText, [
		{ marker: 'Delete the first word on this line.', wordIndex: 0 },
		{ marker: 'Delete the second word on this line.', wordIndex: 1 }
	]);

	const tutorialStepSets: { text: string; steps: TutorialStep[]; finalStage?: boolean }[] = [
		{
			text: tutorialText,
			steps: [
				{ kind: 'move', row: 0, col: 2 },
				{ kind: 'move', row: 0, col: 5 },
				{ kind: 'move', row: 2, col: 5 },
				{ kind: 'move', row: 4, col: 7 },
				{ kind: 'move', row: 3, col: 4 },
				{ kind: 'move', row: 7, col: 8 }
			]
		},
		{
			text: advancedMovementText,
			steps: [
				{ kind: 'move', row: 0, col: 5 },
				{ kind: 'move', row: 4, col: 3 },
				{ kind: 'move', row: 7, col: 8 },
				{ kind: 'move', row: 8, col: 11 }
			]
		},
		{
			text: horizontalMovementText,
			steps: [
				{ kind: 'move', row: 0, col: 4 },
				{ kind: 'move', row: 2, col: 33 },
				{ kind: 'move', row: 3, col: 7 },
				{ kind: 'move', row: 4, col: 31 }
			]
		},
		{
			text: highlightLessonText,
			steps: highlightSteps
		},
		{
			text: deletionLessonText,
			steps: deletionSteps
		},
		{
			text: gameSystemText,
			steps: [{ kind: 'move', row: 11, col: 42 }],
			finalStage: true
		}
	];

	let activeSetIndex = 0;
	let tutorialComplete = false;

	function handleComplete() {
		if (activeSetIndex < tutorialStepSets.length - 1) {
			activeSetIndex += 1;
		} else {
			// Final stage completed
			showDone = true;
			tutorialComplete = true;
		}
	}

	let showDone = false;
	function playMatch() {
		// Change this route if your match page lives elsewhere.
		goto('/');
	}
</script>

<div
	class="relative flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-between gap-6 bg-black py-8"
>
	<div class="flex grow items-center justify-center">
		<div class="relative">
			<!-- Editor container (blurs when complete) -->
			<div class={`rounded-xl border border-white/20 transition-all duration-300 `}>
				{#key activeSetIndex}
					<TutorialEditor
						steps={tutorialStepSets[activeSetIndex].steps}
						initialText={tutorialStepSets[activeSetIndex].text}
						onComplete={handleComplete}
					/>
				{/key}
			</div>
		</div>
	</div>
	<Footer />
</div>
<RankUp rank={'Tutorial Complete'} closeRankup={() => playMatch()} visible={showDone} />
