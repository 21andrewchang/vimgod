<script lang="ts">
	import Footer from '$lib/components/Footer.svelte';
	import Tutorial from '$lib/components/Tutorial.svelte';

	type Kind = 'movement' | 'delete' | 'visual' | 'undo';
	type Combo = { keys: string | string[]; label: string; desc: string; kind: Kind };

	const combos: Combo[] = [
		{ keys: 'h j k l', label: 'basic movement', desc: 'left, down, up, right', kind: 'movement' },
		{
			keys: ['w'],
			label: 'move word',
			desc: 'jump to start of next word',
			kind: 'movement'
		},
		{
			keys: ['b'],
			label: 'move back',
			desc: 'jump to first char of current word or start of previous word',
			kind: 'movement'
		},
		{
			keys: ['e'],
			label: 'move end',
			desc: 'jump to last char of current word or end of next word',
			kind: 'movement'
		},
		{
			keys: ['0'],
			label: 'start of line',
			desc: 'teleport to the start of current line',
			kind: 'movement'
		},
		{
			keys: ['^'],
			label: 'current line',
			desc: 'teleport to first char of current line',
			kind: 'movement'
		},
		{
			keys: ['$'],
			label: 'end of line',
			desc: 'teleport to end of line',
			kind: 'movement'
		},
		{
			keys: ['gg'],
			label: 'first line',
			desc: 'teleport to first line of file',
			kind: 'movement'
		},
		{
			keys: ['G'],
			label: 'last line',
			desc: 'teleport to last line of file',
			kind: 'movement'
		},
		{
			keys: ['f{char}'],
			label: 'find {char}',
			desc: 'teleport cursor to the next instance {char}',
			kind: 'movement'
		},
		{
			keys: ['F{char}'],
			label: 'find previous {char}',
			desc: 'teleport cursor to the previous instance {char}',
			kind: 'movement'
		},
		{
			keys: ['t{char}'],
			label: 'to {char}',
			desc: 'teleport cursor right before the next instance of {char}',
			kind: 'movement'
		},
		{
			keys: ['T{char}'],
			label: 'to previous {char}',
			desc: 'teleport cursor right before the previous instance of {char}',
			kind: 'movement'
		},
		{
			keys: ['Shift + v'],
			label: 'select line',
			desc: 'highlight the current line',
			kind: 'visual'
		},
		{
			keys: ['viw'],
			label: 'select in word',
			desc: 'highlight the current word',
			kind: 'visual'
		},
		{
			keys: ['vi(', 'vi)'],
			label: 'select in ()',
			desc: 'highlight content inside of current or next ()',
			kind: 'visual'
		},
		{
			keys: ['vi<', 'vi>'],
			label: 'select in <>',
			desc: 'highlight content inside of current or next <>',
			kind: 'visual'
		},
		{
			keys: ['d'],
			label: 'delete',
			desc: 'deletes current selection',
			kind: 'delete'
		},
		{
			keys: ['di(', 'di)'],
			label: 'delete in ()',
			desc: 'delete the contents of the current or next ()',
			kind: 'delete'
		},
		{
			keys: ['di<', 'di>'],
			label: 'delete in <>',
			desc: 'delete the contents of the current or next <>',
			kind: 'delete'
		},
		{ keys: ['dd'], label: 'delete line', desc: 'deletes the current line', kind: 'delete' },
		{ keys: ['u'], label: 'Undo', desc: 'undo your most recent edit', kind: 'undo' }
	];

	function keyPill(k: string) {
		return k.replace(/^<C-(.+)>$/i, 'Ctrl+$1').replace(/^<c-(.+)>$/i, 'Ctrl+$1');
	}

	let started = false;
</script>

<svelte:head>
	<title>vimgod</title>
	<meta name="description" content="vimgod - ranked vim. gg." />
	<style>
		html,
		body {
			height: 100%;
			overflow: hidden;
		} /* no scroll anywhere */
	</style>
</svelte:head>

<main
	class="relative flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center gap-8 bg-black py-8"
