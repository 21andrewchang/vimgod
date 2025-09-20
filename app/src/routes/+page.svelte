<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Editor from '$lib/components/Editor.svelte';
	import MatchResults from '$lib/components/MatchResults.svelte';
	import Header from '$lib/components/Header.svelte';
	import { createMatchController } from '$lib/match/match';
	import { getContext, onDestroy } from 'svelte';
	import '$lib/stores/auth'; // Initialize auth store

	const match = createMatchController({ totalRounds: 20 });

	type ReloadGuardContext = {
		enable: () => void;
		disable: () => void;
	};

	const reloadGuard = getContext<ReloadGuardContext | undefined>('reload-guard');

const shouldProtectStatuses = new Set(['ready', 'running']);

$: if (reloadGuard) {
	const status = $match.status;
	if (shouldProtectStatuses.has(status)) {
		reloadGuard.enable();
	} else {
		reloadGuard.disable();
	}
}

	onDestroy(() => {
		reloadGuard?.disable();
	});
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
	<Header variant="fixed" size="small" />
	{#if $match.status !== 'complete'}
		<div class="rounded-xl border border-white/20">
			<Editor {match} />
		</div>
	{:else}
		<MatchResults {match} />
	{/if}
	<Footer />
</main>

<style>
	::selection {
		background: transparent;
	}
</style>
