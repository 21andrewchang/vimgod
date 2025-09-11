<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let raf = 0;
	let ro: ResizeObserver | undefined;
	let dpr = 1;
	type Cursor = { row: number; col: number; goalCol: number | null };

	export const lines = ['Hello, world!', 'Second line', ''];
	export const cursor: Cursor = { row: 0, col: 0, goalCol: null };

	export let charWidth = 12; // update after measureText
	export let lineHeight = 18; // fontSize * 1.3-ish
	export const paddingX = 8;
	export const paddingY = 8;

	function clamp(n: number, lo: number, hi: number) {
		return Math.max(lo, Math.min(hi, n));
	}
	function lineLen(r: number) {
		return lines[r]?.length - 1;
	}

	export function moveLastRow() {
		setGoalIfNeeded();
		cursor.row = lines.length - 1;
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function moveFirstCol() {
		cursor.col = 0;
		cursor.goalCol = cursor.col;
	}
	export function moveLastCol() {
		cursor.col = lineLen(cursor.row);
		cursor.goalCol = cursor.col;
	}
	export function moveLeft() {
		cursor.col = clamp(cursor.col - 1, 0, lineLen(cursor.row));
		cursor.goalCol = cursor.col;
	}
	export function moveRight() {
		cursor.col = clamp(cursor.col + 1, 0, lineLen(cursor.row));
		cursor.goalCol = cursor.col;
	}
	function setGoalIfNeeded() {
		if (cursor.goalCol == null) cursor.goalCol = cursor.col;
	}
	export function moveUp() {
		setGoalIfNeeded();
		cursor.row = clamp(cursor.row - 1, 0, lines.length - 1);
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function moveDown() {
		setGoalIfNeeded();
		cursor.row = clamp(cursor.row + 1, 0, lines.length - 1);
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function resetGoal() {
		cursor.goalCol = null;
	}

	export function caretXY() {
		return {
			x: paddingX + cursor.col * 12,
			y: paddingY + cursor.row * lineHeight
		};
	}

	function computeMetrics() {
		// Call after ctx.font is set
		const m = ctx.measureText('0000000000'); // average over 10 zeros
		charWidth = Math.round(m.width / 10);
		const ascent = m.actualBoundingBoxAscent ?? 11;
		const descent = m.actualBoundingBoxDescent ?? 4;
		lineHeight = Math.ceil(ascent + descent + 4); // small padding
	}

	function drawText() {
		ctx.fillStyle = '#e5e7eb'; // light gray
		ctx.font = '20px monospace';
		let width = ctx.measureText('l');
		console.log('width: ', width);
		for (let r = 0; r < lines.length; r++) {
			ctx.fillText(lines[r], paddingX, 24 + r * lineHeight);
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

	function charAdvanceAt(line: string, col: number) {
		const ch = line[col] ?? ' ';
		// Tabs etc. can be handled later; treat as one cell for now
		return ch === '\t' ? charWidth : ctx.measureText(ch).width || charWidth;
	}
	function draw() {
		clear();
		drawText();
		ctx.strokeStyle = '#ddd';
		const line = lines[cursor.row] ?? '';
		const { x, y } = caretXY();
		const w = 12.5;
		ctx.fillStyle = '#dddddd';
		ctx.globalAlpha = 0.85; // slightly translucent so text can still be seen
		ctx.fillRect(Math.floor(x), Math.floor(y), w, lineHeight);
		ctx.globalAlpha = 1;
		raf = requestAnimationFrame(draw);
	}
	function onKeyDown(e: KeyboardEvent) {
		const k = e.key;
		if ('hjkl'.includes(k)) e.preventDefault();

		if (k === 'h') moveLeft();
		else if (k === 'l') moveRight();
		else if (k === 'k') moveUp();
		else if (k === 'j') moveDown();
		else if (k === '0') moveFirstCol();
		else if (k === '$') moveLastCol();
		else if (k === 'G') moveLastRow();
	}
	onMount(async () => {
		if (!browser) return;

		ctx = canvas.getContext('2d', { alpha: false })!;
		ctx.textBaseline = 'top';
		setFontMetrics();
		applyDpr();

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

<canvas
	bind:this={canvas}
	style="display:block; width:100%; height:100%; outline:none;"
	on:keydown={onKeyDown}
	class="rounded-xl"
></canvas>
