<script lang="ts">
	import { user } from '$lib/stores/auth';
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
	let headerTooltip = $state({ show: false, x: 0, y: 0, text: '' });

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
	const isTutorial = $derived(pathname.startsWith('/tutorial'));
	const isLogin = $derived(pathname.startsWith('/login'));
	const logoIsInteractive = $derived(isProfile || isMotions || isLogin || isTutorial);

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

	function showHeaderTooltip(event: MouseEvent | FocusEvent, text: string) {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) return;
		const rect = target.getBoundingClientRect();

		headerTooltip = {
			show: true,
			x: rect.left + rect.width / 2,
			y: rect.bottom + 8,
			text
		};
	}

	function hideHeaderTooltip() {
		headerTooltip.show = false;
	}

	function handleProfileClick() {
		goto('/profile');
	}

	function handleProfilePointerEnter(event: MouseEvent | FocusEvent) {
		showHeaderTooltip(event, 'profile');
	}

	function handleProfilePointerLeave() {
		hideHeaderTooltip();
	}

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
			class="group relative mb-1 inline-flex items-center justify-center rounded-full !font-mono !text-lg text-white opacity-70 outline-none transition hover:opacity-100 focus-visible:opacity-100"
			onmouseenter={(event) => showHeaderTooltip(event, 'tutorial')}
			onmouseleave={hideHeaderTooltip}
			onfocus={(event) => showHeaderTooltip(event, 'tutorial')}
			onblur={hideHeaderTooltip}
			onclick={() => goto('/tutorial')}
			aria-label="tutorial"
		>
			<svg
				class={`h-7 w-7 opacity-50 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100`}
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
			class="group relative inline-flex items-center justify-center rounded-full px-2 pb-1 !font-mono !text-lg opacity-70 outline-none transition hover:opacity-100 focus-visible:opacity-100"
			onmouseenter={(event) => showHeaderTooltip(event, 'library')}
			onmouseleave={hideHeaderTooltip}
			onfocus={(event) => showHeaderTooltip(event, 'library')}
			onblur={hideHeaderTooltip}
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

		<button
			type="button"
			class="group relative inline-flex items-center rounded-full px-2 !font-mono !text-lg text-white opacity-70 outline-none transition hover:opacity-100 focus-visible:opacity-100"
			onmouseenter={handleProfilePointerEnter}
			onmouseleave={handleProfilePointerLeave}
			onfocus={handleProfilePointerEnter}
			onblur={handleProfilePointerLeave}
			onclick={handleProfileClick}
			aria-label="profile"
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
				class="h-5 w-5 text-white/50 transition-colors duration-200 group-hover:text-white group-focus-visible:text-white"
			>
				<path d="M20 21.5v-2.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2.5h16" />
				<circle cx="12" cy="7" r="4" />
			</svg>

			{#if isAuthed}
				<span
					class="ml-2 max-w-[12rem] truncate py-[1px] font-mono text-[14px] leading-[1.2] text-white/60 transition-colors duration-200 group-hover:text-white group-focus-visible:text-white"
					>{displayName}</span
				>
			{/if}
		</button>
	</div>
</div>

{#if headerTooltip.show}
	<div
		class="pointer-events-none fixed z-50 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-100 shadow-lg transition-all duration-200 ease-out"
		style="
			left: {headerTooltip.x}px;
			top: {headerTooltip.y}px;
			transform: translateX(-50%) translateY(0);
			font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;
			white-space: nowrap;
		"
	>
		{headerTooltip.text}
	</div>
{/if}

<style>
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
