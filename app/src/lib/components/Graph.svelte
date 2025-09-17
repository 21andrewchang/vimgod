<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Data (one sample per round/second/etc.)
	export let samples: { x: number; y: number; err?: number }[] = []; // primary metric
	export let target: { x: number; y: number }[] | null = null; // dashed guide

	// Layout & style
	export let height = 200; // px
	export let yMin: number | null = null; // primary axis range
	export let yMax: number | null = null;
	export let eMax: number | null = null; // right axis (errors)
	export let gridH = 5; // horizontal grid lines
	export let color = 'rgb(194, 123, 255)'; // main line
	export let colorTarget = 'rgb(194, 123, 255, 0.5)'; // dashed target
	export let bgGrid = 'rgba(148,163,184,0.18)';
	export let area = 0.12; // fill under main (0 disables)
	export let pointRadiusPx = 2.0; // marker radius in CSS pixels
	export let tension = 0.5; // Catmull-Rom tension (0..1)

	// Responsive marker sizing (avoid oval dots with preserveAspectRatio="none")
	let svgEl: SVGSVGElement;
	let viewportW = 1;
	let ro: ResizeObserver;
	onMount(() => {
		ro = new ResizeObserver(([e]) => (viewportW = e?.contentRect?.width || 1));
		ro.observe(svgEl);
	});
	onDestroy(() => ro?.disconnect());

	// Derived domains
	$: N = samples.length;
	$: xMax = Math.max(1, N - 1); // viewBox width in user units
	$: pad = { t: 0, b: 0, l: 6, r: 6 };
	$: plotH = 100 - pad.t - pad.b;

	// Y scales
	$: yVals = samples.map((d) => d.y).concat(target ? target.map((t) => t.y) : []);
	$: y0 = yMin ?? Math.min(0, ...yVals, 0);
	$: y1 = yMax ?? Math.max(1, ...yVals, 1);
	const sy = (v: number) => {
		if (y1 === y0) return pad.t + plotH / 2;
		const t = (v - y0) / (y1 - y0);
		return pad.t + (1 - t) * plotH;
	};

	// Right-axis (errors)
	$: eVals = samples.map((d) => d.err ?? 0);
	$: e1 = eMax ?? Math.max(1, ...eVals, 1);
	const syErr = (v: number) => {
		if (e1 <= 0) return pad.t + plotH;
		const t = v / e1;
		return pad.t + (1 - t) * plotH;
	};

	// Project to SVG coords
	$: P = samples.map((d, i) => ({ x: i, y: sy(d.y), err: d.err ?? 0 }));
	$: T = target ? target.map((d) => ({ x: d.x, y: sy(d.y) })) : null;

	// Smooth line (Catmull-Rom → cubic)
	function smoothPath(pts: { x: number; y: number }[]) {
		if (!pts.length) return '';
		if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
		const a = tension;
		let d = `M ${pts[0].x} ${pts[0].y}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[i - 1] ?? pts[i];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[i + 2] ?? p2;
			const t1x = (p2.x - p0.x) * a,
				t1y = (p2.y - p0.y) * a;
			const t2x = (p3.x - p1.x) * a,
				t2y = (p3.y - p1.y) * a;
			d += ` C ${p1.x + t1x / 3} ${p1.y + t1y / 3} ${p2.x - t2x / 3} ${p2.y - t2y / 3} ${p2.x} ${p2.y}`;
		}
		return d;
	}
	$: dMain = smoothPath(P);
	$: dTarget = T ? smoothPath(T) : '';
	$: dArea = dMain ? `${dMain} L ${xMax} ${pad.t + plotH} L 0 ${pad.t + plotH} Z` : '';

	// Grid
	$: hTicks = Array.from({ length: gridH + 1 }, (_, i) => pad.t + (plotH * i) / gridH);
	$: vTicks = Array.from({ length: xMax + 1 }, (_, i) => i);

	// Compensated ellipse radii so markers stay circular on stretched SVG
	$: rx = (pointRadiusPx * xMax) / (viewportW || 1); // because sx = viewportW / xMax
	$: ry = (pointRadiusPx * 100) / height; // because sy = height / 100
</script>

<svg
	bind:this={svgEl}
	viewBox={`0 0 ${xMax} 100`}
	preserveAspectRatio="none"
	class="w-full"
	style={`height:${height}px; display:block;`}
	shape-rendering="geometricPrecision"
>
	<!-- grid -->
	{#each hTicks as y}
		<line
			x1="0"
			x2={xMax}
			y1={y}
			y2={y}
			stroke={bgGrid}
			stroke-width="1"
			opacity="0.5"
			vector-effect="non-scaling-stroke"
		/>
	{/each}
	{#each vTicks as x}
		<line
			x1={x}
			x2={x}
			y1={pad.t}
			y2={pad.t + plotH}
			stroke={bgGrid}
			stroke-width="1"
			opacity="0.5"
			vector-effect="non-scaling-stroke"
		/>
	{/each}

	<!-- dashed target -->
	{#if dTarget}
		<path
			d={dTarget}
			fill="none"
			stroke={colorTarget}
			stroke-width="2"
			stroke-dasharray="6 6"
			opacity="0.6"
			vector-effect="non-scaling-stroke"
		/>
	{/if}

	<!-- area under main -->
	{#if area > 0 && dArea}
		<path d={dArea} fill={color} opacity={area} />
	{/if}

	<!-- main smooth line -->
	{#if dMain}
		<path
			d={dMain}
			fill="none"
			stroke={color}
			stroke-width="2"
			vector-effect="non-scaling-stroke"
		/>
	{/if}
</svg>
