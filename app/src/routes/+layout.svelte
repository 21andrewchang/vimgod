<script lang="ts">
	import '../app.css';
	import { onMount, setContext, tick } from 'svelte';
	import { browser } from '$app/environment';
	import Header from '$lib/components/Header.svelte';
	import { get, writable } from 'svelte/store';
	import { page } from '$app/stores';
import { clearDodgeSnapshot, DODGE_STORAGE_KEY } from '$lib/reloadGuard';
	import type { DodgeSnapshot } from '$lib/reloadGuard';

	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/auth';
	import { refreshProfile } from '$lib/stores/profile';
	import { invalidate } from '$app/navigation';

	type UsernameAvailability = 'unknown' | 'checking' | 'available' | 'unavailable';

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

	/* onboarding username prompt */
	let showUsernameModal = $state(false);
	let usernameModalManual = $state(false);
	let usernameInput = $state('');
	let usernameError = $state('');
	let submittingUsername = $state(false);
	let usernameInputRef: HTMLInputElement | null = null;
	let usernameAvailability: UsernameAvailability = $state('unknown');
	let availabilityHover = $state(false);
	let usernameCheckVersion = 0;
	let lastCheckedUsername = '';

	const requiresUsername = $derived(Boolean($page.data?.user?.requiresUsername));
	const currentUserId = $derived($page.data?.user?.id ?? null);

	$effect(() => {
		const shouldShow = requiresUsername || usernameModalManual;
		if (shouldShow) {
			if (!showUsernameModal) {
				showUsernameModal = true;
				if (requiresUsername && !usernameModalManual) {
					usernameInput = '';
					usernameError = '';
					usernameAvailability = 'unknown';
					availabilityHover = false;
					lastCheckedUsername = '';
				}
			}
			return;
		}
		if (showUsernameModal) {
			showUsernameModal = false;
		}
	});

	$effect(() => {
		if (!browser) return;
		if (!showUsernameModal) {
			document.body.style.overflow = '';
			return;
		}
		document.body.style.overflow = 'hidden';
		void tick().then(() => {
			const input = usernameInputRef;
			if (input && typeof input.focus === 'function') {
				input.focus();
			}
		});
	});

	function sanitizeUsername(value: string): string {
		return value.replace(/[^A-Za-z0-9._]/g, '').slice(0, 16);
	}

	async function checkUsernameAvailability(candidate: string) {
		const normalized = candidate.trim();
		const currentVersion = ++usernameCheckVersion;
		if (!normalized) {
			usernameAvailability = 'unknown';
			lastCheckedUsername = '';
			return;
		}
		if (normalized === lastCheckedUsername && usernameAvailability !== 'checking') {
			return;
		}
		usernameAvailability = 'checking';
		try {
			const { data, error } = await supabase
				.from('users')
				.select('id')
				.ilike('name', normalized)
				.limit(1);
			if (currentVersion !== usernameCheckVersion) return;
			if (error) throw error;
			const exists = Array.isArray(data) && data.length > 0;
			usernameAvailability = exists ? 'unavailable' : 'available';
			lastCheckedUsername = normalized;
		} catch (err) {
			console.error('Failed to check username availability', err);
			if (currentVersion === usernameCheckVersion) {
				usernameAvailability = 'unknown';
			}
		}
	}

	function getAvailabilityMessage(state: UsernameAvailability): string {
		switch (state) {
			case 'available':
				return 'username is available';
			case 'unavailable':
				return 'username is unavailable';
			case 'checking':
				return 'checking availability…';
			default:
				return '';
		}
	}

	function openUsernameModal(prefill?: string | null) {
		const sanitized = prefill ? sanitizeUsername(prefill) : '';
		usernameModalManual = true;
		showUsernameModal = true;
		usernameInput = sanitized;
		usernameError = '';
		availabilityHover = false;
		usernameAvailability = 'unknown';
		lastCheckedUsername = '';
		if (sanitized) {
			void checkUsernameAvailability(sanitized);
		}
	}

	function closeUsernameModal() {
		usernameModalManual = false;
		showUsernameModal = false;
	}

	function handleUsernameOverlayClick(event: MouseEvent) {
		if (requiresUsername) return;
		if (event.target !== event.currentTarget) return;
		closeUsernameModal();
	}

	function handleUsernameInput(event: Event) {
		const target = event.target as HTMLInputElement;
		usernameInput = sanitizeUsername(target.value);
		if (usernameError) usernameError = '';
		void checkUsernameAvailability(usernameInput);
	}

	async function submitUsername() {
		if (submittingUsername) return;
		const trimmed = usernameInput.trim();
		if (!trimmed) {
			usernameError = 'Username is required.';
			usernameAvailability = 'unavailable';
			return;
		}
		if (trimmed.length > 16) {
			usernameError = 'Username must be 16 characters or fewer.';
			usernameAvailability = 'unavailable';
			return;
		}
		if (!/^[A-Za-z0-9._]+$/.test(trimmed)) {
			usernameError = 'Only letters, numbers, periods, and underscores are allowed.';
			usernameAvailability = 'unavailable';
			return;
		}
		if (usernameAvailability !== 'available') {
			usernameError = 'Username is unavailable.';
			return;
		}
		const uid = currentUserId;
		if (!uid) {
			usernameError = 'Unable to determine user ID.';
			return;
		}
		submittingUsername = true;
		try {
			const { error } = await supabase
				.from('users')
				.update({ name: trimmed })
				.eq('id', uid)
				.select('id')
				.single();
			if (error) throw error;
			await refreshProfile();
			await invalidate('app:user');
			usernameModalManual = false;
			showUsernameModal = false;
			usernameInput = '';
		} catch (err) {
			console.error('Failed to set username', err);
			usernameError = 'Failed to save username. Please try again.';
		} finally {
			submittingUsername = false;
		}
	}

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
			const nextSnapshot = snapshot;
			try {
				snapshotFinalizer(nextSnapshot);
			} finally {
				if (browser) {
					clearDodgeSnapshot();
				}
			}
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

	setContext('username-modal', {
		open: openUsernameModal,
		close: closeUsernameModal
	});

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

