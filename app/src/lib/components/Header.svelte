<script lang="ts">
	import { user, signOut } from '$lib/stores/auth';
	import { onDestroy } from 'svelte';

	const { variant = 'inline', size = 'large' } = $props<{
		variant?: 'fixed' | 'inline';
		size?: 'small' | 'large';
	}>();

	let isHeaderHovered = $state(false);
	let isUserIconHovered = $state(false);

	let showUserDropdown = $state(false);
	let dropdownHiding = $state(false);

	let dropdownTimeout: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	// Refs for safe-zone math
	let iconRef: HTMLDivElement;
	let menuRef: HTMLDivElement | null = null;

	const SAFE_MARGIN = 4;     // px around the bridge area
	const HIDE_DELAY = 0;    // ms grace to allow travel outside both

	function handleHeaderMouseEnter() { isHeaderHovered = true; }
	function handleHeaderMouseLeave() { isHeaderHovered = false; }

	function handleHeaderClick() {
		window.location.href = '/';
	}

	function handleUserIconClick() {
		if (!$user) console.log('User not logged in');
	}

	function handleUserIconMouseEnter() {
		if ($user) {
			cancelHide();
			showUserDropdown = true;
		}
		isUserIconHovered = true;
	}

	function handleUserIconMouseLeave() {
		isUserIconHovered = false;
		tryScheduleHide(); // don’t hide immediately—grace + safe zone handles gaps
	}

	function handleDropdownMouseEnter() {
		cancelHide();
	}

	function handleDropdownMouseLeave() {
		tryScheduleHide();
	}

	function startDropdownHideAnimation() {
		dropdownHiding = true;
		setTimeout(() => {
			showUserDropdown = false;
			dropdownHiding = false;
		}, 100); // match animation
	}

	function handleDropdownAction(action: string) {
		cancelHide();
		startDropdownHideAnimation();
		switch (action) {
			case 'profile':  window.location.href = '/profile'; break;
			case 'settings': console.log('Settings clicked'); break;
			case 'signout':  signOut(); break;
		}
	}

	// --- Safe-zone hover intent logic ---------------------------------------

	function tryScheduleHide() {
		// Grace period: if the pointer travels through the safe zone, we’ll cancel this.
		cancelHide();
		hideTimer = setTimeout(() => {
			// Final check: if pointer is still outside both + safe zone, hide
			if (!isPointerInIcon() && !isPointerInMenu() && !isPointerInBridge()) {
				startDropdownHideAnimation();
			}
		}, HIDE_DELAY);
	}

	function cancelHide() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	let lastPointer = { x: 0, y: 0 };
	function onPointerMove(e: PointerEvent) {
		lastPointer = { x: e.clientX, y: e.clientY };

		// Keep dropdown up if in icon, menu, or the “bridge” area between them.
		const inIcon = isPointInRect(lastPointer, getRect(iconRef));
		const inMenu = menuRef ? isPointInRect(lastPointer, getRect(menuRef)) : false;
		const inBridge = isPointerInBridge();

		// Icon highlight only when actually over icon
		isUserIconHovered = inIcon;

		if ($user && (inIcon || inMenu || inBridge)) {
			// Ensure visible while traveling between
			cancelHide();
			showUserDropdown = true;
		} else if (showUserDropdown) {
			// Outside both + bridge → allow delayed hide
			tryScheduleHide();
		}
	}

	// Attach pointer tracking while the dropdown could be visible (client-side only)
	if (typeof document !== 'undefined') {
		document.addEventListener('pointermove', onPointerMove, { passive: true });
		onDestroy(() => document.removeEventListener('pointermove', onPointerMove));
	}

	// --- Geometry helpers ----------------------------------------------------

	function getRect(el: Element | null) {
		return el ? el.getBoundingClientRect() : null;
	}
	function isPointInRect(p: { x: number; y: number }, r: DOMRect | null) {
		return !!r && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
	}

	function getBridgeRect() {
        const a = getRect(iconRef);
        const b = getRect(menuRef);
        if (!a || !b) return null;

        const SAFE_MARGIN = 8;

        // Sort by vertical position
        const topRect = a.top <= b.top ? a : b;
        const bottomRect = a.top <= b.top ? b : a;

        // Corridor spans horizontally across both, but only the vertical gap between them
        const left = Math.min(a.left, b.left) - SAFE_MARGIN;
        const right = Math.max(a.right, b.right) + SAFE_MARGIN;
        const top = topRect.bottom - SAFE_MARGIN;
        const bottom = bottomRect.top + SAFE_MARGIN;

        // If overlapping vertically already, fall back to the original bounding-box bridge
        if (bottom <= top) {
            return {
            left: Math.min(a.left, b.left) - SAFE_MARGIN,
            right: Math.max(a.right, b.right) + SAFE_MARGIN,
            top: Math.min(a.top, b.top) - SAFE_MARGIN,
            bottom: Math.max(a.bottom, b.bottom) + SAFE_MARGIN
            };
        }
        return { left, right, top, bottom };
        }

	function isPointerInIcon() {
		return isPointInRect(lastPointer, getRect(iconRef));
	}
	function isPointerInMenu() {
		return isPointInRect(lastPointer, getRect(menuRef));
	}
	function isPointerInBridge() {
		const bridge = getBridgeRect();
		if (!bridge) return false;

		// Inside the bridge bounding box?
		const inBridgeBox =
			lastPointer.x >= bridge.left &&
			lastPointer.x <= bridge.right &&
			lastPointer.y >= bridge.top &&
			lastPointer.y <= bridge.bottom;

		// But not inside icon/menu themselves
		if (!inBridgeBox) return false;
		if (isPointerInIcon() || isPointerInMenu()) return false;

		return true;
	}

	// Dynamic classes based on variant and size
	const containerClass = $derived(variant === 'fixed' 
		? 'fixed left-8 top-6 z-50 flex items-center justify-between w-full max-w-[calc(100vw-4rem)]' 
		: 'flex items-center justify-between');

	const logoClass = $derived(variant === 'fixed'
		? 'flex cursor-pointer items-center gap-2 max-[740px]:hidden'
		: 'flex items-center gap-2 cursor-pointer');

	const greaterThanClass = $derived(size === 'small'
		? 'text-2xl font-normal text-purple-400'
		: 'text-4xl font-normal');

	const vimgodClass = $derived(size === 'small'
		? 'text-xl font-medium'
		: 'text-3xl font-medium');

	const underscoreClass = $derived(size === 'small'
		? 'text-xl font-medium'
		: 'text-3xl font-medium');
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
			class={greaterThanClass}
			style="color:#bc93f9; font-family: 'Sono', sans-serif; font-weight: 400; transform: translateY(-1px);"
		>
			{`>`}
		</span>
		<span
			class={vimgodClass}
			style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500;"
		>
			vimgod
		</span>
		<span
			class={underscoreClass}
			style="color:#e8e8e8; font-family: 'DM Mono', sans-serif; font-weight: 500; transform: translateX(-8px); animation: {isHeaderHovered ? 'blink 1s infinite' : 'none'};"
		>
			_
		</span>
	</div>
	
	<!-- User Icon Section -->
	<div class="flex items-center" class:max-[740px]:hidden={variant === 'fixed'}>
		<div
			bind:this={iconRef}
			role="button"
			tabindex="0"
			class="p-2 cursor-pointer relative"
			onmouseenter={handleUserIconMouseEnter}
			onmouseleave={handleUserIconMouseLeave}
			onclick={handleUserIconClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleUserIconClick();
				}
			}}
			aria-label={$user ? 'User menu' : 'Sign in'}
			aria-haspopup="menu"
			aria-expanded={$user && showUserDropdown ? 'true' : 'false'}
			aria-controls="user-menu"
		>
			<svg 
				width="24" height="24" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				shape-rendering="geometricPrecision"
				class="transition-colors duration-200"
				style="color: {isUserIconHovered ? 'white' : 'rgba(255, 255, 255, 0.5)'};"
			>
				<path d="M20 21.5v-2.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2.5h16"/>
				<circle cx="12" cy="7" r="4"/>
			</svg>

			{#if $user && showUserDropdown}
				<div 
					id="user-menu"
					bind:this={menuRef}
					class="user-dropdown absolute top-full right-0 mt-1 w-24 bg-neutral-800 border border-neutral-700 rounded shadow-lg z-50 {dropdownHiding ? 'hiding' : ''}"
					role="menu"
					tabindex="-1"
					style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
					onmouseenter={handleDropdownMouseEnter}
					onmouseleave={handleDropdownMouseLeave}
				>
					<div class="py-0.5">
						<div
							role="menuitem" tabindex="0"
							class="w-full px-2 py-1 text-left text-[12px] text-neutral-200 hover:text-white transition-colors duration-200 focus:outline-none focus:bg-neutral-700/40"
							onclick={() => handleDropdownAction('profile')}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleDropdownAction('profile'))}
						>profile</div>
						<div
							role="menuitem" tabindex="0"
							class="w-full px-2 py-1 text-left text-[12px] text-neutral-200 hover:text-white transition-colors duration-200 focus:outline-none focus:bg-neutral-700/40"
							onclick={() => handleDropdownAction('settings')}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleDropdownAction('settings'))}
						>settings</div>
						<hr class="border-neutral-700 my-0.5">
						<div
							role="menuitem" tabindex="0"
							class="w-full px-2 py-1 text-left text-[12px] text-neutral-200 hover:text-white transition-colors duration-200 focus:outline-none focus:bg-neutral-700/40"
							onclick={() => handleDropdownAction('signout')}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleDropdownAction('signout'))}
						>sign out</div>
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
		0% { transform: scale(0.3); opacity: 0; }
		100% { transform: scale(1); opacity: 1; }
	}
	@keyframes dropdownShrink {
		0% { transform: scale(1); opacity: 1; }
		100% { transform: scale(0.3); opacity: 0; }
	}
</style>