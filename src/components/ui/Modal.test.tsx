import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Modal } from './Modal';

/**
 * The bug this pins: a dialog taller than the window used to grow unbounded, and
 * `items-center` overflowed it in BOTH directions — the half above the scroll
 * origin was simply unreachable, so a long form pushed its own title off the top
 * of the screen and no amount of scrolling brought it back. Zooming the browser
 * out was the only way to read it.
 */
describe('Modal', () => {
  function renderTall() {
    return render(
      <Modal open onClose={vi.fn()} title="Add service" footer={<button type="button">Save</button>}>
        <p>Body</p>
      </Modal>,
    );
  }

  it('caps its height at the viewport instead of growing past it', () => {
    renderTall();
    const panel = screen.getByRole('heading', { name: 'Add service' }).closest('div')!.parentElement!;
    expect(panel.className).toContain('max-h-[calc(100vh-2rem)]');
  });

  it('centres a short dialog with auto margins rather than items-center', () => {
    // Auto margins take the free space when there is any and yield when there is
    // none — the behaviour items-center only appears to have.
    renderTall();
    const panel = screen.getByRole('heading', { name: 'Add service' }).closest('div')!.parentElement!;
    expect(panel.className).toContain('my-auto');
    expect(panel.parentElement!.className).not.toContain('items-center');
  });

  it('scrolls the body only, so the title and buttons stay put', () => {
    renderTall();
    const body = screen.getByText('Body').parentElement!;
    expect(body.className).toContain('overflow-y-auto');
    // min-h-0 is what actually lets a flex child shrink enough to scroll.
    expect(body.className).toContain('min-h-0');

    const footer = screen.getByRole('button', { name: 'Save' }).parentElement!;
    expect(footer.className).toContain('shrink-0');
  });

  it('still renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Add service">
        <p>Body</p>
      </Modal>,
    );
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });
});
