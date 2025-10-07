import { describe, expect, it } from 'vitest';
import { createVimController } from './vim';

function makeKeyEvent(key: string): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    getModifierState: () => false,
    preventDefault: () => {
      /* noop */
    }
  } as unknown as KeyboardEvent;
}

describe('vim controller command mode navigation', () => {
  it('jumps to the requested line while respecting the goal column', () => {
    const vim = createVimController({ initialText: 'short\n\nverylongline\nmid', maxRows: 10 });
    const { cursor } = vim;

    cursor.row = 2;
    cursor.col = 7;
    cursor.goalCol = 7;

    vim.handleKeyDown(makeKeyEvent(':'));
    vim.handleKeyDown(makeKeyEvent('1'));
    vim.handleKeyDown(makeKeyEvent('Enter'));

    expect(cursor.row).toBe(0);
    expect(cursor.col).toBe(4);
    expect(cursor.goalCol).toBe(7);

    vim.handleKeyDown(makeKeyEvent(':'));
    vim.handleKeyDown(makeKeyEvent('3'));
    vim.handleKeyDown(makeKeyEvent('Enter'));

    expect(cursor.row).toBe(2);
    expect(cursor.col).toBe(7);
  });
});
