<script lang="ts">
	import { user, signOut } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const {
		variant = 'inline',
		size = 'large',
		fixed = false
	} = $props<{
		variant?: 'fixed' | 'inline';
		size?: 'small' | 'large';
		fixed?: boolean;
	}>();

	const effectiveVariant = $derived(fixed ? 'fixed' : variant);

	let isHeaderHovered = $state(false);
	let isUserIconHovered = $state(false);
	let isHelpHovered = $state(false);

	let showUserDropdown = $state(false);
	let dropdownHiding = $state(false);

	let iconRef = $state<HTMLDivElement | null>(null);
	let menuRef = $state<HTMLDivElement | null>(null);

	const serverUser = $derived($page.data?.user ?? null);
	const activeUser = $derived($user ?? serverUser);
	const isAuthed = $derived(activeUser !== null);
	const dbNameFromPage = $derived($page.data?.user?.name ?? null);
	const displayName = $derived(
		isAuthed
			? (dbNameFromPage ??
					activeUser?.user_metadata?.name ??
					activeUser?.email?.split('@')[0] ??
					'User')
			: ''
	);

	/* page-aware logo interactivity */
	const pathname = $derived($page.url?.pathname ?? '/');
	const isProfile = $derived(pathname.startsWith('/profile'));
	const isMotions = $derived(pathname.startsWith('/motions'));
	const logoIsInteractive = $derived(isProfile || isMotions);

	function handleHeaderMouseEnter() {
		isHeaderHovered = true;
	}
	function handleHeaderMouseLeave() {
		isHeaderHovered = false;
	}

	function handleHeaderClick() {
		if (!logoIsInteractive) return;
		window.location.href = '/';
	}

	function openMenu() {
		if (dropdownHiding) return;
		if (!showUserDropdown) {
			showUserDropdown = true;
		}
	}
	function startDropdownHideAnimation() {
		dropdownHiding = true;
		setTimeout(() => {
			showUserDropdown = false;
			dropdownHiding = false;
		}, 100);
	}
	function closeMenu(animated = true) {
		if (!showUserDropdown) return;
		animated ? startDropdownHideAnimation() : (showUserDropdown = false);
	}
	function toggleMenu() {
		showUserDropdown ? closeMenu() : openMenu();
	}

	function handleUserIconClick() {
		if (!isAuthed) {
			window.location.href = '/login';
			return;
		}
		toggleMenu();
	}
	function handleDropdownAction(action: string) {
		closeMenu();
		switch (action) {
			case 'profile':
				window.location.href = '/profile';
				break;
			case 'settings':
				console.log('Settings clicked');
				break;
			case 'signout':
				signOut().then(() => {
					window.location.href = '/';
				});
				break;
		}
	}

	function onDocumentPointerDown(e: PointerEvent) {
		const t = e.target as Node;
		if (iconRef?.contains(t) || menuRef?.contains(t)) return;
		closeMenu();
	}
	function onTriggerKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleUserIconClick();
		} else if (e.key === 'Escape') {
			closeMenu();
		}
	}
	function onMenuKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu();
			(iconRef as HTMLElement | null)?.focus?.();
		}
	}
	onMount(() => {
		if (!browser) return;
		document.addEventListener('pointerdown', onDocumentPointerDown, { passive: true });
		return () => document.removeEventListener('pointerdown', onDocumentPointerDown);
	});

	const containerClass = $derived(
		effectiveVariant === 'fixed'
			? 'fixed left-8 top-6 z-50 flex items-center justify-between w-full max-w-[calc(100vw-4rem)]'
			: 'relative z-50 left-8 top-6 flex items-center justify-between w-full max-w-[calc(100vw-4rem)]'
	);

	const logoClass = $derived(
		effectiveVariant === 'fixed'
			? `flex items-center gap-2 max-[740px]:hidden ${logoIsInteractive ? 'cursor-pointer' : 'cursor-default'}`
			: `flex items-center gap-2 ${logoIsInteractive ? 'cursor-pointer' : 'cursor-default'}`
	);

	const greaterThanClass = $derived(
		size === 'small' ? 'text-2xl font-normal text-purple-400' : 'text-4xl font-normal'
	);
	const vimgodClass = $derived(size === 'small' ? 'text-xl font-medium' : 'text-3xl font-medium');
	const underscoreClass = $derived(
		size === 'small' ? 'text-xl font-medium' : 'text-3xl font-medium'
	);

	/* size-aware icon class for the motions button */
	const helpIconSizeClass = $derived(size === 'small' ? 'h-5 w-5' : 'h-6 w-6');
</script>

