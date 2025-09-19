<script lang="ts" context="module">
	let nextGraphId = 0;
	export const createGraphInstanceId = () => {
		nextGraphId += 1;
		return `graph-${nextGraphId}`;
	};
</script>

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
	export let gridH = 4; // horizontal grid lines
	export let color = 'rgb(160, 160, 160)'; // main line
	export let colorTarget = 'rgba(244,63,94,0.3)'; // dashed target
	export let bgGrid = 'rgba(148,163,184,0.18)';
	export let area = 0.12; // fill under main (0 disables)
	export let tension = 0.5; // Catmull-Rom tension (0..1)
	const formatYTick = (ms: number) => {
		const s = ms / 1000;
		if (s >= 10) return `${Math.round(s)}s`; // 10s, 11s, ...
		if (s >= 1) return `${s.toFixed(1)}s`; // 1.2s, 3.7s, ...
		return `${s.toFixed(0)}s`; // 0.25s, 0.95s
	};
	const axisPadLeft = 0;
	const axisPadRight = 0;

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
	$: xMax = Math.max(1, N - 1); // span of data in user units
	$: pad = { t: 4, b: 12, l: 6, r: 6 };
	$: plotH = 100 - pad.t - pad.b;
	$: viewWidth = xMax + axisPadLeft + axisPadRight;
	const viewMinX = -axisPadLeft;

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
	$: P = samples.map((d, i) => ({ x: axisPadLeft + i, y: sy(d.y), err: d.err ?? 0 }));
	$: T = target ? target.map((d) => ({ x: axisPadLeft + d.x, y: sy(d.y) })) : null;

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
	$: dArea = dMain
		? `${dMain} L ${axisPadLeft + xMax} ${pad.t + plotH} L ${axisPadLeft} ${pad.t + plotH} Z`
		: '';

	// Grid
	$: segments = Math.max(1, gridH);
	$: hTicks = Array.from({ length: segments + 1 }, (_, i) => {
		const y = pad.t + (plotH * i) / segments;
		return {
			y,
			value: y0 + ((segments - i) * (y1 - y0)) / segments,
			percent: y / 100
		};
	});
	$: vTicks = Array.from({ length: N }, (_, i) => {
		const svgX = axisPadLeft + i;
		return {
			x: i,
			svgX,
			label: i + 1,
			percent: viewWidth ? svgX / viewWidth : 0
		};
	});
	$: axisXPercent = viewWidth ? axisPadLeft / viewWidth : 0;
	$: xAxisTitlePercent = viewWidth ? (axisPadLeft + xMax + axisPadRight / 2) / viewWidth : 1;
	$: plotTopPercent = pad.t / 100;
	$: plotBottomPercent = (pad.t + plotH) / 100;
	$: cutoffY = target && target.length ? sy(target[0].y) : null;
	$: cutoffHeight = cutoffY !== null ? Math.max(0, Math.min(pad.t + plotH, cutoffY) - pad.t) : null;
	$: clipWidth = Math.max(0.0001, xMax);
</script>

<div class="relative w-full" style={`height:${height}px;`}>
	<svg
		bind:this={svgEl}
		viewBox={`${viewMinX} 0 ${viewWidth} 100`}
		preserveAspectRatio="none"
		class="h-full w-full"
		shape-rendering="geometricPrecision"
	>
		<!-- grid -->
		{#each hTicks as tick}
			<line
				x1={axisPadLeft}
				x2={axisPadLeft + xMax}
				y1={tick.y}
				y2={tick.y}
				stroke={bgGrid}
				stroke-width="1"
				opacity="0.5"
				vector-effect="non-scaling-stroke"
			/>
		{/each}
		{#each vTicks as tick}
			<line
				x1={tick.svgX}
				x2={tick.svgX}
				y1={pad.t}
				y2={pad.t + plotH}
				stroke={bgGrid}
				stroke-width="1"
				opacity="0.5"
				vector-effect="non-scaling-stroke"
			/>
		{/each}

		{#if cutoffHeight !== null && cutoffHeight > 0}
			<rect
				x={axisPadLeft}
				y={pad.t}
				width={clipWidth}
				height={cutoffHeight}
				fill="rgba(244,63,94,0.1)"
			/>
		{/if}

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
				stroke-width="1"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
	</svg>
	<div class="pointer-events-none absolute inset-0">
		{#each hTicks as tick}
			<div
				class="absolute font-mono text-[10px] text-neutral-600"
				style={`top:${tick.percent * 100}%; left:${axisXPercent * 100}%; transform: translate(-115%, -50%); `}
			>
				{formatYTick(tick.value)}
			</div>
		{/each}
		{#each vTicks as tick}
			<div
				class="absolute font-mono text-[10px] text-neutral-600"
				style={`top:${plotBottomPercent * 100}%; left:${tick.percent * 100}%; transform: translate(-50%, 6px); `}
			>
				{tick.label}
			</div>
		{/each}
	</div>
</div>
