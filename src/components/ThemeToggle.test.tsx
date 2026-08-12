import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, THEME_STORAGE_KEY } from '@/context/ThemeContext';
import { ThemeSegmented, ThemeToggle } from './ThemeToggle';
import { useDarkTheme } from '@/lib/useDarkTheme';

function installMatchMedia(dark = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') && dark,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

const html = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  html().className = '';
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
  html().className = '';
});

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  it('names the current setting on the trigger, so the state is readable without opening it', () => {
    renderToggle();
    expect(screen.getByRole('button', { name: /appearance: system/i })).toBeInTheDocument();
  });

  it('offers all three settings, including the one that follows the OS', async () => {
    const u = userEvent.setup();
    renderToggle();
    await u.click(screen.getByRole('button', { name: /appearance/i }));

    // Radio, not checkbox: the three are mutually exclusive.
    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument();
  });

  it('applies and persists dark when chosen', async () => {
    const u = userEvent.setup();
    renderToggle();
    await u.click(screen.getByRole('button', { name: /appearance/i }));
    await u.click(await screen.findByRole('menuitemradio', { name: 'Dark' }));

    expect(html().classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('marks the active setting as checked', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const u = userEvent.setup();
    renderToggle();
    await u.click(screen.getByRole('button', { name: /appearance/i }));

    expect(await screen.findByRole('menuitemradio', { name: 'Light' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false');
  });

  /**
   * Console routes hold dark deliberately. A picker there would be a control
   * that visibly does nothing, which is worse than no control.
   */
  it('disappears on console routes, which hold dark on purpose', () => {
    function Console() {
      useDarkTheme();
      return null;
    }
    render(
      <ThemeProvider>
        <Console />
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('button', { name: /appearance/i })).not.toBeInTheDocument();
  });
});

describe('ThemeSegmented (mobile drawer)', () => {
  it('exposes the three settings as one radio group', () => {
    render(
      <ThemeProvider>
        <ThemeSegmented />
      </ThemeProvider>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Appearance' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('switches theme without a second layer to dismiss', async () => {
    const u = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeSegmented />
      </ThemeProvider>,
    );

    await u.click(screen.getByRole('radio', { name: /dark/i }));

    expect(html().classList.contains('dark')).toBe(true);
    expect(screen.getByRole('radio', { name: /dark/i })).toHaveAttribute('aria-checked', 'true');
  });

  it('is absent on console routes too', () => {
    function Console() {
      useDarkTheme();
      return null;
    }
    render(
      <ThemeProvider>
        <Console />
        <ThemeSegmented />
      </ThemeProvider>,
    );
    expect(screen.queryByRole('radiogroup', { name: 'Appearance' })).not.toBeInTheDocument();
  });
});
