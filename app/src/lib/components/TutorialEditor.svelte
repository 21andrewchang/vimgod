<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { createVimController, type Cursor, type Mode } from '$lib/vim/vim';
    import RoundGoalBadge from '$lib/components/RoundGoalBadge.svelte';
	import type {
		MatchController,
		MatchState,
		MatchTarget,
		PlayerSelection,
		HighlightSelection
	} from '$lib/match/match';
  
    const COLS = 64;
    const ROWS = 15;
    const MAX_ROWS = ROWS;
    const GUTTER_PAD = 20;
    const TEXT_TOP = 38;
    const CARET_STEP = 9.6328;
  const MAX_UNDO_ENTRIES = 50;
  
    const MOVEMENT_GLOW = '194, 123, 255';
    const HIGHLIGHT_GLOW = '96, 165, 250';
    const DELETE_GLOW = '239, 68, 68';
    const FORCE_UNDO_GLOW = '252, 211, 77';
    const DEFAULT_BORDER_COLOR = 'border-color: rgba(148, 163, 184, 0.14);';
  
    export type MoveStep = {
      kind: 'move';
      row: number;
      col: number;
    };
  
    export type HighlightStep = {
      kind: 'highlight';
      selection: HighlightSelection;
    };
  
    export type DeleteStep = {
      kind: 'delete';
      selection: HighlightSelection;
      expectedDocument: string;
    };
  
    export type TutorialStep = MoveStep | HighlightStep | DeleteStep;
  
type TutorialTarget =
  | { kind: 'move'; row: number; col: number }
  | { kind: 'highlight'; selection: HighlightSelection }
  | { kind: 'manipulate'; selection: HighlightSelection; expectedDocument: string; action: 'delete' };

const {
  steps = [] as TutorialStep[],
  initialText,
  onComplete
} = $props<{
  steps?: TutorialStep[];
  initialText?: string;
  onComplete?: () => void;
}>();

let stepIndex = $state(0);
const totalSteps = $derived(steps.length);
const currentStep = $derived(() => steps[stepIndex] ?? null);

let currentMode: Mode = 'normal';
let pendingCombo = '';
let pendingCount: number | null = null;
let commandBuf = '';
let forceUndoRequired = $state(false);

const tutorial = createVimController({
  initialText: initialText ?? '',
  maxRows: MAX_ROWS,
  onModeChange: (mode) => {
    currentMode = mode;
  },
  onUiStateChange: (uiState) => {
    pendingCombo = uiState.pendingCombo;
    pendingCount = uiState.pendingCount;
    commandBuf = uiState.commandBuffer;
      }
    });

const lines = tutorial.lines;
const cursor: Cursor = tutorial.cursor;

const activeTarget = $derived(() => {
  const step = currentStep();
  if (!step) return null;
  if (step.kind === 'move') {
    return { kind: 'move' as const, row: step.row, col: step.col };
  }
  if (step.kind === 'highlight') {
    return { kind: 'highlight' as const, selection: step.selection };
  }
  return {
    kind: 'manipulate' as const,
    selection: step.selection,
    expectedDocument: step.expectedDocument,
    action: 'delete' as const
  };
});

const targetKind = $derived((): MatchTarget['kind'] | null => {
  const target = activeTarget();
  return target?.kind ?? null;
});

const manipulationAction = $derived((): 'delete' | null => {
  const target = activeTarget();
  return target?.kind === 'manipulate' ? target.action : null;
});

    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let raf = 0;
    let ro: ResizeObserver | undefined;
    let dpr = 1;

    let charWidth = $state(9.6);
    let lineHeight = $state(24);
    const paddingX = 30;
    const paddingY = 20;

    let targetW = $state(0);
    let targetH = $state(0);
    let glowBorderColor = $state(DEFAULT_BORDER_COLOR);
    let glowBoxShadow = $state('none');

type UndoSnapshot = { document: string; cursor: { row: number; col: number } };
let undoStack: UndoSnapshot[] = [];
let roundBaselineSnapshot: UndoSnapshot | null = null;
let lastNowMs = 0;
let undoBlink = 0;

  function serializeDocument(source: string[] = lines) {
    return source.join('\n');
  }

function snapshotRoundBaseline() {
  roundBaselineSnapshot = {
    document: serializeDocument(),
    cursor: { row: cursor.row, col: cursor.col }
  };
  undoStack = [];
  forceUndoRequired = false;
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
  if (baselineDocument !== null && nextDocument === baselineDocument) {
    forceUndoRequired = false;
    undoStack = [];
    return true;
  }
  const target = activeTarget();
  if (target?.kind === 'manipulate' && nextDocument === target.expectedDocument) {
    forceUndoRequired = false;
    return true;
  }
  return false;
}

function requireUndo() {
  if (!forceUndoRequired) {
    forceUndoRequired = true;
  }
}

