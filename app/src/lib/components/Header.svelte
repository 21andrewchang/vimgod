<script lang="ts">
	import { user, signOut } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	const { variant = 'inline', size = 'large', fixed = false } = $props<{
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
	const isHome = $derived(pathname === '/');
	const isProfile = $derived(pathname.startsWith('/profile'));
	const isTutorial = $derived(pathname.startsWith('/tutorial'));
	const logoIsInteractive = $derived(isProfile || isTutorial);

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

	/* size-aware icon class for the tutorial button */
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

	<!-- Right: Tutorial icon + User -->
	<div class="flex items-center gap-2" class:max-[740px]:hidden={variant === 'fixed'}>
		<button
			class=" relative inline-flex items-center justify-center rounded-full !font-mono !text-lg text-white/40 outline-none transition hover:text-white"
			onclick={() => goto('/tutorial')}
		>
			<svg viewBox="0 0 512 512" class="h-4 w-4" aria-hidden="true" focusable="false">
				<path
					fill="currentColor"
					d="M396.138,85.295c-13.172-25.037-33.795-45.898-59.342-61.03C311.26,9.2,280.435,0.001,246.98,0.001
      c-41.238-0.102-75.5,10.642-101.359,25.521c-25.962,14.826-37.156,32.088-37.156,32.088c-4.363,3.786-6.824,9.294-6.721,15.056
      c0.118,5.77,2.775,11.186,7.273,14.784l35.933,28.78c7.324,5.864,17.806,5.644,24.875-0.518c0,0,4.414-7.978,18.247-15.88
      c13.91-7.85,31.945-14.173,58.908-14.258c23.517-0.051,44.022,8.725,58.016,20.717c6.952,5.941,12.145,12.594,15.328,18.68
      c3.208,6.136,4.379,11.5,4.363,15.574c-0.068,13.766-2.742,22.77-6.603,30.442c-2.945,5.729-6.789,10.813-11.738,15.744
      c-7.384,7.384-17.398,14.207-28.634,20.479c-11.245,6.348-23.365,11.932-35.612,18.68c-13.978,7.74-28.77,18.858-39.701,35.544
      c-5.449,8.249-9.71,17.686-12.416,27.641c-2.742,9.964-3.98,20.412-3.98,31.071c0,11.372,0,20.708,0,20.708
      c0,10.719,8.69,19.41,19.41,19.41h46.762c10.719,0,19.41-8.691,19.41-19.41c0,0,0-9.336,0-20.708c0-4.107,0.467-6.755,0.917-8.436
      c0.773-2.512,1.206-3.14,2.47-4.668c1.29-1.452,3.895-3.674,8.698-6.331c7.019-3.946,18.298-9.276,31.07-16.176
      c19.121-10.456,42.367-24.646,61.972-48.062c9.752-11.686,18.374-25.758,24.323-41.968c6.001-16.21,9.242-34.431,9.226-53.96
      C410.243,120.761,404.879,101.971,396.138,85.295z"
				/>
				<path
					fill="currentColor"
					d="M228.809,406.44c-29.152,0-52.788,23.644-52.788,52.788c0,29.136,23.637,52.772,52.788,52.772
      c29.136,0,52.763-23.636,52.763-52.772C281.572,430.084,257.945,406.44,228.809,406.44z"
				/>
			</svg>
		</button>

		<!-- User Icon + Username -->
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
