import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductForm from './ProductForm';
import { adminCategories, adminProducts, adminProductVariants } from '@/api/admin';
import { listBrands } from '@/api/catalog';
import type { ProductResponse, ProductVariantResponse } from '@/lib/types';

vi.mock('@/api/admin', () => ({
  adminProducts: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    addImages: vi.fn(),
    deleteImage: vi.fn(),
    setPrimaryImage: vi.fn(),
  },
  adminCategories: { list: vi.fn() },
  adminProductVariants: { list: vi.fn(), create: vi.fn(), update: vi.fn(), setStock: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/api/catalog', () => ({ listBrands: vi.fn() }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getMock = vi.mocked(adminProducts.get);
const categoriesMock = vi.mocked(adminCategories.list);
const brandsMock = vi.mocked(listBrands);
const variantsListMock = vi.mocked(adminProductVariants.list);
const variantCreateMock = vi.mocked(adminProductVariants.create);
const setPrimaryImageMock = vi.mocked(adminProducts.setPrimaryImage);

const IMAGES: ProductResponse['images'] = [
  { id: 'img-1', url: 'https://cdn.example.com/a.jpg', altText: 'Front', sortOrder: 0, isPrimary: true },
  { id: 'img-2', url: 'https://cdn.example.com/b.jpg', altText: 'Side', sortOrder: 1, isPrimary: false },
];

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'p1',
    name: 'Signet Ring',
    slug: 'signet-ring',
    description: null,
    shortDescription: null,
    sku: 'RING-1',
    price: 120,
    compareAtPrice: null,
    currency: 'USD',
    status: 'ACTIVE',
    categoryId: null,
    categoryName: null,
    categorySlug: null,
    brandId: null,
    brandName: null,
    weight: null,
    sellingUnit: null,
    stockQuantity: 10,
    tags: [],
    images: [],
    variants: [],
    ratingAvg: null,
    ratingCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function variant(overrides: Partial<ProductVariantResponse> = {}): ProductVariantResponse {
  return {
    id: 'var-1',
    sku: 'RING-1-M',
    barcode: null,
    options: { Size: 'M' },
    optionsLabel: 'Size: M',
    priceOverride: null,
    effectivePrice: 120,
    stockQuantity: 5,
    imageId: null,
    active: true,
    ...overrides,
  };
}

function renderEditForm() {
  function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/inventory/p1']}>
          <Routes>
            <Route path="/admin/inventory/:id" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<ProductForm />, { wrapper: Wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(product());
  categoriesMock.mockResolvedValue([]);
  brandsMock.mockResolvedValue([]);
  variantsListMock.mockResolvedValue([]);
  variantCreateMock.mockResolvedValue(variant());
});

describe('Admin ProductForm — variants (WP-3.5)', () => {
  it('adds a variant with its SKU and options via the variant editor', async () => {
    const user = userEvent.setup();
    renderEditForm();

    // The variant editor (edit mode only) surfaces an "Add variant" trigger.
    const trigger = await screen.findByRole('button', { name: /add variant/i });
    await user.click(trigger);

    // Scope to the modal card so we don't collide with the main product form fields.
    const dialog = screen.getByRole('heading', { name: 'Add variant' }).closest('div.relative') as HTMLElement;
    const skuInput = within(dialog).getAllByRole('textbox')[0]; // first textbox = SKU
    await user.type(skuInput, 'RING-1-M');
    await user.type(within(dialog).getByLabelText('Option 1 name'), 'Size');
    await user.type(within(dialog).getByLabelText('Option 1 value'), 'M');

    await user.click(within(dialog).getByRole('button', { name: /add variant/i }));

    await waitFor(() =>
      expect(variantCreateMock).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ sku: 'RING-1-M', options: { Size: 'M' }, active: true }),
      ),
    );
  });

  it('lists existing variants with their options label and SKU', async () => {
    variantsListMock.mockResolvedValue([variant()]);
    renderEditForm();

    expect(await screen.findByText('Size: M')).toBeInTheDocument();
    expect(screen.getByText('RING-1-M')).toBeInTheDocument();
  });
});

describe('Admin ProductForm — the primary image', () => {
  /**
   * Which image is primary decides the listing thumbnail and what the product page opens
   * on. It could only be chosen while adding an image, so correcting it meant deleting the
   * photo and uploading it again.
   */
  it('promotes any image to primary', async () => {
    getMock.mockResolvedValue(product({ images: IMAGES }));
    setPrimaryImageMock.mockResolvedValue(product({ images: IMAGES }));
    const user = userEvent.setup();
    renderEditForm();

    await user.click(await screen.findByRole('button', { name: /make Side the primary image/i }));

    await waitFor(() => expect(setPrimaryImageMock).toHaveBeenCalledWith('p1', 'img-2'));
  });

  /** The one that already holds it is labelled, not offered — promoting it does nothing. */
  it('offers promotion only on the images that are not already primary', async () => {
    getMock.mockResolvedValue(product({ images: IMAGES }));
    renderEditForm();

    expect(await screen.findByText('Primary')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /the primary image/i })).toHaveLength(1);
  });
});
