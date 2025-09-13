<script lang="ts">
	import { scale } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';

	const ROWS = 15; // same as MAX_ROWS
	const COLS = 64; // pick what looks right; fixed column budget
	const GUTTER_PAD = 20; // space for line numbers + gap
	const TEXT_TOP = 38; // replace your magic 38 with a named const

	let targetW = 0,
		targetH = 0;

	function recomputeLayout() {
		// assumes ctx.font is set and charWidth/lineHeight are up to date
		const gutter = Math.ceil(ctx.measureText(String(ROWS)).width) + GUTTER_PAD;
		targetW = Math.round(paddingX + gutter + COLS * charWidth + paddingX);
		targetH = Math.round(TEXT_TOP + ROWS * lineHeight + paddingY); // top offset + rows + bottom pad
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

	const MAX_ROWS = 15;
	function viewBase() {
		return Math.max(0, lines.length - MAX_ROWS);
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

	export const lines = [''];
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
		console.log('curr mode: ', currentMode);
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
			console.log('curr mode: ', currentMode);
		}
	}

	export function newLine(mode: 'insert' | 'below' | 'above' | 'normal' = 'insert') {
		// Default Vim-like semantics:
		// - insert/Enter: split current line at cursor, insert tail on the next line
		// - below/normal/o: insert empty line below
		// - above/O: insert empty line above

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
	// 3) Clamp vertical motion to the visible window when overflowed
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
		ctx.fillStyle = '#6b7280';
		ctx.textAlign = 'right';

		for (let r = base; r < lines.length; r++) {
			const isCurrent = r === cursor.row;
			const rel = lines.length === 1 ? 1 : Math.abs(r - cursor.row);
			const label = isCurrent ? String(r + 1) : String(rel || 1);

			const tx = paddingX;
			const ty = 38 + (r - base) * lineHeight; // <-- offset by base
			ctx.fillText(label, tx, ty);
		}

		ctx.textAlign = 'left';
		ctx.fillStyle = '#e5e7eb';
		ctx.font = '16px monospace';

		for (let r = base; r < lines.length; r++) {
			const ty = 38 + (r - base) * lineHeight; // <-- offset by base
			ctx.fillText(lines[r], paddingX + 10, ty);
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
	function draw() {
		clear();

		if (state === 'vim') {
			drawText();

			// Pick fill color per mode
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
				const w = 9.8;
				ctx.globalAlpha = 0.85;
				ctx.fillRect(Math.floor(x), Math.floor(rowTop), w, lineHeight);
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
	function onKeyDown(e: KeyboardEvent) {
		const k = e.key;
		if ('hjkl'.includes(k)) e.preventDefault();

		if (currentMode === 'normal') {
			if (k >= '1' && k <= '9') {
				e.preventDefault();
				if (pendingCount == null) pendingCount = k.charCodeAt(0) - 48;
				else {
					pendingCount = (pendingCount ?? 0) * 10 + (k.charCodeAt(0) - 48);
				}
				console.log(pendingCount);
				return;
			}
			if (k === 'h') moveLeft(pendingCount);
			else if (k === 'l') moveRight(pendingCount);
			else if (k === 'k') moveUp(pendingCount);
			else if (k === 'j') moveDown(pendingCount);
			else if (k === '0') {
				if (pendingCount != null) {
					pendingCount = (pendingCount ?? 0) * 10 + (k.charCodeAt(0) - 48);
				} else {
					moveFirstCol();
				}
			} else if (k === '$') moveLastCol();
			else if (k === 'G') moveLastRow();
			// else if (k === 'u') console.log('undo');
			else if (k === 'w') console.log('forward word');
			else if (k === 'b') console.log('backwards word');
			else if (k === 'e') console.log('forward end');
			else if (k === 'x') console.log('cut current letter');
			// else if (k === 'q') console.log('macro start');
			// else if (k === 'r') console.log('replace curr letter');
			// else if (k === 'p') console.log('paste numeral combo 2p');
			else if (k === 't') console.log('COMBO to __');
			else if (k === 'f') console.log('COMBO find next __');
			else if (k === 'y') console.log('COMBO yoink');
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
				console.log(k);
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
		ro?.disconnect();
		window.removeEventListener('resize', resize);
		cancelAnimationFrame(raf);
	});
</script>

<div class="fixed inset-0 grid place-items-center">
	<div class="relative mb-10">
		<div
			data-mode={currentMode}
			class="aspect-[16/10] max-h-[50dvh] w-[50vw] overflow-hidden rounded-xl border border-white/20
         shadow-lg transition-colors data-[mode=command]:border-white/10"
			style={`width:${targetW}px; height:${targetH}px`}
		>
			<canvas
				bind:this={canvas}
				class="block h-full w-full rounded-xl outline-none"
				on:keydown={onKeyDown}
				on:click={() => canvas?.focus()}
			/>
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
<div class="fixed bottom-3 right-4 z-50 font-mono text-gray-100">
	{pendingCombo}
</div>
<div class="fixed bottom-3 right-4 z-50 font-mono text-gray-100">
	{pendingCount}
</div>
