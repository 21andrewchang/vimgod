<script lang="ts">
	import '../app.css';
	import { onMount, setContext } from 'svelte';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import { get, writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { DODGE_STORAGE_KEY } from '$lib/reloadGuard';
	import type { DodgeSnapshot } from '$lib/reloadGuard';

	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/auth';
	import { profile, refreshProfile } from '$lib/stores/profile';

	let { children } = $props();

	/* existing reload-guard state */
	const reloadWarningVisible = writable(false);
	const countdown = writable(5);
	const reloadGuardActive = writable(false);
	let snapshotProvider: (() => DodgeSnapshot | null) | null = null;
	let snapshotFinalizer: ((snapshot: DodgeSnapshot | null) => void) | null = null;
	let guardDisabled = false;
	let countdownTimer: ReturnType<typeof setInterval> | undefined;

	/* NEW: realtime channel + unsub handle */
	let usersChannel: ReturnType<typeof supabase.channel> | null = null;
	let unsubAuth: (() => void) | null = null;

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

	function setGuardDisabled(value: boolean) {
		guardDisabled = value;
		if (value) {
			hideReloadWarning();
		}
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
		setGuardDisabled(false);
	};
	const disableReloadGuard = () => {
		reloadGuardActive.set(false);
		snapshotProvider = null;
		snapshotFinalizer = null;
		setGuardDisabled(false);
		hideReloadWarning();
	};

	setContext('reload-guard', {
		enable: enableReloadGuard,
		disable: disableReloadGuard,
		disableBlocking: setGuardDisabled
	});

	const handleKeyDown = (event: KeyboardEvent) => {
		const key = event.key?.toLowerCase();
		const isReloadCombo = key === 'r' && (event.metaKey || event.ctrlKey);
		const warningActive = get(reloadWarningVisible);
		const guardActive = get(reloadGuardActive);
		if (isReloadCombo) {
			if (!guardActive || guardDisabled) {
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

	/* --- NEW: bind/unbind realtime on users row --- */
	function bindUsersRealtime(uid: string | null) {
		// clean previous
		if (usersChannel) {
			supabase.removeChannel(usersChannel);
			usersChannel = null;
		}
		if (!uid) return;

		usersChannel = supabase
			.channel(`users-row-${uid}`)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
				async () => {
					// whenever users row changes (triggers, manual updates, etc.), refresh the profile store
					await refreshProfile();
				}
			)
			.subscribe();
	}

	onMount(() => {
		if (!browser) return;

		// FONT LOADING (existing)
		const fonts: FontFaceSet | undefined = (document as any).fonts;
		if (!fonts) {
			document.documentElement.classList.add('fonts-ready');
		} else if ((fonts as any).status === 'loaded') {
			document.documentElement.classList.add('fonts-ready');
		} else {
			(async () => {
				await Promise.race([
					Promise.allSettled([fonts.load('500 24px "DM Mono"'), fonts.load('400 24px "Sono"')]),
					new Promise((r) => setTimeout(r, 1500))
				]);
				document.documentElement.classList.add('fonts-ready');
			})();
		}

		// KEY HANDLER (existing)
		window.addEventListener('keydown', handleKeyDown, { capture: true });

		// PROFILE HYDRATION + REALTIME (new)
		(async () => {
			await refreshProfile(); // initial read
			bindUsersRealtime(get(user)?.id ?? null);
		})();

		// react to auth changes -> refresh + rebind realtime
		unsubAuth = user.subscribe(async (u) => {
			await refreshProfile();
			bindUsersRealtime(u?.id ?? null);
		});

		return () => {
			window.removeEventListener('keydown', handleKeyDown, { capture: true });
			clearCountdown();

			if (usersChannel) {
				supabase.removeChannel(usersChannel);
				usersChannel = null;
			}
			if (unsubAuth) {
				try {
					unsubAuth();
				} catch {}
				unsubAuth = null;
			}
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
	{#if $page.url.pathname.startsWith('/profile')}
		<Header size="small" />
	{:else}
		<Header fixed size="small" />
	{/if}
	{@render children()}
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
