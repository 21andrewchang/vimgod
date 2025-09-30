<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';

	const { fixed = true, minimal = false } = $props<{ fixed?: boolean; minimal?: boolean }>();

	// Keycap style
	const cap =
		'inline-flex h-5 w-5 items-center justify-center rounded-sm bg-neutral-800 border border-[#313131] ' +
		'font-mono text-[10px] leading-none text-neutral-500 ' +
		'shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] ';

	const links = [
		{
			name: 'tutorial',
			url: '/tutorial',
			icon: ''
		},
		{
			name: 'contact',
			url: 'mailto:founders@alice.co',
			icon: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'
		},
		{
			name: 'twitter',
			url: 'https://twitter.com/yourusername',
			icon: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z'
		}
	];

	// Refs
	let footerElement: HTMLElement;
	let twitterTextRef: HTMLDivElement;
	let twitterBubbleRef: HTMLDivElement | null = null;

	// Tooltip state
	let twitterTooltip = $state({ show: false, x: 0, y: 0, hiding: false });

	// Visual active state (white + underline)
	let twitterActive = $state(false);

	// Safe zone + grace
	const SAFE_MARGIN = 2; // px padding around the corridor
	const HIDE_DELAY = 0; // ms delay before closing

	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let lastPointer = { x: 0, y: 0 };

	// Open and position bubble on text hover
	function handleTwitterMouseEnter() {
		cancelHide();

		const textRect = twitterTextRef.getBoundingClientRect();
		const footerRect = footerElement.getBoundingClientRect();

		twitterTooltip = {
			show: true,
			hiding: false,
			x: textRect.left + textRect.width / 2 - footerRect.left,
			y: textRect.top - footerRect.top - 10
		};
	}

	function handleTwitterMouseLeave() {
		tryScheduleHide();
	}

	function handleTooltipMouseEnter() {
		cancelHide();
	}

	function handleTooltipMouseLeave() {
		tryScheduleHide();
	}

	function tryScheduleHide() {
		cancelHide();
		hideTimer = setTimeout(() => {
			// Only close if outside text, bubble, and corridor
			if (!isPointerInText() && !isPointerInBubble() && !isPointerInCorridor()) {
				startHideAnimation();
			}
		}, HIDE_DELAY);
	}

	function cancelHide() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	function startHideAnimation() {
		twitterTooltip.hiding = true;
		setTimeout(() => {
			twitterTooltip.show = false;
			twitterTooltip.hiding = false;
			twitterActive = false;
		}, 100); // match CSS animation
	}

	// Pointer tracking to maintain open state in text/bubble/corridor
	function onPointerMove(e: PointerEvent) {
		lastPointer = { x: e.clientX, y: e.clientY };

		const inText = isPointerInText();
		const inBubble = isPointerInBubble();
		const inCorridor = isPointerInCorridor();

		twitterActive = inText || inBubble || inCorridor;

		if (twitterTooltip.show && twitterActive) {
			cancelHide();
		} else if (twitterTooltip.show && !twitterActive) {
			tryScheduleHide();
		}
	}
	onMount(() => {
		if (!browser) return;
		const handler = (e: PointerEvent) => onPointerMove(e);
		document.addEventListener('pointermove', handler, { passive: true });
		return () => document.removeEventListener('pointermove', handler);
	});

	// Geometry helpers
	function getRect(el: Element | null) {
		return el ? el.getBoundingClientRect() : null;
	}
	function pointInRect(p: { x: number; y: number }, r: DOMRect | null) {
		return !!r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
	}
	function isPointerInText() {
		return pointInRect(lastPointer, getRect(twitterTextRef));
	}
	function isPointerInBubble() {
		return pointInRect(lastPointer, getRect(twitterBubbleRef));
	}

	// ---- Corridor-only safe zone (vertical gap between text & bubble) ----
	function getCorridorRect() {
		const a = getRect(twitterTextRef);
		const b = getRect(twitterBubbleRef);
		if (!a || !b) return null;

		// Identify which is above
		const topRect = a.top <= b.top ? a : b;
		const bottomRect = a.top <= b.top ? b : a;

		// Horizontal span across both; vertical span only in the gap between them
		const left = Math.min(a.left, b.left) - SAFE_MARGIN;
		const right = Math.max(a.right, b.right) + SAFE_MARGIN;
		const top = topRect.bottom - SAFE_MARGIN;
		const bottom = bottomRect.top + SAFE_MARGIN;

		// If they overlap vertically (no gap), fall back to a minimal padded band
		if (bottom <= top) {
			return {
				left,
				right,
				top: Math.min(a.top, b.top) - SAFE_MARGIN,
				bottom: Math.max(a.bottom, b.bottom) + SAFE_MARGIN
			};
		}
		return { left, right, top, bottom };
	}

	function isPointerInCorridor() {
		const c = getCorridorRect();
		if (!c) return false;

		const inBand =
			lastPointer.x >= c.left &&
			lastPointer.x <= c.right &&
			lastPointer.y >= c.top &&
			lastPointer.y <= c.bottom;

		// Exclude text/bubble themselves
		if (!inBand) return false;
		if (isPointerInText() || isPointerInBubble()) return false;

		return true;
	}

	// Twitter links for the tooltip
	const twitterLinks = [
		{ name: '@627B8D', url: 'https://twitter.com/627B8D' },
		{ name: '@nico_lu0', url: 'https://twitter.com/nico_lu0' }
	];
