<script lang="ts">
	import { blur } from 'svelte/transition';

	const { visible, rank, closeRankup } = $props<{
		rank: string;
		closeRankup: () => void;
		visible: boolean;
	}>();

	const RANKS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;

	// start at bronze for the demo
	let idx = $state(0);
	const normalizeRank = (label: string) => label.toLowerCase().split(' ');
	const colorKey = $derived(normalizeRank(rank)[0]);
	console.log(colorKey);

	const currentRank = $derived(RANKS[idx]);
	const pretty = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

	function next() {
		if (idx < RANKS.length - 1) {
			idx += 1;
		} else {
			closeRankup();
		}
	}
	// --- Starburst config (perf-tuned) ---
	const STAR_COUNT = 120; // ↓ a bit for perf; bump if you need denser fields
	const MIN_DUR_MS = 700;
	const MAX_DUR_MS = 1600;
	const MIN_DELAY = 180;
	const MAX_DELAY = 520;
	const MAX_DIST_VW = 65;
	const MIN_SCALE = 0.9;
	const MAX_SCALE = 1.8;

	const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
		const theta = Math.random() * Math.PI * 2;
		const r = Math.pow(Math.random(), 0.5) * MAX_DIST_VW;
		const dx = r * Math.cos(theta) + (Math.random() * 2 - 1) * 2;
		const dy = r * Math.sin(theta) + (Math.random() * 2 - 1) * 2;
		return {
			id: i,
			dx,
			dy,
			scale: MIN_SCALE + (MAX_SCALE - MIN_SCALE) * Math.random(),
			delay: Math.floor(MIN_DELAY + (MAX_DELAY - MIN_DELAY) * Math.random()),
			dur: Math.floor(MIN_DUR_MS + (MAX_DUR_MS - MIN_DUR_MS) * Math.random())
		};
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
		onclick={closeRankup}
		transition:blur={{ duration: 200 }}
		data-rank={colorKey}
	>
		<div class="relative z-10 w-full max-w-md text-center">
			<div class="rank-beam" aria-hidden="true"></div>
			<div class="rank-title mb-16 font-mono uppercase tracking-widest">{pretty(rank)}</div>
		</div>

		{#if rank === 'Singularity'}
			<div class="singularity-stars" aria-hidden="true">
				{#each stars as s}
					<span
						class="star-wrap"
						style="--dx:{s.dx}vw; --dy:{s.dy}vh; --delay:{s.delay}ms; --dur:{s.dur}ms;"
					>
						<span
							class="star"
							style="
					--scale-end:{s.scale};
					--drift-x-end:{s.dx * 0.08}vw;  /* drift ~8% farther along same vector */
					--drift-y-end:{s.dy * 0.08}vh;
				"
						/>
					</span>
				{/each}
			</div>
		{/if}

		<button
			in:blur={{ duration: 500, delay: 800 }}
			class="text-mono absolute bottom-20 z-10 px-10 pt-10 !text-xs tracking-widest text-neutral-700 transition hover:text-neutral-500"
			onclick={closeRankup}
		>
			CONTINUE
		</button>
	</div>
{/if}

<style>
	/* Respect reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.rank-beam,
		.rank-title {
			animation: none !important;
		}
	}

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
	}
	[data-rank='tutorial'] {
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(255, 255, 255, 0);
		--rank-core-2: rgba(255, 255, 255, 0.92);
		--rank-core-3: rgba(255, 255, 255, 0);
		--rank-bloom-1: rgba(255, 255, 255, 0.08);
		--rank-bloom-2: rgba(255, 255, 255, 0.25);
		--rank-shadow-1: rgba(255, 255, 255, 0.75);
		--rank-shadow-2: rgba(255, 255, 255, 0.45);
		--rank-shadow-3: rgba(255, 255, 255, 0.25);
		--rank-title-glow-1: rgba(255, 255, 255, 0.55);
		--rank-title-glow-2: rgba(255, 255, 255, 0.35);
		--rank-title-color: #fff;
	}
	[data-rank='bronze'] {
		--rank-core-1: rgba(205, 127, 50, 0);
		--rank-core-2: rgba(205, 127, 50, 0.95);
		--rank-core-3: rgba(205, 127, 50, 0);
		--rank-bloom-1: rgba(237, 178, 116, 0.1);
		--rank-bloom-2: rgba(237, 178, 116, 0.35);
		--rank-shadow-1: rgba(237, 178, 116, 0.7);
		--rank-shadow-2: rgba(237, 178, 116, 0.4);
		--rank-shadow-3: rgba(237, 178, 116, 0.22);
		--rank-title-glow-1: rgba(237, 178, 116, 0.55);
		--rank-title-glow-2: rgba(237, 178, 116, 0.3);
		--rank-title-color: #ffe9d3;
	}
	[data-rank='silver'] {
		--rank-core-1: rgba(192, 192, 192, 0);
		--rank-core-2: rgba(210, 220, 230, 0.95);
		--rank-core-3: rgba(192, 192, 192, 0);
		--rank-bloom-1: rgba(200, 210, 220, 0.12);
		--rank-bloom-2: rgba(200, 220, 240, 0.32);
		--rank-shadow-1: rgba(208, 220, 232, 0.7);
		--rank-shadow-2: rgba(208, 220, 232, 0.4);
		--rank-shadow-3: rgba(208, 220, 232, 0.2);
		--rank-title-glow-1: rgba(208, 220, 232, 0.55);
		--rank-title-glow-2: rgba(208, 220, 232, 0.3);
		--rank-title-color: #f4f7fa;
	}
	[data-rank='gold'] {
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
	[data-rank='platinum'] {
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
	}
	[data-rank='diamond'] {
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
	[data-rank='nova'] {
		/* Core beam: red (12%) → luminous center (50%) → purple (88%) */
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(255, 48, 64, 0.85); /* red band */
		--rank-core-2: rgba(255, 48, 64, 0.95); /* near-white with a faint violet tint */
		--rank-core-3: rgba(255, 48, 64, 0.85); /* purple band */

		/* Bloom halo: balanced red/purple */
		--rank-bloom-1: rgba(255, 48, 64, 0.16); /* red inner bloom */
		--rank-bloom-2: rgba(255, 48, 64, 0.28); /* purple outer bloom */

		/* Beam shadows (near → far falloff) */
		--rank-shadow-1: rgba(255, 48, 64, 0.72); /* hot red core glow */
		--rank-shadow-2: rgba(255, 48, 64, 0.55); /* accretion purple */
		--rank-shadow-3: rgba(201, 224, 253, 0.18); /* cool distant haze to keep depth */

		/* Title glow + color */
		--rank-title-glow-1: rgba(255, 48, 64, 0.55); /* purple inner glow */
		--rank-title-glow-2: rgba(255, 48, 64, 0.35); /* red outer haze */
		--rank-title-color: #f9f5ff; /* icy, readable white */
	}
	[data-rank='supernova'] {
		/* Core beam */
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(255, 170, 64, 0.9); /* #FFAA40 (left) */
		--rank-core-2: rgba(255, 246, 236, 0.98); /* white-hot center (warm) */
		--rank-core-3: rgba(156, 64, 255, 0.9); /* #9C40FF (right) */

		/* Bloom halo */
		--rank-bloom-1: rgba(255, 170, 64, 0.18); /* warm inner bloom */
		--rank-bloom-2: rgba(156, 64, 255, 0.3); /* violet outer bloom */

		/* Beam shadows (near → far falloff) */
		--rank-shadow-1: rgba(255, 170, 64, 0.75); /* hot orange core glow */
		--rank-shadow-2: rgba(156, 64, 255, 0.55); /* energetic violet */
		--rank-shadow-3: rgba(255, 204, 128, 0.25); /* warm haze for depth */

		/* Title glow + color */
		--rank-title-glow-1: rgba(255, 170, 64, 0.58); /* warm inner rim */
		--rank-title-glow-2: rgba(156, 64, 255, 0.36); /* cool outer halo */
		--rank-title-color: #fff6ea; /* warm, readable white */
	}

	[data-rank='singularity'] {
		/* Core beam: red (12%) → luminous center (50%) → purple (88%) */
		--rank-core-0: rgba(0, 0, 0, 0);
		--rank-core-1: rgba(255, 48, 64, 0.85); /* red band */
		--rank-core-2: rgba(250, 236, 255, 0.95); /* near-white with a faint violet tint */
		--rank-core-3: rgba(157, 78, 221, 0.85); /* purple band */

		/* Bloom halo: balanced red/purple */
		--rank-bloom-1: rgba(255, 48, 64, 0.16); /* red inner bloom */
		--rank-bloom-2: rgba(157, 78, 221, 0.28); /* purple outer bloom */

		/* Beam shadows (near → far falloff) */
		--rank-shadow-1: rgba(255, 48, 64, 0.72); /* hot red core glow */
		--rank-shadow-2: rgba(157, 78, 221, 0.55); /* accretion purple */
		--rank-shadow-3: rgba(201, 224, 253, 0.18); /* cool distant haze to keep depth */

		/* Title glow + color */
		--rank-title-glow-1: rgba(157, 78, 221, 0.55); /* purple inner glow */
		--rank-title-glow-2: rgba(255, 48, 64, 0.35); /* red outer haze */
		--rank-title-color: #f9f5ff; /* icy, readable white */
	}

	/* Beam line */
	.rank-beam {
		position: absolute;
		left: 50%;
		top: 50%;
		height: 1px;
		width: min(30vw, 900px);
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

	/* Extra bloom around the beam */
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

	/* Title pop + subtle glow */
	.rank-title {
		position: relative;
		margin-top: 0.5rem;
		/* font-family: */
		/* 	ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', */
		/* 	monospace; */
		font-size: clamp(2rem, 3.2vw, 2.25rem);
		color: var(--rank-title-color);
		text-shadow:
			0 0 6px var(--rank-title-glow-1),
			0 0 18px var(--rank-title-glow-2);
		opacity: 0;
		transform: translateY(6px) scale(0.98);
		animation:
			title-in 2000ms 520ms cubic-bezier(0.12, 0.7, 0.2, 1) forwards,
			title-glow 1400ms 900ms ease-in-out 2;
	}

	/* Keyframes (unchanged) */
	@keyframes beam-grow {
		to {
			transform: translate(-50%, -50%) scaleX(1);
		}
	}
	@keyframes beam-fade {
		to {
			opacity: 0.35;
			box-shadow:
				0 0 8px rgba(147, 197, 253, 0.55),
				0 0 20px rgba(147, 197, 253, 0.28),
				0 0 36px rgba(147, 197, 253, 0.15);
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
			transform: translateY(0) scale(1);
		}
	}
	@keyframes title-glow {
		0%,
		100% {
			text-shadow:
				0 0 6px var(--rank-title-glow-1),
				0 0 14px var(--rank-title-glow-2);
		}
		50% {
			text-shadow:
				0 0 10px var(--rank-title-glow-1),
				0 0 26px var(--rank-title-glow-2);
		}
	}
	@property --popScale {
		syntax: '<number>';
		inherits: false;
		initial-value: 0.2;
	}
	@property --driftX {
		syntax: '<length-percentage>';
		inherits: false;
		initial-value: 0vw;
	}
	@property --driftY {
		syntax: '<length-percentage>';
		inherits: false;
		initial-value: 0vh;
	}

	.singularity-stars {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 5;
		contain: layout paint size;
	}

	/* Wrapper: one-time ballistic flight to (dx,dy) */
	.star-wrap {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate3d(-50%, -50%, 0);
		will-change: transform;
		animation: star-fly-wrap var(--dur) cubic-bezier(0.18, 0.68, 0.12, 1) var(--delay) forwards;
	}
	@keyframes star-fly-wrap {
		0% {
			transform: translate3d(-50%, -50%, 0);
		}
		100% {
			transform: translate3d(calc(-50% + var(--dx)), calc(-50% + var(--dy)), 0);
		}
	}

	/* Inner star: white + ice-blue glow, variable-driven scale + drift + twinkle */
	.star {
		display: block;
		width: 2px;
		height: 2px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 8px rgba(173, 216, 255, 0.55);
		opacity: 0;
		will-change: opacity, box-shadow, transform;

		/* Compose transforms via variables: scale comes from --popScale, position from --driftX/Y */
		transform: translate3d(var(--driftX), var(--driftY), 0) scale(var(--popScale));

		/* 1) pop in (opacity + --popScale only)
	   2) ultra-slow forward drift along original vector (variables only)
	   3) infinite twinkle */
		animation:
			star-pop 900ms ease calc(var(--delay) + var(--dur) * 0.12) forwards,
			star-drift 300000ms linear calc(var(--delay) + var(--dur)) infinite,
			/* 5 min per cycle */ star-twinkle 2400ms ease-in-out calc(var(--delay) + var(--dur)) infinite;
	}

	/* Pop: do NOT animate transform directly */
	@keyframes star-pop {
		0% {
			opacity: 0;
			--popScale: 0.2;
		}
		40% {
			opacity: 1;
			--popScale: 1;
		}
		100% {
			opacity: 0.46;
			--popScale: 1.06;
		}
	}

	/* Forward drift forever: tiny nudge per cycle; loop reset is negligible */
	@keyframes star-drift {
		0% {
			--driftX: 0vw;
			--driftY: 0vh;
		}
		100% {
			--driftX: var(--drift-x-end);
			--driftY: var(--drift-y-end);
		}
	}

	/* Gentle endless twinkle (cheap) */
	@keyframes star-twinkle {
		0% {
			opacity: 0.5;
			box-shadow: 0 0 7px rgba(173, 216, 255, 0.48);
		}
		50% {
			opacity: 0.7;
			box-shadow: 0 0 9px rgba(198, 232, 255, 0.6);
		}
		100% {
			opacity: 0.3;
			box-shadow: 0 0 7px rgba(173, 216, 255, 0.48);
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.star-wrap {
			animation: none;
			transform: translate3d(calc(-50% + var(--dx)), calc(-50% + var(--dy)), 0);
		}
		.star {
			animation: none;
			opacity: 0.45;
			--popScale: 1;
			--driftX: 0;
			--driftY: 0;
		}
	}
</style>
