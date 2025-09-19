import { ENABLE_INSERT_MODE } from '$lib/config';

export type Mode = 'normal' | 'insert' | 'visual' | 'command' | 'block' | 'line';

export type Cursor = {
  row: number;
  col: number;
  goalCol: number | null;
};

export type Position = {
  row: number;
  col: number;
};

export type LineSelection = {
  type: 'line';
  startRow: number;
  endRow: number;
};

export type CharSelection = {
  type: 'char';
  start: Position;
  end: Position;
};

export type Selection = LineSelection | CharSelection;

export interface VimUiState {
  pendingCombo: string;
  pendingCount: number | null;
  commandBuffer: string;
}

export interface VimController {
  lines: string[];
  cursor: Cursor;
  viewBase(): number;
  getVisualLineStart(): number | null;
  getSelection(): Selection | null;
  getMode(): Mode;
  getUiState(): VimUiState;
  handleKeyDown(event: KeyboardEvent): boolean;
  resetDocument(text: string, position?: Position | null): void;
}

interface VimOptions {
  initialText: string;
  maxRows: number;
  onModeChange?: (mode: Mode) => void;
  onUiStateChange?: (state: VimUiState) => void;
  onCommand?: (command: string) => void;
  insertModeEnabled?: boolean;
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

const BRACKET_PAIRS: Record<string, [string, string]> = {
  '(': ['(', ')'],
  ')': ['(', ')'],
  '[': ['[', ']'],
  ']': ['[', ']'],
  '{': ['{', '}'],
  '}': ['{', '}'],
  '<': ['<', '>'],
  '>': ['<', '>']
};

const QUOTE_KEYS: Record<string, '"' | '\'' | '`'> = {
  '"': '"',
  "'": '\'',
  '`': '`'
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeText(raw: string) {
  return raw.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
}

function isPrintable(event: KeyboardEvent) {
  if (IGNORED_KEYS.has(event.key)) return false;
  const altGraph = typeof event.getModifierState === 'function' && event.getModifierState('AltGraph');
  if (event.ctrlKey || event.metaKey) return false;
  if (event.altKey && !altGraph) return false;
  return event.key.length === 1;
}

const ISKEYWORD_RE = /[\p{L}\p{N}_]/u;
function isWordChar(ch: string | undefined | null) {
  if (!ch) return false;
  try {
    return ISKEYWORD_RE.test(ch);
  } catch {
    return /[A-Za-z0-9_]/.test(ch);
  }
}

function isSpaceChar(ch: string | undefined | null) {
  return ch === ' ' || ch === '\t';
}

export function createVimController(options: VimOptions): VimController {
  const lines = (() => {
    const normalized = normalizeText(options.initialText);
    return normalized.length ? normalized.split('\n') : [''];
  })();

  const cursor: Cursor = { row: 0, col: 0, goalCol: null };

  let currentMode: Mode = 'normal';
  const insertModeEnabled = options.insertModeEnabled ?? ENABLE_INSERT_MODE;
  let visualLineStart: number | null = null;
  let selection: Selection | null = null;
  let visualCharAnchor: Position | null = null;
  let pendingCount: number | null = null;
  let pendingCombo = '';
  let pendingOperatorCount: number | null = null;
  let commandBuffer = '';
  let lastSearch = '';
  let lastSearchDirection = false;
  let lastSearchType: 'find' | 'to' = 'find';

  const emitMode = () => options.onModeChange?.(currentMode);
  const emitUiState = () =>
    options.onUiStateChange?.({
      pendingCombo,
      pendingCount,
      commandBuffer
    });

  function lineText(row: number) {
    return lines[row] ?? '';
  }

  function lineLength(row: number) {
    const text = lineText(row);
    return text.length;
  }

  function lineLen(row: number) {
    const len = lineLength(row);
    return len === 0 ? 0 : len - 1;
  }

  function viewBase() {
    const maxBase = Math.max(0, lines.length - options.maxRows);
    return clamp(cursor.row - Math.floor(options.maxRows / 2), 0, maxBase);
  }

  function setMode(mode: Mode) {
    if (currentMode !== mode) {
      currentMode = mode;
      emitMode();
    }
  }

  function setPendingCombo(value: string) {
    if (pendingCombo !== value) {
      pendingCombo = value;
      emitUiState();
    }
  }

  function setPendingCount(value: number | null) {
    if (pendingCount !== value) {
      pendingCount = value;
      emitUiState();
    }
  }

  function setCommandBuffer(value: string) {
    if (commandBuffer !== value) {
      commandBuffer = value;
      emitUiState();
    }
  }

  function ensureGoal() {
    if (cursor.goalCol == null) cursor.goalCol = cursor.col;
  }

  const clampRow = (row: number) => clamp(row, 0, Math.max(0, lines.length - 1));

  function normalizePosition(pos: Position): Position {
    const row = clampRow(pos.row);
    const text = lineText(row);
    const col = clamp(pos.col, 0, text.length);
    return { row, col };
  }

  function comparePositions(a: Position, b: Position) {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  }

  function normalizeRange(start: Position, end: Position) {
    const a = normalizePosition(start);
    const b = normalizePosition(end);
    return comparePositions(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
  }

  function setCharSelectionRange(
    start: Position,
    end: Position,
    options: { preserveCursor?: boolean; anchor?: Position | null } = {}
  ) {
    let { start: normalizedStart, end: normalizedEnd } = normalizeRange(start, end);
    if (comparePositions(normalizedStart, normalizedEnd) === 0) {
      const length = lineLength(normalizedStart.row);
      if (normalizedEnd.col < length) {
        normalizedEnd = { row: normalizedEnd.row, col: normalizedEnd.col + 1 };
      } else if (normalizedStart.col > 0) {
        normalizedStart = { row: normalizedStart.row, col: normalizedStart.col - 1 };
      }
    }

    const resolvedStart = normalizePosition(normalizedStart);
    const resolvedEnd = normalizePosition(normalizedEnd);

    selection = {
      type: 'char',
      start: resolvedStart,
      end: resolvedEnd
    };

    if (options.anchor !== undefined) {
      visualCharAnchor = options.anchor ? normalizePosition(options.anchor) : null;
    } else if (!options.preserveCursor) {
      visualCharAnchor = resolvedStart;
    }

    visualLineStart = null;
    setMode('visual');

    if (!options.preserveCursor) {
      cursor.row = resolvedStart.row;
      cursor.col = resolvedEnd.col - 1;
      cursor.goalCol = cursor.col;
    }
  }

  function setLineSelectionRange(startRow: number, endRow: number) {
    const minRow = clampRow(Math.min(startRow, endRow));
    const maxRow = clampRow(Math.max(startRow, endRow));
    selection = { type: 'line', startRow: minRow, endRow: maxRow };
    visualCharAnchor = null;
  }

  function clearSelection() {
    selection = null;
    visualLineStart = null;
    visualCharAnchor = null;
  }

  function updateLineSelection() {
    if (visualLineStart == null) return;
    setLineSelectionRange(visualLineStart, cursor.row);
    setMode('line');
  }

  function ensureVisualAnchor() {
    if (!visualCharAnchor) {
      visualCharAnchor = normalizePosition({ row: cursor.row, col: cursor.col });
    }
  }

  function updateVisualCharSelection() {
    if (currentMode !== 'visual') return;
    ensureVisualAnchor();
    if (!visualCharAnchor) return;

    const head = normalizePosition({ row: cursor.row, col: cursor.col });
    const anchor = visualCharAnchor;

    if (comparePositions(anchor, head) <= 0) {
      setCharSelectionRange(anchor, { row: head.row, col: head.col + 1 }, {
        preserveCursor: true,
        anchor
      });
    } else {
      setCharSelectionRange(head, { row: anchor.row, col: anchor.col + 1 }, {
        preserveCursor: true,
        anchor
      });
    }

    cursor.row = head.row;
    cursor.col = head.col;
    cursor.goalCol = cursor.col;
  }

  function normalMode() {
    if (currentMode !== 'normal') {
      clearSelection();
      clearPending();
    }
    setMode('normal');
    const line = lineText(cursor.row);
    if (line.length === 0) {
      cursor.col = 0;
      cursor.goalCol = cursor.col;
      return;
    }
    if (cursor.col > line.length - 1) {
      cursor.col = Math.max(0, line.length - 1);
    }
  }

  function visualLineMode() {
    if (currentMode !== 'line') {
      setMode('line');
      visualLineStart = cursor.row;
    }
    updateLineSelection();
  }

  function insertMode() {
    if (!insertModeEnabled) return;
    if (currentMode === 'line' || currentMode === 'visual') {
      clearSelection();
    }
    if (currentMode !== 'insert') {
      setMode('insert');
    }
  }

  function enterCommand() {
    setMode('command');
    commandBuffer = '';
    emitUiState();
  }

  function exitCommand() {
    const cmd = commandBuffer.trim();
    if (cmd) {
      options.onCommand?.(cmd);
    }
    setMode('normal');
    commandBuffer = '';
    emitUiState();
  }

  function backspace() {
    const row = cursor.row;
    const col = cursor.col;
    const line = lines[row] ?? '';

    if (col > 0) {
      lines[row] = line.slice(0, col - 1) + line.slice(col);
      cursor.col -= 1;
      cursor.goalCol = cursor.col;
      return;
    }

    if (row > 0) {
      const prev = lines[row - 1] ?? '';
      const merged = prev + line;
      lines[row - 1] = merged;
      lines.splice(row, 1);
      cursor.row = row - 1;
      cursor.col = prev.length;
      cursor.goalCol = cursor.col;
    }
  }

  function insertChar(char: string) {
    const row = cursor.row;
    const col = cursor.col;
    const line = lines[row] ?? '';
    lines[row] = line.slice(0, col) + char + line.slice(col);
    cursor.col += 1;
    cursor.goalCol = cursor.col;
  }

  function moveFirstCol() {
    cursor.col = 0;
    cursor.goalCol = cursor.col;
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveFirstChar() {
    const line = lines[cursor.row] ?? '';
    let idx = 0;
    for (idx = 0; idx < line.length; idx++) {
      if (line[idx] !== ' ') break;
    }
    cursor.col = idx;
    cursor.goalCol = cursor.col;
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveLastCol() {
    cursor.col = lineLen(cursor.row);
    cursor.goalCol = cursor.col;
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveLeft(count: number | null) {
    cursor.col = clamp(cursor.col - (count ?? 1), 0, lineLen(cursor.row));
    cursor.goalCol = cursor.col;
    setPendingCount(null);
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveRight(count: number | null) {
    cursor.col = clamp(cursor.col + (count ?? 1), 0, lineLen(cursor.row));
    cursor.goalCol = cursor.col;
    setPendingCount(null);
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveUp(count: number | null) {
    ensureGoal();
    const base = viewBase();
    cursor.row = clamp(cursor.row - (count ?? 1), base, lines.length - 1);
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    setPendingCount(null);
    if (currentMode === 'line') updateLineSelection();
    else if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveDown(count: number | null) {
    ensureGoal();
    const base = viewBase();
    cursor.row = clamp(cursor.row + (count ?? 1), base, lines.length - 1);
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    setPendingCount(null);
    if (currentMode === 'line') updateLineSelection();
    else if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveFirstRow() {
    ensureGoal();
    cursor.row = 0;
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    if (currentMode === 'line') updateLineSelection();
    else if (currentMode === 'visual') updateVisualCharSelection();
  }

  function moveLastRow() {
    ensureGoal();
    cursor.row = lines.length - 1;
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    if (currentMode === 'line') updateLineSelection();
    else if (currentMode === 'visual') updateVisualCharSelection();
  }

  function resetGoal() {
    cursor.goalCol = null;
  }

  function classOf(row: number, col: number, big: boolean): 'space' | 'word' | 'punct' {
    const line = lines[row] ?? '';
    const ch = line[col];
    if (isSpaceChar(ch)) return 'space';
    if (big) return 'word';
    return isWordChar(ch) ? 'word' : 'punct';
  }

  function clampColForRow(row: number, col: number) {
    const text = lines[row] ?? '';
    if (text.length === 0) return 0;
    return clamp(col, 0, text.length - 1);
  }

  function findNextNonSpaceForward(row: number, col: number): Position | null {
    let currRow = clampRow(row);
    let currCol = Math.max(0, col);

    while (currRow < lines.length) {
      const text = lines[currRow] ?? '';
      if (text.length === 0) {
        if (currRow >= lines.length - 1) return null;
        currRow += 1;
        currCol = 0;
        continue;
      }

      if (currCol >= text.length) {
        if (currRow >= lines.length - 1) return null;
        currRow += 1;
        currCol = 0;
        continue;
      }

      if (!isSpaceChar(text[currCol])) {
        return { row: currRow, col: currCol };
      }

      currCol += 1;
    }

    return null;
  }

  function isWordEnd(row: number, col: number, big: boolean) {
    const text = lines[row] ?? '';
    if (text.length === 0) return false;
    const currClass = classOf(row, col, big);
    if (currClass === 'space') return false;
    if (col >= text.length - 1) return true;
    const nextClass = classOf(row, col + 1, big);
    return currClass !== nextClass;
  }
  function skipSpaces(row: number, col: number, reverse: boolean) {
    let currRow = row;
    let currCol = col;
    while (isSpaceChar(lines[currRow]?.[currCol])) {
      if (!reverse && currCol === (lines[currRow]?.length ?? 1) - 1) {
        currCol = 0;
        currRow++;
      } else if (reverse && currCol === 0) {
        currRow--;
        currCol = (lines[currRow]?.length ?? 1) - 1;
      } else {
        currCol += reverse ? -1 : 1;
      }
    }
    return [currRow, currCol] as const;
  }

  function moveNextWord(count: number | null, big: boolean, ghost: boolean) {
    let remaining = count ?? 1;
    let currRow = cursor.row;
    let currCol = cursor.col;
    let newRow = currRow;
    let newCol = currCol + 1;
    let currLine = lines[cursor.row] ?? '';

    for (; remaining > 0; remaining--) {
      if (currRow === lines.length - 1 && currCol === (lines[currRow]?.length ?? 1) - 1) {
        if (!ghost) setPendingCount(null);
        return ghost ? [currRow, currCol] : undefined;
      }
      while (classOf(currRow, currCol, big) === classOf(newRow, newCol, big)) {
        if (newCol < currLine.length - 1) {
          newCol++;
        } else if (currRow === lines.length - 1) {
          newCol = (lines[currRow]?.length ?? 1) - 1;
          break;
        } else {
          newCol = 0;
          newRow++;
          currLine = lines[newRow] ?? '';
        }
      }
      currCol = newCol;
      currRow = newRow;
      if (isSpaceChar(lines[currRow]?.[currCol])) {
        [newRow, newCol] = skipSpaces(currRow, currCol, false);
      }
    }

    if (!ghost) {
      cursor.col = newCol;
      cursor.goalCol = cursor.col;
      cursor.row = newRow;
      setPendingCount(null);
      if (currentMode === 'visual') updateVisualCharSelection();
      return;
    }
    return [newRow, newCol] as const;
  }

  function moveBackWord(count: number | null, big: boolean, ghost: boolean) {
    let remaining = count ?? 1;
    let currRow = cursor.row;
    let currCol = cursor.col;
    let newRow = currRow;
    let newCol = currCol - 1;

    if (currRow === 0 && currCol === 0) return ghost ? [currRow, currCol] : undefined;

    for (; remaining > 0; remaining--) {
      if (currRow === 0 && currCol === 1) {
        newCol--;
        break;
      }
      if (classOf(currRow, currCol, big) !== classOf(newRow, newCol, big)) {
        currCol = newCol;
        newCol--;
      }
      if (isSpaceChar(lines[currRow]?.[currCol])) {
        [currRow, currCol] = skipSpaces(currRow, currCol, true);
        newRow = currRow;
        newCol = currCol - 1;
      }
      while (classOf(currRow, currCol, big) === classOf(newRow, newCol, big)) {
        newCol--;
      }
    }

    if (!ghost) {
      cursor.col = newCol + 1;
      cursor.goalCol = cursor.col;
      cursor.row = newRow;
      setPendingCount(null);
      if (currentMode === 'visual') updateVisualCharSelection();
      return;
    }
    return [newRow, newCol + 1] as const;
  }

  function deleteRange(start: Position, end: Position) {
    const { start: s, end: e } = normalizeRange(start, end);
    if (comparePositions(s, e) >= 0) return false;

    if (s.row === e.row) {
      const text = lines[s.row] ?? '';
      const next = text.slice(0, s.col) + text.slice(e.col);
      lines[s.row] = next;
      cursor.row = s.row;
      cursor.col = next.length === 0 ? 0 : Math.max(0, Math.min(s.col, next.length - 1));
    } else {
      const startText = lines[s.row] ?? '';
      const endText = lines[e.row] ?? '';
      const merged = startText.slice(0, s.col) + endText.slice(e.col);
      lines.splice(s.row, e.row - s.row + 1, merged);
      cursor.row = s.row;
      cursor.col = merged.length === 0 ? 0 : Math.max(0, Math.min(s.col, merged.length - 1));
    }

    if (!lines.length) {
      lines.push('');
      cursor.row = 0;
      cursor.col = 0;
    }

    cursor.goalCol = cursor.col;
    normalMode();
    return true;
  }

  function deleteCurrentLines(count: number) {
    const total = Math.max(1, count);
    const startRow = clampRow(cursor.row);
    lines.splice(startRow, total);
    if (!lines.length) {
      lines.push('');
    }
    cursor.row = Math.min(startRow, lines.length - 1);
    cursor.col = 0;
    cursor.goalCol = 0;
    normalMode();
  }

  function innerWordRange(big: boolean): { start: Position; end: Position } | null {
    const row = cursor.row;
    const text = lineText(row);
    if (text.length === 0) return null;

    let col = clampColForRow(row, cursor.col);
    if (col >= text.length) col = Math.max(0, text.length - 1);

    const isWord = big
      ? (ch: string | undefined) => !!ch && !isSpaceChar(ch)
      : (ch: string | undefined) => !!ch && isWordChar(ch);

    if (!isWord(text[col])) {
      const currentChar = text[col];
      if (currentChar && !isSpaceChar(currentChar)) {
        return {
          start: { row, col },
          end: { row, col: col + 1 }
        };
      }
      let idx = col;
      while (idx < text.length && !isWord(text[idx])) idx++;
      if (idx >= text.length) {
        idx = col;
        while (idx >= 0 && !isWord(text[idx])) idx--;
        if (idx < 0) return null;
      }
      col = idx;
    }

    let startCol = col;
    while (startCol > 0 && isWord(text[startCol - 1])) startCol--;

    let endCol = col + 1;
    while (endCol < text.length && isWord(text[endCol])) endCol++;

    return {
      start: { row, col: startCol },
      end: { row, col: endCol }
    };
  }

  function innerQuoteRange(quote: '"' | '\'' | '`'): { start: Position; end: Position } | null {
    const pivot = pivotPosition();
    const row = pivot.row;
    const text = lineText(row);
    if (text.length === 0) return null;

    let start = -1;
    for (let i = pivot.col; i >= 0; i--) {
      if (text[i] === quote) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      const forward = findNextQuoteRange(quote);
      return forward ?? null;
    }

    let end = -1;
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === quote) {
        end = i;
        break;
      }
    }
    if (end === -1 || end <= start + 1) {
      const forward = findNextQuoteRange(quote);
      return forward ?? null;
    }

    return {
      start: { row, col: start + 1 },
      end: { row, col: end }
    };
  }

  const INNER_BRACKETS: Record<string, [string, string]> = {
    '(': ['(', ')'],
    ')': ['(', ')'],
    '[': ['[', ']'],
    ']': ['[', ']'],
    '{': ['{', '}'],
    '}': ['{', '}'],
    '<': ['<', '>'],
    '>': ['<', '>'],
    b: ['(', ')'],
    B: ['{', '}']
  };

  function innerBracketRange(openChar: string, closeChar: string): { start: Position; end: Position } | null {
    const pivot = pivotPosition();
    const row = pivot.row;
    const line = lineText(row);
    if (line.length === 0) return null;

    let depth = 0;
    let start = -1;
    for (let i = pivot.col; i >= 0; i--) {
      const ch = line[i];
      if (ch === closeChar) depth++;
      else if (ch === openChar) {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    if (start === -1) {
      const forward = findNextBracketRange(openChar, closeChar);
      return forward ?? null;
    }

    depth = 0;
    let end = -1;
    for (let i = start + 1; i < line.length; i++) {
      const ch = line[i];
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }

    if (end === -1 || end <= start + 1) {
      const forward = findNextBracketRange(openChar, closeChar);
      return forward ?? null;
    }

    return {
      start: { row, col: start + 1 },
      end: { row, col: end }
    };
  }

  function rangeForInnerTextObject(key: string): { start: Position; end: Position } | null {
    if (key === 'w') return innerWordRange(false);
    if (key === 'W') return innerWordRange(true);
    if (key === '"' || key === '\'' || key === '`') {
      return innerQuoteRange(key as '"' | '\'' | '`');
    }
    const bracket = INNER_BRACKETS[key];
    if (bracket) return innerBracketRange(bracket[0], bracket[1]);
    return null;
  }

  function deleteToLineStart() {
    const row = cursor.row;
    const col = clamp(cursor.col, 0, lineLength(row));
    if (col <= 0) return false;
    return deleteRange({ row, col: 0 }, { row, col: col + 1 });
  }

  function deleteToLineEnd() {
    const row = cursor.row;
    const line = lineText(row);
    if (!line.length) return false;
    const startCol = clamp(cursor.col, 0, line.length - 1);
    return deleteRange({ row, col: startCol }, { row, col: line.length });
  }

  function deleteToCharForward(char: string, inclusive: boolean) {
    const row = cursor.row;
    const line = lineText(row);
    if (!line.length) return false;
    const from = clamp(cursor.col, 0, line.length - 1);
    const target = line.indexOf(char, from + 1);
    if (target === -1) return false;
    const endCol = inclusive ? target + 1 : target;
    if (endCol <= from) return false;
    return deleteRange({ row, col: from }, { row, col: endCol });
  }

  function deleteToCharBackward(char: string, inclusive: boolean) {
    const row = cursor.row;
    const line = lineText(row);
    if (!line.length) return false;
    const from = clamp(cursor.col, 0, line.length - 1);
    const target = line.lastIndexOf(char, from - 1);
    if (target === -1) return false;
    const startCol = inclusive ? target : target + 1;
    if (startCol > from) return false;
    return deleteRange({ row, col: startCol }, { row, col: from + 1 });
  }

  function moveEndWord(count: number | null, big: boolean, ghost: boolean) {
    let remaining = count ?? 1;
    let nextRow = clampRow(cursor.row);
    let nextCol = clampColForRow(nextRow, cursor.col);

    const initialText = lines[nextRow] ?? '';
    if (
      initialText.length > 0 &&
      !isSpaceChar(initialText[nextCol]) &&
      isWordEnd(nextRow, nextCol, big)
    ) {
      const target = findNextNonSpaceForward(nextRow, nextCol + 1);
      if (target) {
        nextRow = target.row;
        nextCol = target.col;
      }
    }

    let lastRow = nextRow;
    let lastCol = nextCol;

    while (remaining > 0) {
      if (nextRow >= lines.length) break;

      let text = lines[nextRow] ?? '';

      if (text.length === 0 || nextCol >= text.length || isSpaceChar(text[nextCol])) {
        const target = findNextNonSpaceForward(nextRow, nextCol);
        if (!target) break;
        nextRow = target.row;
        nextCol = target.col;
        text = lines[nextRow] ?? '';
        if (text.length === 0) break;
      }

      if (nextCol >= (lines[nextRow]?.length ?? 0)) {
        nextCol = clampColForRow(nextRow, nextCol);
      }

      const wordClass = classOf(nextRow, nextCol, big);
      let endRow = nextRow;
      let endCol = nextCol;

      while (true) {
        const lineText = lines[endRow] ?? '';
        if (lineText.length === 0) break;
        if (endCol >= lineText.length - 1) break;
        const candidateCol = endCol + 1;
        if (classOf(endRow, candidateCol, big) !== wordClass) break;
        endCol = candidateCol;
      }

      lastRow = endRow;
      lastCol = endCol;
      remaining -= 1;

      if (remaining <= 0) {
        nextRow = endRow;
        nextCol = endCol;
        break;
      }

      const lineText = lines[endRow] ?? '';
      if (lineText.length === 0) {
        if (endRow >= lines.length - 1) {
          nextRow = endRow;
          nextCol = endCol;
          break;
        }
        nextRow = endRow + 1;
        nextCol = 0;
        continue;
      }

      if (endCol < lineText.length - 1) {
        nextRow = endRow;
        nextCol = endCol + 1;
      } else if (endRow < lines.length - 1) {
        nextRow = endRow + 1;
        nextCol = 0;
      } else {
        nextRow = endRow;
        nextCol = endCol;
        break;
      }
    }

    if (!ghost) {
      cursor.row = lastRow;
      cursor.col = lastCol;
      cursor.goalCol = cursor.col;
      setPendingCount(null);
      if (currentMode === 'visual') updateVisualCharSelection();
      return;
    }

    return [lastRow, lastCol] as const;
  }

  function selectInnerWord(big: boolean) {
    const row = cursor.row;
    const line = lineText(row);
    if (line.length === 0) return false;

    let col = cursor.col;
    if (col >= line.length) col = Math.max(0, line.length - 1);

    const isWord = big
      ? (ch: string | undefined) => !!ch && !isSpaceChar(ch)
      : (ch: string | undefined) => !!ch && isWordChar(ch);

    if (!isWord(line[col])) {
      let idx = col;
      while (idx < line.length && !isWord(line[idx])) idx++;
      if (idx >= line.length) {
        idx = col;
        while (idx >= 0 && !isWord(line[idx])) idx--;
        if (idx < 0) return false;
      }
      col = idx;
    }

    let startCol = col;
    while (startCol > 0 && isWord(line[startCol - 1])) startCol--;

    let endCol = col + 1;
    while (endCol < line.length && isWord(line[endCol])) endCol++;

    setCharSelectionRange(
      { row, col: startCol },
      { row, col: endCol },
      { anchor: { row, col: startCol } }
    );
    return true;
  }

  function pivotPosition() {
    return visualCharAnchor ?? normalizePosition({ row: cursor.row, col: cursor.col });
  }

  function selectInsideQuotes(quote: '"' | '\'' | '`') {
    const pivot = pivotPosition();
    const row = pivot.row;
    const line = lineText(row);
    if (line.length === 0) return false;

    let start = -1;
    for (let i = pivot.col; i >= 0; i--) {
      if (line[i] === quote) {
        start = i;
        break;
      }
    }
    if (start === -1) {
      const forward = findNextQuoteRange(quote);
      if (!forward) return false;
      setCharSelectionRange(forward.start, forward.end, { anchor: forward.start });
      return true;
    }

    let end = -1;
    for (let i = start + 1; i < line.length; i++) {
      if (line[i] === quote) {
        end = i;
        break;
      }
    }
    if (end === -1 || end <= start + 1) {
      const forward = findNextQuoteRange(quote);
      if (!forward) return false;
      setCharSelectionRange(forward.start, forward.end, { anchor: forward.start });
      return true;
    }

    const startPos = { row, col: start + 1 };
    const endPos = { row, col: end };
    setCharSelectionRange(startPos, endPos, { anchor: startPos });
    return true;
  }

  function findNextQuoteRange(quote: '"' | '\'' | '`') {
    const pivot = pivotPosition();
    for (let r = pivot.row; r < lines.length; r++) {
      const text = lines[r] ?? '';
      let startIndex = r === pivot.row ? text.indexOf(quote, pivot.col) : text.indexOf(quote);
      while (startIndex !== -1) {
        const endIndex = text.indexOf(quote, startIndex + 1);
        if (endIndex !== -1 && endIndex > startIndex + 1) {
          return {
            start: { row: r, col: startIndex + 1 },
            end: { row: r, col: endIndex }
          };
        }
        if (endIndex === -1) {
          for (let rr = r + 1; rr < lines.length; rr++) {
            const nextText = lines[rr] ?? '';
            const nextIndex = nextText.indexOf(quote);
            if (nextIndex !== -1) {
              return {
                start: { row: r, col: startIndex + 1 },
                end: { row: rr, col: nextIndex }
              };
            }
          }
        }
        startIndex = text.indexOf(quote, startIndex + 1);
      }
    }
    return null;
  }

  function selectInsideBrackets(openChar: string, closeChar: string) {
    const pivot = pivotPosition();
    const row = pivot.row;
    const line = lineText(row);
    if (line.length === 0) return false;

    let depth = 0;
    let start = -1;
    for (let i = pivot.col; i >= 0; i--) {
      const ch = line[i];
      if (ch === closeChar) depth++;
      else if (ch === openChar) {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    if (start === -1) {
      const forward = findNextBracketRange(openChar, closeChar);
      if (!forward) return false;
      setCharSelectionRange(forward.start, forward.end, { anchor: forward.start });
      return true;
    }

    depth = 0;
    let end = -1;
    for (let i = start + 1; i < line.length; i++) {
      const ch = line[i];
      if (ch === openChar) depth++;
      else if (ch === closeChar) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }

    if (end === -1 || end <= start + 1) {
      const forward = findNextBracketRange(openChar, closeChar);
      if (!forward) return false;
      setCharSelectionRange(forward.start, forward.end, { anchor: forward.start });
      return true;
    }

    const startPos = { row, col: start + 1 };
    const endPos = { row, col: end };
    setCharSelectionRange(startPos, endPos, { anchor: startPos });
    return true;
  }

  function findNextBracketRange(openChar: string, closeChar: string) {
    let depth = 0;
    let startPos: Position | null = null;
    for (let r = pivotPosition().row; r < lines.length; r++) {
      const text = lines[r] ?? '';
      let c = r === pivotPosition().row ? Math.max(pivotPosition().col, 0) : 0;
      for (; c < text.length; c++) {
        const ch = text[c];
        if (ch === openChar) {
          if (!startPos) {
            startPos = { row: r, col: c };
            depth = 1;
          } else {
            depth += 1;
          }
        } else if (ch === closeChar && startPos) {
          depth -= 1;
          if (depth === 0) {
            if (r === startPos.row && c <= startPos.col + 1) {
              startPos = null;
              continue;
            }
            return {
              start: { row: startPos.row, col: startPos.col + 1 },
              end: { row: r, col: c }
            };
          }
        }
      }
    }
    return null;
  }

  function to(char: string, reverse: boolean) {
    let currRow = cursor.row;
    let currCol = cursor.col;
    let newRow = cursor.row;
    let newCol = currCol;
    const line = lines[currRow] ?? '';

    if (!reverse && currCol < line.length - 1 && line[currCol + 1] === char) {
      currCol++;
    }
    if (reverse && currCol > 0 && line[currCol - 1] === char) {
      currCol--;
    }

    if (!reverse && currCol < line.length - 1) {
      newCol = currCol + 1;
    } else if (reverse && currCol > 0) {
      newCol = currCol - 1;
    }

    while ((lines[newRow] ?? '')[newCol] !== char) {
      if (newCol === (lines[currRow]?.length ?? 1) - 1 || newCol === 0) {
        newCol = currCol;
        break;
      }
      newCol += reverse ? -1 : 1;
    }

    cursor.col = newCol + (reverse ? 1 : -1);
    cursor.goalCol = cursor.col;
    cursor.row = newRow;
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function find(char: string, reverse: boolean) {
    let currRow = cursor.row;
    let currCol = cursor.col;
    let newRow = cursor.row;
    let newCol = currCol;

    if (!reverse && currCol < (lines[currRow]?.length ?? 1) - 1) {
      newCol = currCol + 1;
    } else if (reverse && currCol > 0) {
      newCol = currCol - 1;
    }

    while ((lines[newRow] ?? '')[newCol] !== char) {
      if (newCol === (lines[currRow]?.length ?? 1) - 1 || newCol === 0) {
        newCol = currCol;
        break;
      }
      newCol += reverse ? -1 : 1;
    }

    cursor.col = newCol;
    cursor.goalCol = cursor.col;
    cursor.row = newRow;
    if (currentMode === 'visual') updateVisualCharSelection();
  }

  function newLine(mode: 'insert' | 'below' | 'above' | 'normal' = 'insert') {
    const row = cursor.row;
    const col = cursor.col;
    const line = lines[row] ?? '';

    if (mode === 'insert') {
      const head = line.slice(0, col);
      const tail = line.slice(col);
      lines[row] = head;
      lines.splice(row + 1, 0, tail);
      cursor.row = row + 1;
      cursor.col = 0;
    } else if (mode === 'above') {
      lines.splice(row, 0, '');
      cursor.col = 0;
    } else {
      lines.splice(row + 1, 0, '');
      cursor.row = row + 1;
      cursor.col = 0;
    }
    cursor.goalCol = cursor.col;
  }

  function deleteRow() {
    if (visualLineStart == null) return;
    const a = Math.min(visualLineStart, cursor.row);
    const b = Math.max(visualLineStart, cursor.row);
    const count = b - a + 1;
    lines.splice(a, count);

    if (lines.length === 0) {
      lines.push('');
    }

    cursor.row = Math.min(a, lines.length - 1);
    cursor.col = 0;
    cursor.goalCol = 0;

    normalMode();
    visualLineStart = null;
  }

  function resetDocument(text: string, position?: Position | null) {
    const normalized = normalizeText(text);
    const nextLines = normalized.length ? normalized.split('\n') : [''];
    lines.length = 0;
    for (const line of nextLines) lines.push(line);

    clearSelection();
    if (position) {
      const resolved = normalizePosition(position);
      const lineTextValue = lineText(resolved.row);
      cursor.row = resolved.row;
      cursor.col = Math.min(resolved.col, Math.max(0, lineTextValue.length ? lineTextValue.length - 1 : 0));
    } else {
      cursor.row = 0;
      cursor.col = 0;
    }
    cursor.goalCol = cursor.col;
    setPendingCombo('');
    setPendingCount(null);
    pendingOperatorCount = null;
    normalMode();
    emitUiState();
  }

  function clearPending() {
    setPendingCombo('');
    setPendingCount(null);
    pendingOperatorCount = null;
  }

  function handleNormalMode(event: KeyboardEvent) {
    const key = event.key;

    if (pendingCombo === 'di') {
      event.preventDefault();
      if (key === 'Escape') {
        clearPending();
        return true;
      }
      if (key === 'Shift') return true;
      const range = rangeForInnerTextObject(key);
      if (range) deleteRange(range.start, range.end);
      clearPending();
      return true;
    }

    if (pendingCombo === 'df' || pendingCombo === 'dF' || pendingCombo === 'dt' || pendingCombo === 'dT') {
      if (key === 'Escape') {
        event.preventDefault();
        clearPending();
        return true;
      }
      if (isPrintable(event) && key.length === 1) {
        event.preventDefault();
        const combo = pendingCombo;
        let success = false;
        if (combo === 'df') success = deleteToCharForward(key, true);
        else if (combo === 'dt') success = deleteToCharForward(key, false);
        else if (combo === 'dF') success = deleteToCharBackward(key, true);
        else if (combo === 'dT') success = deleteToCharBackward(key, false);
        if (success) {
          clearPending();
        } else {
          clearPending();
        }
        return true;
      }
      return true;
    }

    if (pendingCombo === 'd') {
      event.preventDefault();
      if (key === 'Escape') {
        clearPending();
        return true;
      }
      if (key === 'i') {
        setPendingCombo('di');
        return true;
      }
      if (key === 'f' || key === 'F' || key === 't' || key === 'T') {
        setPendingCombo(`d${key}`);
        return true;
      }
      if (key === '0') {
        deleteToLineStart();
        clearPending();
        return true;
      }
      if (key === '$') {
        deleteToLineEnd();
        clearPending();
        return true;
      }
      if (key === 'd') {
        deleteCurrentLines(Math.max(1, pendingOperatorCount ?? 1));
        clearPending();
        return true;
      }
      clearPending();
      return true;
    }

    if (pendingCombo === 'T') {
      if (key === 'Escape') {
        event.preventDefault();
        clearPending();
        return true;
      }
      if (isPrintable(event) && key.length === 1) {
        event.preventDefault();
        lastSearch = key;
        lastSearchDirection = true;
        lastSearchType = 'to';
        setPendingCount(null);
        to(key, true);
        setPendingCombo('');
        return true;
      }
      return true;
    }

    if (pendingCombo === 't') {
      if (key === 'Escape') {
        event.preventDefault();
        clearPending();
        return true;
      }
      if (isPrintable(event) && key.length === 1) {
        event.preventDefault();
        lastSearch = key;
        lastSearchType = 'to';
        lastSearchDirection = false;
        setPendingCount(null);
        to(key, false);
        setPendingCombo('');
        return true;
      }
      return true;
    }

    if (pendingCombo === 'F') {
      if (key === 'Escape') {
        event.preventDefault();
        clearPending();
        return true;
      }
      if (isPrintable(event) && key.length === 1) {
        event.preventDefault();
        lastSearch = key;
        lastSearchDirection = true;
        lastSearchType = 'find';
        find(key, true);
        clearPending();
        return true;
      }
      return true;
    }

    if (pendingCombo === 'f') {
      if (key === 'Escape') {
        event.preventDefault();
        clearPending();
        return true;
      }
      if (isPrintable(event) && key.length === 1) {
        event.preventDefault();
        lastSearch = key;
        lastSearchDirection = false;
        lastSearchType = 'find';
        find(key, false);
        clearPending();
        return true;
      }
      return true;
    }

    if (key === ';') {
      if (lastSearch) {
        if (lastSearchType === 'find') find(lastSearch, lastSearchDirection);
        else to(lastSearch, lastSearchDirection);
      }
      return true;
    }

    if (key === ',') {
      if (lastSearch) {
        if (lastSearchType === 'find') find(lastSearch, !lastSearchDirection);
        else to(lastSearch, !lastSearchDirection);
      }
      return true;
    }

    if (key >= '1' && key <= '9') {
      event.preventDefault();
      const digit = key.charCodeAt(0) - 48;
      const nextCount = pendingCount == null ? digit : (pendingCount ?? 0) * 10 + digit;
      setPendingCount(nextCount);
      return true;
    }

    switch (key) {
      case 'h':
        moveLeft(pendingCount);
        return true;
      case 'l':
        moveRight(pendingCount);
        return true;
      case 'k':
        moveUp(pendingCount);
        return true;
      case 'j':
        moveDown(pendingCount);
        return true;
      case '^':
        moveFirstChar();
        return true;
      case '0':
        if (pendingCount != null) {
          const next = (pendingCount ?? 0) * 10;
          setPendingCount(next);
        } else {
          moveFirstCol();
        }
        return true;
      case '$':
        moveLastCol();
        return true;
      case 'G':
        moveLastRow();
        return true;
      case 'W':
        moveNextWord(pendingCount, true, false);
        return true;
      case 'w':
        moveNextWord(pendingCount, false, false);
        return true;
      case 'E':
        moveEndWord(pendingCount, true, false);
        return true;
      case 'e':
        moveEndWord(pendingCount, false, false);
        return true;
      case 'B':
        moveBackWord(pendingCount, true, false);
        return true;
      case 'b':
        moveBackWord(pendingCount, false, false);
        return true;
      case 'T':
      case 't':
      case 'F':
      case 'f':
        setPendingCombo(key);
        return true;
      case 'd':
        event.preventDefault();
        pendingOperatorCount = pendingCount ?? 1;
        setPendingCount(null);
        setPendingCombo('d');
        return true;
      case 'g':
        if (pendingCombo === 'g') {
          moveFirstRow();
          setPendingCombo('');
        } else {
          setPendingCombo(pendingCombo + 'g');
        }
        return true;
      case 'v': {
        event.preventDefault();
        setPendingCount(null);
        setPendingCombo('v');
        const row = cursor.row;
        const col = cursor.col;
        setCharSelectionRange(
          { row, col },
          { row, col: col + 1 },
          { preserveCursor: true, anchor: { row, col } }
        );
        cursor.goalCol = cursor.col;
        return true;
      }
      case 'V':
        visualLineMode();
        return true;
      case 'i':
        if (!insertModeEnabled) return true;
        insertMode();
        return true;
      case ':':
        enterCommand();
        return true;
      case 'O':
        if (!insertModeEnabled) return true;
        newLine('above');
        insertMode();
        return true;
      case 'o':
        if (!insertModeEnabled) return true;
        newLine('normal');
        insertMode();
        return true;
      case 'a':
        if (!insertModeEnabled) return true;
        if (lines[cursor.row] !== '') cursor.col++;
        insertMode();
        return true;
      case 'I':
        if (!insertModeEnabled) return true;
        cursor.col = 0;
        insertMode();
        return true;
      case 'A':
        if (!insertModeEnabled) return true;
        moveLastCol();
        if (lines[cursor.row] !== '') cursor.col++;
        insertMode();
        return true;
      case 'Escape':
        clearPending();
        normalMode();
        return true;
      default:
        return false;
    }
  }

  function handleVisualMode(event: KeyboardEvent) {
    const key = event.key;

    if (key === 'Escape') {
      event.preventDefault();
      clearPending();
      normalMode();
      return true;
    }

    if (key === 'v') {
      event.preventDefault();
      clearPending();
      normalMode();
      return true;
    }

    if (pendingCombo === 'vi') {
      if (key === 'Shift') return true;

      event.preventDefault();
      let applied = false;
      if (key === 'w') {
        applied = selectInnerWord(false);
      } else if (key === 'W') {
        applied = selectInnerWord(true);
      } else {
        const quote = QUOTE_KEYS[key];
        if (quote) {
          applied = selectInsideQuotes(quote);
        } else if (key in BRACKET_PAIRS) {
          const [openChar, closeChar] = BRACKET_PAIRS[key];
          applied = selectInsideBrackets(openChar, closeChar);
        }
      }
      clearPending();
      return true;
    }

    if (pendingCombo === 'v') {
      if (key === 'i') {
        event.preventDefault();
        setPendingCombo('vi');
        return true;
      }
      if (key !== 'Shift') {
        clearPending();
      }
    }

    return handleNormalMode(event);
  }

  function handleLineMode(event: KeyboardEvent) {
    const key = event.key;
    switch (key) {
      case 'Escape':
        event.preventDefault();
        normalMode();
        return true;
      case 'k':
        moveUp(pendingCount);
        return true;
      case 'j':
        moveDown(pendingCount);
        return true;
      case 'd':
        deleteRow();
        return true;
      case 'g':
        if (pendingCombo === 'g') {
          moveFirstRow();
          setPendingCombo('');
        } else {
          setPendingCombo(pendingCombo + 'g');
        }
        return true;
      default:
        return false;
    }
  }

  function handleInsertMode(event: KeyboardEvent) {
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      normalMode();
      return true;
    }
    if (key === 'Enter') {
      event.preventDefault();
      newLine();
      return true;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      backspace();
      return true;
    }
    if (isPrintable(event)) {
      event.preventDefault();
      insertChar(event.key);
      return true;
    }
    return false;
  }

  function handleCommandMode(event: KeyboardEvent) {
    const key = event.key;
    if (key === 'Escape') {
      event.preventDefault();
      normalMode();
      return true;
    }
    if (key === 'Enter') {
      event.preventDefault();
      exitCommand();
      return true;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      setCommandBuffer(commandBuffer.slice(0, -1));
      return true;
    }
    if (isPrintable(event)) {
      event.preventDefault();
      setCommandBuffer(commandBuffer + event.key);
      return true;
    }
    return false;
  }

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key;

    if ('hjkl'.includes(key)) {
      event.preventDefault();
    }

    let handled = false;
    switch (currentMode) {
      case 'normal':
        handled = handleNormalMode(event);
        break;
      case 'line':
        handled = handleLineMode(event);
        break;
      case 'visual':
        handled = handleVisualMode(event);
        break;
      case 'insert':
        handled = handleInsertMode(event);
        break;
      case 'command':
        handled = handleCommandMode(event);
        break;
      default:
        handled = false;
        break;
    }

    if (currentMode !== 'command') {
      emitUiState();
    }

    return handled;
  }

  emitMode();
  emitUiState();

  return {
    lines,
    cursor,
    viewBase,
    getVisualLineStart: () => visualLineStart,
    getSelection: () => selection,
    getMode: () => currentMode,
    getUiState: () => ({ pendingCombo, pendingCount, commandBuffer }),
    handleKeyDown,
    resetDocument
  };
}

export const vimUtils = {
  isPrintable
};
