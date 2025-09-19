<!-- RectBorderTimer.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// 0..1 elapsed; 0 = full border, 1 = empty
	export let value = 0;

	// Look & geometry
	export let stroke = 2; // border thickness (px)
	export let padding = 0; // border inset from edge (px)
	export let radius = 8; // px, matches Tailwind rounded-lg ≈ 8
	export let color = 'rgba(226,232,240,0.75)'; // active border color
	export let track = 'rgba(226,232,240,0.18)'; // faint full border behind
	export let clockwise = true; // depletion direction

	let host: HTMLDivElement;
	let w = 1,
		h = 1;
	let ro: ResizeObserver | null = null;

	onMount(() => {
		ro = new ResizeObserver(([e]) => {
			const r = e.contentRect;
			w = Math.max(1, r.width);
			h = Math.max(1, r.height);
		});
		ro.observe(host);
	});
	onDestroy(() => ro?.disconnect());

	// Inner rect the stroke sits on (centered on stroke)
	$: inset = padding + stroke / 2;
	$: iw = Math.max(0, w - inset * 2);
	$: ih = Math.max(0, h - inset * 2);
	$: r = Math.min(radius, iw / 2, ih / 2);

	// Path that starts at top center, then goes clockwise around a rounded-rect
	function pathTopCenterRoundedRect(x: number, y: number, w: number, h: number, r: number) {
		const cx = x + w / 2,
			top = y,
			right = x + w,
			bottom = y + h,
			left = x;
		const rt = r; // corner radius
		return [
			`M ${cx} ${top}`, // start at top-center
			`H ${right - rt}`,
			`A ${rt} ${rt} 0 0 1 ${right} ${top + rt}`,
			`V ${bottom - rt}`,
			`A ${rt} ${rt} 0 0 1 ${right - rt} ${bottom}`,
			`H ${left + rt}`,
			`A ${rt} ${rt} 0 0 1 ${left} ${bottom - rt}`,
			`V ${top + rt}`,
			`A ${rt} ${rt} 0 0 1 ${left + rt} ${top}`,
			`H ${cx}`,
			'Z'
		].join(' ');
	}

	$: d = pathTopCenterRoundedRect(inset, inset, iw, ih, r);

	// Normalize total path length to 1 so dash math is trivial
	$: pathLength = 1;

	// Remaining fraction (visible border length)
	$: rem = Math.max(0, Math.min(1, 1 - value));

	// Dash pattern: [visible, gap] starting at top-center
	// For CCW, mirror by offsetting the dash
	$: dasharray = `${rem} ${1 - rem}`;
	$: dashoffset = clockwise ? 0 : 1 - rem; // simple mirror
</script>

<div bind:this={host} class={`relative inline-flex items-center overflow-hidden rounded-lg `}>
	<slot />

	<!-- Track + active stroke exactly on the rounded-rect border -->
	<svg class="pointer-events-none absolute inset-0" width="100%" height="100%" aria-hidden="true">
		<!-- faint full track -->
		<path
			{d}
			fill="none"
			stroke={track}
			stroke-width={stroke}
			{pathLength}
			stroke-linecap="butt"
			shape-rendering="geometricPrecision"
		/>
		<!-- active shrinking border -->
		<path
			{d}
			fill="none"
			stroke={color}
			stroke-width={stroke}
			{pathLength}
			stroke-dasharray={dasharray}
			stroke-dashoffset={dashoffset}
			stroke-linecap="butt"
			shape-rendering="geometricPrecision"
			style="transition: stroke-dasharray 50ms linear, stroke-dashoffset 50ms linear"
		/>
	</svg>
</div>
