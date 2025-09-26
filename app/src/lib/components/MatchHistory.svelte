<script lang="ts">
	import CardIcon from '$lib/components/CardIcon.svelte';

	type HistoryRow = {
		id: string;
		date: string;
		result: 'win' | 'loss' | 'draw' | 'placement';
		eloDelta: number | null;
		avgSpeed?: number;
		apm?: number;
	};

	const { history } = $props<{ history: HistoryRow[] }>();

	let cardElement: HTMLDivElement;
	let isHovered = $state(false);

	function handleMouseEnter() {
		isHovered = true;
	}

	function handleMouseLeave() {
		isHovered = false;
	}

	function fmtDate(iso: string) {
		const d = new Date(iso);
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function resultClass(result: HistoryRow['result']) {
		if (result === 'win') return 'text-emerald-400';
		if (result === 'loss') return 'text-rose-400';
		if (result === 'placement') return 'text-neutral-600';
		return 'text-yellow-400';
	}

	function eloDeltaClass(result: HistoryRow['result'], delta: HistoryRow['eloDelta']) {
		if (result === 'draw') return 'text-yellow-400';
		if (delta === null) return 'text-neutral-400';
		return delta >= 0 ? 'text-emerald-400' : 'text-rose-400';
	}

	function formatEloDelta(delta: HistoryRow['eloDelta']) {
		if (delta === null) return '';
		const prefix = delta >= 0 ? '+' : '';
		return `${prefix}${delta}`;
	}
</script>

<div
	bind:this={cardElement}
	class="relative overflow-hidden border border-dashed border-zinc-400 transition-all duration-300 dark:border-zinc-700"
	style="background:#0a0a0a; position: relative;"
	role="presentation"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<!-- Solid border overlay that appears on hover -->
	<div
		class="pointer-events-none absolute inset-0 border border-solid border-zinc-400 transition-opacity duration-300 dark:border-zinc-700"
		style="opacity: {isHovered ? 1 : 0}; margin: -1px;"
	></div>

	<!-- Corner pins -->
	<CardIcon class="-left-2 -top-2" />
	<CardIcon class="-right-2 -top-2" />
	<CardIcon class="-bottom-2 -left-2" />
	<CardIcon class="-bottom-2 -right-2" />

	<div class="relative z-10 overflow-x-auto">
		<table
			class="min-w-full text-sm"
			style="font-family: 'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',Monaco,monospace;"
		>
			<thead>
				<tr style="color:#c9ced6;">
					<th class="p-3 text-left text-[11px] tracking-[0.08em]">date</th>
					<th class="p-3 text-left text-[11px] tracking-[0.08em]">result</th>
					<th class="p-3 text-right text-[11px] tracking-[0.08em]">elo Δ</th>
					<th class="p-3 text-right text-[11px] tracking-[0.08em]">avg speed</th>
					<th class="p-3 text-right text-[11px] tracking-[0.08em]">apm</th>
				</tr>
			</thead>
			<tbody>
				{#each history as m}
					<tr class="border-t border-zinc-800">
						<td class="p-3 text-xs" style="color:#e8e8e8;">{fmtDate(m.date)}</td>
						<td class="p-3 text-xs">
							<span class={resultClass(m.result)}>{m.result}</span>
						</td>
						<td class="p-3 text-right text-xs">
							{#if m.result === 'placement' && m.eloDelta === null}
								<span class="text-neutral-400"></span>
							{:else}
								<span class={eloDeltaClass(m.result, m.eloDelta)}>
									{formatEloDelta(m.eloDelta)}
								</span>
							{/if}
						</td>
						<td class="p-3 text-right text-xs" style="color:#e8e8e8;"
							>{m.avgSpeed ? `${(m.avgSpeed / 1000).toFixed(2)}s` : '—'}</td
						>
						<td class="p-3 text-right text-xs" style="color:#e8e8e8;">{m.apm || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
