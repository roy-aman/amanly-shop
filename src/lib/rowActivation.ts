import type { MouseEvent } from 'react';

/** Anything that already answers a click of its own. */
const INTERACTIVE = 'a, button, input, select, textarea, label, [role="button"], [role="checkbox"]';

/**
 * Lets a whole row or card open its primary thing, without stealing clicks from the controls in it.
 *
 * <p><b>Why.</b> A link on the name is the correct markup and the wrong target. People aim at the
 * thumbnail, the price, the empty space beside the title — the row looks like one object, so they
 * click the object — and when nothing happens they conclude the list is broken rather than that
 * they missed by forty pixels.
 *
 * <p><b>What this is not.</b> It is not the accessible affordance. Rows keep their real link or
 * button on the name: that is what a keyboard tabs to, what a screen reader announces, and what
 * gives the row its name in a rotor. This adds only the mouse convenience on top, which is why it
 * is a plain handler rather than {@code role="link"} on a {@code <tr>} — the latter would claim an
 * affordance the keyboard cannot reach.
 *
 * <p>Two things are deliberately let through: clicks that land on an inner control (it handles
 * itself), and clicks that end a text selection — dragging across a row to copy a SKU should not
 * navigate away the moment the mouse comes up.
 */
export function activateRow(handler: () => void) {
  return (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    handler();
  };
}
