<script lang="ts">
	// You can customize these links
	const cap =
		'inline-flex h-5 w-5 items-center justify-center rounded-sm bg-neutral-800 border border-[#313131] ' +
		'font-mono text-[10px] leading-none text-neutral-500 ' +
		'shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)] ';
	const links = [
		{
			name: 'github',
			url: 'https://github.com/21andrewchang/vimgod',
			icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'
		},
		{
			name: 'twitter',
			url: 'https://twitter.com/yourusername',
			icon: 'M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z'
		},
		{
			name: 'contact',
			url: 'mailto:founders@alice.co',
			icon: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'
		}
	];

	// Twitter tooltip state
	let twitterTooltip = $state({ show: false, x: 0, y: 0, hiding: false });
	let isTwitterTextHovered = $state(false);
	let isBubbleHovered = $state(false);
	let footerElement: HTMLElement;
	let hideTimeout: ReturnType<typeof setTimeout>;
	let isTransitioning = $state(false);

	// Twitter links for the tooltip
	const twitterLinks = [
		{ name: '@627B8D', url: 'https://twitter.com/627B8D' },
		{ name: '@nico_lu0', url: 'https://twitter.com/nico_lu0' }
	];

	function handleTwitterMouseEnter(event: MouseEvent) {
		// Clear any pending hide timeout
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}

		isTransitioning = false;
		isTwitterTextHovered = true;
		const rect = (event.target as HTMLElement).getBoundingClientRect();
		const footerRect = footerElement.getBoundingClientRect();

		// Position relative to the footer container, above the Twitter link
		twitterTooltip = {
			show: true,
			hiding: false,
			x: rect.left + rect.width / 2 - footerRect.left,
			y: rect.top - footerRect.top - 10
		};
	}

	function handleTwitterMouseLeave() {
		// Add a small delay before hiding to allow moving to tooltip
		isTransitioning = true;
		hideTimeout = setTimeout(() => {
			if (isTransitioning) {
				isTwitterTextHovered = false;
				checkIfShouldHide();
			}
		}, 100);
	}

	function handleTooltipMouseEnter() {
		// Clear any pending hide timeout when hovering over tooltip
		if (hideTimeout) {
			clearTimeout(hideTimeout);
		}
		// Reset hiding state if we're back on the tooltip
		if (twitterTooltip.hiding) {
			twitterTooltip.hiding = false;
		}
		// Track bubble hover state
		isTransitioning = false;
		isBubbleHovered = true;
	}

	function handleTooltipMouseLeave() {
		// Track bubble hover state
		isBubbleHovered = false;
		// Add a small delay to allow moving back to Twitter text
		isTransitioning = true;
		hideTimeout = setTimeout(() => {
			if (isTransitioning) {
				// If we're still transitioning, it means we didn't move back to Twitter text
				// So we should hide the bubble
				isTwitterTextHovered = false;
				checkIfShouldHide();
			}
		}, 100);
	}

	function checkIfShouldHide() {
		// Only hide if neither Twitter text nor bubble is being hovered
		if (!isTwitterTextHovered && !isBubbleHovered) {
			startHideAnimation();
		}
	}

	function startHideAnimation() {
		twitterTooltip.hiding = true;
		// Wait for animation to complete before removing element
		setTimeout(() => {
			twitterTooltip.show = false;
			twitterTooltip.hiding = false;
		}, 100); // Match animation duration
	}
</script>

<footer
	bind:this={footerElement}
	class="fixed bottom-0 left-0 right-0 z-[2] bg-transparent max-[740px]:hidden"
>
	<div class="mx-auto px-6 py-4">
		<div class="flex flex-col items-center justify-between gap-4 md:flex-row">
			<!-- Social Links -->
			<div class="flex items-center gap-6">
				{#each links as link}
					{#if link.name === 'twitter'}
						<div
							class="flex items-center gap-2 font-mono text-xs text-neutral-700 transition-colors duration-200 hover:text-neutral-200 {isTwitterTextHovered ||
							isBubbleHovered
								? 'text-neutral-200'
								: ''} animated-underline cursor-pointer {isTwitterTextHovered || isBubbleHovered
								? 'twitter-hovered'
								: ''}"
							onmouseenter={handleTwitterMouseEnter}
							onmouseleave={handleTwitterMouseLeave}
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
					{:else}
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="animated-underline flex items-center gap-2 font-mono text-xs !text-neutral-700 transition-colors duration-200 hover:!text-neutral-200"
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

			<div class="absolute bottom-16 left-1/2 -translate-x-1/2">
				<div class="flex items-center gap-16 text-[10px]">
					<div class="group flex gap-2">
						<kbd class={cap}>h</kbd>
						<span class="text-neutral-700">–</span>
						<span class="font-mono text-neutral-700">left</span>
					</div>

					<div class="group flex gap-2">
						<kbd class={cap}>k</kbd>
						<span class="text-neutral-700">–</span>
						<span class="font-mono text-neutral-700">down</span>
					</div>

					<div class="group flex gap-2">
						<kbd class={cap}>k</kbd>
						<span class="text-neutral-700">–</span>
						<span class="font-mono text-neutral-700">up</span>
					</div>

					<div class="group flex gap-2">
						<kbd class={cap}>l</kbd>
						<span class="text-neutral-700">–</span>
						<span class="font-mono text-neutral-700">right</span>
					</div>
				</div>
			</div>
			<!-- Copyright -->
			<div>
				<p class="font-mono text-xs text-neutral-700">© 2025 vimgod. All rights reserved.</p>
			</div>
		</div>
	</div>

	<!-- Twitter Tooltip -->
	{#if twitterTooltip.show}
		<div
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

	.animated-underline:hover::after,
	.animated-underline.twitter-hovered::after {
		width: 100%;
	}

	.animated-underline:hover {
		text-decoration: none;
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
