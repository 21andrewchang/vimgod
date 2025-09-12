<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
	import Shell from '$lib/components/Shell.svelte';
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

<main class="grid h-[100dvh] w-[100dvw] place-items-center bg-black">
	<!-- Outer frame centered on screen -->
	<div class="mx-30 rounded-xl border border-white/20">
		<Shell />
	</div>
</main>
