<script lang="ts">
	import { user } from '$lib/stores/auth';
	
	const { variant = 'inline', size = 'large' } = $props<{
		variant?: 'fixed' | 'inline';
		size?: 'small' | 'large';
	}>();
	
	let isHeaderHovered = $state(false);
	let isUserIconHovered = $state(false);
	
	function handleHeaderMouseEnter() {
		isHeaderHovered = true;
	}
	
	function handleHeaderMouseLeave() {
		isHeaderHovered = false;
	}
	
	function handleHeaderClick() {
		window.location.href = '/';
	}
	
	function handleUserIconClick() {
		if ($user) {
			window.location.href = '/profile';
		} else {
			// You can trigger sign in here if needed
			console.log('User not logged in');
		}
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
	<div 
		class="flex items-center"
		class:max-[740px]:hidden={variant === 'fixed'}
	>
		<div
			role="button"
			tabindex="0"
			class="p-2 rounded-full transition-all duration-200 cursor-pointer {isUserIconHovered ? 'bg-white/10' : ''}"
			onmouseenter={() => isUserIconHovered = true}
			onmouseleave={() => isUserIconHovered = false}
			onclick={handleUserIconClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleUserIconClick();
				}
			}}
			aria-label={$user ? 'Go to profile' : 'Sign in'}
		>
			{#if $user}
				<!-- Filled user icon for logged in users -->
				<svg 
					width="24" 
					height="24" 
					viewBox="0 0 24 24" 
					fill="currentColor"
					class="text-white transition-colors duration-200 {isUserIconHovered ? 'text-purple-400' : ''}"
				>
                    <path d="M32.6731 77.0068C25.7172 81.1486 7.47908 89.6057 18.5873 100.189C24.0136 105.358 30.057 109.056 37.6552 109.056H81.0115C88.6097 109.056 94.6533 105.358 100.079 100.189C111.188 89.6057 92.9496 81.1486 85.9935 77.0068C69.682 67.2939 48.9847 67.2939 32.6731 77.0068Z" stroke="#404040" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M81.4584 32.8472C81.4584 45.0665 71.5528 54.9722 59.3334 54.9722C47.1141 54.9722 37.2084 45.0665 37.2084 32.8472C37.2084 20.6279 47.1141 10.7222 59.3334 10.7222C71.5528 10.7222 81.4584 20.6279 81.4584 32.8472Z" stroke="#404040" stroke-width="8.5"/>
				</svg>
                    
			{:else}
				<!-- Outline user icon for logged out users -->
				<svg 
					width="24" 
					height="24" 
					viewBox="0 0 24 24" 
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="text-white/60 transition-colors duration-200 {isUserIconHovered ? 'text-white' : ''}"
				>
					<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
					<circle cx="12" cy="7" r="4"/>
				</svg>
			{/if}
		</div>
	</div>
</div>
