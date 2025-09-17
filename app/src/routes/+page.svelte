<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import MatchResults from '$lib/components/MatchResults.svelte';
	import { createMatchController } from '$lib/match/match';

	const cap = `inline-flex h-5 w-5 items-center justify-center rounded-sm bg-neutral-800 border border-[#313131]
       font-mono text-[10px] leading-none text-neutral-500
       shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]`;

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
			class="flex cursor-pointer items-center gap-2"
			on:mouseenter={handleHeaderMouseEnter}
			on:mouseleave={handleHeaderMouseLeave}
			on:click={handleHeaderClick}
		>
			<span
				class="text-4xl font-normal"
				style="color:#bc93f9; font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);"
			>
				{`>`}
			</span>
			<span
				class="text-3xl font-medium"
				style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500;"
			>
				vimgod
			</span>
			<span
				class="text-3xl font-medium"
				style={`color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500; transform: translateX(-8px); animation: ${isHeaderHovered ? 'blink 1s infinite' : 'none'};`}
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