function handleDocumentChange(previousDocument: string, nextDocument: string) {
  const target = activeTarget();
  if (!target) return;
  if (resetForceUndoIfCleared(nextDocument)) return;
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
      tutorial.resetDocument(snapshot.document, snapshot.cursor);
      recomputeLayout();
      resetForceUndoIfCleared(serializeDocument());
      return;
    }
    if (!roundBaselineSnapshot) return;
    tutorial.resetDocument(roundBaselineSnapshot.document, roundBaselineSnapshot.cursor);
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

    $effect(() => {
      if (currentStep()) {
        snapshotRoundBaseline();
      }
    });
  
  
  
  
    function viewBase() {
      return tutorial.viewBase();
    }
  
    function caretXY() {
      const base = viewBase();
      return {
        x: paddingX + 10 + cursor.col * CARET_STEP,
        y: paddingY + (cursor.row - base) * lineHeight
      };
    }
  
    function recomputeLayout() {
      const gutter = Math.ceil(ctx.measureText(String(ROWS)).width) + GUTTER_PAD;
      targetW = Math.ceil(paddingX + gutter + COLS * charWidth + paddingX);
      targetH = Math.ceil(TEXT_TOP + MAX_ROWS * lineHeight) + 1;
    }
  
    function applyDpr() {
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
  
    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * Math.min(Math.max(t, 0), 1);
    }
  
    function buildGlow(rgb: string, strength: number) {
      const blur = lerp(90, 320, strength);
      const spread = lerp(10, 36, strength);
      const alpha = lerp(0.18, 0.32, strength);
      return `0 0 ${blur.toFixed(1)}px ${spread.toFixed(1)}px rgba(${rgb}, ${alpha.toFixed(3)})`;
    }
  
    function drawText() {
      const base = viewBase();
      const end = Math.min(lines.length, base + MAX_ROWS);
      ctx.fillStyle = '#737373';
      ctx.textAlign = 'right';
      ctx.font = '16px monospace';

      for (let r = base; r < end; r++) {
        const isCurrent = r === cursor.row;
        const rel = Math.abs(r - cursor.row);
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
  
    function drawMoveTarget(row: number, col: number) {
      const base = viewBase();
      const x = paddingX + 10 + col * CARET_STEP;
      const rowTop = paddingY + (row - base) * lineHeight;
      const caretH = Math.max(1, lineHeight - 1);
      ctx.save();
      ctx.fillStyle = 'rgba(194, 123, 255, 0.55)';
      ctx.fillRect(Math.floor(x), Math.floor(rowTop), Math.ceil(charWidth), caretH);
      ctx.restore();
    }
  
    function drawHighlight(
      selection: HighlightSelection,
      options: { fill?: string; alpha?: number } = {}
    ) {
      const base = viewBase();
      const textStartX = paddingX + 10;
      const { fill = '#dddddd', alpha = 0.28 } = options;
      ctx.save();
      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha;

      if (selection.type === 'line') {
        const start = Math.max(selection.startRow, base);
        const end = Math.min(selection.endRow, lines.length - 1);
        for (let r = start; r <= end && r < base + MAX_ROWS; r++) {
          const text = lines[r] ?? '';
          const textW = Math.max(ctx.measureText(text).width, charWidth);
          const rowY = paddingY + (r - base) * lineHeight;
          ctx.fillRect(Math.floor(textStartX), Math.floor(rowY), Math.ceil(textW), lineHeight);
        }
      } else {
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

      ctx.restore();
    }
  
    function drawCaret() {
      const { x, y } = caretXY();
      const base = viewBase();
      const caretRowTop = paddingY + (cursor.row - base) * lineHeight;
      const caretH = Math.max(1, lineHeight - 1);
      ctx.save();
      ctx.fillStyle = '#dddddd';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(Math.floor(x), Math.floor(caretRowTop), 9.8, caretH);
      ctx.restore();
    }
  
    function drawTargetOverlay() {
      if (forceUndoRequired) {
        return;
      }
      const step = currentStep();
      if (!step) return;
      if (step.kind === 'move') {
        drawMoveTarget(step.row, step.col);
        return;
      }
      if (step.kind === 'highlight') {
        drawHighlight(step.selection, { fill: 'rgb(96, 165, 250)', alpha: 0.35 });
        return;
      }
      if (step.kind === 'delete') {
        drawHighlight(step.selection, { fill: 'rgb(248, 113, 113)', alpha: 0.38 });
        return;
      }
    }
  
    function draw() {
      clear();
      const now = performance.now();
      const breath = (Math.sin(now / 420) + 1) / 2;
      undoBlink = forceUndoRequired ? (Math.sin(now / 60) + 1) / 2 : 1;
      const strength = 0.4 + breath * 0.4;
      const step = currentStep();
      let glowRgb = MOVEMENT_GLOW;
      if (forceUndoRequired) {
        glowRgb = FORCE_UNDO_GLOW;
      } else if (step?.kind === 'highlight') {
        glowRgb = HIGHLIGHT_GLOW;
      } else if (step?.kind === 'delete') {
        glowRgb = DELETE_GLOW;
      }
      const borderStrength = forceUndoRequired ? Math.max(strength, 0.75) : strength;
      const glowStrength = forceUndoRequired ? Math.max(strength, 0.75) : strength;
      glowBoxShadow = buildGlow(glowRgb, glowStrength);
      glowBorderColor = `border-color: rgba(${glowRgb}, ${(0.12 + glowStrength * 0.3).toFixed(3)});`;

      drawText();
      drawTargetOverlay();

      const selection = tutorial.getSelection();
      const base = viewBase();
      const textStartX = paddingX + 10;

      if (selection) {
        ctx.save();
        if (forceUndoRequired) {
          ctx.fillStyle = '#fef08a';
          ctx.globalAlpha = 0.35 + 0.25 * undoBlink;
        } else {
          ctx.fillStyle = '#dddddd';
          ctx.globalAlpha = 0.28;
        }

        if (selection.type === 'line') {
          const startRow = Math.max(selection.startRow, base);
          const endRow = Math.min(selection.endRow, lines.length - 1);
          for (let r = startRow; r <= endRow && r < base + MAX_ROWS; r++) {
            const text = lines[r] ?? '';
            const textW = Math.max(ctx.measureText(text).width, charWidth);
            const rowY = paddingY + (r - base) * lineHeight;
            ctx.fillRect(Math.floor(textStartX), Math.floor(rowY), Math.ceil(textW), lineHeight);
          }
        } else {
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

        ctx.restore();
      }

      if (!selection || selection.type !== 'line') {
        drawCaret();
      }
      raf = requestAnimationFrame(draw);
    }
  
    function stepsCompleted() {
      return stepIndex >= totalSteps;
    }
  
  function advanceStep() {
  stepIndex += 1;
  if (stepsCompleted()) {
      onComplete?.();
      return;
    }
    snapshotRoundBaseline();
  }

  function selectionMatches(target: HighlightSelection | undefined) {
    if (!target) return false;
    const selection = tutorial.getSelection();
    if (!selection) return false;
    if (target.type === 'line' && selection.type === 'line') {
      return (
        target.startRow === selection.startRow && target.endRow === selection.endRow
      );
    }
    if (target.type === 'char' && selection.type === 'char') {
      return (
        target.start.row === selection.start.row &&
        target.start.col === selection.start.col &&
        target.end.row === selection.end.row &&
        target.end.col === selection.end.col
      );
    }
    return false;
  }

  function onKeyDown(event: KeyboardEvent) {
  const undoKeyPressed = isUndoKey(event);
  if (forceUndoRequired && !undoKeyPressed) {
    event.preventDefault();
    return;
  }

  if (undoKeyPressed) {
    event.preventDefault();
    handleUndo();
    return;
  }

  const previousDocument = serializeDocument();
  const previousCursor = { row: cursor.row, col: cursor.col };

  tutorial.handleKeyDown(event);

  const nextDocument = serializeDocument();
  const docChanged = nextDocument !== previousDocument;

  if (docChanged) {
    pushUndoSnapshot({ document: previousDocument, cursor: previousCursor });
    handleDocumentChange(previousDocument, nextDocument);
  }

const selection = tutorial.getSelection();
const step = currentStep();

if (!step) {
  return;
}

if (step.kind === 'move') {
  if (cursor.row === step.row && cursor.col === step.col) {
    advanceStep();
  }
  return;
}

if (step.kind === 'highlight') {
  if (selectionMatches(step.selection)) {
    advanceStep();
  }
  return;
}

if (step.kind === 'delete') {
  if (nextDocument === step.expectedDocument && !selectionMatches(step.selection)) {
    advanceStep();
  }
  return;
}
  }
  
    onMount(() => {
      if (!browser) return;
      ctx = canvas.getContext('2d', { alpha: false })!;
      ctx.textBaseline = 'top';
      charWidth = ctx.measureText('M').width;
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
  
  <div class="fixed inset-0 flex flex-col items-center justify-center">
    <div class="flex flex-col gap-2">
    <div class="flex flex-row items-center">
        <div class="pointer-events-none flex gap-2">
          <div
            class="relative inline-flex items-center gap-3 overflow-hidden rounded-lg border border-neutral-400/20 bg-black/60 px-3 py-2 font-mono uppercase tracking-wide text-neutral-100"
          >
            <span class="text-sm leading-none text-neutral-200"
              >{Math.min(stepIndex + 1, totalSteps)}/{totalSteps}</span
            >
          </div>
          <RoundGoalBadge
            {forceUndoRequired}
            targetKind={targetKind() ?? 'move'}
            manipulationAction={manipulationAction() ?? null}
          />
        </div>
      </div>
      <div class="relative mb-10">
        <div
          data-mode={currentMode}
          class="relative overflow-hidden rounded-xl border border-white/10 shadow-lg data-[mode=command]:border-white/20"
          style={`width:${targetW}px; height:${targetH}px; ${glowBorderColor}`}
          style:box-shadow={glowBoxShadow}
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
            <div class="w-full rounded-md border border-white/10 bg-black/60 px-3 py-1.5">
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