</script>

<footer
	bind:this={footerElement}
	class="{fixed ? 'fixed bottom-0 left-0 right-0 z-[2]' : 'relative z-10'} max-[740px]:hidden"
>
	<div class="mx-auto px-6 py-4">
		<div class="flex flex-col items-center justify-between gap-4 md:flex-row">
			<!-- Social Links -->
			<div class="flex items-center gap-6">
				{#each links as link}
					{#if link.name === 'twitter'}
						<div
							bind:this={twitterTextRef}
							class="animated-underline flex cursor-pointer items-center gap-2 font-mono text-xs transition-colors duration-200 {twitterActive
								? 'twitter-hovered'
								: ''}"
							style="color: {twitterActive ? 'white' : 'rgba(255, 255, 255, 0.4)'};"
							onmouseenter={handleTwitterMouseEnter}
							onmouseleave={handleTwitterMouseLeave}
							aria-haspopup="dialog"
							aria-expanded={twitterTooltip.show ? 'true' : 'false'}
							aria-controls="twitter-tooltip"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="transition-colors duration-200"
							>
								<path d={link.icon} />
							</svg>
							{link.name}
						</div>
					{:else if link.name === 'tutorial'}
						<a
							href={link.url}
							class="animated-underline flex items-center gap-2 font-mono text-xs transition-colors duration-200"
							style="color: rgba(255, 255, 255, 0.4);"
							onmouseenter={(e) => ((e.target as HTMLElement).style.color = 'white')}
							onmouseleave={(e) =>
								((e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)')}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="transition-colors duration-200"
								aria-hidden="true"
							>
								<circle cx="12" cy="12" r="10" fill="currentColor" />
								<path
									d="M12 6c-2.21 0-4 1.79-4 4h2c0-1.105.895-2 2-2s2 .895 2 2c0 .82-.41 1.24-1.24 1.74-.92.55-1.76 1.2-1.76 2.76V15h2v-.5c0-.78.35-1.12 1.12-1.6C15.27 12.94 16 11.97 16 10c0-2.21-1.79-4-4-4zm-1 10v2h2v-2h-2z"
									fill="#0f0f0f"
								/>
							</svg>
							{link.name}
						</a>
					{:else}
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="animated-underline flex items-center gap-2 font-mono text-xs transition-colors duration-200"
							style="color: rgba(255, 255, 255, 0.4);"
							onmouseenter={(e) => ((e.target as HTMLElement).style.color = 'white')}
							onmouseleave={(e) =>
								((e.target as HTMLElement).style.color = 'rgba(255, 255, 255, 0.4)')}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="transition-colors duration-200"
							>
								<path d={link.icon} />
							</svg>
							{link.name}
						</a>
					{/if}
				{/each}
			</div>

			<!-- Center shortcuts -->
			{#if !minimal}
				<div class="absolute bottom-16 left-1/2 -translate-x-1/2">
					<div class="flex items-center gap-16 text-[10px]">
						<div class="group flex gap-2">
							<kbd class={cap}>h</kbd><span style="color: rgba(255,255,255,0.4);">–</span>
							<span class="font-mono" style="color: rgba(255,255,255,0.4);">left</span>
						</div>
						<div class="group flex gap-2">
							<kbd class={cap}>j</kbd><span style="color: rgba(255,255,255,0.4);">–</span>
							<span class="font-mono" style="color: rgba(255,255,255,0.4);">down</span>
						</div>
						<div class="group flex gap-2">
							<kbd class={cap}>k</kbd><span style="color: rgba(255,255,255,0.4);">–</span>
							<span class="font-mono" style="color: rgba(255,255,255,0.4);">up</span>
						</div>
						<div class="group flex gap-2">
							<kbd class={cap}>l</kbd><span style="color: rgba(255,255,255,0.4);">–</span>
							<span class="font-mono" style="color: rgba(255,255,255,0.4);">right</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Copyright -->
			<div>
				<p class="font-mono text-xs" style="color: rgba(255, 255, 255, 0.4);">
					© 2025 vimgod. All rights reserved.
				</p>
			</div>
		</div>
	</div>

	<!-- Twitter Tooltip -->
	{#if twitterTooltip.show}
		<div
			id="twitter-tooltip"
			bind:this={twitterBubbleRef}
			class="twitter-bubble absolute z-[9999] rounded-md border border-neutral-700 bg-neutral-800 px-4 py-3 text-neutral-200 shadow-lg {twitterTooltip.hiding
				? 'hiding'
				: ''}"
			style="
				left: {twitterTooltip.x}px;
				top: {twitterTooltip.y}px;
				transform: translateX(-50%) translateY(-100%);
				font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;
				white-space: nowrap;
				min-width: 200px;
			"
			onmouseenter={handleTooltipMouseEnter}
			onmouseleave={handleTooltipMouseLeave}
		>
			<div class="flex items-center justify-center gap-4">
				{#each twitterLinks as twitterLink}
					<a
						href={twitterLink.url}
						target="_blank"
						rel="noopener noreferrer"
						class="text-xs !text-neutral-200 transition-colors duration-200 hover:text-white"
					>
						{twitterLink.name}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</footer>

<style>
	.animated-underline {
		position: relative;
	}
	.animated-underline::after {
		content: '';
		position: absolute;
		bottom: -2px;
		left: 0;
		width: 0;
		height: 1px;
		background-color: currentColor;
		transition: width 0.2s ease-out;
	}
	/* Remove default text underline and show animated underline */
	.animated-underline:hover,
	.animated-underline.twitter-hovered {
		text-decoration: none;
	}
	.animated-underline:hover::after,
	.animated-underline.twitter-hovered::after {
		width: 100%;
	}

	.twitter-bubble {
		transform-origin: center bottom;
		animation: bubbleExpand 0.1s ease-out forwards;
	}
	.twitter-bubble.hiding {
		animation: bubbleShrink 0.1s ease-in forwards;
	}
	@keyframes bubbleExpand {
		0% {
			transform: translateX(-50%) translateY(-100%) scale(0.3);
			opacity: 0;
		}
		100% {
			transform: translateX(-50%) translateY(-100%) scale(1);
			opacity: 1;
		}
	}
	@keyframes bubbleShrink {
		0% {
			transform: translateX(-50%) translateY(-100%) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateX(-50%) translateY(-100%) scale(0.3);
			opacity: 0;
		}
	}
</style>
