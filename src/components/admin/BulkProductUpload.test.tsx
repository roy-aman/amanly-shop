import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkProductUpload } from './BulkProductUpload';
import { productBulk } from '@/api/productBulk';
import { ApiError } from '@/lib/http';
import type { ProductImportJobResponse } from '@/lib/types';
import { renderWithProviders } from '@/test/utils';

vi.mock('@/api/productBulk', () => ({
  productBulk: { import: vi.fn(), status: vi.fn(), history: vi.fn(), exportCsv: vi.fn() },
}));

vi.mock('@/context/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuth: () => ({ isAdmin: true }),
}));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() };
vi.mock('@/context/ToastContext', () => ({ useToast: () => toast }));

const importMock = vi.mocked(productBulk.import);
const exportMock = vi.mocked(productBulk.exportCsv);

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

function csv(): File {
  return new File(['sku,name,price\nAMN-A,A,1.00\n'], 'products.csv', { type: 'text/csv' });
}

beforeEach(() => {
  vi.clearAllMocks();
  exportMock.mockResolvedValue(undefined);
});

describe('Bulk product upload', () => {
  /**
   * Checking first is the default because the alternative — a merchant's first
   * action being an irreversible write over their whole catalogue — is a bad way
   * to learn that a column was misnamed.
   */
  it('defaults to checking the file rather than applying it', async () => {
    importMock.mockResolvedValue(job({ dryRun: true, status: 'COMPLETED' }));
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /check file/i }));

    await waitFor(() => expect(importMock).toHaveBeenCalled());
    expect(importMock.mock.calls[0][1]).toBe(true);
  });

  it('applies the file once checking is turned off', async () => {
    importMock.mockResolvedValue(job());
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.click(screen.getByRole('checkbox', { name: /check the file first/i }));
    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => expect(importMock).toHaveBeenCalled());
    expect(importMock.mock.calls[0][1]).toBe(false);
  });

  it('reports what a check would have done without claiming anything changed', async () => {
    importMock.mockResolvedValue(job({ dryRun: true, createdCount: 2, updatedCount: 1 }));
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /check file/i }));

    expect(await screen.findByText(/2 would be added/i)).toBeInTheDocument();
    expect(screen.getByText(/1 would be updated/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing was changed/i)).toBeInTheDocument();
  });

  /**
   * A file whose every row was rejected still COMPLETED — it was read to the end.
   * Showing that as plain success is the one thing this report must not do.
   */
  it('does not present a file with rejected rows as a clean success', async () => {
    importMock.mockResolvedValue(
      job({
        createdCount: 1,
        updatedCount: 0,
        failedCount: 2,
        issues: [
          { line: 3, sku: 'AMN-B', severity: 'ERROR', code: 'INVALID_NUMBER', message: "'x' is not a number." },
          { line: 4, sku: 'AMN-C', severity: 'ERROR', code: 'CATEGORY_NOT_FOUND', message: 'No category called Hats.' },
        ],
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.click(screen.getByRole('checkbox', { name: /check the file first/i }));
    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /upload/i }));

    expect(await screen.findByText(/2 rejected/i)).toBeInTheDocument();
    expect(screen.getByText(/is not a number/i)).toBeInTheDocument();
    // The line number has to be the spreadsheet's, or the merchant looks at the wrong row.
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('separates a file that could not be used from rows that failed', async () => {
    importMock.mockResolvedValue(
      job({ status: 'FAILED', failureMessage: "The file needs a 'sku' column.", totalRows: 0 }),
    );
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /check file/i }));

    expect(await screen.findByText(/could not be used/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a 'sku' column/i)).toBeInTheDocument();
  });

  /** Only one import may run per store, so the refusal needs to read as a wait. */
  it('explains a clash with an import already running', async () => {
    importMock.mockRejectedValue(new ApiError(409, 'IMPORT_ALREADY_RUNNING', 'busy'));
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.upload(screen.getByLabelText('CSV file'), csv());
    await user.click(screen.getByRole('button', { name: /check file/i }));

    expect(await screen.findByText(/already running for this store/i)).toBeInTheDocument();
  });

  it('exports the catalogue on request', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload />);

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(exportMock).toHaveBeenCalled());
  });

  /** "Export what I am looking at" has to mean the filter actually on screen. */
  it('carries the status filter into the export', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulkProductUpload statusFilter="ACTIVE" />);

    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(exportMock).toHaveBeenCalledWith({ status: 'ACTIVE' }));
  });

  it('says out loud that a blank cell does not clear a field', () => {
    renderWithProviders(<BulkProductUpload />);

    expect(screen.getByText(/leaves that field unchanged/i)).toBeInTheDocument();
  });
});
