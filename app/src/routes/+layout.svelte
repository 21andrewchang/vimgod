<script lang="ts">
	import '../app.css';
	import { onMount, setContext } from 'svelte';
	import { browser } from '$app/environment';
	import { get, writable } from 'svelte/store';
	import { DODGE_STORAGE_KEY } from '$lib/reloadGuard';
	import type { DodgeSnapshot } from '$lib/reloadGuard';

	let { children } = $props();

	const reloadWarningVisible = writable(false);
	const countdown = writable(5);
	const reloadGuardActive = writable(false);
	let snapshotProvider: (() => DodgeSnapshot | null) | null = null;
	let snapshotFinalizer: ((snapshot: DodgeSnapshot | null) => void) | null = null;
	let countdownTimer: ReturnType<typeof setInterval> | undefined;

	function clearCountdown() {
		if (countdownTimer) {
			clearInterval(countdownTimer);
			countdownTimer = undefined;
		}
	}

	function hideReloadWarning() {
		reloadWarningVisible.set(false);
		countdown.set(5);
		clearCountdown();
	}

	function persistReloadSnapshot(snapshot: DodgeSnapshot | null) {
		if (!browser || !snapshot) return;
		try {
			localStorage.setItem(DODGE_STORAGE_KEY, JSON.stringify(snapshot));
		} catch (error) {
			console.warn('failed to persist reload snapshot', error);
		}
	}

	function resolveReloadIntent() {
		let snapshot: DodgeSnapshot | null = null;
		if (snapshotProvider) {
			try {
				snapshot = snapshotProvider();
			} catch (error) {
				console.warn('failed to prepare dodge snapshot', error);
				snapshot = null;
			}
		}

		persistReloadSnapshot(snapshot);

		if (snapshotFinalizer) {
			snapshotFinalizer(snapshot);
			hideReloadWarning();
			return;
		}

		if (browser) {
			location.reload();
			return;
		}

		hideReloadWarning();
	}

	function startCountdown() {
		clearCountdown();
		countdown.set(5);
		countdownTimer = setInterval(() => {
			countdown.update((value) => {
				const next = Math.max(0, value - 1);
				if (next === 0) {
					clearCountdown();
					resolveReloadIntent();
				}
				return next;
			});
		}, 1000);
	}

	function showReloadWarning() {
		reloadWarningVisible.set(true);
		startCountdown();
	}

	const enableReloadGuard = (
		provider?: () => DodgeSnapshot | null,
		finalizer?: (snapshot: DodgeSnapshot | null) => void
	) => {
		reloadGuardActive.set(true);
		snapshotProvider = provider ?? null;
		snapshotFinalizer = finalizer ?? null;
	};
	const disableReloadGuard = () => {
		reloadGuardActive.set(false);
		snapshotProvider = null;
		snapshotFinalizer = null;
		hideReloadWarning();
	};

	setContext('reload-guard', {
		enable: enableReloadGuard,
		disable: disableReloadGuard
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		const key = event.key?.toLowerCase();
		const isReloadCombo = key === 'r' && (event.metaKey || event.ctrlKey);
		const warningActive = get(reloadWarningVisible);
		const guardActive = get(reloadGuardActive);
		if (isReloadCombo) {
			if (!guardActive) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			if (!snapshotProvider && snapshotFinalizer && !warningActive) {
				snapshotFinalizer(null);
				return;
			}
			if (warningActive) {
				resolveReloadIntent();
				return;
			}
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

<div class={`min-h-screen transition-[filter,transform] duration-150 ease-out `}>
	{@render children()}
	<!-- render the routed page here -->
</div>

{#if $reloadWarningVisible}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur">
		<div class="text-center font-mono lowercase text-neutral-200">
			<p>reloading will result in a loss</p>
			<p class="text-[clamp(2rem,3vw,2.75rem)] tabular-nums tracking-[0.1em] text-red-400">
				{$countdown}s
			</p>
			<p class="text-xs opacity-70">press [esc] to continue</p>
		</div>
	</div>
{/if}
