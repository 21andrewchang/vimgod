export type Mode = 'normal' | 'insert' | 'visual' | 'command' | 'block' | 'line';

export type Cursor = {
  row: number;
  col: number;
  goalCol: number | null;
};

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
  getMode(): Mode;
  getUiState(): VimUiState;
  handleKeyDown(event: KeyboardEvent): boolean;
}

interface VimOptions {
  initialText: string;
  maxRows: number;
  onModeChange?: (mode: Mode) => void;
  onUiStateChange?: (state: VimUiState) => void;
  onCommand?: (command: string) => void;
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
  let visualLineStart: number | null = null;
  let pendingCount: number | null = null;
  let pendingCombo = '';
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

  function lineLen(row: number) {
    const line = lines[row] ?? '';
    return line.length === 0 ? 0 : line.length - 1;
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

  function normalMode() {
    setMode('normal');
    const line = lines[cursor.row] ?? '';
    if (!line) return;
    if (cursor.col > line.length - 1) {
      cursor.col = Math.max(0, line.length - 1);
    }
  }

  function visualLineMode() {
    if (currentMode !== 'line') {
      setMode('line');
      visualLineStart = cursor.row;
    }
  }

  function insertMode() {
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
  }

  function moveFirstChar() {
    const line = lines[cursor.row] ?? '';
    let idx = 0;
    for (idx = 0; idx < line.length; idx++) {
      if (line[idx] !== ' ') break;
    }
    cursor.col = idx;
    cursor.goalCol = cursor.col;
  }

  function moveLastCol() {
    cursor.col = lineLen(cursor.row);
    cursor.goalCol = cursor.col;
  }

  function moveLeft(count: number | null) {
    cursor.col = clamp(cursor.col - (count ?? 1), 0, lineLen(cursor.row));
    cursor.goalCol = cursor.col;
    setPendingCount(null);
  }

  function moveRight(count: number | null) {
    cursor.col = clamp(cursor.col + (count ?? 1), 0, lineLen(cursor.row));
    cursor.goalCol = cursor.col;
    setPendingCount(null);
  }

  function moveUp(count: number | null) {
    ensureGoal();
    const base = viewBase();
    cursor.row = clamp(cursor.row - (count ?? 1), base, lines.length - 1);
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    setPendingCount(null);
  }

  function moveDown(count: number | null) {
    ensureGoal();
    const base = viewBase();
    cursor.row = clamp(cursor.row + (count ?? 1), base, lines.length - 1);
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
    setPendingCount(null);
  }

  function moveFirstRow() {
    ensureGoal();
    cursor.row = 0;
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
  }

  function moveLastRow() {
    ensureGoal();
    cursor.row = lines.length - 1;
    cursor.col = clamp(cursor.goalCol!, 0, lineLen(cursor.row));
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
      return;
    }
    return [newRow, newCol + 1] as const;
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

  function clearPending() {
    setPendingCombo('');
    setPendingCount(null);
  }

  function handleNormalMode(event: KeyboardEvent) {
    const key = event.key;

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
      case 'b':
        moveBackWord(pendingCount, false, false);
        return true;
      case 'T':
      case 't':
      case 'F':
      case 'f':
        setPendingCombo(key);
        return true;
      case 'g':
        if (pendingCombo === 'g') {
          moveFirstRow();
          setPendingCombo('');
        } else {
          setPendingCombo(pendingCombo + 'g');
        }
        return true;
      case 'V':
        visualLineMode();
        return true;
      case 'i':
        insertMode();
        return true;
      case ':':
        enterCommand();
        return true;
      case 'O':
        newLine('above');
        insertMode();
        return true;
      case 'o':
        newLine('normal');
        insertMode();
        return true;
      case 'a':
        if (lines[cursor.row] !== '') cursor.col++;
        insertMode();
        return true;
      case 'I':
        cursor.col = 0;
        insertMode();
        return true;
      case 'A':
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
    getMode: () => currentMode,
    getUiState: () => ({ pendingCombo, pendingCount, commandBuffer }),
    handleKeyDown
  };
}

export const vimUtils = {
  isPrintable
};