<div class={containerClass}>
	<!-- Left: Logo -->
	<div class="flex flex-row items-center">
		<div
			class={logoClass}
			role={logoIsInteractive ? 'button' : 'img'}
			tabindex={logoIsInteractive ? 0 : -1}
			aria-label={logoIsInteractive ? 'Go to home page' : 'vimgod'}
			onmouseenter={handleHeaderMouseEnter}
			onmouseleave={handleHeaderMouseLeave}
			onclick={handleHeaderClick}
			onkeydown={(e) => {
				if (!logoIsInteractive) return;
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleHeaderClick();
				}
			}}
			aria-disabled={logoIsInteractive ? 'false' : 'true'}
		>
			<span
				class={`${greaterThanClass} logo-mark`}
				style="color:#bc93f9; font-family:'Sono',sans-serif; font-weight:400; transform:translateY(-1px);"
			>
				{`>`}
			</span>
			<span
				class={`${vimgodClass} logo-word`}
				style="color:#e8e8e8; font-family:'DM Mono',sans-serif; font-weight:500;"
			>
				vimgod
			</span>
			<span
				class={`${underscoreClass} logo-cursor`}
				style={`color:#e8e8e8; font-family:'DM Mono',sans-serif; font-weight:500; transform:translateX(-8px);
				        animation:${isHeaderHovered ? 'blink 1s infinite' : 'none'};`}>_</span
			>
		</div>
	</div>

	<div class="flex items-center gap-2" class:max-[740px]:hidden={variant === 'fixed'}>
		<button
			class="group relative inline-flex items-center justify-center rounded-full !font-mono !text-lg text-white opacity-70 outline-none transition hover:opacity-100 focus-visible:opacity-100"
			onclick={() => goto('/tutorial')}
			aria-label="tutorial"
		>
			<svg
				class={`h-6 w-6 opacity-50 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100`}
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					d="M12 6a4 4 0 0 1 4 4c0 2.22-1.76 3.18-2.66 3.73-.69.41-.84.59-.84 1.27v.25h-2v-.39c0-1.54.6-2.2 1.8-2.92.69-.41 1.7-1.01 1.7-1.94A2 2 0 0 0 12 8a2 2 0 0 0-2 2H8a4 4 0 0 1 4-4Z"
				/>
				<circle cx="12" cy="18.5" r="1.25" />
			</svg>
		</button>
		<button
			class="group relative inline-flex items-center justify-center rounded-full px-2 !font-mono !text-lg opacity-70 outline-none transition hover:opacity-100 focus-visible:opacity-100"
			onclick={() => goto('/motions')}
			aria-label="motions"
		>
			<img
				src="/cards.svg"
				alt=""
				class={`${helpIconSizeClass} opacity-50 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100`}
				aria-hidden="true"
			/>
		</button>

		<div
			bind:this={iconRef}
			role="button"
			tabindex="0"
			class="relative flex cursor-pointer items-center p-2"
			onclick={handleUserIconClick}
			onkeydown={onTriggerKeydown}
			onmouseenter={() => (isUserIconHovered = true)}
			onmouseleave={() => (isUserIconHovered = false)}
			aria-label={isAuthed ? 'User menu' : 'Sign in'}
			aria-haspopup="menu"
			aria-expanded={isAuthed && showUserDropdown ? 'true' : 'false'}
			aria-controls="user-menu"
		>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				shape-rendering="geometricPrecision"
				class="transition-colors duration-200"
				style="color: {isUserIconHovered ? 'white' : 'rgba(255, 255, 255, 0.4)'};"
			>
				<path d="M20 21.5v-2.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2.5h16" />
				<circle cx="12" cy="7" r="4" />
			</svg>

			{#if isAuthed}
				<span
					class="ml-2 max-w-[12rem] truncate py-[1px] font-mono text-[14px] leading-[1.2] text-neutral-300 transition-colors duration-200"
					style="color: {isUserIconHovered ? 'white' : 'rgba(255,255,255,0.4)'};"
					>{displayName}</span
				>
			{/if}

			{#if isAuthed && showUserDropdown}
				<div
					id="user-menu"
					bind:this={menuRef}
					class="user-dropdown absolute right-0 top-full z-50 mt-1 w-40 rounded border border-neutral-700 bg-neutral-800 shadow-lg {dropdownHiding
						? 'hiding'
						: ''}"
					role="menu"
					tabindex="-1"
					style="font-family:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
					onkeydown={onMenuKeydown}
				>
					<div
						role="menuitem"
						tabindex="0"
						class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 transition-all duration-200 hover:bg-neutral-700/60 hover:text-white focus:bg-neutral-700/40 focus:outline-none"
						onclick={() => handleDropdownAction('profile')}
					>
						user profile
					</div>
					<div
						role="menuitem"
						tabindex="0"
						class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 transition-all duration-200 hover:bg-neutral-700/60 hover:text-white focus:bg-neutral-700/40 focus:outline-none"
						onclick={() => handleDropdownAction('settings')}
					>
						account settings
					</div>
					<hr class="border-neutral-700" />
					<div
						role="menuitem"
						tabindex="0"
						class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 transition-all duration-200 hover:bg-neutral-700/60 hover:text-white focus:bg-neutral-700/40 focus:outline-none"
						onclick={() => handleDropdownAction('signout')}
					>
						sign out
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.user-dropdown {
		transform-origin: center top;
		animation: dropdownExpand 0.1s ease-out forwards;
	}
	.user-dropdown.hiding {
		animation: dropdownShrink 0.1s ease-in forwards;
	}

	.rank-display {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		width: fit-content;
	}
	.rank-progress {
		height: 1px;
		width: 100%;
		background: rgba(255, 255, 255, 0.12);
		position: relative;
		overflow: hidden;
		border-radius: 9999px;
	}
	.rank-progress__fill {
		position: absolute;
		inset: 0;
		background: #666;
	}

	@keyframes dropdownExpand {
		0% {
			transform: scale(0.3);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
	@keyframes dropdownShrink {
		0% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(0.3);
			opacity: 0;
		}
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}
</style>
