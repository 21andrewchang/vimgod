<!-- PieCountdown.svelte -->
<script lang="ts">
	export let value = 0; // 0..1 (elapsed fraction). 0 = full, 1 = empty
	export let size = 96; // px
	export let stroke = 8; // border width (px)
	export let fill = 'rgb(232, 232, 232, 0.2)'; // pie color
	export let border = 'rgb(232, 232, 232, 0.5)'; // pie color
	export let startAt = -Math.PI / 2; // start angle (12 o’clock)
	export let clockwise = true; // direction of depletion

	const r = (size - stroke) / 2;
	const TAU = Math.PI * 2;

	const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

	function pt(theta: number) {
		const cx = size / 2,
			cy = size / 2;
		return `${cx + r * Math.cos(theta)} ${cy + r * Math.sin(theta)}`;
	}

	// Returns:
	// - ''   for empty (no fill)
	// - null for full (use <circle> fill)
	// - 'M..' path for partial sector
	function sectorPath(fracElapsed: number) {
		const f = clamp01(1 - fracElapsed); // remaining fraction (1→0 over time)
		if (f <= 1e-5) return ''; // empty
		if (f >= 1 - 1e-5) return null; // full

		const sweepDir = clockwise ? 1 : 0; // SVG arc sweep flag
		const end = startAt + (clockwise ? 1 : -1) * f * TAU;
		const large = f > 0.5 ? 1 : 0;

		const startP = pt(startAt);
		const endP = pt(end);
		return `M ${size / 2} ${size / 2} L ${startP} A ${r} ${r} 0 ${large} ${sweepDir} ${endP} Z`;
	}

	$: d = sectorPath(value);
</script>

<svg
	width={size}
	height={size}
	viewBox={`0 0 ${size} ${size}`}
	aria-hidden="true"
	style="display:block"
>
	{#if d === null}
		<circle cx={size / 2} cy={size / 2} {r} {fill} />
	{:else if d}
		<path {d} {fill} />
	{/if}

	<!-- solid border (always constant) -->
	<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={border} stroke-width={stroke} />
</svg>
