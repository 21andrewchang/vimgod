<script lang="ts">
	import Editor from '$lib/components/Editor.svelte';
</script>

<svelte:head>
	<title>vimgod</title>
	<meta name="description" content="vimgod - ranked vim. gg." />
</svelte:head>

<main>
	<div class="flex flex-col p-10">
		<div class="text-4xl text-white">VIM GOD AHAHA</div>
		<div class="mt-6 h-full w-full rounded-xl border border-white/20">
			<Editor />
		</div>
	</div>
</main>
