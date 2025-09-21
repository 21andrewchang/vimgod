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
	import RoundGoalBadge from '$lib/components/RoundGoalBadge.svelte';
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
	const MAX_ROWS = ROWS;
	const TEXT_TOP = 38;

	const PLATINUM_THRESHOLD = 1200;
	const DIAMOND_THRESHOLD = 1600;
	const HIGHLIGHT_CHANCE = 0.4;
	const MANIPULATION_CHANCE = 0.35;
	const MAX_MANIPULATION_LINES = 2;
	const MAX_MANIPULATION_ROUNDS = 4;
	const MAX_MANIPULATION_SELECTION_ATTEMPTS = 8;
	const MAX_UNDO_ENTRIES = 50;

	const RATING_TIMER_RULES: Array<{ max: number; ms: number }> = [
		{ max: 399, ms: 5000 },
		{ max: 799, ms: 4000 },
		{ max: 1199, ms: 3000 },
		{ max: 1599, ms: 2000 },
		{ max: Infinity, ms: 1500 }
	];
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

	const MANIPULATION_GLOW_CONFIG = {
		rgb: '239, 68, 68',
		blur: [100, 420] as [number, number],
		spread: [10, 44] as [number, number],
		alpha: [0.16, 0.38] as [number, number],
		borderAlpha: [0.12, 0.32] as [number, number]
	};

	const FORCE_UNDO_GLOW_CONFIG = {
		rgb: '252, 223, 73',
		blur: [100, 300] as [number, number],
		spread: [0, 1] as [number, number],
		alpha: [0.16, 0.38] as [number, number],
		borderAlpha: [0.1, 0.5] as [number, number]
	};

	const DEFAULT_BORDER_COLOR = 'border-color: rgba(148, 163, 184, 0.14);';

	type RoundBracket = 'movement-only' | 'highlight-enabled' | 'manipulation-enabled';

	type UndoSnapshot = { document: string; cursor: { row: number; col: number } };
	let roundBracket: RoundBracket = 'movement-only';
	let manipulationRoundsGenerated = 0;
	let loadingRating = false;
	let undoStack: UndoSnapshot[] = [];
	let roundBaselineSnapshot: UndoSnapshot | null = null;
	let lastActiveRoundIndex: number | null = null;
	let forceUndoRequired = false;
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
		pointsPerRound: 1,
		undoCount: 0,
		outcome: undefined
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
	let totalPoints = 0;
	let pointsLabel = '+0';
	let timerValue = 0;
	let timerProgress = 1; // remaining / limit
	let timerFill = 'rgba(226, 232, 240, 1)';
	let timerBorder = 'rgba(226, 232, 240, 1)';
	let displaySeconds = 0;
	let glowBoxShadow = 'none';
	let glowBorderColor = DEFAULT_BORDER_COLOR;
	let editorStyle = '';
	let currentRating: number | null = null;
	let activeTargetKind: MatchTarget['kind'] | null = null;
	let manipulationAction: 'delete' | null = null;
	let undoCount = 0;
	let signedIn = false;
	let warmupState: 'inactive' | 'waiting' | 'countdown' | 'complete' = 'inactive';
	let warmupCountdownValue = 3;
	let warmupTimer: ReturnType<typeof setTimeout> | null = null;
	let warmupRoomActive = false;
	let showTimer = false;
	let currentRoundDisplay = 0;
	let warmupPulse = false;
	let warmupPulseTimer: ReturnType<typeof setTimeout> | null = null;

	function cancelWarmupTimer() {
		if (warmupTimer) {
			clearTimeout(warmupTimer);
			warmupTimer = null;
		}
	}

	function cancelWarmupPulseTimer() {
		if (warmupPulseTimer) {
			clearTimeout(warmupPulseTimer);
			warmupPulseTimer = null;
		}
	}

	function exitWarmup() {
		cancelWarmupTimer();
		cancelWarmupPulseTimer();
		warmupState = 'inactive';
		warmupCountdownValue = 3;
	}

	function enterWarmup() {
		exitWarmup();
		warmupState = 'waiting';
		forceUndoRequired = false;
		undoStack = [];
		roundBaselineSnapshot = null;
	}

	function finishWarmup() {
		cancelWarmupTimer();
		cancelWarmupPulseTimer();
		warmupState = 'complete';
		warmupCountdownValue = 0;
		match.start({ skipWarmup: true });
	}

	function triggerWarmupPulse() {
		warmupPulse = true;
		cancelWarmupPulseTimer();
		warmupPulseTimer = setTimeout(() => {
			warmupPulse = false;
			warmupPulseTimer = null;
		}, 320);
	}

	function runWarmupCountdownStep(value: number) {
		warmupCountdownValue = value;
		triggerWarmupPulse();
		if (value <= 1) {
			warmupTimer = setTimeout(() => {
				warmupTimer = null;
				finishWarmup();
			}, 1000);
		} else {
			warmupTimer = setTimeout(() => {
				runWarmupCountdownStep(value - 1);
			}, 1000);
		}
	}

	function startWarmupCountdown() {
		if (warmupState !== 'waiting') return;
		warmupState = 'countdown';
		runWarmupCountdownStep(3);
	}

	$: timeLimitMs = matchState.timeLimitMs ?? 5000;
	$: totalPoints = matchState.totalPoints ?? 0;
	$: pointsLabel = `${totalPoints > 0 ? '+' : ''}${totalPoints.toFixed(0)}`;
	$: timerValue = 1 - (timeLimitMs > 0 ? Math.max(0, Math.min(1, timeRemaining / timeLimitMs)) : 0);
	$: timerExpired = timeRemaining <= 0;
	$: displaySeconds = timeLimitMs > 0 ? Math.max(0, Math.ceil(timeRemaining / 1000)) : 0;
	$: activeTargetKind = matchState.active?.target.kind ?? null;
	$: manipulationAction =
		matchState.active?.target.kind === 'manipulate' ? matchState.active.target.action : null;
	$: {
		const strength = matchState.active ? glowStrength : 0;
		if (!matchState.active || strength <= 0.002) {
			glowBoxShadow = 'none';
			glowBorderColor = DEFAULT_BORDER_COLOR;
		} else if (forceUndoRequired) {
			const forcedStrength = Math.max(strength, 0.65);
			glowBoxShadow = buildGlow(FORCE_UNDO_GLOW_CONFIG, forcedStrength);
			glowBorderColor = buildBorderStyle(FORCE_UNDO_GLOW_CONFIG, forcedStrength);
		} else if (activeTargetKind === 'highlight') {
			glowBoxShadow = buildGlow(HIGHLIGHT_GLOW_CONFIG, strength);
			glowBorderColor = buildBorderStyle(HIGHLIGHT_GLOW_CONFIG, strength);
		} else if (activeTargetKind === 'manipulate') {
			glowBoxShadow = buildGlow(MANIPULATION_GLOW_CONFIG, strength);
			glowBorderColor = buildBorderStyle(MANIPULATION_GLOW_CONFIG, strength);
		} else {
			glowBoxShadow = buildGlow(MOVEMENT_GLOW_CONFIG, strength);
			glowBorderColor = buildBorderStyle(MOVEMENT_GLOW_CONFIG, strength);
		}
	}
	$: warmupRoomActive = signedIn && (warmupState === 'waiting' || warmupState === 'countdown');
	$: currentRoundDisplay =
		warmupRoomActive || matchState.active?.isWarmup
			? 0
			: Math.min(matchState.active?.index ?? 0, totalRoundsDisplay);
	$: showTimer =
		matchState.status !== 'complete' &&
		!!matchState.active &&
		(!matchState.active.isWarmup || !signedIn);
	$: if (warmupRoomActive) {
		if (warmupState === 'countdown') {
			const baseGlow = warmupPulse
				? '0 0 300px 0px rgba(255, 255, 255, 0.2)'
				: '0 0 50px 0px rgba(255, 255, 255, 0.2)';
			glowBoxShadow = baseGlow;
			glowBorderColor = warmupPulse
				? 'border-color: rgba(255, 255, 255, 0.1);'
				: 'border-color: rgba(255, 255, 255, 0.1);';
		} else {
			glowBoxShadow = 'none';
			glowBorderColor = 'border-color: rgba(255, 255, 255, 0.1);';
		}
	}
	$: editorStyle = `width:${targetW}px; height:${targetH}px; box-shadow:${glowBoxShadow}; ${glowBorderColor}`;
	$: if (matchState.status === 'idle') {
		manipulationRoundsGenerated = 0;
		undoStack = [];
		roundBaselineSnapshot = null;
		lastActiveRoundIndex = null;
		forceUndoRequired = false;
		undoCount = 0;
	}
	$: match?.setUndoCount?.(undoCount);

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

	function selectionText(selection: HighlightSelection): string {
		if (selection.type === 'line') {
			const rows: string[] = [];
			for (let r = selection.startRow; r <= selection.endRow; r++) {
				if (r < 0 || r >= lines.length) {
					rows.push('');
					continue;
				}
				rows.push(lines[r] ?? '');
			}
			return rows.join('\n');
		}

		const startRow = selection.start.row;
		const endRow = selection.end.row;
		if (startRow < 0 || startRow >= lines.length) return '';
		const parts: string[] = [];
		for (let r = startRow; r <= endRow; r++) {
			if (r < 0 || r >= lines.length) {
				parts.push('');
				continue;
			}
			const text = lines[r] ?? '';
			const rowStart = r === startRow ? Math.min(selection.start.col, text.length) : 0;
			const rowEnd = r === endRow ? Math.min(selection.end.col, text.length) : text.length;
			parts.push(text.slice(rowStart, rowEnd));
		}
		return parts.join('\n');
	}

	function serializeDocument(source: string[] = lines) {
		return source.join('\n');
	}

	function cloneLines() {
		return lines.map((line) => line.slice());
	}

	function selectionLineSpan(selection: HighlightSelection) {
		if (selection.type === 'line') {
			return selection.endRow - selection.startRow + 1;
		}
		return selection.end.row - selection.start.row + 1;
	}

	function pushUndoSnapshot(snapshot: UndoSnapshot) {
		const last = undoStack[undoStack.length - 1];
		if (
			last &&
			last.document === snapshot.document &&
			last.cursor.row === snapshot.cursor.row &&
			last.cursor.col === snapshot.cursor.col
		) {
			return;
		}
		undoStack.push(snapshot);
		if (undoStack.length > MAX_UNDO_ENTRIES) {
			const overflow = undoStack.length - MAX_UNDO_ENTRIES;
			undoStack.splice(0, overflow);
		}
	}

	function resetForceUndoIfCleared(nextDocument: string) {
		const baselineDocument = roundBaselineSnapshot?.document ?? null;
		if (baselineDocument && nextDocument === baselineDocument) {
			forceUndoRequired = false;
			undoStack = [];
			return true;
		}
		const target = matchState.active?.target;
		if (target?.kind === 'manipulate' && nextDocument === target.expectedDocument) {
			forceUndoRequired = false;
			return true;
		}
		return false;
	}

	function requireUndo() {
		if (!forceUndoRequired) {
			forceUndoRequired = true;
			undoCount += 1;
		}
	}

	function handleDocumentChange(previousDocument: string, nextDocument: string) {
		if (!matchState.active) return;
		if (resetForceUndoIfCleared(nextDocument)) return;
		const target = matchState.active.target;
		if (target.kind === 'manipulate') {
			requireUndo();
			return;
		}
		const deletionOccurred = nextDocument.length < previousDocument.length;
		if (deletionOccurred) {
			requireUndo();
		}
	}

	function handleUndo() {
		const snapshot = undoStack.pop();
		if (snapshot) {
			vim.resetDocument(snapshot.document, snapshot.cursor);
			recomputeLayout();
			resetForceUndoIfCleared(serializeDocument());
			return;
		}
		if (!roundBaselineSnapshot) return;
		vim.resetDocument(roundBaselineSnapshot.document, roundBaselineSnapshot.cursor);
		recomputeLayout();
		resetForceUndoIfCleared(serializeDocument());
	}

	function isUndoKey(event: KeyboardEvent) {
		const hasPendingCombo = pendingCombo.length > 0;
		return (
			currentMode === 'normal' &&
			!hasPendingCombo &&
			event.key === 'u' &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		);
	}

	function applyDeletionToClone(clone: string[], selection: HighlightSelection) {
		if (!clone.length) {
			clone.push('');
		}
		if (selection.type === 'line') {
			const startRow = Math.max(0, Math.min(selection.startRow, clone.length - 1));
			const endRow = Math.max(0, Math.min(selection.endRow, clone.length - 1));
			clone.splice(startRow, endRow - startRow + 1);
			if (!clone.length) clone.push('');
			return clone;
		}

		const startRow = Math.max(0, Math.min(selection.start.row, clone.length - 1));
		const endRow = Math.max(0, Math.min(selection.end.row, clone.length - 1));
		const startLine = clone[startRow] ?? '';
		const endLine = clone[endRow] ?? '';
		const startCol = Math.max(0, Math.min(selection.start.col, startLine.length));
		const endCol = Math.max(0, Math.min(selection.end.col, endLine.length));

		if (startRow === endRow) {
			const line = clone[startRow] ?? '';
			clone[startRow] = line.slice(0, startCol) + line.slice(endCol);
		} else {
			const before = startLine.slice(0, startCol);
			const after = endLine.slice(endCol);
			clone.splice(startRow, endRow - startRow + 1, before + after);
		}

		if (!clone.length) clone.push('');
		return clone;
	}

	function expectedDocumentAfterDeletion(selection: HighlightSelection) {
		const clone = applyDeletionToClone(cloneLines(), selection);
		return serializeDocument(clone);
	}

	function generateManipulationSelection(): HighlightSelection | null {
		for (let attempt = 0; attempt < MAX_MANIPULATION_SELECTION_ATTEMPTS; attempt++) {
			const selection = generateHighlightSelection();
			if (!selection) continue;
			if (selectionLineSpan(selection) <= MAX_MANIPULATION_LINES) {
				return selection;
			}
		}
		const fallbackRow = randomVisibleRow() ?? (lines.length ? randInt(0, lines.length - 1) : null);
		if (fallbackRow === null) return null;
		return { type: 'line', startRow: fallbackRow, endRow: fallbackRow };
	}

	function generateHighlightTarget(): MatchTarget | null {
		const selection = generateHighlightSelection();
		return selection ? { kind: 'highlight', selection } : null;
	}

	function generateManipulationTarget(): MatchTarget | null {
		const selection = generateManipulationSelection();
		if (!selection) return null;
		const snapshot = selectionText(selection);
		const expectedDocument = expectedDocumentAfterDeletion(selection);
		return { kind: 'manipulate', selection, action: 'delete', snapshot, expectedDocument };
	}

	function generateMovementTarget(): MatchTarget {
		const fallback = randomTargetInViewport();
		return { kind: 'move', row: fallback.row, col: fallback.col, sequence: [] };
	}

	function generateRoundTarget(): MatchTarget {
		const canAttemptManipulation =
			roundBracket === 'manipulation-enabled' &&
			manipulationRoundsGenerated < MAX_MANIPULATION_ROUNDS;
		if (canAttemptManipulation) {
			if (Math.random() < MANIPULATION_CHANCE) {
				const manipulation = generateManipulationTarget();
				if (manipulation) {
					manipulationRoundsGenerated += 1;
					return manipulation;
				}
			}
		}
		if (roundBracket === 'manipulation-enabled') {
			if (Math.random() < HIGHLIGHT_CHANCE) {
				const highlight = generateHighlightTarget();
				if (highlight) return highlight;
			}
		}
		if (roundBracket === 'highlight-enabled') {
			if (Math.random() < HIGHLIGHT_CHANCE) {
				const highlight = generateHighlightTarget();
				if (highlight) return highlight;
			}
		}
		return generateMovementTarget();
	}

	$: {
		const activeIndex = matchState.active?.index ?? null;
		if (activeIndex !== lastActiveRoundIndex) {
			lastActiveRoundIndex = activeIndex;
			undoStack = [];
			if (activeIndex !== null) {
				roundBaselineSnapshot = {
					document: serializeDocument(),
					cursor: { row: cursor.row, col: cursor.col }
				};
			} else {
				roundBaselineSnapshot = null;
			}
			forceUndoRequired = false;
		}
	}

	function timerForRating(rating: number | null) {
		const value = rating ?? 0;
		for (const rule of RATING_TIMER_RULES) {
			if (value < rule.max) return rule.ms;
		}
		return 5000;
	}

	function applyTimerForRating(rating: number | null) {
		const ms = timerForRating(rating);
		match?.setTimeLimit?.(ms);
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
				currentRating = null;
				roundBracket = 'movement-only';
				applyTimerForRating(currentRating);
				return;
			}
			const { data, error } = await supabase
				.from('users')
				.select('rating')
				.eq('id', currentUser.id)
				.single();
			if (error) {
				console.error('Failed to fetch user rating', error);
				currentRating = null;
				roundBracket = 'movement-only';
				applyTimerForRating(currentRating);
				return;
			}
			const ratingValue = typeof data?.rating === 'number' ? data.rating : null;
			currentRating = ratingValue;
			if (ratingValue != null && ratingValue >= DIAMOND_THRESHOLD) {
				roundBracket = 'manipulation-enabled';
			} else if (ratingValue != null && ratingValue >= PLATINUM_THRESHOLD) {
				roundBracket = 'highlight-enabled';
			} else {
				roundBracket = 'movement-only';
			}
			applyTimerForRating(currentRating);
		} catch (error) {
			console.error('Failed to fetch user rating', error);
			roundBracket = 'movement-only';
			currentRating = null;
			applyTimerForRating(currentRating);
		} finally {
			loadingRating = false;
		}
	}

	function drawTargetOverlay() {
		const active = matchState.active;
		if (!active) return;
		const target = active.target;
		const base = viewBase();
		const playerSelection = selectionForMatch();
		const isManipulation = target.kind === 'manipulate';
		const manipulationCleared = isManipulation
			? serializeDocument() === target.expectedDocument
			: false;
		let roundCompleted = false;
		if (matchState.status === 'running' && !forceUndoRequired) {
			roundCompleted = match.evaluate({
				cursor: { row: cursor.row, col: cursor.col },
				selection: playerSelection ?? null,
				manipulated: manipulationCleared
			});
		}

		if (roundCompleted && isManipulation) return;

		if (target.kind === 'move') {
			const x = paddingX + 10 + target.col * CARET_STEP;
			const rowTop = paddingY + (target.row - base) * lineHeight;
			const caretH = Math.max(1, lineHeight - 1);
			ctx.save();
			ctx.fillStyle = forceUndoRequired ? 'rgb(156, 163, 175)' : 'rgb(194, 123, 255)';
			ctx.globalAlpha = forceUndoRequired ? 0.15 : 0.5;
			ctx.fillRect(Math.floor(x), Math.floor(rowTop), Math.ceil(charWidth), caretH);
			ctx.restore();
			return;
		}

		ctx.save();
		if (forceUndoRequired) {
			ctx.fillStyle = 'rgb(148, 163, 184)';
			ctx.globalAlpha = 0.18;
		} else if (target.kind === 'manipulate') {
			ctx.fillStyle = 'rgb(248, 113, 113)';
			ctx.globalAlpha = 0.38;
		} else {
			ctx.fillStyle = 'rgb(96, 165, 250)';
			ctx.globalAlpha = 0.35;
		}
		const textStartX = paddingX + 10;
		const targetSelection = target.selection;
		if (targetSelection.type === 'line') {
			const startRow = Math.max(targetSelection.startRow, base);
			const endRow = Math.min(targetSelection.endRow, lines.length - 1);
			for (let r = startRow; r <= endRow && r < base + MAX_ROWS; r++) {
				const text = lines[r] ?? '';
				const textW = Math.max(ctx.measureText(text).width, charWidth);
				const rowY = paddingY + (r - base) * lineHeight;
				ctx.fillRect(Math.floor(textStartX), Math.floor(rowY), Math.ceil(textW), lineHeight);
			}
		} else {
			const startRow = targetSelection.start.row;
			const endRow = targetSelection.end.row;
			for (let r = startRow; r <= endRow; r++) {
				if (r < base || r >= base + MAX_ROWS) continue;
				const text = lines[r] ?? '';
				const rowStart = r === startRow ? targetSelection.start.col : 0;
				const rowEnd = r === endRow ? targetSelection.end.col : text.length;
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
		const nowMs = performance.now();
		ctx.font = '16px monospace';

		const limit = timeLimitMs;
		if (matchState.active) {
			const startedAt = matchState.active.startedAt;
			const elapsed = startedAt == null ? 0 : nowMs - startedAt;
			timeRemaining = Math.max(0, limit - elapsed);
		} else {
			timeRemaining = limit;
		}
		timerProgress = limit > 0 ? Math.max(0, Math.min(1, timeRemaining / limit)) : 0;

		if (matchState.active) {
			const breath = (Math.sin(nowMs / 420) + 1) / 2; // 0..1
			const fade = Math.pow(timerProgress, 0.65);
			const base = fade * (0.6 + 0.4 * breath);
			const flickerWindow = Math.max(0, 1 - timerProgress / 0.22);
			const flicker = flickerWindow ? (Math.sin(nowMs / 75) * 0.5 + 0.5) * flickerWindow * 0.35 : 0;
			glowStrength = Math.max(0, Math.min(1, base + flicker));
		} else {
			glowStrength = 0;
		}
		const undoBlink = forceUndoRequired ? (Math.sin(nowMs / 50) + 1) / 2 : 1;

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
				ctx.fillStyle = '#dddddd';
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
			const caretColor = forceUndoRequired ? '#9CA3AF' : '#dddddd';
			const caretAlpha = forceUndoRequired ? 0.12 + 0.4 * undoBlink : 0.85;
			ctx.fillStyle = caretColor;
			ctx.globalAlpha = caretAlpha;
			ctx.fillRect(Math.floor(x), Math.floor(caretRowTop), 9.8, caretH);
			ctx.globalAlpha = 1;
		}
		raf = requestAnimationFrame(draw);
	}

	function onKeyDown(e: KeyboardEvent) {
		const inWarmupRoom = warmupRoomActive;
		if (!inWarmupRoom) {
			match.recordKey(e.key, now());
		}
		const undoKeyPressed = isUndoKey(e);
		if (!inWarmupRoom && forceUndoRequired && !undoKeyPressed) {
			e.preventDefault();
			return;
		}
		if (undoKeyPressed) {
			e.preventDefault();
			if (!inWarmupRoom) {
				handleUndo();
			}
			return;
		}
		const previousDocument = serializeDocument();
		const previousCursor = { row: cursor.row, col: cursor.col };
		vim.handleKeyDown(e);
		const nextDocument = serializeDocument();
		const docChanged = nextDocument !== previousDocument;
		if (inWarmupRoom) {
			if (docChanged) {
				vim.resetDocument(previousDocument, previousCursor);
				recomputeLayout();
			}
		} else if (docChanged) {
			pushUndoSnapshot({ document: previousDocument, cursor: previousCursor });
			handleDocumentChange(previousDocument, nextDocument);
		}
		const moved = previousCursor.row !== cursor.row || previousCursor.col !== cursor.col;
		if (warmupState === 'waiting' && moved) {
			startWarmupCountdown();
		}
		const uiState = vim.getUiState();
		pendingCombo = uiState.pendingCombo;
		pendingCount = uiState.pendingCount;
		commandBuf = uiState.commandBuffer;
	}

	onMount(() => {
		if (!browser) return;
		applyTimerForRating(currentRating);

		matchState = get(match);
		signedIn = Boolean(get(user));
		unsubscribeMatch = match.subscribe((value) => {
			matchState = value;
			if (signedIn && value.status === 'idle' && warmupState !== 'countdown') {
				enterWarmup();
			}
		});
		match.setGenerator(() => generateRoundTarget());
		if (signedIn) {
			match.reset();
			matchState = get(match);
			enterWarmup();
		} else if (matchState.status === 'idle') {
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

		unsubscribeUser = user.subscribe((value) => {
			signedIn = Boolean(value);
			if (signedIn) {
				exitWarmup();
				match.reset();
				matchState = get(match);
				enterWarmup();
			} else {
				exitWarmup();
				match.reset();
				matchState = get(match);
				match.start();
			}
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
		exitWarmup();
	});
</script>

<div class="fixed inset-0 flex flex-col items-center justify-center">
	<div class="flex flex-col gap-2">
		<div class="flex flex-row items-center">
			{#if matchState.active || warmupRoomActive}
				<div class="pointer-events-none flex gap-2">
					<div
						class="gap relative inline-flex items-center gap-3 overflow-hidden rounded-lg border border-neutral-400/20 bg-black/60 px-3 py-2 font-mono uppercase tracking-wide text-neutral-100"
					>
						<div class="relative flex items-center justify-center">
							<CircularProgress
								value={timerValue}
								size={14}
								stroke={1}
								fill={timerFill}
								border={timerBorder}
							/>
						</div>
						<span class="text-sm leading-none text-neutral-200"
							>{currentRoundDisplay}/{totalRoundsDisplay}</span
						>
					</div>
					{#if warmupRoomActive}
						<RoundGoalBadge labelOverride="ranked" />
					{:else if matchState.active && (!matchState.active.isWarmup || !signedIn)}
						<RoundGoalBadge
							{forceUndoRequired}
							targetKind={activeTargetKind}
							{manipulationAction}
						/>
					{/if}
				</div>
			{/if}
		</div>
		<div class="relative mb-10">
			<div
				data-mode={currentMode}
				data-glow-kind={activeTargetKind ?? 'none'}
				class="data-[mode=command]:border-white/7 relative overflow-hidden rounded-xl border
         border-white/10 shadow-lg transition-all"
				style={editorStyle}
			>
				<canvas
					bind:this={canvas}
					class="block h-full w-full rounded-xl outline-none"
					on:keydown={onKeyDown}
					on:click={() => canvas?.focus()}
				></canvas>
				{#if warmupRoomActive}
					<div class="pointer-events-none absolute inset-0">
						<div class="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
						<div class="relative flex h-full w-full items-center justify-center">
							{#if warmupState === 'waiting'}
								<div class=" font-mono text-lg uppercase tracking-wider text-neutral-200">
									move to start match
								</div>
							{:else if warmupState === 'countdown'}
								{#each [warmupCountdownValue] as value (value)}
									<div class="font-mono text-5xl text-neutral-200">{value}</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
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

	.warmup-countdown {
		font-family: 'DM Mono', monospace;
		font-size: clamp(3rem, 12vw, 5.5rem);
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 0 18px rgba(255, 255, 255, 0.45);
		opacity: 0.9;
	}

	@keyframes warmupPulse {
		0% {
			transform: scale(0.65);
			opacity: 0.35;
			text-shadow: 0 0 0 rgba(255, 255, 255, 0);
		}
		50% {
			transform: scale(1.08);
			opacity: 1;
			text-shadow: 0 0 40px rgba(255, 255, 255, 0.55);
		}
		100% {
			transform: scale(0.95);
			opacity: 0.45;
			text-shadow: 0 0 14px rgba(255, 255, 255, 0.35);
		}
	}
</style>
