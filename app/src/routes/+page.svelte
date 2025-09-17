<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import MatchResults from '$lib/components/MatchResults.svelte';
	import { createMatchController } from '$lib/match/match';

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
	<div class="fixed left-8 top-6 z-50">
		<div
			class="flex cursor-pointer items-center gap-2 max-[740px]:hidden"
			on:mouseenter={handleHeaderMouseEnter}
			on:mouseleave={handleHeaderMouseLeave}
			on:click={handleHeaderClick}
		>
			<span
				class="text-2xl font-normal text-purple-400"
				style=" font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);"
			>
				{`>`}
			</span>
			<span
				class="text-xl font-medium"
				style="color:#E4E4E4; font-family: 'DM Mono', sans-serif; font-weight: 500;"
			>
				vimgod
			</span>
			<span
				class="text-xl font-medium"
				style={`color:#E4E4E4; font-family: 'DM Mono', sans-serif; font-weight: 500; transform: translateX(-8px); animation: ${isHeaderHovered ? 'blink 1s infinite' : 'none'};`}
			>
				_
			</span>
		</div>
	</div>
	{#if $match.status !== 'complete'}
		<div class="rounded-xl border border-white/20">
			<Editor {match} />
		</div>
	{:else}
		<MatchResults {match} />
	{/if}
	<Footer />
</main>
