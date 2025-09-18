<script lang="ts">
	import defaultText from '$lib/default-code.svelte.txt?raw';
	import { scale } from 'svelte/transition';
	import CircularProgress from '$lib/components/CircularProgress.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { createVimController, type Cursor, type Mode } from '$lib/vim/vim';
	import type { MatchController, MatchState, MatchTarget } from '$lib/match/match';

	const COLS = 64; // pick what looks right; fixed column budget
	const GUTTER_PAD = 20; // space for line numbers + gap

	let targetW = 0,
		targetH = 0;

	const ROWS = 15;
	const MAX_ROWS = ROWS; // keep these in lockstep
	const TEXT_TOP = 38;

	export let match: MatchController;
	const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

	let matchState: MatchState = {
		status: 'idle',
		totalRounds: 21,
		scoringRounds: 20,
		roundIndex: 0,
		active: null,
		completed: [],
		timeLimitMs: 5000,
		totalPoints: 0,
		maxPoints: 20,
		pointsPerRound: 1
	};
	let unsubscribeMatch: (() => void) | null = null;
	let averageMs = 0;
	$: averageMs = matchState.completed.length
		? matchState.completed.reduce((sum, round) => sum + round.durationMs, 0) /
			matchState.completed.length
		: 0;
	$: totalRoundsDisplay = Math.max(1, (matchState.totalRounds ?? 1) - 1);

	let timeLimitMs = 5000;
	let timeRemaining = timeLimitMs;
	let timerExpired = false;
	let timeLabel = '0.0s';
	let totalPoints = 0;
	let pointsLabel = '+0';
	let timerBackground = 'conic-gradient(#34d399 360deg, rgba(15, 23, 42, 0.35) 360deg)';
	let timerColor = '#DDDDDD';
	let timerProgress = 1; // remaining / limit
	let timerValue = 0; // elapsed / limit for the ring

	$: timerValue = 1 - (timeLimitMs > 0 ? Math.max(0, Math.min(1, timeRemaining / timeLimitMs)) : 0);
	$: timeLimitMs = matchState.timeLimitMs ?? 5000;
	$: totalPoints = matchState.totalPoints ?? 0;
	$: pointsLabel = `${totalPoints > 0 ? '+' : ''}${totalPoints.toFixed(0)}`;
	$: timerExpired = timeRemaining <= 0;
	$: timeLabel = `${(timeRemaining / 1000).toFixed(1)}s`;
	$: timerColor = timerExpired ? '#f87171' : '#DDDDDD';
	$: timerBackground = `conic-gradient(${timerColor} ${timerProgress * 360}deg, rgba(15, 23, 42, 0.35) ${timerProgress * 360}deg)`;

	function recomputeLayout() {
		const gutter = Math.ceil(ctx.measureText(String(ROWS)).width) + GUTTER_PAD;
		targetW = Math.ceil(paddingX + gutter + COLS * charWidth + paddingX);
		targetH = Math.ceil(TEXT_TOP + MAX_ROWS * lineHeight) + 1; // +1 avoids clipping
	}

	let currentMode: Mode = 'normal';
	let pendingCount: number | null = null;
	let pendingCombo = '';
	let commandBuf = '';
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let raf = 0;
	let ro: ResizeObserver | undefined;
	let dpr = 1;

	const vim = createVimController({
		initialText: defaultText,
		maxRows: MAX_ROWS,
		onModeChange: (mode) => {
			currentMode = mode;
		},
		onUiStateChange: (uiState) => {
			pendingCombo = uiState.pendingCombo;
			pendingCount = uiState.pendingCount;
			commandBuf = uiState.commandBuffer;
		},
		onCommand: (command) => {
			if (command === 'wq' || command === 'x' || command === 'q') {
			}
		}
	});

	{
		const initialUiState = vim.getUiState();
		pendingCombo = initialUiState.pendingCombo;
		pendingCount = initialUiState.pendingCount;
		commandBuf = initialUiState.commandBuffer;
	}

	export const lines = vim.lines;
	export const cursor: Cursor = vim.cursor;

	export let charWidth = 9.6; // update after measureText
	export let lineHeight = 24; // fontSize * 1.3-ish
	export const paddingX = 30;
	export const paddingY = 20;

	function viewBase() {
		return vim.viewBase();
	}

	export function caretXY() {
		const base = viewBase();
		return {
			x: paddingX + 10 + cursor.col * 9.6328,
			y: paddingY + (cursor.row - base) * lineHeight
		};
	}

	function drawText() {
		const base = viewBase();
		const end = Math.min(lines.length, base + MAX_ROWS);

		ctx.fillStyle = '#737373';
		ctx.textAlign = 'right';
		ctx.font = '16px monospace';

		for (let r = base; r < end; r++) {
			const isCurrent = r === cursor.row;
			const rel = lines.length === 1 ? 1 : Math.abs(r - cursor.row);
			const label = isCurrent ? String(r + 1) : String(rel || 1);

			const tx = paddingX;
			const ty = TEXT_TOP + (r - base) * lineHeight;
			ctx.fillText(label, tx, ty);
		}

		ctx.textAlign = 'left';
		ctx.fillStyle = '#E4E4E4';
		ctx.font = '16px monospace';

		for (let r = base; r < end; r++) {
			const ty = TEXT_TOP + (r - base) * lineHeight;
			ctx.fillText(lines[r] ?? '', paddingX + 10, ty);
		}
	}

	function applyDpr() {
		// Only ever called in browser
		const rect = canvas.getBoundingClientRect();
		const next = Math.min(window.devicePixelRatio || 1, 3);
		const w = Math.round(rect.width * next);
		const h = Math.round(rect.height * next);
		if (canvas.width !== w || canvas.height !== h || dpr !== next) {
			dpr = next;
			canvas.width = w;
			canvas.height = h;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
	}

	function resize() {
		applyDpr();
		recomputeLayout();
	}

	function clear() {
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.restore();
	}

	function setFontMetrics() {
		charWidth = ctx.measureText('M').width;
	}

	function randInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function randomTargetInViewport(): { row: number; col: number } {
		const base = viewBase();
		const top = base;
		const bottom = Math.min(lines.length - 1, base + MAX_ROWS - 1);
		const candidates: Array<{ row: number; col: number }> = [];
		for (let r = top; r <= bottom; r++) {
			const line = lines[r] ?? '';
			const len = line.length;
			const last = Math.max(0, len ? len - 1 : 0);
			for (let c = 0; c <= last; c++) {
				if (c !== 0 && c < len) {
					const ch = line[c];
					if (ch === ' ' || ch === '\t') continue;
				}
				if (r !== cursor.row || c !== cursor.col) {
					candidates.push({ row: r, col: c });
				}
			}
		}
		if (!candidates.length) {
			return { row: cursor.row, col: cursor.col };
		}
		return candidates[randInt(0, candidates.length - 1)];
	}

	function generateSequenceTarget(): MatchTarget {
		const fallback = randomTargetInViewport();
		return { row: fallback.row, col: fallback.col, sequence: [] };
	}

	function drawGhostMove() {
		if (matchState.status === 'running') {
			match.evaluate({ row: cursor.row, col: cursor.col });
		}
		const active = matchState.active;
		if (!active) return;
		const target = active.target;
		const base = viewBase();
		const x = paddingX + 10 + target.col * 9.6328;
		const rowTop = paddingY + (target.row - base) * lineHeight;
		const caretH = Math.max(1, lineHeight - 1);
		ctx.save();
		ctx.fillStyle = 'rgb(194, 123, 255)';
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 1.5;
		ctx.fillRect(Math.floor(x), Math.floor(rowTop), Math.ceil(charWidth), caretH);
		ctx.restore();
	}
	function draw() {
		clear();

		const limit = timeLimitMs;
		if (matchState.active) {
			const startedAt = matchState.active.startedAt;
			const elapsed = startedAt == null ? 0 : performance.now() - startedAt;
			timeRemaining = Math.max(0, limit - elapsed);
		} else {
			timeRemaining = limit;
		}
		timerProgress = limit > 0 ? Math.max(0, Math.min(1, timeRemaining / limit)) : 0;

		drawGhostMove();
		drawText();
		switch (currentMode) {
			case 'insert':
				ctx.fillStyle = '#B990F5';
				break;
			case 'command':
				ctx.fillStyle = '#333333';
				break;
			case 'line':
				ctx.fillStyle = '#B990F5';
				break; // any highlight color
			default:
				ctx.fillStyle = '#dddddd';
		}
		const base = viewBase();
		const rowTop = paddingY + (cursor.row - base) * lineHeight;
		const textStartX = paddingX + 10;

		const visualLineStart = vim.getVisualLineStart();

		if (currentMode === 'line' && visualLineStart !== null) {
			const lo = Math.max(Math.min(visualLineStart, cursor.row), base);
			const hi = Math.min(Math.max(visualLineStart, cursor.row), lines.length - 1);

			ctx.globalAlpha = 0.28;
			for (let r = lo; r <= hi; r++) {
				const textW = Math.max(ctx.measureText(lines[r] ?? '').width, charWidth);
				const rowTop = paddingY + (r - base) * lineHeight;
				ctx.fillRect(Math.floor(textStartX), Math.floor(rowTop), Math.ceil(textW), lineHeight);
			}
			ctx.globalAlpha = 1;
		} else {
			const { x } = caretXY();
			const caretH = Math.max(1, lineHeight - 1); // avoid touching bottom edge
			ctx.globalAlpha = 0.85;
			ctx.fillRect(Math.floor(x), Math.floor(rowTop), 9.8, caretH);
			ctx.globalAlpha = 1;
		}
		raf = requestAnimationFrame(draw);
	}

	function onKeyDown(e: KeyboardEvent) {
		match.recordKey(e.key, now());
		vim.handleKeyDown(e);
		const uiState = vim.getUiState();
		pendingCombo = uiState.pendingCombo;
		pendingCount = uiState.pendingCount;
		commandBuf = uiState.commandBuffer;
	}

	onMount(async () => {
		if (!browser) return;

		matchState = get(match);
		unsubscribeMatch = match.subscribe((value) => {
			matchState = value;
		});
		match.setGenerator(generateSequenceTarget);
		if (matchState.status === 'idle') {
			match.start();
		}

		ctx = canvas.getContext('2d', { alpha: false })!;
		ctx.textBaseline = 'top';
		setFontMetrics();
		applyDpr();
		recomputeLayout();

		ro = new ResizeObserver(resize);
		ro.observe(canvas);
		window.addEventListener('resize', resize);

		canvas.tabIndex = 0;
		canvas.focus();

		raf = requestAnimationFrame(draw);
	});

	onDestroy(() => {
		if (!browser) return;
		unsubscribeMatch?.();
		ro?.disconnect();
		window.removeEventListener('resize', resize);
		cancelAnimationFrame(raf);
	});
</script>

<div class="fixed inset-0 flex flex-col items-center justify-center">
	<div class="flex flex-col gap-2">
		<div class="flex flex-row items-center justify-between">
			{#if matchState.active}
				<div class="pointer-events-none flex gap-2">
					<span
						class="rounded-xl border border-purple-400/40 bg-purple-400/10 px-3 py-1 font-mono text-lg uppercase tracking-wide text-purple-200"
					>
						{matchState.active.isWarmup
							? `0/${totalRoundsDisplay}`
							: `${Math.min(matchState.active.index, totalRoundsDisplay)}/${totalRoundsDisplay}`}
					</span>
				</div>
			{/if}
			{#if matchState.active && matchState.status !== 'complete'}
				<div class="relative flex h-8 w-8 items-center justify-center">
					<CircularProgress value={timerValue} size={26} stroke={1} />
				</div>
			{/if}
		</div>
		<div class="relative mb-10">
			<div
				data-mode={currentMode}
				class=" data-[mode=command]:border-white/7 overflow-hidden rounded-xl border
         border-white/10 shadow-lg transition-colors"
				style={`width:${targetW}px; height:${targetH}px`}
			>
				<canvas
					bind:this={canvas}
					class="block h-full w-full rounded-xl outline-none"
					on:keydown={onKeyDown}
					on:click={() => canvas?.focus()}
				></canvas>
			</div>

			{#if currentMode === 'command'}
				<div
					class="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] -translate-x-1/2"
					style={`width:${targetW}px`}
				>
					<div
						data-mode={currentMode}
						transition:scale={{ duration: 100, start: 0.8 }}
						class="w-full rounded-md border border-white/10 bg-black/60 px-3 py-1.5
             data-[mode=command]:border-white/10"
					>
						<span class="text-gray-300">:</span>
						<span class="font-mono text-gray-100">{commandBuf}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<div class="fixed bottom-3 right-4 z-50 space-y-1 text-right font-mono text-gray-100">
	<div>{pendingCombo}</div>
	<div>{pendingCount}</div>
</div>
