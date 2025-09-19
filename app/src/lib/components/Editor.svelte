<script lang="ts">
	import defaultText from '$lib/default-code.svelte.txt?raw';
	import { scale } from 'svelte/transition';
	import CircularProgress from '$lib/components/CircularProgress.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/auth';
	import { createVimController, type Cursor, type Mode } from '$lib/vim/vim';
	import type {
		MatchController,
		MatchState,
		MatchTarget,
		PlayerSelection,
		HighlightSelection
	} from '$lib/match/match';

	const COLS = 64; // pick what looks right; fixed column budget
	const GUTTER_PAD = 20; // space for line numbers + gap

	let targetW = 0,
		targetH = 0;

	const ROWS = 15;
	const MAX_ROWS = ROWS; // keep these in lockstep
	const TEXT_TOP = 38;

	const PLATINUM_THRESHOLD = 1200;
	const HIGHLIGHT_CHANCE = 0.4;
	const CARET_STEP = 9.6328;

	const MOVEMENT_GLOW_CONFIG = {
		rgb: '194, 123, 255',
		blur: [90, 400] as [number, number],
		spread: [10, 40] as [number, number],
		alpha: [0.12, 0.2] as [number, number],
		borderAlpha: [0.07, 0.22] as [number, number]
	};

	const HIGHLIGHT_GLOW_CONFIG = {
		rgb: '96, 165, 250',
		blur: [100, 400] as [number, number],
		spread: [10, 40] as [number, number],
		alpha: [0.14, 0.34] as [number, number],
		borderAlpha: [0.1, 0.26] as [number, number]
	};

	const DEFAULT_BORDER_COLOR = 'border-color: rgba(148, 163, 184, 0.14);';

	type RoundBracket = 'movement-only' | 'highlight-enabled';

	let roundBracket: RoundBracket = 'movement-only';
	let loadingRating = false;
	let unsubscribeUser: (() => void) | undefined;

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
	let timerColor = '#DDDDDD';
	let timerProgress = 1; // remaining / limit
	let glowBoxShadow = 'none';
	let glowBorderColor = DEFAULT_BORDER_COLOR;
	let editorStyle = '';

	$: timeLimitMs = matchState.timeLimitMs ?? 5000;
	$: timerValue = 1 - (timeLimitMs > 0 ? Math.max(0, Math.min(1, timeRemaining / timeLimitMs)) : 0);
	$: totalPoints = matchState.totalPoints ?? 0;
	$: pointsLabel = `${totalPoints > 0 ? '+' : ''}${totalPoints.toFixed(0)}`;
	$: timerExpired = timeRemaining <= 0;
	$: timeLabel = `${(timeRemaining / 1000).toFixed(1)}s`;
	$: timerColor = timerExpired ? '#f87171' : '#DDDDDD';
	$: activeTargetKind = matchState.active?.target.kind ?? null;
	$: {
		const strength = matchState.active ? glowStrength : 0;
		if (!matchState.active || strength <= 0.002) {
			glowBoxShadow = 'none';
			glowBorderColor = DEFAULT_BORDER_COLOR;
		} else if (activeTargetKind === 'highlight') {
			glowBoxShadow = buildGlow(HIGHLIGHT_GLOW_CONFIG, strength);
			glowBorderColor = buildBorderStyle(HIGHLIGHT_GLOW_CONFIG, strength);
		} else {
			glowBoxShadow = buildGlow(MOVEMENT_GLOW_CONFIG, strength);
			glowBorderColor = buildBorderStyle(MOVEMENT_GLOW_CONFIG, strength);
		}
	}
	$: editorStyle = `width:${targetW}px; height:${targetH}px; box-shadow:${glowBoxShadow}; ${glowBorderColor}`;

	function recomputeLayout() {
		const gutter = Math.ceil(ctx.measureText(String(ROWS)).width) + GUTTER_PAD;
		targetW = Math.ceil(paddingX + gutter + COLS * charWidth + paddingX);
		targetH = Math.ceil(TEXT_TOP + MAX_ROWS * lineHeight) + 1; // +1 avoids clipping
	}

	let currentMode: Mode = 'normal';
	let pendingCount: number | null = null;
	let pendingCombo = '';
	let commandBuf = '';
	let glowStrength = 0;
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
			x: paddingX + 10 + cursor.col * CARET_STEP,
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

	function lerp(a: number, b: number, t: number) {
		return a + (b - a) * Math.min(Math.max(t, 0), 1);
	}

	function buildGlow(
		config: {
			rgb: string;
			blur: [number, number];
			spread: [number, number];
			alpha: [number, number];
		},
		strength: number
	) {
		const blur = lerp(config.blur[0], config.blur[1], strength);
		const spread = lerp(config.spread[0], config.spread[1], strength);
		const alpha = lerp(config.alpha[0], config.alpha[1], strength);
		return `0 0 ${blur.toFixed(1)}px ${spread.toFixed(1)}px rgba(${config.rgb}, ${alpha.toFixed(3)})`;
	}

	function buildBorderStyle(
		config: {
			rgb: string;
			borderAlpha: [number, number];
		},
		strength: number
	) {
		const alpha = lerp(config.borderAlpha[0], config.borderAlpha[1], strength);
		return `border-color: rgba(${config.rgb}, ${alpha.toFixed(3)});`;
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

	function randomVisibleRow(): number | null {
		const base = viewBase();
		const top = base;
		const bottom = Math.min(lines.length - 1, base + MAX_ROWS - 1);
		if (bottom < top) return null;
		return randInt(top, bottom);
	}

	function visibleRowRange() {
		const base = viewBase();
		const top = base;
		const bottom = Math.min(lines.length - 1, base + MAX_ROWS - 1);
		const rows: number[] = [];
		for (let r = top; r <= bottom; r++) rows.push(r);
		return rows;
	}

	function lineHasMeaningfulContent(row: number) {
		const text = lines[row] ?? '';
		return text.trim().length >= 2;
	}

	function generateLineHighlightSelection(): HighlightSelection | null {
		const candidates = visibleRowRange().filter((row) => lineHasMeaningfulContent(row));
		if (!candidates.length) return null;
		const row = candidates[randInt(0, candidates.length - 1)];
		return { type: 'line', startRow: row, endRow: row };
	}

	function generateMultiLineHighlightSelection(): HighlightSelection | null {
		const rows = visibleRowRange();
		if (!rows.length || lines.length < 2) return null;
		for (let attempt = 0; attempt < 10; attempt++) {
			const startRow = rows[randInt(0, rows.length - 1)];
			const available = Math.min(lines.length - 1 - startRow, MAX_ROWS - 1);
			if (available < 1) continue;
			const span = randInt(1, Math.min(3, available));
			const endRow = startRow + span;
			const lo = Math.min(startRow, endRow);
			const hi = Math.max(startRow, endRow);
			let valid = true;
			for (let r = lo; r <= hi; r++) {
				if (!lineHasMeaningfulContent(r)) {
					valid = false;
					break;
				}
			}
			if (!valid) continue;
			return {
				type: 'line',
				startRow: lo,
				endRow: hi
			};
		}
		return null;
	}

	function collectWordCandidates() {
		const base = viewBase();
		const top = base;
		const bottom = Math.min(lines.length - 1, base + MAX_ROWS - 1);
		const candidates: Array<{ row: number; startCol: number; endCol: number }> = [];
		for (let row = top; row <= bottom; row++) {
			const text = lines[row] ?? '';
			const regex = /[A-Za-z0-9_]+/g;
			let match: RegExpExecArray | null;
			while ((match = regex.exec(text)) !== null) {
				const start = match.index ?? 0;
				const end = start + (match[0]?.length ?? 0);
				if (end > start) {
					candidates.push({ row, startCol: start, endCol: end });
				}
			}
		}
		return candidates;
	}

	function generateWordHighlightSelection(): HighlightSelection | null {
		const candidates = collectWordCandidates().filter(
			(candidate) => candidate.endCol - candidate.startCol >= 2
		);
		if (!candidates.length) return null;
		const candidate = candidates[randInt(0, candidates.length - 1)];
		return {
			type: 'char',
			start: { row: candidate.row, col: candidate.startCol },
			end: { row: candidate.row, col: candidate.endCol }
		};
	}

	function collectInsideCandidates() {
		const base = viewBase();
		const top = base;
		const bottom = Math.min(lines.length - 1, base + MAX_ROWS - 1);
		const candidates: Array<{ row: number; startCol: number; endCol: number }> = [];
		const bracketPairs: Array<{ open: string; close: string }> = [
			{ open: '(', close: ')' },
			{ open: '[', close: ']' },
			{ open: '{', close: '}' },
			{ open: '<', close: '>' }
		];
		const openSet = new Set(bracketPairs.map((pair) => pair.open));
		const closeMap = new Map(bracketPairs.map((pair) => [pair.close, pair.open]));
		for (let row = top; row <= bottom; row++) {
			const text = lines[row] ?? '';
			for (const quote of ['"', "'", '`']) {
				let index = text.indexOf(quote);
				while (index !== -1) {
					const end = text.indexOf(quote, index + 1);
					if (end === -1) break;
					if (end > index + 1) {
						candidates.push({ row, startCol: index + 1, endCol: end });
					}
					index = text.indexOf(quote, index + 1);
				}
			}
			const stack: Array<{ char: string; index: number }> = [];
			for (let i = 0; i < text.length; i++) {
				const ch = text[i];
				if (openSet.has(ch)) {
					stack.push({ char: ch, index: i });
					continue;
				}
				const matchingOpen = closeMap.get(ch);
				if (!matchingOpen) continue;
				for (let j = stack.length - 1; j >= 0; j--) {
					if (stack[j].char === matchingOpen) {
						const startIndex = stack[j].index;
						stack.splice(j, 1);
						if (i > startIndex + 1) {
							candidates.push({ row, startCol: startIndex + 1, endCol: i });
						}
						break;
					}
				}
			}
		}
		return candidates.filter((candidate) => candidate.endCol - candidate.startCol >= 2);
	}

	function generateInsideHighlightSelection(): HighlightSelection | null {
		const candidates = collectInsideCandidates();
		if (!candidates.length) return null;
		const candidate = candidates[randInt(0, candidates.length - 1)];
		return {
			type: 'char',
			start: { row: candidate.row, col: candidate.startCol },
			end: { row: candidate.row, col: candidate.endCol }
		};
	}

	function generateHighlightSelection(): HighlightSelection | null {
		const generators: Array<() => HighlightSelection | null> = [
			generateLineHighlightSelection,
			generateMultiLineHighlightSelection,
			generateWordHighlightSelection,
			generateInsideHighlightSelection
		];
		const pool = [...generators];
		while (pool.length) {
			const index = randInt(0, pool.length - 1);
			const selection = pool.splice(index, 1)[0]();
			if (selection) return selection;
		}
		return null;
	}

	function generateHighlightTarget(): MatchTarget | null {
		const selection = generateHighlightSelection();
		return selection ? { kind: 'highlight', selection } : null;
	}

	function generateMovementTarget(): MatchTarget {
		const fallback = randomTargetInViewport();
		return { kind: 'move', row: fallback.row, col: fallback.col, sequence: [] };
	}

	function generateRoundTarget(): MatchTarget {
		if (roundBracket === 'highlight-enabled') {
			if (Math.random() < HIGHLIGHT_CHANCE) {
				const highlight = generateHighlightTarget();
				if (highlight) return highlight;
			}
		}
		return generateMovementTarget();
	}

	function selectionForMatch(): PlayerSelection | null {
		const selection = vim.getSelection();
		if (!selection) return null;
		if (selection.type === 'line') {
			return { type: 'line', startRow: selection.startRow, endRow: selection.endRow };
		}
		return {
			type: 'char',
			start: { row: selection.start.row, col: selection.start.col },
			end: { row: selection.end.row, col: selection.end.col }
		};
	}

	async function loadPlayerRating() {
		if (!browser || loadingRating) return;
		loadingRating = true;
		try {
			const currentUser = get(user);
			if (!currentUser) {
				roundBracket = 'movement-only';
				return;
			}
			const { data, error } = await supabase
				.from('users')
				.select('rating')
				.eq('id', currentUser.id)
				.single();
			if (error) {
				console.error('Failed to fetch user rating', error);
				roundBracket = 'movement-only';
				return;
			}
			const ratingValue = typeof data?.rating === 'number' ? data.rating : null;
			roundBracket =
				ratingValue != null && ratingValue >= PLATINUM_THRESHOLD
					? 'highlight-enabled'
					: 'movement-only';
		} catch (error) {
			console.error('Failed to fetch user rating', error);
			roundBracket = 'movement-only';
		} finally {
			loadingRating = false;
		}
	}

	function drawTargetOverlay() {
		const active = matchState.active;
		if (!active) return;
		const target = active.target;
		const base = viewBase();
		const selection = selectionForMatch();
		if (matchState.status === 'running') {
			match.evaluate({
				cursor: { row: cursor.row, col: cursor.col },
				selection: selection ?? null
			});
		}

		if (target.kind === 'move') {
			const x = paddingX + 10 + target.col * CARET_STEP;
			const rowTop = paddingY + (target.row - base) * lineHeight;
			const caretH = Math.max(1, lineHeight - 1);
			ctx.save();
			ctx.fillStyle = 'rgb(194, 123, 255)';
			ctx.globalAlpha = 0.5;
			ctx.fillRect(Math.floor(x), Math.floor(rowTop), Math.ceil(charWidth), caretH);
			ctx.restore();
			return;
		}

		ctx.save();
		ctx.fillStyle = 'rgb(96, 165, 250)';
		ctx.globalAlpha = 0.35;
		const textStartX = paddingX + 10;
		if (target.selection.type === 'line') {
			const startRow = Math.max(target.selection.startRow, base);
			const endRow = Math.min(target.selection.endRow, lines.length - 1);
			for (let r = startRow; r <= endRow && r < base + MAX_ROWS; r++) {
				const text = lines[r] ?? '';
				const textW = Math.max(ctx.measureText(text).width, charWidth);
				const rowY = paddingY + (r - base) * lineHeight;
				ctx.fillRect(Math.floor(textStartX), Math.floor(rowY), Math.ceil(textW), lineHeight);
			}
		} else {
			const startRow = target.selection.start.row;
			const endRow = target.selection.end.row;
			for (let r = startRow; r <= endRow; r++) {
				if (r < base || r >= base + MAX_ROWS) continue;
				const text = lines[r] ?? '';
				const rowStart = r === startRow ? target.selection.start.col : 0;
				const rowEnd = r === endRow ? target.selection.end.col : text.length;
				const clampedStart = Math.max(0, Math.min(rowStart, text.length));
				const clampedEnd = Math.max(clampedStart, Math.min(rowEnd, text.length));
				if (clampedEnd <= clampedStart) continue;
				const prefix = text.slice(0, clampedStart);
				const segment = text.slice(clampedStart, clampedEnd);
				const x = textStartX + ctx.measureText(prefix).width;
				const width = Math.max(ctx.measureText(segment).width, charWidth);
				const rowY = paddingY + (r - base) * lineHeight;
				ctx.fillRect(Math.floor(x), Math.floor(rowY), Math.ceil(width), lineHeight);
			}
		}
		ctx.restore();
	}
	function draw() {
		clear();
		ctx.font = '16px monospace';

		const limit = timeLimitMs;
		if (matchState.active) {
			const startedAt = matchState.active.startedAt;
			const elapsed = startedAt == null ? 0 : performance.now() - startedAt;
			timeRemaining = Math.max(0, limit - elapsed);
		} else {
			timeRemaining = limit;
		}
		timerProgress = limit > 0 ? Math.max(0, Math.min(1, timeRemaining / limit)) : 0;

		if (matchState.active) {
			const nowMs = performance.now();
			const breath = (Math.sin(nowMs / 420) + 1) / 2; // 0..1
			const fade = Math.pow(timerProgress, 0.65);
			const base = fade * (0.6 + 0.4 * breath);
			const flickerWindow = Math.max(0, 1 - timerProgress / 0.22);
			const flicker = flickerWindow ? (Math.sin(nowMs / 75) * 0.5 + 0.5) * flickerWindow * 0.35 : 0;
			glowStrength = Math.max(0, Math.min(1, base + flicker));
		} else {
			glowStrength = 0;
		}

		drawTargetOverlay();
		drawText();
		const selection = vim.getSelection();
		const base = viewBase();
		const textStartX = paddingX + 10;

		switch (currentMode) {
			case 'insert':
				ctx.fillStyle = '#B990F5';
				break;
			case 'command':
				ctx.fillStyle = '#333333';
				break;
			case 'line':
			case 'visual':
				ctx.fillStyle = '#B990F5';
				break;
			default:
				ctx.fillStyle = '#dddddd';
		}

		if (selection) {
			ctx.globalAlpha = 0.28;
			if (selection.type === 'line') {
				const startRow = Math.max(selection.startRow, base);
				const endRow = Math.min(selection.endRow, lines.length - 1);
				for (let r = startRow; r <= endRow && r < base + MAX_ROWS; r++) {
					const text = lines[r] ?? '';
					const textW = Math.max(ctx.measureText(text).width, charWidth);
					const rowY = paddingY + (r - base) * lineHeight;
					ctx.fillRect(Math.floor(textStartX), Math.floor(rowY), Math.ceil(textW), lineHeight);
				}
			} else if (selection.type === 'char') {
				for (let r = selection.start.row; r <= selection.end.row; r++) {
					if (r < base || r >= base + MAX_ROWS) continue;
					const text = lines[r] ?? '';
					const rowStart = r === selection.start.row ? selection.start.col : 0;
					const rowEnd = r === selection.end.row ? selection.end.col : text.length;
					const clampedStart = Math.max(0, Math.min(rowStart, text.length));
					const clampedEnd = Math.max(clampedStart, Math.min(rowEnd, text.length));
					if (clampedEnd <= clampedStart) continue;
					const prefix = text.slice(0, clampedStart);
					const segment = text.slice(clampedStart, clampedEnd);
					const x = textStartX + ctx.measureText(prefix).width;
					const width = Math.max(ctx.measureText(segment).width, charWidth);
					const rowY = paddingY + (r - base) * lineHeight;
					ctx.fillRect(Math.floor(x), Math.floor(rowY), Math.ceil(width), lineHeight);
				}
			}
			ctx.globalAlpha = 1;
		}

		const shouldDrawCaret = !selection || selection.type !== 'line';
		if (shouldDrawCaret) {
			const { x } = caretXY();
			const caretRowTop = paddingY + (cursor.row - base) * lineHeight;
			const caretH = Math.max(1, lineHeight - 1); // avoid touching bottom edge
			ctx.globalAlpha = 0.85;
			ctx.fillRect(Math.floor(x), Math.floor(caretRowTop), 9.8, caretH);
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

	onMount(() => {
		if (!browser) return;

		matchState = get(match);
		unsubscribeMatch = match.subscribe((value) => {
			matchState = value;
		});
		match.setGenerator(() => generateRoundTarget());
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

		unsubscribeUser = user.subscribe(() => {
			loadPlayerRating();
		});
		loadPlayerRating();

		raf = requestAnimationFrame(draw);
	});

	onDestroy(() => {
		if (!browser) return;
		unsubscribeMatch?.();
		unsubscribeUser?.();
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
						class="rounded-xl border border-neutral-400/40 bg-neutral-400/10 px-3 py-1 font-mono text-lg uppercase tracking-wide text-neutral-100"
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
				data-glow-kind={activeTargetKind ?? 'none'}
				class=" data-[mode=command]:border-white/7 overflow-hidden rounded-xl border
         border-white/10 shadow-lg transition-all"
				style={editorStyle}
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

<style>
	[data-glow-kind] {
		transition:
			box-shadow 250ms ease,
			border-color 250ms ease;
	}
</style>
