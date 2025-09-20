<script lang="ts">
	import { user, signOut } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	const { variant = 'inline', size = 'large' } = $props<{
		variant?: 'fixed' | 'inline';
		size?: 'small' | 'large';
	}>();

	let isHeaderHovered = $state(false);
	let isUserIconHovered = $state(false); // keep for hover color only

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
			? (dbNameFromPage ?? activeUser?.user_metadata?.name ?? activeUser?.email?.split('@')[0] ?? 'User')
			: ''
	);

	function handleHeaderMouseEnter() { isHeaderHovered = true; }
	function handleHeaderMouseLeave() { isHeaderHovered = false; }

	function handleHeaderClick() {
		window.location.href = '/';
	}

	function openMenu() {
		if (dropdownHiding) return;     // don't fight the closing animation
		if (!showUserDropdown) {
			showUserDropdown = true;
			// focus first item after mount
			requestAnimationFrame(() => {
				const first = menuRef?.querySelector('[role="menuitem"]') as HTMLElement | null;
				first?.focus();
			});
		}
	}

	function startDropdownHideAnimation() {
		dropdownHiding = true;
		setTimeout(() => {
			showUserDropdown = false;
			dropdownHiding = false;
		}, 100); // match CSS keyframes
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
			case 'profile':  window.location.href = '/profile'; break;
			case 'settings': console.log('Settings clicked'); break;
			case 'signout':
				signOut().then(() => { window.location.href = '/'; });
				break;
		}
	}

	// Close on outside click (pointerdown feels snappier than click)
	function onDocumentPointerDown(e: PointerEvent) {
		const t = e.target as Node;
		if (iconRef?.contains(t) || menuRef?.contains(t)) return;
		closeMenu();
	}

	// Keyboard: Enter/Space to toggle on trigger, Esc to close on trigger or menu
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

	// Dynamic classes based on variant and size
	const containerClass = $derived(
		variant === 'fixed'
			? 'fixed left-8 top-6 z-50 flex items-center justify-between w-full max-w-[calc(100vw-4rem)]'
			: 'flex items-center justify-between'
	);

	const logoClass = $derived(
		variant === 'fixed'
			? 'flex cursor-pointer items-center gap-2 max-[740px]:hidden'
			: 'flex items-center gap-2 cursor-pointer'
	);

	const greaterThanClass = $derived(size === 'small' ? 'text-2xl font-normal text-purple-400' : 'text-4xl font-normal');
	const vimgodClass = $derived(size === 'small' ? 'text-xl font-medium' : 'text-3xl font-medium');
	const underscoreClass = $derived(size === 'small' ? 'text-xl font-medium' : 'text-3xl font-medium');
</script>

<div class={containerClass}>
	<!-- Logo Section -->
	<div 
		class={logoClass}
		role="button"
		tabindex="0"
		onmouseenter={handleHeaderMouseEnter}
		onmouseleave={handleHeaderMouseLeave}
		onclick={handleHeaderClick}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleHeaderClick();
			}
		}}
		aria-label="Go to home page"
	>
		<span 
			class={`${greaterThanClass} logo-mark`} 
			style="color:#bc93f9; font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);"
		>
			{`>`}
		</span>
		<span 
			class={`${vimgodClass} logo-word`} 
			style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500;"
		>
			vimgod
		</span>
		<span 
			class={`${underscoreClass} logo-cursor`} 
			style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500; transform: translateX(-8px); animation: {isHeaderHovered ? 'blink 1s infinite' : 'none'};"
		>
			_
		</span>
	</div>
	
	<!-- User Icon + Username Section -->
    <div class="flex items-center" class:max-[740px]:hidden={variant === 'fixed'}>
        <div
        bind:this={iconRef}
        role="button"
        tabindex="0"
        class="p-2 cursor-pointer relative flex items-center"
        onclick={handleUserIconClick}
        onkeydown={onTriggerKeydown}
        onmouseenter={() => (isUserIconHovered = true)}
        onmouseleave={() => (isUserIconHovered = false)}
        aria-label={isAuthed ? 'User menu' : 'Sign in'}
        aria-haspopup="menu"
        aria-expanded={isAuthed && showUserDropdown ? 'true' : 'false'}
        aria-controls="user-menu"
        >
        <!-- (svg + displayName unchanged) -->
        <svg 
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        shape-rendering="geometricPrecision"
        class="transition-colors duration-200"
        style="color: {isUserIconHovered ? 'white' : 'rgba(255, 255, 255, 0.4)'};"
    >
        <path d="M20 21.5v-2.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2.5h16"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>

    {#if isAuthed}
        <span
            class="ml-2 text-[14px] text-neutral-300 font-mono max-w-[12rem] truncate transition-colors duration-200 leading-[1.2] py-[1px]"
            style="color: {isUserIconHovered ? 'white' : 'rgba(255,255,255,0.4)'};"
        >
            {displayName}
        </span>
    {/if}
  
      {#if isAuthed && showUserDropdown}
        <div
          id="user-menu"
          bind:this={menuRef}
          class="user-dropdown absolute top-full right-0 mt-1 w-40 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-50 {dropdownHiding ? 'hiding' : ''}"
          role="menu"
          tabindex="-1"
          style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
          onkeydown={onMenuKeydown}
        >
          <div
            role="menuitem"
            tabindex="0"
            class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 hover:text-white hover:bg-neutral-700/60 transition-all duration-200 focus:outline-none focus:bg-neutral-700/40"
            onclick={() => handleDropdownAction('profile')}
          >user profile</div>
          <div
            role="menuitem"
            tabindex="0"
            class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 hover:text-white hover:bg-neutral-700/60 transition-all duration-200 focus:outline-none focus:bg-neutral-700/40"
            onclick={() => handleDropdownAction('settings')}
          >account settings</div>
          <hr class="border-neutral-700">
          <div
            role="menuitem"
            tabindex="0"
            class="w-full px-2 py-1 text-left text-[13px] text-neutral-200 hover:text-white hover:bg-neutral-700/60 transition-all duration-200 focus:outline-none focus:bg-neutral-700/40"
            onclick={() => handleDropdownAction('signout')}
          >sign out</div>
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
		0% { transform: scale(0.3); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
	@keyframes dropdownShrink {
		0% { transform: scale(1); opacity: 1; }
		100% { transform: scale(0.3); opacity: 0; }
	}
</style>