<div
	class={`min-h-screen transition-[filter,transform] duration-150 ease-out `}
	class:blur-sm={showUsernameModal}
>
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


{#if showUsernameModal}
	<div
		class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
		on:click={handleUsernameOverlayClick}
	>
		<form
			class="relative w-[90%] max-w-sm rounded-xl border border-dashed border-[#3f3f48] bg-[#0a0a0a] p-6 shadow-2xl transition-all duration-300"
			on:submit|preventDefault={submitUsername}
			on:click|stopPropagation
		>
			<h2
				class="text-lg font-semibold text-neutral-100"
				style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
			>
				choose a username
			</h2>
			<p
				class="mt-2 text-sm text-neutral-400"
				style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
			>
				your username can include letters, numbers, periods, and underscores (max 16 characters).
			</p>
			<div class="mt-4">
				<div class="relative">
					<input
						type="text"
						class="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 pr-10 text-sm text-neutral-100 outline-none transition focus:border-neutral-400 focus:ring-0"
						autocomplete="off"
						spellcheck={false}
						maxlength={16}
						value={usernameInput}
						on:input={handleUsernameInput}
						bind:this={usernameInputRef}
						style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
					/>
					{#if usernameAvailability !== 'unknown'}
						<button
							type="button"
							class="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full text-sm font-bold transition focus:outline-none"
							style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
							on:mouseenter={() => (availabilityHover = true)}
							on:mouseleave={() => (availabilityHover = false)}
							aria-label={getAvailabilityMessage(usernameAvailability) || 'username status'}
						>
							{#if usernameAvailability === 'available'}
								<span class="relative block h-4 w-4">
									<span
										class="absolute left-[55%] top-0 h-full w-[2px] -translate-x-1/2 rotate-45 rounded-full bg-emerald-400"
									/>
									<span
										class="-rotate-135 absolute bottom-[3px] left-[18%] h-[2px] w-[50%] -translate-x-2/3 -translate-y-1/2 rounded-full bg-emerald-400"
									/>
								</span>
							{:else if usernameAvailability === 'unavailable'}
								<span class="relative block h-4 w-4">
									<span
										class="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-rose-400"
									/>
									<span
										class="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-rose-400"
									/>
								</span>
							{:else}
								<span class="flex items-center gap-[3px]">
									<span
										class="h-0.5 w-0.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-neutral-400"
									/>
									<span
										class="h-0.5 w-0.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-neutral-400"
										style="animation-delay:0.15s;"
									/>
									<span
										class="h-0.5 w-0.5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-neutral-400"
										style="animation-delay:0.3s;"
									/>
								</span>
							{/if}
						</button>
						{#if availabilityHover && getAvailabilityMessage(usernameAvailability)}
							{@const availabilityText = getAvailabilityMessage(usernameAvailability)}
							<div
								class="absolute right-0 mt-2 w-max max-w-[220px] rounded border border-neutral-700 bg-[#0a0a0a] px-3 py-1 text-xs text-neutral-300 shadow-lg"
								style="top:calc(100% + 0.25rem); font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
							>
								{availabilityText}
							</div>
						{/if}
					{/if}
				</div>
				{#if usernameError}
					<p
						class="mt-2 text-xs text-rose-400"
						style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
					>
						{usernameError}
					</p>
				{/if}
			</div>
			<button
				type="submit"
				class="mt-5 inline-flex w-full items-center justify-center rounded bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-400"
				style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
				disabled={submittingUsername ||
					!usernameInput.trim() ||
					usernameAvailability !== 'available'}
			>
				{submittingUsername ? 'saving...' : 'save username'}
			</button>
		</form>
	</div>
{/if}