>
	{#if !started}
		<div class="flex flex-col items-center gap-6">
			<div
				class="fade-bottom max-h-[70dvh] overflow-y-auto overscroll-contain p-4"
				tabindex="0"
				aria-label="vim combos list"
			>
				<section class="w-[min(1100px,92vw)]">
					<div
						class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
						aria-label="vim combos"
					>
						{#each combos as c}
							<article
								data-kind={c.kind}
								class="group rounded-xl border-0 bg-neutral-900/60 p-4 shadow-sm outline-none transition
								hover:[box-shadow:0_0_0_1px_var(--kind-border),0_0_30px_var(--kind-shadow)]
								focus-visible:outline-none
								focus-visible:[box-shadow:0_0_0_1px_var(--kind-border),0_0_36px_var(--kind-shadow)]"
								tabindex="0"
							>
								<!-- combo -->
								<div class="mb-2 flex flex-wrap items-center gap-1.5">
									{#if Array.isArray(c.keys)}
										{#each c.keys as k, i}
											<kbd class="kbd">{keyPill(k)}</kbd>
											{#if i < c.keys.length - 1}
												<span class="mx-0.5 text-xs text-neutral-500">/</span>
											{/if}
										{/each}
									{:else}
										{#each c.keys.split(' ') as k, i}
											<kbd class="kbd">{keyPill(k)}</kbd>
											{#if i < c.keys.split(' ').length - 1}
												<span class="mx-0.5 text-xs text-neutral-500">·</span>
											{/if}
										{/each}
									{/if}
								</div>

								<h3 class="font-mono text-sm tracking-wide text-neutral-100">{c.label}</h3>
								<p class="mt-1 font-mono text-[13px] leading-snug text-neutral-400">{c.desc}</p>

								<!-- bottom accent bar -->
								<div
									class="pointer-events-none mt-3 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-[var(--kind-from)] via-[var(--kind-via)] to-transparent transition-transform duration-300 group-hover:scale-x-100"
								/>
							</article>
						{/each}
					</div>
					<div class="h-24 sm:h-28 md:h-32" aria-hidden="true" />
				</section>
			</div>
		</div>
	{:else}
		<Tutorial />
	{/if}

	<Footer minimal={true} />
</main>

<style>
	::selection {
		background: transparent;
	}

	/* ---- Color tokens per kind (card = no border at rest) ---- */
	article[data-kind] {
		/* card color tokens */
		--kind-border: rgba(186, 104, 255, 0.38);
		--kind-shadow: rgba(186, 104, 255, 0.18);
		--kind-from: rgba(186, 104, 255, 0.7);
		--kind-via: rgba(99, 102, 241, 0.6);

		/* key pill (kbd) default border color per card kind */
		--pill-border: var(--kind-border);
	}

	/* movement → purple */
	article[data-kind='movement'] {
		--kind-border: rgba(186, 104, 255, 0.38);
		--kind-shadow: rgba(186, 104, 255, 0.18);
		--kind-from: rgba(186, 104, 255, 0.7);
		--kind-via: rgba(99, 102, 241, 0.6);
		--pill-border: rgba(186, 104, 255, 0.55);
	}
	/* delete → red */
	article[data-kind='delete'] {
		--kind-border: rgba(239, 68, 68, 0.42);
		--kind-shadow: rgba(239, 68, 68, 0.22);
		--kind-from: rgba(239, 68, 68, 0.75);
		--kind-via: rgba(248, 113, 113, 0.65);
		--pill-border: rgba(239, 68, 68, 0.6);
	}
	/* visual/highlight → blue */
	article[data-kind='visual'] {
		--kind-border: rgba(59, 130, 246, 0.42);
		--kind-shadow: rgba(59, 130, 246, 0.22);
		--kind-from: rgba(59, 130, 246, 0.75);
		--kind-via: rgba(56, 189, 248, 0.65);
		--pill-border: rgba(59, 130, 246, 0.6);
	}
	/* undo → yellow */
	article[data-kind='undo'] {
		--kind-border: rgba(234, 179, 8, 0.48);
		--kind-shadow: rgba(234, 179, 8, 0.22);
		--kind-from: rgba(250, 204, 21, 0.85);
		--kind-via: rgba(253, 224, 71, 0.7);
		--pill-border: rgba(250, 204, 21, 0.7);
	}

	.kbd {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.15rem 0.45rem;
		min-width: 1.6rem;
		border-radius: 0.375rem;
		border: 1px solid var(--pill-border);
		background: rgba(24, 24, 24, 0.9);
		box-shadow:
			inset 0 -1px 0 rgba(255, 255, 255, 0.06),
			0 2px 10px rgba(0, 0, 0, 0.35);
		color: #e7e7e7;
		font:
			500 12px/1.1 ui-monospace,
			SFMono-Regular,
			Menlo,
			Monaco,
			Consolas,
			'Liberation Mono',
			'JetBrains Mono',
			monospace;
		letter-spacing: 0.02em;
		transition:
			transform 0.15s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}
	article:hover .kbd {
		transform: translateY(-1px);
	}
	div[aria-label='vim combos list'] {
		scrollbar-width: thin;
		scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
	}
	div[aria-label='vim combos list']::-webkit-scrollbar {
		width: 8px;
	}
	div[aria-label='vim combos list']::-webkit-scrollbar-thumb {
		background: rgba(148, 163, 184, 0.35);
		border-radius: 999px;
	}
	div[aria-label='vim combos list']::-webkit-scrollbar-track {
		background: transparent;
	}
	/* Fade only at the bottom (24px tall fade) */
	.fade-bottom {
		/* Safari/Chromium */
		-webkit-mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 1) calc(100% - 24px),
			rgba(0, 0, 0, 0) 100%
		);
		mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 1) calc(100% - 24px),
			rgba(0, 0, 0, 0) 100%
		);
	}

	/* If you want top+bottom fade instead, swap to this: */
	.fade-edges {
		-webkit-mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0) 0,
			rgba(0, 0, 0, 1) 24px,
			rgba(0, 0, 0, 1) calc(100% - 24px),
			rgba(0, 0, 0, 0) 100%
		);
		mask-image: linear-gradient(
			to bottom,
			rgba(0, 0, 0, 0) 0,
			rgba(0, 0, 0, 1) 24px,
			rgba(0, 0, 0, 1) calc(100% - 24px),
			rgba(0, 0, 0, 0) 100%
		);
	}
</style>
