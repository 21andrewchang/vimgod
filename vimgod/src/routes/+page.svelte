<script lang="ts">
	import Canvas from '$lib/components/Canvas.svelte';
</script>

<svelte:head>
	<title>vimgod</title>
	<meta name="description" content="vimgod - ranked vim. gg." />
</svelte:head>

<main>
	<div class="flex flex-col p-10">
		<div class="text-4xl text-white">VIM GOD AHAHA</div>
		<div class="mt-6 w-full rounded-xl border border-white/20 p-6">
			<Canvas />
		</div>
	</div>
</main>
