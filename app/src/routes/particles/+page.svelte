<script lang="ts">
	import Particles from '$lib/components/Particles.svelte';
	import MatchResults from '$lib/components/MatchResults.svelte';
	import { createMatchController } from '$lib/match/match';
	import '$lib/stores/auth'; // Initialize auth store

	const match = createMatchController({ totalRounds: 20 });
	let isHeaderHovered = false;

	const handleHeaderMouseEnter = () => {
		isHeaderHovered = true;
	};

	const handleHeaderMouseLeave = () => {
		isHeaderHovered = false;
	};

	const handleHeaderClick = () => {
		if (typeof window !== 'undefined') {
			window.location.href = '/';
		}
	};
</script>

<svelte:head>
	<title>vimgod</title>
	<meta name="description" content="vimgod - ranked vim. gg." />
	<style>
		html,
		body {
			height: 100%;
			overflow: hidden;
		} /* no scroll anywhere */
	</style>
</svelte:head>

<main
	class="relative flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-6 bg-black py-8"
>
	{#if $match.status !== 'complete'}
		<div class="rounded-xl border border-white/20">
			<Particles {match} />
		</div>
	{:else}
		<MatchResults {match} />
	{/if}
</main>

<style>
	::selection {
		background: transparent;
	}
</style>
