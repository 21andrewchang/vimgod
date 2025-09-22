<script lang="ts">
	import CardIcon from '$lib/components/CardIcon.svelte';
	import RankBadge from '$lib/components/RankBadge.svelte';
	import { lpForRating, rankIdFromRating, abbrevFromRankId, colorByRank } from '$lib/data/ranks';

	const {
		userName = 'Player',
		rank = 'Bronze',
		rankName = 'Bronze',
		level = 420,
		experience = 67,
		maxExperience = 100
	} = $props<{
		userName?: string;
		rank?: string;
		rankName?: string;
		level?: number;
		experience?: number;
		maxExperience?: number;
	}>();

	const progressPercentage = (experience / maxExperience) * 100;

	let cardElement: HTMLDivElement;
	let isHovered = $state(false);

	function handleMouseEnter() {
		isHovered = true;
	}
	function handleMouseLeave() {
		isHovered = false;
	}

	// --- Singularity starfield -------------------------------
	const isSingularity =
		(rankName ?? rank ?? '').toLowerCase() === 'singularity' ||
		(rank ?? '').toLowerCase() === 'singularity';

	const STAR_COUNT = 120; // density for the profile background
	const rand = (min: number, max: number) => Math.random() * (max - min) + min;

	// Precompute once; rendered only when isSingularity
	const stars = Array.from({ length: STAR_COUNT }, () => ({
		top: rand(-6, 106), // small bleed for natural clipping
		left: rand(-6, 106),
		delay: rand(0, 3.8),
		dur: rand(1.1, 3.6),
		// tiny chance of a slightly tinted pixel
		color:
			Math.random() < 0.12
				? 'rgba(201,224,253,0.95)' // #C9E0FD-ish
				: 'rgba(255,255,255,0.95)'
	}));
	// ---------------------------------------------------------
</script>

<div
	bind:this={cardElement}
	class="relative w-full border border-dashed border-zinc-400 transition-all duration-300 dark:border-zinc-700"
	style="background:#0a0a0a; position: relative;"
	role="presentation"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<!-- Solid border overlay that appears on hover -->
	<div
		class="pointer-events-none absolute inset-0 border-solid border-zinc-400 transition-opacity duration-300 dark:border-zinc-700"
		style="opacity: {isHovered ? 1 : 0}; margin: -1px; border-width: 1px;"
	/>

	<!-- Corner pins -->
	<CardIcon class="-left-2 -top-2" />
	<CardIcon class="-right-2 -top-2" />
	<CardIcon class="-bottom-2 -left-2" />
	<CardIcon class="-bottom-2 -right-2" />

	<!-- Singularity-only twinkling starfield (inside the card) -->
	{#if isSingularity}
		<div class="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
			{#each stars as s}
				<span
					class="animate-twinkle will-change-opacity absolute"
					style={`
						top:${s.top}%;
						left:${s.left}%;
						width:1px;height:1px;
						background:${s.color};
						opacity:0;
						animation-duration:${s.dur}s;
						animation-delay:${s.delay}s;
					`}
				/>
			{/each}
		</div>
	{/if}

	<!-- Content -->
	<div class="relative z-10 p-5">
		<!-- Top row: User Name (left) and Rank Badge (right) -->
		<div class="mb-3 flex items-start justify-between">
			<div
				class="text-lg font-medium"
				style="color:#e8e8e8; font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
			>
				{userName}
			</div>
			<RankBadge {rank} {rankName} />
		</div>

		<!-- Level Progress -->
		<div class="space-y-2">
			<div
				class="flex justify-between text-xs"
				style="color:#c9ced6; font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
			>
				<span>Level {level}</span>
				<span>{experience}/{maxExperience} XP</span>
			</div>

			<!-- Progress Bar -->
			<div class="h-2 w-full overflow-hidden rounded-full bg-zinc-800/60">
				<div
					class="xp-pearlescent shiny-glow bg-pearlescent h-2 rounded-full transition-all duration-300"
					style={`width: ${progressPercentage}%`}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	/* XP-specific tweaks so the shine fits a 2–6px bar */
	:global(.xp-pearlescent) {
		position: relative;
		isolation: isolate;
		box-shadow:
			0 0 4px hsla(220, 100%, 80%, 0.25),
			0 0 10px hsla(230, 100%, 78%, 0.18);
	}

	/* Subtle top gloss */
	:global(.xp-pearlescent)::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		mix-blend-mode: screen;
		background: linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.45) 0%,
			rgba(255, 255, 255, 0.12) 55%,
			rgba(255, 255, 255, 0) 100%
		);
	}

	/* Thin specular sweep */
	:global(.xp-pearlescent)::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		background: linear-gradient(
				115deg,
				rgba(255, 255, 255, 0) 46%,
				rgba(255, 255, 255, 0.75) 50%,
				rgba(255, 255, 255, 0) 54%
			)
			no-repeat;
		background-size: 220% 220%;
		opacity: 0.6;
	}

	@media (prefers-reduced-motion: no-preference) {
		:global(.xp-pearlescent)::after {
			animation: xpShine 3.2s linear infinite;
		}
		@keyframes xpShine {
			0% {
				background-position: -60% -60%;
			}
			100% {
				background-position: 160% 160%;
			}
		}
	}

	/* 1px star blink (opacity only to keep pixels crisp) */
	@keyframes twinkle {
		0% {
			opacity: 0;
		}
		45% {
			opacity: 0.4;
		}
		60% {
			opacity: 0.4;
		}
		100% {
			opacity: 0;
		}
	}
	.animate-twinkle {
		animation-name: twinkle;
		animation-timing-function: ease-in-out;
		animation-iteration-count: infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-twinkle {
			animation: none;
			opacity: 0.5;
		}
	}
</style>
