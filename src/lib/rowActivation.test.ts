import { describe, expect, it, vi } from 'vitest';
import type { MouseEvent } from 'react';
import { activateRow } from './rowActivation';

/**
 * The whole value of this helper is what it refuses to do. Making a row clickable is one line; not
 * hijacking the delete button inside it, and not navigating away the moment someone finishes
 * selecting a SKU to copy, is the part worth pinning.
 */
describe('activateRow', () => {
  function clickOn(html: string, selector: string): MouseEvent<HTMLElement> {
    document.body.innerHTML = html;
    const target = document.querySelector(selector)!;
    return { target } as unknown as MouseEvent<HTMLElement>;
  }

  it('activates when the click lands on inert parts of the row', () => {
    const handler = vi.fn();
    activateRow(handler)(clickOn('<tr><td><img id="thumb" /></td></tr>', '#thumb'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('leaves a control inside the row to answer its own click', () => {
    const handler = vi.fn();
    activateRow(handler)(clickOn('<tr><td><button id="del">Delete</button></td></tr>', '#del'));
    expect(handler).not.toHaveBeenCalled();
  });

  /** A click that lands on an icon inside a button is still a click on the button. */
  it('looks past the element actually hit to the control containing it', () => {
    const handler = vi.fn();
    activateRow(handler)(clickOn('<tr><td><button><svg id="icon"></svg></button></td></tr>', '#icon'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when the click ends a text selection', () => {
    const handler = vi.fn();
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'AMN-SHIRT',
    } as unknown as Selection);

    activateRow(handler)(clickOn('<tr><td id="sku">AMN-SHIRT</td></tr>', '#sku'));

    expect(handler).not.toHaveBeenCalled();
    selection.mockRestore();
  });
});
