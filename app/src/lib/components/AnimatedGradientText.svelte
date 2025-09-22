<script lang="ts">
	import { cn } from '$lib/utils';

	let className: any = '';
	export { className as class };
	let colorClass: string = '';
</script>

<button
	class={cn(
		'group relative mx-auto flex flex-row items-center justify-center rounded-xl backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%]  dark:bg-black/40',
		className
	)}
>
	<div
		class={cn(
			'animate-gradient absolute inset-0 block h-full w-full bg-gradient-to-r from-[#ffaa40]/50 via-[#9c40ff]/50 to-[#ffaa40]/50 bg-[length:var(--bg-size)_100%] p-[1px] [border-radius:inherit] ![mask-composite:subtract] [mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]',
			colorClass
		)}
	/>

	<slot>Gradient</slot>
</button>

<style>
	:root {
		--bg-size: 200%;
	}
	@keyframes gradient {
		to {
			background-position: 200% center;
		}
	}
	/* Tailwind-like utility recreated locally */
	.animate-gradient {
		animation: gradient 8s linear infinite;
	}
</style>
