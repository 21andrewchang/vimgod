<script lang="ts">
	import { scale } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	function onGlobalTab(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		if (document.activeElement !== canvas) return; // only when terminal is focused
		e.preventDefault(); // stop focus moving
		e.stopPropagation(); // be extra safe

		// Optional: treat Tab as input
		if (state === 'shell') {
			shellLine += '  '; // two spaces in shell
		} else if (state === 'vim' && currentMode === 'insert') {
			insertChar('\t'); // real tab in Vim insert
		}
	}
	let helpCount = 0;
	const MAX_ROWS = 12;
	function viewBase() {
		return Math.max(0, lines.length - MAX_ROWS);
	}
	let state: 'shell' | 'vim' = 'shell';
	// --- Shell state ---
	let sourcedSpecial = false; // becomes true after source .waitlistrc
	const aliases: Record<string, string> = {}; // optional: parsed from .waitlistrc

	function sourceFile(name: string): string[] {
		if (name !== '.waitlistrc') return [`did you just try to source a markdown file?`];
		const f = fs[name];
		if (!f) return [`source: ${name}: No such file`];

		const out: string[] = [];

		// Parse aliases into memory (unchanged behavior)
		for (const ln of f.content.split(/\r?\n/)) {
			const mAlias = ln.match(/^\s*alias\s+([A-Za-z_][\w-]*)=(?:"([^"]*)"|'([^']*)'|([^\s#]+))?/);
			if (mAlias) {
				aliases[mAlias[1]] = mAlias[2] ?? mAlias[3] ?? mAlias[4] ?? '';
				continue;
			}
			const mKV = ln.match(/^\s*([A-Za-z_]\w*)\s*=\s*"?([^"]*)"?\s*$/);
			if (mKV) {
				aliases[mKV[1]] = mKV[2];
				continue;
			}
		}

		// Gate the "special" unlock on valid contact info *inside .waitlistrc*
		const { email } = parseRcFields(f.content);
		const ok = isValidEmail(email);

		if (!ok) {
			out.push('');
			return out;
		}

		sourcedSpecial = true;
		out.push('impressive', 'you earned a spot on the special waitlist');
		return out;
	}

	// write the current Vim buffer back to fs
	function writeCurrentFile() {
		if (!currentFile) return;
		const content = lines.join('\n');
		(fs[currentFile] ??= { name: currentFile, content: '' }).content = content;
		dirty = false;
	}

	// extract contact info from waitlist.md content
	function parseWaitlistFields(txt: string) {
		const email = txt.match(/email\s*=\s*"?([^"\n#]+)"?/i)?.[1]?.trim();
		return { email };
	}

	function parseRcFields(txt: string) {
		// Prefer alias lines; fall back to plain key=value if present
		const email =
			txt.match(/alias\s+email\s*=\s*"?([^"\n#]+)"?/i)?.[1]?.trim() ??
			txt.match(/\bemail\s*=\s*"?([^"\n#]+)"?/i)?.[1]?.trim();

		return { email };
	}

	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	function isValidEmail(s?: string | null) {
		return !!s && EMAIL_RE.test(s);
	}
	function announceWaitlistResult() {
		if (currentFile !== 'waitlist.md') return;
		const { email } = parseWaitlistFields(fs['waitlist.md']?.content ?? '');
		if (!email) {
			shellLog.push('maybe try putting ur email in...');
			return;
		}
		shellLog.push(sourcedSpecial ? 'ur on the SPECIAL waitlist' : `alright, you're in.`);
	}

	const cwd = '~/vimgod';
	type FileRec = { name: string; hidden?: boolean; content: string };
	const fs: Record<string, FileRec> = {
		'waitlist.md': {
			name: 'waitlist.md',
			content: '# hopefully you know how to save and quit...\nemail = ""'
		},
		'.waitlistrc': {
			name: '.waitlistrc',
			hidden: true,
			content: 'alias email=""'
		}
	};

	let dirty = false;
	let shellLog: string[] = [];
	let shellLine = '';
	const shellHist: string[] = [];
	let histIdx = -1; // -1 = live

	function shellPrintPrompt(cmd: string) {
		shellLog.push(`${cwd} ➜ ${cmd}`);
	}

	function shellAppend(out: string[]) {
		if (!out?.length) return;
		if (out.includes('__CLEAR__')) {
			shellLog = [];
			out = out.filter((l) => l !== '__CLEAR__');
		}
		if (out.length) shellLog.push(...out);
	}

	function runShell(cmd: string): string[] {
		const out: string[] = [];
		const [bin, ...args] = cmd.trim().split(/\s+/);
		switch (bin) {
			case '':
				break;
			case 'source': {
				const n = args[0] ?? '';
				out.push(...sourceFile(n));
				break;
			}
			case 'ls':
				out.push(
					Object.values(fs)
						.filter((f) => args.includes('-a') || !f.hidden)
						.map((f) => f.name)
						.sort()
						.join('  ')
				);
				break;
			case 'pwd':
				out.push(cwd);
				break;
			case 'cat': {
				const n = args[0];
				out.push(n && fs[n] ? fs[n].content : `cat: ${n}: No such file`);
				break;
			}
			case 'help': {
				out.push(
					helpCount === 0 ? 'fine try ls' : 'really? u want me to spoonfeed you? nvim waitlist.md'
				);
				helpCount = Math.min(helpCount + 1, 2);
				break;
			}
			case 'clear':
				out.push('__CLEAR__');
				break;
			case 'vi': {
				const n = args[0];
				if (!n) {
					out.push('pretty close unc, you forget something?');
					break;
				}
				try {
					openVim(n);
				} catch (e: any) {
					out.push(String(e?.message ?? e));
				}
				break;
			}
			case 'vim': {
				const n = args[0];
				if (!n) {
					out.push('ok sherlock, almost there');
					break;
				}
				try {
					openVim(n);
				} catch (e: any) {
					out.push(String(e?.message ?? e));
				}
				break;
			}
			case 'nvim': {
				const n = args[0];
				if (!n) {
					out.push('not bad, try again');
					break;
				}
				try {
					openVim(n);
				} catch (e: any) {
					out.push(String(e?.message ?? e));
				}
				break;
			}
			default:
				out.push(`command not found: ${bin}`);
		}
		return out;
	}

	function openVim(name: string) {
		if (name === '.') throw new Error(`were you really expecting netrw too?`);
		const f = fs[name];
		if (!f) throw new Error(`nvim: ${name}: No such file`);
		currentFile = name;
		// load file into vim buffer
		lines.length = 0;
		f.content.split('\n').forEach((s) => lines.push(s));
		cursor.row = Math.max(0, lines.length - 1);
		cursor.col = Math.max(0, (lines[cursor.row] ?? '').length - 1);
		currentMode = 'normal';
		commandBuf = '';
		dirty = false; // <— reset dirty when opening
		state = 'vim';
	}

	function onShellKey(e: KeyboardEvent) {
		const k = e.key;

		// Ctrl+L = clear
		if (e.ctrlKey && (k === 'l' || k === 'L')) {
			e.preventDefault();
			shellLog = [];
			return;
		}

		// History
		if (k === 'ArrowUp') {
			e.preventDefault();
			if (!shellHist.length) return;
			if (histIdx === -1) histIdx = shellHist.length - 1;
			else histIdx = Math.max(0, histIdx - 1);
			shellLine = shellHist[histIdx] ?? shellLine;
			return;
		}
		if (k === 'ArrowDown') {
			e.preventDefault();
			if (!shellHist.length) return;
			if (histIdx === -1) return;
			histIdx++;
			if (histIdx >= shellHist.length) {
				histIdx = -1;
				shellLine = '';
			} else shellLine = shellHist[histIdx] ?? '';
			return;
		}

		// Submit
		if (k === 'Enter') {
			e.preventDefault();
			const cmd = shellLine;
			shellLine = '';
			shellPrintPrompt(cmd);
			try {
				shellAppend(runShell(cmd));
			} catch (err: any) {
				shellAppend([String(err?.message ?? err)]);
			}
			if (cmd.trim()) {
				shellHist.push(cmd);
				if (shellHist.length > 500) shellHist.shift();
			}
			histIdx = -1;
			return;
		}

		// Backspace
		if (k === 'Backspace') {
			e.preventDefault();
			if (shellLine.length) shellLine = shellLine.slice(0, -1);
			return;
		}

		// Basic printable
		if (!e.metaKey && !e.ctrlKey && k.length === 1) {
			e.preventDefault();
			shellLine += k;
		}
	}

	// VIM
	type Mode = 'normal' | 'insert' | 'visual' | 'command';
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

	let commandBuf = '';
	let currentFile: string | null = null;

	function enterCommand() {
		currentMode = 'command';
		commandBuf = '';
	}

	function exitCommand() {
		const cmd = commandBuf.trim();
		if (cmd === 'w' || cmd === 'write') {
			writeCurrentFile(); // write, stay in Vim
		} else if (cmd === 'wq' || cmd === 'x') {
			writeCurrentFile(); // write, then quit
			announceWaitlistResult(); // <-- tell them the result
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
	export function insertMode() {
		if (currentMode !== 'insert') {
			currentMode = 'insert';
			console.log('curr mode: ', currentMode);
		}
	}

	export function newLine() {
		lines.push('');
		cursor.col = 0;
		cursor.row++;
		dirty = true;
	}

	export function backspace() {
		const r = cursor.row;
		const line = lines[r] ?? '';

		// If we're not at the very start of the buffer, delete one char to the left.
		if (cursor.col > 0) {
			lines[r] = line.slice(0, cursor.col - 1) + line.slice(cursor.col);
			cursor.col -= 1;
			cursor.goalCol = cursor.col;
			dirty = true;
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
			dirty = true;
			return;
		}

		// (r === 0 && col === 0): nothing to do.
	}

	export function insertChar(char: string) {
		const line = lines[cursor.row] ?? '';
		lines[cursor.row] = line.slice(0, cursor.col) + char + line.slice(cursor.col);
		cursor.col++;
		cursor.goalCol = cursor.col;
		dirty = true; // <— mark dirty
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
	// 3) Clamp vertical motion to the visible window when overflowed
	export function moveUp() {
		setGoalIfNeeded();
		const base = viewBase();
		cursor.row = clamp(cursor.row - 1, base, lines.length - 1);
		cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
	}
	export function moveDown() {
		setGoalIfNeeded();
		const base = viewBase();
		cursor.row = clamp(cursor.row + 1, base, lines.length - 1);
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

	function computeMetrics() {
		// Call after ctx.font is set
		const m = ctx.measureText('0000000000'); // average over 10 zeros
		charWidth = Math.round(m.width / 10);
		const ascent = m.actualBoundingBoxAscent ?? 11;
		const descent = m.actualBoundingBoxDescent ?? 4;
		lineHeight = Math.ceil(ascent + descent + 4); // small padding
	}

	function drawShell() {
		// show last MAX_ROWS-1 log lines + prompt on the last row
		const rowsForLog = MAX_ROWS - 1;
		const base = Math.max(0, shellLog.length - rowsForLog);

		ctx.fillStyle = '#e5e7eb';
		ctx.font = '16px monospace';
		ctx.textAlign = 'left';

		// log lines
		for (let i = base; i < shellLog.length; i++) {
			const ty = 38 + (i - base) * lineHeight;
			ctx.fillText(shellLog[i], paddingX - 16, ty);
		}

		// prompt line
		const promptY = 38 + rowsForLog * lineHeight;
		const prompt = `${cwd} ➜ `;
		ctx.fillStyle = '#bc93f9'; // prompt color
		ctx.fillText(prompt, paddingX - 16, promptY);

		// command text
		ctx.fillStyle = '#e5e7eb';
		const promptW = ctx.measureText(prompt).width;
		ctx.fillText(shellLine, paddingX - 16 + promptW, promptY);

		// caret (same size as Vim)
		const caretX = paddingX + promptW + ctx.measureText(shellLine).width;
		ctx.globalAlpha = 0.85;
		ctx.fillStyle = '#dddddd';
		ctx.fillRect(Math.floor(caretX - 16), Math.floor(promptY - 18), 9.8, lineHeight);
		ctx.globalAlpha = 1;
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

		if (state === 'vim') {
			drawText();
			const { x, y } = caretXY();
			const w = 9.8;
			ctx.fillStyle =
				currentMode === 'insert' ? '#FF0000' : currentMode === 'command' ? '#333333' : '#dddddd';
			ctx.globalAlpha = 0.85;
			ctx.fillRect(Math.floor(x), Math.floor(y), w, lineHeight);
			ctx.globalAlpha = 1;
		} else {
			drawShell();
		}

		raf = requestAnimationFrame(draw);
	}
	let pendingCount: number;
	function onKeyDown(e: KeyboardEvent) {
		if (state === 'shell') {
			onShellKey(e);
			return;
		}
		const k = e.key;
		if ('hjkl'.includes(k)) e.preventDefault();

		if (currentMode === 'normal') {
			if (k >= '1' && k <= '9') {
				e.preventDefault();
				pendingCount = (pendingCount ?? 0) * 10 + (k.charCodeAt(0) - 48);
				console.log(pendingCount);
				return;
			}
			if (k === 'h') moveLeft();
			else if (k === 'l') moveRight();
			else if (k === 'k') moveUp();
			else if (k === 'j') moveDown();
			else if (k === '0') moveFirstCol();
			else if (k === '$') moveLastCol();
			else if (k === 'G') moveLastRow();
			else if (k === 'i') insertMode();
			else if (k === ':') enterCommand();
			else if (k === 'o') {
				newLine();
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
			} else if (k === 'Escape') normalMode();
		} else if (currentMode === 'insert') {
			if (k === 'Escape') {
				normalMode();
			} else if (k === 'Enter') {
				newLine();
			} else if (k === 'Backspace') {
				backspace();
			} else {
				insertChar(k);
			}
		} else if (currentMode === 'command') {
			if (k === 'Escape') {
				normalMode();
			} else if (k === 'Enter') {
				console.log(commandBuf);
				exitCommand();
			} else if (k === 'Backspace') {
				commandBuf = commandBuf.slice(0, commandBuf.length - 1);
			} else {
				commandBuf += k;
			}
		}
	}

	onMount(async () => {
		if (!browser) return;

		window.addEventListener('keydown', onGlobalTab, true); // capture phase
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
		window.removeEventListener('keydown', onGlobalTab, true);
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
				class="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] w-full -translate-x-1/2"
			>
				<div class="mx-auto w-[50vw] max-w-[50vw]">
					<div
						data-mode={currentMode}
						transition:scale={{ duration: 100, start: 0.8 }}
						class="rounded-md border border-white/10 bg-black/60 px-3 py-1.5 data-[mode=command]:border-white/20"
					>
						<span class="text-gray-300">:</span>
						<span class="font-mono text-gray-100">{commandBuf}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
