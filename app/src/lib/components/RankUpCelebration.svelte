<script lang="ts">
	import { scale, fade } from 'svelte/transition';
	import type { RankName } from '$lib/data/ranks';

	const props = $props<{
		rankName: RankName;
		displayLabel: string;
		onContinue: () => void;
	}>();

	const { rankName, displayLabel, onContinue } = props;
</script>

<div class="overlay" role="dialog" aria-modal="true" aria-label="Rank up celebration">
	<div class="content" in:fade={{ duration: 150 }}>
		<div class="title" in:scale={{ start: 0.7, duration: 200 }}>rank up</div>
		<div class="rank" in:scale={{ start: 0.9, duration: 220, delay: 80 }}>{rankName}</div>
		<div class="label" in:fade={{ duration: 220, delay: 140 }}>{displayLabel}</div>
		<button class="continue" type="button" onclick={onContinue}>
			continue
		</button>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(4px);
		z-index: 100;
	}

	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 3rem 4rem;
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: radial-gradient(circle at top, rgba(45, 45, 89, 0.7), rgba(10, 10, 18, 0.9));
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
		text-align: center;
	}

	.title {
		font-family: 'DM Mono', monospace;
		font-size: 0.75rem;
		letter-spacing: 0.45em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.6);
	}

	.rank {
		font-size: 3rem;
		font-weight: 600;
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.label {
		font-size: 1.25rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.continue {
		padding: 0.75rem 2.75rem;
		border-radius: 9999px;
		border: 1px solid rgba(255, 255, 255, 0.35);
		background: transparent;
		color: #ffffff;
		font-family: 'DM Mono', monospace;
		font-size: 0.65rem;
		letter-spacing: 0.35em;
		text-transform: uppercase;
		cursor: pointer;
		transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
	}

	.continue:hover,
	.continue:focus-visible {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.55);
		color: #f8f8ff;
		outline: none;
	}

	.continue:focus-visible {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
	}
</style>
