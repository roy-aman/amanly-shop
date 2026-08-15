import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import StoreQrCode from './StoreQrCode';
import { mediaApi } from '@/api/media';
import { getPublicStore } from '@/api/store';
import type { QrCodeResponse } from '@/lib/types';

vi.mock('@/api/media', () => ({
  mediaApi: { qrCode: vi.fn(), uploadImages: vi.fn(), quota: vi.fn() },
}));
vi.mock('@/api/store', () => ({ getPublicStore: vi.fn() }));

const qrMock = vi.mocked(mediaApi.qrCode);
const storeMock = vi.mocked(getPublicStore);

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function poster(overrides: Partial<QrCodeResponse> = {}): QrCodeResponse {
  return {
    url: 'https://amanly.in',
    dataUri: PNG,
    sizePx: 512,
    widthPx: 512,
    heightPx: 638,
    format: 'PNG',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  qrMock.mockResolvedValue(poster());
  storeMock.mockResolvedValue({ slug: 'amanly', name: 'Amanly', currency: 'INR' } as never);
});

describe('Admin store QR code', () => {
  it('generates a poster for the shop home page without being told the address', async () => {
    renderWithProviders(<StoreQrCode />);

    await waitFor(() => expect(qrMock).toHaveBeenCalled());
    // `url` left undefined is what makes the server resolve the store's own
    // canonical address; sending a guessed one would defeat the point.
    expect(qrMock).toHaveBeenCalledWith(expect.objectContaining({ url: undefined, size: 512 }));

    const image = await screen.findByAltText(/qr code linking to https:\/\/amanly\.in/i);
    expect(image).toHaveAttribute('src', PNG);
  });

  it('offers the PNG as a download rather than a link the browser cannot authenticate', async () => {
    renderWithProviders(<StoreQrCode />);

    const link = await screen.findByRole('link', { name: /download png/i });
    expect(link).toHaveAttribute('href', PNG);
    expect(link).toHaveAttribute('download', 'amanly-qr-code.png');
  });

  it('reports the real image height, which is taller than the code when captioned', async () => {
    renderWithProviders(<StoreQrCode />);
    expect(await screen.findByText('512 × 638 px')).toBeInTheDocument();
  });

  /**
   * The distinction the API cares about: omitted means "use the default
   * caption", empty means "leave the line out". A blank input must not be sent
   * as empty or every untouched poster would lose its heading.
   */
  it('sends a blank caption field as absent, not as empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StoreQrCode />);
    await screen.findByAltText(/qr code/i);

    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(qrMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: undefined, subtitle: undefined }),
      ),
    );
  });

  it('turning the caption off asks for a bare code with empty strings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StoreQrCode />);
    await screen.findByAltText(/qr code/i);

    await user.click(screen.getByLabelText(/print a message above the code/i));
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(qrMock).toHaveBeenLastCalledWith(expect.objectContaining({ title: '', subtitle: '' })),
    );
  });

  it('sends a typed heading through', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StoreQrCode />);
    await screen.findByAltText(/qr code/i);

    await user.type(screen.getByPlaceholderText('Welcome to Amanly'), 'Our new shop');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(qrMock).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Our new shop' })),
    );
  });

  it('asks for a specific page when one is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StoreQrCode />);
    await screen.findByAltText(/qr code/i);

    await user.selectOptions(screen.getByLabelText(/where it goes/i), 'custom');
    await user.type(screen.getByPlaceholderText(/example\.com/i), 'https://amanly.in/products/kurta');
    await user.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(qrMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: 'https://amanly.in/products/kurta' }),
      ),
    );
  });
});
