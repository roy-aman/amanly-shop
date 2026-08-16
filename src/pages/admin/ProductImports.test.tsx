import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductImports from './ProductImports';
import { productBulk } from '@/api/productBulk';
import type { Page, ProductImportJobResponse } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/productBulk', () => ({
  productBulk: { import: vi.fn(), status: vi.fn(), history: vi.fn(), exportCsv: vi.fn() },
}));

const historyMock = vi.mocked(productBulk.history);

function job(overrides: Partial<ProductImportJobResponse> = {}): ProductImportJobResponse {
  return {
    id: 'j1',
    status: 'COMPLETED',
    dryRun: false,
    originalFilename: 'products.csv',
    totalRows: 3,
    createdCount: 2,
    updatedCount: 1,
    failedCount: 0,
    issues: [],
    issuesTruncated: false,
    failureMessage: null,
    submittedAt: '2026-08-16T10:00:00Z',
    startedAt: '2026-08-16T10:00:01Z',
    finishedAt: '2026-08-16T10:00:05Z',
    ...overrides,
  };
}

function page(content: ProductImportJobResponse[], totalPages = 1): Page<ProductImportJobResponse> {
  return {
    content,
    totalElements: content.length,
    totalPages,
    size: 15,
    number: 0,
    first: true,
    last: totalPages <= 1,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Import history', () => {
  it('lists past uploads with what each one did', async () => {
    historyMock.mockResolvedValue(page([job({ createdCount: 2, updatedCount: 1 })]));
    renderWithProviders(<ProductImports />);

    expect(await screen.findByText('products.csv')).toBeInTheDocument();
    expect(screen.getByText(/2 added · 1 updated/)).toBeInTheDocument();
  });

  /**
   * A job outlives the page that started it, which is the whole reason this screen exists — the
   * report has to be findable after navigating away.
   */
  it('shows the report of a finished job on demand', async () => {
    historyMock.mockResolvedValue(
      page([
        job({
          failedCount: 1,
          issues: [
            { line: 4, sku: 'AMN-C', severity: 'ERROR', code: 'INVALID_NUMBER', message: "'x' is not a number." },
          ],
        }),
      ]),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProductImports />);

    await user.click(await screen.findByRole('button', { name: /show what happened to products.csv/i }));

    expect(await screen.findByText(/is not a number/i)).toBeInTheDocument();
    expect(screen.getByText(/header is row 1/i)).toBeInTheDocument();
  });

  it('announces a running import and keeps the list live', async () => {
    historyMock.mockResolvedValue(page([job({ status: 'RUNNING', finishedAt: null })]));
    renderWithProviders(<ProductImports />);

    expect(await screen.findByText(/an import is running/i)).toBeInTheDocument();
    expect(screen.getByText(/updating itself/i)).toBeInTheDocument();
  });

  /** Polling a page of finished jobs forever is a request every two seconds for nothing. */
  it('does not claim to be updating when nothing is running', async () => {
    historyMock.mockResolvedValue(page([job()]));
    renderWithProviders(<ProductImports />);

    await screen.findByText('products.csv');
    expect(screen.queryByText(/updating itself/i)).not.toBeInTheDocument();
  });

  /** A file that could not be used is a different event from rows that failed. */
  it('separates an unusable file from a file with bad rows', async () => {
    historyMock.mockResolvedValue(
      page([job({ status: 'FAILED', failureMessage: "The file needs a 'sku' column.", totalRows: 0 })]),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProductImports />);

    expect(await screen.findByText(/not applied/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show what happened to products.csv/i }));
    expect(await screen.findByText(/needs a 'sku' column/i)).toBeInTheDocument();
  });

  it('marks a check-only run so it is not mistaken for an applied one', async () => {
    historyMock.mockResolvedValue(page([job({ dryRun: true })]));
    renderWithProviders(<ProductImports />);

    expect(await screen.findByText(/check only/i)).toBeInTheDocument();
  });

  it('says so plainly when nothing has been uploaded yet', async () => {
    historyMock.mockResolvedValue(page([]));
    renderWithProviders(<ProductImports />);

    expect(await screen.findByText(/no imports yet/i)).toBeInTheDocument();
  });

});
