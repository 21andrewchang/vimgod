<script lang="ts">
	import { scale, blur } from 'svelte/transition';
	import type { Motion } from '$lib/data/motions';

	const BEAM_GROW_X_MS = 2000;

	const { visible, motion, closeMotion } = $props<{
		motion: Motion | null;
		closeMotion: () => void;
		visible: boolean;
	}>();

	const motionKindToRank: Record<Motion['kind'], 'movement' | 'deletion' | 'visual' | 'undo'> = {
		movement: 'movement',
		delete: 'deletion',
		visual: 'visual',
		undo: 'undo'
	};

	// runes state
	let phase = $state<'idle' | 'beamX' | 'toCard' | 'card'>('idle');
	let showCard = $state(false);

	const colorKey = $derived<'movement' | 'deletion' | 'visual' | 'undo' | 'tutorial'>(
		motion ? motionKindToRank[motion.kind] : 'movement'
	);

	function keyPill(k: string) {
		return k.replace(/^<C-(.+)>$/i, 'Ctrl+$1').replace(/^<c-(.+)>$/i, 'Ctrl+$1');
	}

	function resetPresentation() {
		showCard = false;
		phase = 'idle';
	}

	$effect(() => {
		const v = visible;
		const m = motion;

		let t2: number | undefined;
		let t3: number | undefined;

		if (!v || !m) {
			resetPresentation();
			return () => {
				clearTimeout(t2);
				clearTimeout(t3);
			};
		}

		resetPresentation();
		phase = 'beamX';

		const toCardDelay = BEAM_GROW_X_MS + 120;
		const revealDelay = toCardDelay - 800;

		t2 = window.setTimeout(() => (phase = 'toCard'), toCardDelay);

		t3 = window.setTimeout(() => {
			showCard = true;
			phase = 'card';
		}, revealDelay);

		return () => {
			clearTimeout(t2);
			clearTimeout(t3);
		};
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
		on:click={closeMotion}
		transition:blur={{ duration: 200 }}
		data-rank={colorKey}
		style="
			--card-w: min(32rem, 92vw);
			--card-h: 178px;
			--title-gap: 40px;
			--lift: calc((var(--card-h) / 2) + var(--title-gap));
			--morph-ms: 520ms;
			--fade-delay: 420ms;
		"
	>
		<div class={`rank-title ${phase === 'toCard' || phase === 'card' ? 'at-border' : ''}`}>
			NEW MOTION UNLOCKED
		</div>
		<div
			class={`rank-beam ${phase === 'toCard' || phase === 'card' ? 'to-card' : ''}`}
			aria-hidden="true"
		></div>

		{#if motion && showCard}
			<div class="beam-card-contents" in:scale={{ start: 0.8, duration: 500 }}>
				<article
					data-kind={motion.kind}
					class="group relative rounded-xl border-0 bg-neutral-900/80 p-4 text-left shadow-sm outline-none"
				>
					<div class="mb-2 flex flex-wrap items-center gap-1.5">
						{#if Array.isArray(motion.keys)}
							{#each motion.keys as key, i}
								<kbd class="kbd">{keyPill(key)}</kbd>{#if i < motion.keys.length - 1}
									<span class="mx-0.5 text-xs text-neutral-500">/</span>{/if}
							{/each}
						{:else}
							{#each motion.keys.split(' ') as key, i}
								<kbd class="kbd">{keyPill(key)}</kbd>{#if i < motion.keys.split(' ').length - 1}
									<span class="mx-0.5 text-xs text-neutral-500">·</span>{/if}
							{/each}
						{/if}
					</div>
					<h3 class="font-mono text-sm tracking-wide text-neutral-100">{motion.label}</h3>
					<p class="mt-1 font-mono text-[13px] leading-snug text-neutral-400">{motion.desc}</p>
					<div
						class="pointer-events-none mt-3 h-px w-full origin-left bg-gradient-to-r from-[var(--kind-from)] via-[var(--kind-via)] to-transparent"
					/>
				</article>
			</div>
		{/if}

		<button
			on:click={closeMotion}
			in:blur={{ duration: 500, delay: 800 }}
			class="text-mono absolute bottom-20 z-30 px-10 pt-10 !text-xs tracking-widest text-neutral-700 transition hover:text-neutral-500"
		>
			CONTINUE
		</button>
	</div>
{/if}

<style>
	[data-rank] {
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(167, 224, 255, 0);
		--rank-core-2: rgba(167, 224, 255, 0.92);
		--rank-core-3: rgba(167, 224, 255, 0);
		--rank-bloom-1: rgba(147, 197, 253, 0.08);
		--rank-bloom-2: rgba(147, 197, 253, 0.25);
		--rank-shadow-1: rgba(147, 197, 253, 0.75);
		--rank-shadow-2: rgba(147, 197, 253, 0.45);
		--rank-shadow-3: rgba(147, 197, 253, 0.25);
		--rank-title-glow-1: rgba(147, 197, 253, 0.55);
		--rank-title-glow-2: rgba(147, 197, 253, 0.35);
		--rank-title-color: #e6f6ff;
		--card-w: min(32rem, 92vw);
		--card-h: 178px;
		--title-gap: 56px;
		--lift: calc((var(--card-h) / 2) + var(--title-gap));
	}
	[data-rank='movement'] {
		--rank-core-1: rgba(194, 123, 255, 0);
		--rank-core-2: rgba(194, 123, 255, 0.92);
		--rank-core-3: rgba(194, 123, 255, 0);
		--rank-bloom-1: rgba(194, 123, 255, 0.08);
		--rank-bloom-2: rgba(194, 123, 255, 0.25);
		--rank-shadow-1: rgba(194, 123, 255, 0.75);
		--rank-shadow-2: rgba(194, 123, 255, 0.45);
		--rank-shadow-3: rgba(194, 123, 255, 0.25);
		--rank-title-glow-1: rgba(194, 123, 255, 0.55);
		--rank-title-glow-2: rgba(194, 123, 255, 0.35);
		--rank-title-color: #fae6fa;
	}
	[data-rank='deletion'] {
		--rank-core-1: rgba(239, 68, 68, 0);
		--rank-core-2: rgba(239, 68, 68, 0.95);
		--rank-core-3: rgba(239, 68, 68, 0);
		--rank-bloom-1: rgba(239, 68, 68, 0.12);
		--rank-bloom-2: rgba(239, 68, 68, 0.32);
		--rank-shadow-1: rgba(239, 68, 68, 0.7);
		--rank-shadow-2: rgba(239, 68, 68, 0.4);
		--rank-shadow-3: rgba(239, 68, 68, 0.2);
		--rank-title-glow-1: rgba(239, 68, 68, 0.55);
		--rank-title-glow-2: rgba(239, 68, 68, 0.3);
		--rank-title-color: #ffdddd;
	}
	[data-rank='undo'] {
		--rank-core-1: rgba(255, 213, 74, 0);
		--rank-core-2: rgba(255, 213, 74, 0.95);
		--rank-core-3: rgba(255, 213, 74, 0);
		--rank-bloom-1: rgba(255, 230, 140, 0.15);
		--rank-bloom-2: rgba(255, 220, 90, 0.38);
		--rank-shadow-1: rgba(255, 213, 74, 0.75);
		--rank-shadow-2: rgba(255, 196, 0, 0.45);
		--rank-shadow-3: rgba(255, 170, 0, 0.25);
		--rank-title-glow-1: rgba(255, 230, 150, 0.6);
		--rank-title-glow-2: rgba(255, 220, 120, 0.35);
		--rank-title-color: #fff6d8;
	}
	[data-rank='visual'] {
		--rank-core-1: rgba(56, 189, 248, 0);
		--rank-core-2: rgba(56, 189, 248, 0.95);
		--rank-core-3: rgba(56, 189, 248, 0);
		--rank-bloom-1: rgba(34, 211, 238, 0.14);
		--rank-bloom-2: rgba(59, 130, 246, 0.34);
		--rank-shadow-1: rgba(56, 189, 248, 0.75);
		--rank-shadow-2: rgba(59, 130, 246, 0.45);
		--rank-shadow-3: rgba(34, 211, 238, 0.25);
		--rank-title-glow-1: rgba(56, 189, 248, 0.6);
		--rank-title-glow-2: rgba(59, 130, 246, 0.35);
		--rank-title-color: #d9fbff;
	}

	.rank-beam {
		position: absolute;
		z-index: 10;
		left: 50%;
		top: 50%;
		height: 1px;
		width: var(--card-w);
		transform: translate(-50%, -50%) scaleX(0);
		transform-origin: 50% 50%;
		background: linear-gradient(
			90deg,
			var(--rank-core-0) 0%,
			var(--rank-core-1) 12%,
			var(--rank-core-2) 50%,
			var(--rank-core-3) 88%,
			var(--rank-core-0) 100%
		);
		box-shadow:
			0 0 12px var(--rank-shadow-1),
			0 0 28px var(--rank-shadow-2),
			0 0 60px var(--rank-shadow-3);
		filter: saturate(1.2);
		animation:
			beam-grow 2000ms cubic-bezier(0.15, 0.8, 0.2, 1) forwards,
			beam-fade 900ms 700ms ease-out forwards,
			beam-pulse 1200ms 700ms ease-in-out 2;
	}
	.rank-beam::before {
		content: '';
		position: absolute;
		inset: -14px 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			var(--rank-bloom-1) 20%,
			var(--rank-bloom-2) 50%,
			var(--rank-bloom-1) 80%,
			transparent 100%
		);
		filter: blur(12px);
		opacity: 0;
		animation: bloom-in 600ms 200ms ease-out forwards;
	}

	.rank-beam.to-card {
		animation: none;
		transform: translate(-50%, -50%);
		height: var(--card-h);
		width: var(--card-w);
		background: transparent;
		box-shadow:
			0 0 8px rgba(0, 0, 0, 0.25),
			0 10px 30px rgba(0, 0, 0, 0.45);
		transition:
			width var(--morph-ms) cubic-bezier(0.2, 0.8, 0.2, 1),
			height var(--morph-ms) cubic-bezier(0.2, 0.8, 0.2, 1),
			border-radius var(--morph-ms) cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 400ms ease;
	}
	.rank-beam.to-card::before {
		content: none;
		opacity: 0;
	}

	.rank-beam.to-card::after {
		content: '';
		position: absolute;
		inset: 0;
		padding: 1px;
		border-radius: inherit;
		background: linear-gradient(
			90deg,
			var(--rank-core-1) 0%,
			var(--rank-core-2) 50%,
			var(--rank-core-1) 100%
		);
		-webkit-mask:
			linear-gradient(#000 0 0) content-box,
			linear-gradient(#000 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
	}

	.rank-title {
		position: absolute;
		z-index: 25;
		left: 50%;
		top: calc(50% - 36px); /* start near the center line */
		transform: translateX(-50%); /* no Y transform anymore */
		margin: 0;
		color: var(--rank-title-color);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'JetBrains Mono',
			monospace;
		font-size: 1.5rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-shadow:
			0 0 6px var(--rank-title-glow-1),
			0 0 18px var(--rank-title-glow-2);
		opacity: 0;
		animation: title-in 1200ms 420ms cubic-bezier(0.12, 0.7, 0.2, 1) forwards;
		/* animate TOP so it tracks the border smoothly during morph */
		transition: top var(--morph-ms) cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	/* When the beam morphs, snap the title to just above the card’s top border */
	.rank-title.at-border {
		/* 50% is the beam/card center line
     subtract half the card height to reach the top edge
     then subtract the desired gap above the border */
		top: calc(50% - (var(--card-h) / 2) - var(--title-gap));
	}

	/* ================ Card (centered) ================ */
	.beam-card-contents {
		position: absolute;
		z-index: 20;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: var(--card-w);
		height: var(--card-h);
		display: grid;
		place-items: center;
		padding: 0.75rem;
	}

	/* ================ Card theme bits ================ */
	article[data-kind] {
		--kind-border: rgba(186, 104, 255, 0.38);
		--kind-shadow: rgba(186, 104, 255, 0.18);
		--kind-from: rgba(186, 104, 255, 0.7);
		--kind-via: rgba(99, 102, 241, 0.6);
		--pill-border: var(--kind-border);
	}
	article[data-kind='delete'] {
		--kind-border: rgba(239, 68, 68, 0.42);
		--kind-shadow: rgba(239, 68, 68, 0.22);
		--kind-from: rgba(239, 68, 68, 0.75);
		--kind-via: rgba(248, 113, 113, 0.65);
		--pill-border: rgba(239, 68, 68, 0.6);
	}
	article[data-kind='visual'] {
		--kind-border: rgba(59, 130, 246, 0.42);
		--kind-shadow: rgba(59, 130, 246, 0.22);
		--kind-from: rgba(59, 130, 246, 0.75);
		--kind-via: rgba(56, 189, 248, 0.65);
		--pill-border: rgba(59, 130, 246, 0.6);
	}
	article[data-kind='undo'] {
		--kind-border: rgba(234, 179, 8, 0.48);
		--kind-shadow: rgba(234, 179, 8, 0.22);
		--kind-from: rgba(250, 204, 21, 0.85);
		--kind-via: rgba(253, 224, 71, 0.7);
		--pill-border: rgba(250, 204, 21, 0.7);
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.15rem 0.45rem;
		min-width: 1.6rem;
		border-radius: 0.375rem;
		border: 1px solid var(--pill-border);
		background: rgba(24, 24, 24, 0.9);
		box-shadow:
			inset 0 -1px 0 rgba(255, 255, 255, 0.06),
			0 2px 10px rgba(0, 0, 0, 0.35);
		color: #e7e7e7;
		font:
			500 12px/1.1 ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			Consolas,
			'Liberation Mono',
			'JetBrains Mono',
			monospace;
		letter-spacing: 0.02em;
		transition:
			transform 0.15s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}
	article[data-kind]:hover .kbd {
		transform: translateY(-1px);
	}

	/* ================ Keyframes ================ */
	@keyframes beam-grow {
		to {
			transform: translate(-50%, -50%) scaleX(1);
		}
	}
	@keyframes beam-fade {
		to {
			opacity: 0.35;
			box-shadow:
				0 0 8px var(--rank-shadow-1),
				0 0 20px var(--rank-shadow-2),
				0 0 36px var(--rank-shadow-3);
		}
	}
	@keyframes beam-pulse {
		0%,
		100% {
			filter: brightness(1);
		}
		50% {
			filter: brightness(1.35);
		}
	}
	@keyframes bloom-in {
		to {
			opacity: 0.9;
		}
	}
	@keyframes title-in {
		to {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
	}
	@keyframes title-up {
		to {
			transform: translateY(-50px);
		}
	}

	/* ================ Reduced motion ================ */
	@media (prefers-reduced-motion: reduce) {
		.rank-beam,
		.rank-beam::before,
		.rank-beam.to-card,
		.split-beam,
		.beam-card-contents {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
