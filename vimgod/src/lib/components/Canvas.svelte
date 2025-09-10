<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let raf = 0;
	let ro: ResizeObserver;

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 3);
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.round(rect.width * dpr);
		canvas.height = Math.round(rect.height * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function draw(time: number) {
		// Clear in logical pixels
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// --- demo: tiny caret blink line ---
		const on = Math.floor(time / 500) % 2 === 0;
		if (on) {
			ctx.beginPath();
			ctx.moveTo(20, 20);
			ctx.lineTo(20, 40);
			ctx.stroke();
			ctx.strokeStyle = '#dddddd'; // any CSS color
		}

		raf = requestAnimationFrame(draw);
	}

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		ctx.lineWidth = 20;

		ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();

		raf = requestAnimationFrame(draw);

		return () => {
			ro?.disconnect();
		};
	});

	onDestroy(() => {
		ro?.disconnect();
	});
</script>

<canvas bind:this={canvas} style="display:block; width:100%; height:100%;"></canvas>
