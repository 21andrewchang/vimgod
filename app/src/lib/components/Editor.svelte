<script lang="ts">
	import defaultText from '$lib/default-code.svelte.txt?raw';
	import { scale } from 'svelte/transition';
	import CircularProgress from '$lib/components/CircularProgress.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
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

	const IGNORED_KEYS = new Set([
		'Shift',
		'Control',
		'Alt',
		'Meta',
		'CapsLock',
		'NumLock',
		'ScrollLock',
		'OS',
		'Dead',
		'Compose'
	]);

	function isPrintable(e: KeyboardEvent) {
		// ignore named modifier keys outright
		if (IGNORED_KEYS.has(e.key)) return false;

		const altGraph = typeof e.getModifierState === 'function' && e.getModifierState('AltGraph');

		if (e.ctrlKey || e.metaKey) return false;
		if (e.altKey && !altGraph) return false;

		// Single-character keys only (letters, digits, symbols, whitespace)
		return e.key.length === 1;
	}

	function viewBase() {
		const maxBase = Math.max(0, lines.length - MAX_ROWS);
		return clamp(cursor.row - Math.floor(MAX_ROWS / 2), 0, maxBase);
	}
	let state: 'shell' | 'vim' = 'vim';
	// VIM
	type Mode = 'normal' | 'insert' | 'visual' | 'command' | 'block' | 'line';
	let currentMode: Mode = 'normal';
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let raf = 0;
	let ro: ResizeObserver | undefined;
	let dpr = 1;
	type Cursor = { row: number; col: number; goalCol: number | null };

	const normalized = defaultText.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
	export const lines: string[] = normalized.length ? normalized.split('\n') : [''];
	export const cursor: Cursor = { row: 0, col: 0, goalCol: null };

	export let charWidth = 9.6; // update after measureText
	export let lineHeight = 24; // fontSize * 1.3-ish
	export const paddingX = 30;
	export const paddingY = 20;

	let combo: string[] = [];
	let commandBuf = '';

	function enterCommand() {
		currentMode = 'command';
		commandBuf = '';
	}

	function exitCommand() {
		const cmd = commandBuf.trim();
		if (cmd === 'w' || cmd === 'write') {
		} else if (cmd === 'wq' || cmd === 'x') {
			state = 'shell';
		} else if (cmd === 'q') {
			state = 'shell'; // quit without saving
		}
		currentMode = 'normal';
		commandBuf = '';
	}

	function clamp(n: number, lo: number, hi: number) {
		return Math.max(lo, Math.min(hi, n));
	}

	function lineLen(r: number) {
		return lines[r]?.length === 0 ? 0 : lines[r]?.length - 1;
	}

	export function normalMode() {
		currentMode = 'normal';
		if (lines[cursor.row] === '') return;
		if (cursor.col > lines[cursor.row].length - 1) cursor.col = lines[cursor.row].length - 1;
	}

	export function visualLineMode() {
		if (currentMode !== 'line') {
			currentMode = 'line';
			visualLine_start = cursor.row;
		}
	}

	export function insertMode() {
		if (currentMode !== 'insert') {
			currentMode = 'insert';
		}
	}

	export function newLine(mode: 'insert' | 'below' | 'above' | 'normal' = 'insert') {
		const r = cursor.row;
		const c = cursor.col;
		const cur = lines[r] ?? '';

		if (mode === 'insert') {
			const head = cur.slice(0, c);
			const tail = cur.slice(c);
			lines[r] = head;
			lines.splice(r + 1, 0, tail); // INSERT here
			cursor.row = r + 1;
			cursor.col = 0;
		} else if (mode === 'above') {
			lines.splice(r, 0, ''); // INSERT above current row
			cursor.col = 0;
			// stay on the new blank line (same row index now points to it)
		} else {
			// 'below' | 'normal'
			lines.splice(r + 1, 0, '');
			cursor.row = r + 1;
			cursor.col = 0;
		}

		cursor.goalCol = cursor.col;
	}

	export function backspace() {
		const r = cursor.row;
		const line = lines[r] ?? '';

		// If we're not at the very start of the buffer, delete one char to the left.
		if (cursor.col > 0) {
			lines[r] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
			cursor.col -= 1;
			cursor.goalCol = cursor.col;
			return;
		}

		// At column 0: if there is a previous line, join with it.
		if (r > 0) {
			const prev = lines[r - 1] ?? '';
			const merged = prev + line;
			lines[r - 1] = merged;
			lines.splice(r, 1); // remove current line
			cursor.row = r - 1;
			cursor.col = prev.length; // insertion index after the old prev line
			cursor.goalCol = cursor.col;
			return;
		}

		// (r === 0 && col === 0): nothing to do.
	}

	export function insertChar(char: string) {
		const line = lines[cursor.row] ?? '';
		lines[cursor.row] = line.slice(0, cursor.col) + char + line.slice(cursor.col);
		cursor.col++;
		cursor.goalCol = cursor.col;
	}
	export function moveFirstCol() {
		cursor.col = 0;
		cursor.goalCol = cursor.col;
	}
	export function moveFirstChar() {
		const curr = lines[cursor.row];
		let i = 0;
		for (i; i < curr.length; i++) {
			if (curr[i] !== ' ') {
				break;
			}
		}
		cursor.col = i;
		cursor.goalCol = cursor.col;
	}

	function _isSpaceCh(ch: string | null) {
		return ch === ' ' || ch === '\t';
	}

	const ISKEYWORD_RE = /[\p{L}\p{N}_]/u;
	function _isWordCh(ch: string | null) {
		if (!ch) return false;
		try {
			return ISKEYWORD_RE.test(ch);
		} catch {
			return /[A-Za-z0-9_]/.test(ch);
		}
	}

	function _classOf(r: number, c: number, big: boolean): 'space' | 'word' | 'punct' {
		const s = lines[r] ?? '';
		const ch = s[c];
		if (_isSpaceCh(ch)) return 'space';
		if (big) return 'word';
		return _isWordCh(ch) ? 'word' : 'punct';
	}

	function skipSpaces(r_start: number, c_start: number, reverse: boolean) {
		let curr_row = r_start;
		let curr_col = c_start;
		while (_isSpaceCh(lines[curr_row][curr_col])) {
			if (curr_col == lines[curr_row].length - 1 && !reverse) {
				curr_col = 0;
				curr_row++;
			} else if (reverse && curr_col == 0) {
				curr_row--;
				curr_col = lines[curr_row].length - 1;
			} else {
				curr_col += reverse ? -1 : 1;
			}
		}
		return [curr_row, curr_col];
	}

	export function to(char: string, reverse: boolean) {
		let curr_row = cursor.row;
		let curr_col = cursor.col;
		let new_row = cursor.row;
		let new_col = curr_col;
		if (
			!reverse &&
			curr_col < lines[curr_row].length - 1 &&
			lines[curr_row][curr_col + 1] === char
		) {
			curr_col++;
		}
		if (reverse && curr_col > 0 && lines[curr_row][curr_col - 1] === char) {
			curr_col--;
		}
		if (!reverse && curr_col < lines[curr_row].length - 1) {
			new_col = curr_col + 1;
		} else if (reverse && curr_col > 0) {
			new_col = curr_col - 1;
		}
		while (lines[new_row][new_col] !== char) {
			if (new_col == lines[curr_row].length - 1 || new_col == 0) {
				new_col = curr_col;
				break;
			}
			new_col += reverse ? -1 : 1;
		}
		cursor.col = new_col + (reverse ? 1 : -1);
		cursor.goalCol = cursor.col;
		cursor.row = new_row;
	}
	export function find(char: string, reverse: boolean) {
		let curr_row = cursor.row;
		let curr_col = cursor.col;
		let new_row = cursor.row;
		let new_col = curr_col;
		if (!reverse && curr_col < lines[curr_row].length - 1) {
			new_col = curr_col + 1;
		} else if (reverse && curr_col > 0) {
			new_col = curr_col - 1;
		}
		while (lines[new_row][new_col] !== char) {
			if (new_col == lines[curr_row].length - 1 || new_col == 0) {
				new_col = curr_col;
				break;
			}
			new_col += reverse ? -1 : 1;
		}
		cursor.col = new_col;
		cursor.goalCol = cursor.col;
		cursor.row = new_row;
	}

	export function moveNextWord(count: number | null, big: boolean, ghost: boolean) {
		let c = count ? count : 1;
		let curr_row = cursor.row;
		let curr_col = cursor.col;
		let new_row = curr_row;
		let new_col = curr_col + 1;
		let curr = lines[cursor.row];

		// HAVE TO USE WHILE LOOP CANNOT USE FOR LOOP
		// using curr.length makes it stop at this line which isnt correct
		for (; c > 0; c--) {
			console.log(c);
			if (curr_row == lines.length - 1 && curr_col == lines[curr_row].length - 1) return;
			while (_classOf(curr_row, curr_col, big) === _classOf(new_row, new_col, big)) {
				if (new_col < curr.length - 1) {
					new_col++;
				} else if (curr_row == lines.length - 1) {
					new_col = lines[curr_row].length - 1;
					break;
				} else {
					new_col = 0;
					new_row++;
					curr = lines[new_row];
				}
			}
			curr_col = new_col;
			curr_row = new_row;
			if (_isSpaceCh(lines[curr_row][curr_col])) {
				[new_row, new_col] = skipSpaces(curr_row, curr_col, false);
			}
		}
		if (!ghost) {
			cursor.col = new_col;
			cursor.goalCol = cursor.col;
			cursor.row = new_row;
			pendingCount = null;
		} else {
			return [new_row, new_col];
		}
	}

	// 1. move until start of a letnum or punctuation sequence
	// 2. if in middle of sequence, go until diff class (including space)
	export function moveBackWord(count: number | null, big: boolean, ghost: boolean) {
		let c = count ? count : 1;
		let curr_row = cursor.row;
		let curr_col = cursor.col;
		let new_row = curr_row;
		let new_col = curr_col - 1;

		if (curr_row == 0 && curr_col == 0) return;
		for (; c > 0; c--) {
			if (curr_row == 0 && curr_col == 1) {
				new_col--;
				break;
			}
			if (_classOf(curr_row, curr_col, big) !== _classOf(new_row, new_col, big)) {
				curr_col = new_col;
				new_col--;
			}
			if (_isSpaceCh(lines[curr_row][curr_col])) {
				console.log('is space');
				[curr_row, curr_col] = skipSpaces(curr_row, curr_col, true);
				new_row = curr_row;
				new_col = curr_col - 1;
				console.log('skipSpaces done', curr_col);
			}
			while (_classOf(curr_row, curr_col, big) === _classOf(new_row, new_col, big)) {
				new_col--;
			}
		}
		if (!ghost) {
			cursor.col = new_col + 1;
			cursor.goalCol = cursor.col;
			cursor.row = new_row;
			pendingCount = null;
		} else {
			return [new_row, new_col + 1];
		}
	}

	export function moveLastCol() {
		cursor.col = lineLen(cursor.row);
		cursor.goalCol = cursor.col;
	}

	export function moveLeft(count: number | null) {
		cursor.col = clamp(cursor.col - (count ? count : 1), 0, lineLen(cursor.row));
		cursor.goalCol = cursor.col;
		pendingCount = null;
	}

	export function moveRight(count: number | null) {
		cursor.col = clamp(cursor.col + (count ? count : 1), 0, lineLen(cursor.row));
		cursor.goalCol = cursor.col;
		pendingCount = null;
	}

	function setGoalIfNeeded() {
		if (cursor.goalCol == null) cursor.goalCol = cursor.col;
	}

	export function moveUp(count: number | null) {
		setGoalIfNeeded();
		const base = viewBase();
		cursor.row = clamp(cursor.row - (count ? count : 1), base, lines.length - 1);
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
		pendingCount = null;
	}
	export function moveDown(count: number | null) {
		setGoalIfNeeded();
		const base = viewBase();
		cursor.row = clamp(cursor.row + (count ? count : 1), base, lines.length - 1);
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
		pendingCount = null;
	}
	export function moveFirstRow() {
		setGoalIfNeeded();
		cursor.row = 0;
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function moveLastRow() {
		setGoalIfNeeded();
		cursor.row = lines.length - 1; // bottom of buffer
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function resetGoal() {
		cursor.goalCol = null;
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

		ctx.fillStyle = '#6b7280';
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
		ctx.fillStyle = '#e5e7eb';
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

	let visualLine_start: number;
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

	type MovementResult = { target: { row: number; col: number }; sequence: string[] };

	function toDigitKeys(count: number) {
		return count > 1 ? String(count).split('') : [];
	}

	function goalColumnForRow(row: number) {
		const desired = cursor.goalCol ?? cursor.col;
		const max = Math.max(0, lineLen(row));
		return clamp(desired, 0, max);
	}

	function firstNonWhitespace(line: string) {
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch !== ' ' && ch !== '\t') return i;
		}
		return -1;
	}

	function simulateSearchMotion(
		char: string,
		type: 'find' | 'to',
		reverse: boolean,
		startRow: number,
		startCol: number
	): { row: number; col: number } | null {
		const line = lines[startRow] ?? '';
		if (!line.length) return null;
		const step = reverse ? -1 : 1;
		let idx = reverse
			? Math.min(startCol - 1, line.length - 1)
			: Math.min(startCol + 1, line.length - 1);
		while (idx >= 0 && idx < line.length) {
			if (line[idx] === char) {
				if (type === 'find') {
					if (idx === startCol) return null;
					return { row: startRow, col: idx };
				}
				const offset = reverse ? 1 : -1;
				const nextCol = idx + offset;
				if (nextCol < 0 || nextCol >= line.length) return null;
				if (nextCol === startCol) return null;
				return { row: startRow, col: nextCol };
			}
			idx += step;
		}
		return null;
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
		if (state === 'vim') {
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

			if (currentMode === 'line' && visualLine_start !== null) {
				const lo = Math.max(Math.min(visualLine_start, cursor.row), base);
				const hi = Math.min(Math.max(visualLine_start, cursor.row), lines.length - 1);

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
		}
		raf = requestAnimationFrame(draw);
	}

	function deleteRow() {
		const a = Math.min(visualLine_start, cursor.row);
		const b = Math.max(visualLine_start, cursor.row);
		const count = b - a + 1;

		const removed = lines.splice(a, count);

		if (lines.length === 0) {
			lines.push('');
		}

		// place cursor at the line where the block used to start
		cursor.row = Math.min(a, lines.length - 1);
		cursor.col = 0;
		cursor.goalCol = 0;

		normalMode(); // your existing function
	}
	let pendingCount: number | null;
	let pendingCombo: string = '';
	let lastSearch: string = '';
	let lastSearchDirection: boolean = false;
	let lastSearchType: string = 'find';
	function onKeyDown(e: KeyboardEvent) {
		const k = e.key;
		match.recordKey(k, now());
		if ('hjkl'.includes(k)) e.preventDefault();

		if (currentMode === 'normal') {
			if (pendingCombo === 'T') {
				if (k === 'Escape') {
					e.preventDefault();
					pendingCombo = ''; // cancel
					pendingCount = null;
					return;
				}
				if (isPrintable(e) && k.length === 1) {
					e.preventDefault();
					lastSearch = k;
					lastSearchDirection = true;
					lastSearchType = 'to';
					pendingCount = null;
					to(k, true);
					pendingCombo = '';
					return;
				}
				return; // ignore everything else (Shift, Ctrl, etc.)
			}
			if (pendingCombo === 't') {
				if (k === 'Escape') {
					e.preventDefault();
					pendingCombo = ''; // cancel
					pendingCount = null;
					return;
				}
				if (isPrintable(e) && k.length === 1) {
					e.preventDefault();
					lastSearch = k;
					lastSearchType = 'to';
					lastSearchDirection = false;
					pendingCount = null;
					to(k, false);
					pendingCombo = '';
					return;
				}
				return;
			}
			if (pendingCombo === 'F') {
				if (k === 'Escape') {
					e.preventDefault();
					pendingCombo = ''; // cancel
					pendingCount = null;
					return;
				}
				if (isPrintable(e) && k.length === 1) {
					e.preventDefault();
					lastSearch = k;
					lastSearchDirection = true;
					pendingCount = null;
					lastSearchType = 'find';
					find(k, true);
					pendingCombo = '';
					return;
				}
				return; // ignore everything else (Shift, Ctrl, etc.)
			}
			if (pendingCombo === 'f') {
				if (k === 'Escape') {
					e.preventDefault();
					pendingCombo = ''; // cancel
					pendingCount = null;
					return;
				}
				if (isPrintable(e) && k.length === 1) {
					e.preventDefault();
					lastSearch = k;
					lastSearchDirection = false;
					pendingCount = null;
					lastSearchType = 'find';
					find(k, false);
					pendingCombo = '';
					return;
				}
				return; // ignore everything else (Shift, Ctrl, etc.)
			}
			if (k === ';') {
				if (lastSearch !== '') {
					if (lastSearchType === 'find') find(lastSearch, lastSearchDirection);
					else to(lastSearch, lastSearchDirection);
				}
			}
			if (k === ',') {
				if (lastSearch !== '') {
					if (lastSearchType === 'find') find(lastSearch, !lastSearchDirection);
					else to(lastSearch, !lastSearchDirection);
				}
			}
			if (k >= '1' && k <= '9') {
				e.preventDefault();
				if (pendingCount == null) pendingCount = k.charCodeAt(0) - 48;
				else {
					pendingCount = (pendingCount ?? 0) * 10 + (k.charCodeAt(0) - 48);
				}
				return;
			}
			if (k === 'h') moveLeft(pendingCount);
			else if (k === 'l') moveRight(pendingCount);
			else if (k === 'k') moveUp(pendingCount);
			else if (k === 'j') moveDown(pendingCount);
			else if (k === '^') moveFirstChar();
			else if (k === '0') {
				if (pendingCount != null) {
					pendingCount = (pendingCount ?? 0) * 10 + (k.charCodeAt(0) - 48);
				} else {
					moveFirstCol();
				}
			} else if (k === '$') moveLastCol();
			else if (k === 'G') moveLastRow();
			// else if (k === 'u') console.log('undo');
			else if (k === 'W') {
				moveNextWord(pendingCount, true, false);
			} else if (k === 'w') {
				moveNextWord(pendingCount, false, false);
			} else if (k === 'b') {
				moveBackWord(pendingCount, false, false);
			} else if (k === 'e') console.log('forward end');
			else if (k === 'x') console.log('cut current letter');
			// else if (k === 'q') console.log('macro start');
			// else if (k === 'r') console.log('replace curr letter');
			// else if (k === 'p') console.log('paste numeral combo 2p');
			else if (k === 'T') {
				pendingCombo = 'T';
			} else if (k === 't') {
				pendingCombo = 't';
			} else if (k === 'F') {
				pendingCombo = 'F';
			} else if (k === 'f') {
				pendingCombo = 'f';
			} else if (k === 'T') {
				pendingCombo = 'T';
			} else if (k === 't') {
				pendingCombo = 't';
			} else if (k === 'y') console.log('COMBO yoink');
			else if (k === 'g') {
				if (pendingCombo == 'g') {
					moveFirstRow();
					pendingCombo = '';
				} else {
					pendingCombo += 'g';
				}
				console.log('COMBO go');
			} else if (k === 'c') console.log('COMBO cut');
			else if (k === 'v') console.log('COMBO visual mode');
			else if (k === 'v') console.log('COMBO visual mode');
			else if (k === 's') console.log('curr letter delete -> insert');
			else if (k === 'x') console.log('curr letter delete');
			else if (k === 'V') visualLineMode();
			else if (k === 'i') insertMode();
			else if (k === ':') enterCommand();
			else if (k === 'O') {
				newLine('above');
				insertMode();
			} else if (k === 'o') {
				newLine('normal');
				insertMode();
			} else if (k === 'a') {
				if (lines[cursor.row] !== '') cursor.col++;
				insertMode();
			} else if (k === 'I') {
				cursor.col = 0;
				insertMode();
			} else if (k === 'A') {
				moveLastCol();
				if (lines[cursor.row] !== '') cursor.col++;
				insertMode();
			} else if (k === 'Escape') {
				pendingCount = null;
				pendingCombo = '';
				normalMode();
			} else {
				combo.push(k);
			}
		} else if (currentMode === 'line') {
			if (k === 'Escape') {
				e.preventDefault();
				normalMode();
			} else if (k === 'k') {
				moveUp(pendingCount);
			} else if (k === 'j') {
				moveDown(pendingCount);
			} else if (k === 'd') {
				deleteRow();
			} else if (k === 'g') {
				if (pendingCombo == 'g') {
					moveFirstRow();
					pendingCombo = '';
				} else {
					pendingCombo += 'g';
				}
				console.log('COMBO go');
			}
		} else if (currentMode === 'insert') {
			if (k === 'Escape') {
				e.preventDefault();
				normalMode();
			} else if (k === 'Enter') {
				e.preventDefault();
				newLine();
			} else if (k === 'Backspace') {
				e.preventDefault();
				backspace();
			} else if (isPrintable(e)) {
				e.preventDefault();
				insertChar(e.key); // '@' works; Shift is ignored as a modifier
			} // else ignore
		} else if (currentMode === 'command') {
			if (k === 'Escape') {
				e.preventDefault();
				normalMode();
			} else if (k === 'Enter') {
				e.preventDefault();
				exitCommand();
			} else if (k === 'Backspace') {
				e.preventDefault();
				commandBuf = commandBuf.slice(0, -1);
			} else if (isPrintable(e)) {
				e.preventDefault();
				commandBuf += e.key;
			} // else ignore
		}
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
					<CircularProgress value={timerValue} size={26} stroke={1} track="rgba(255,255,255,0.1)" />
				</div>
			{/if}
		</div>
		<div class="relative mb-10">
			<div
				data-mode={currentMode}
				class=" overflow-hidden rounded-xl border border-white/20
         shadow-lg transition-colors data-[mode=command]:border-white/10"
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
             data-[mode=command]:border-white/20"
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
