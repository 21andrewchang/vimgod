<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { get, writable } from 'svelte/store';

	let { children } = $props();

	const reloadWarningVisible = writable(false);
	const countdown = writable(5);
	let countdownTimer: ReturnType<typeof setInterval> | undefined;

	const clearCountdown = () => {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
	};

	const startCountdown = () => {
		clearCountdown();
		countdown.set(5);
		countdownTimer = setInterval(() => {
			countdown.update((value) => {
				const next = Math.max(0, value - 1);
				if (next === 0) {
					clearCountdown();
					if (browser) {
						// Allow the reload to go through once the timer expires.
						reloadWarningVisible.set(false);
						location.reload();
					}
				}
				return next;
			});
		}, 1000);
	};

	const showReloadWarning = () => {
		reloadWarningVisible.set(true);
		startCountdown();
	};

	const hideReloadWarning = () => {
		reloadWarningVisible.set(false);
		countdown.set(5);
		clearCountdown();
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		const key = event.key?.toLowerCase();
		const isReloadCombo = key === 'r' && (event.metaKey || event.ctrlKey);
		const warningActive = get(reloadWarningVisible);
		if (isReloadCombo) {
			if (warningActive) {
				// Allow the browser reload once the warning is already showing.
				hideReloadWarning();
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			showReloadWarning();
			return;
		}

		if (warningActive && event.key === 'Escape') {
			event.preventDefault();
			hideReloadWarning();
		}
	};

	onMount(() => {
		if (!browser) return;

		// If Font Loading API is missing, just show the logo.
		const fonts: FontFaceSet | undefined = (document as any).fonts;
		if (!fonts) {
			document.documentElement.classList.add('fonts-ready');
		} else if ((fonts as any).status === 'loaded') {
			document.documentElement.classList.add('fonts-ready');
		} else {
			(async () => {
				// Wait briefly for your specific faces; don't block forever.
				await Promise.race([
					Promise.allSettled([fonts.load('500 24px "DM Mono"'), fonts.load('400 24px "Sono"')]),
					new Promise((r) => setTimeout(r, 1500))
				]);

				document.documentElement.classList.add('fonts-ready');
			})();
		}

		window.addEventListener('keydown', handleKeyDown, { capture: true });

		return () => {
			window.removeEventListener('keydown', handleKeyDown, { capture: true });
			clearCountdown();
		};
	});
</script>

<svelte:head>
	<link
		rel="preload"
		href="/fonts/DMMono-500.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
	<link
		rel="preload"
		href="/fonts/Sono-400.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

<div class={`app ${$reloadWarningVisible ? 'app--intercepted' : ''}`}>
	{@render children()}
	<!-- render the routed page here -->
</div>

{#if $reloadWarningVisible}
	<div class="fixed flex items-center justify-center bg-black/50 backdrop-blur-md">
		<div class="flex flex-col text-center font-mono text-neutral-200">
			<p>reloading will exit the current match and result in a loss.</p>
			<p>are you sure you want to continue?</p>
			<p class="reload-overlay__countdown">{$countdown}s</p>
			<p class="reload-overlay__dismiss">press escape to continue</p>
		</div>
	</div>
{/if}

<style>
	.app {
		min-height: 100vh;
		transition:
			filter 150ms ease,
			transform 150ms ease;
	}

	.app--intercepted {
		filter: blur(6px);
		transform: scale(0.99);
	}

	.reload-overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(5, 5, 12, 0.88);
		backdrop-filter: blur(4px);
		z-index: 9999;
	}

	.reload-overlay__content {
		display: grid;
		gap: 0.75rem;
		padding: 2.5rem 3rem;
		border: 1px solid rgba(255, 255, 255, 0.2);
		background: rgba(12, 12, 20, 0.6);
		border-radius: 0.75rem;
		font-family: 'DM Mono', monospace;
		text-transform: lowercase;
		color: rgba(255, 255, 255, 0.9);
		text-align: center;
		max-width: min(90vw, 28rem);
	}

	.reload-overlay__countdown {
		font-size: clamp(2rem, 3vw, 2.75rem);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.1em;
	}

	.reload-overlay__dismiss {
		font-size: 0.875rem;
		opacity: 0.7;
	}
</style>
