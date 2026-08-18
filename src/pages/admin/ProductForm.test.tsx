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
    list: vi.fn(),
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
vi.mock('@/context/StoreContext', () => ({ useStore: () => ({ store: { currency: 'INR' } }) }));
vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), push: vi.fn() }),
}));

const getMock = vi.mocked(adminProducts.get);
const listMock = vi.mocked(adminProducts.list);
const createMock = vi.mocked(adminProducts.create);
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

function emptyPage() {
  return pageOf([]);
}

/** Matches Spring's Page envelope; the extra flags are required by the shared type. */
function pageOf(content: never[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 5,
    number: 0,
    first: true,
    last: true,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(product());
  categoriesMock.mockResolvedValue([]);
  brandsMock.mockResolvedValue([]);
  variantsListMock.mockResolvedValue([]);
  variantCreateMock.mockResolvedValue(variant());
  listMock.mockResolvedValue(emptyPage());
});

/** Create mode: no :id in the route, so the form provisions a new product. */
function renderNewForm() {
  function Wrapper({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }));
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/admin/inventory/new']}>
          <Routes>
            <Route path="/admin/inventory/new" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(<ProductForm />, { wrapper: Wrapper });
}

describe('Admin ProductForm — barcode', () => {
  /**
   * products.barcode existed in the schema from V39 but no DTO carried it, so a variantless product
   * - the only kind that has one - could never be seen or set from here.
   */
  it('shows the product barcode when editing', async () => {
    getMock.mockResolvedValue(product({ barcode: '8901234567890' }));
    renderEditForm();

    await waitFor(() => expect(screen.getByLabelText("Barcode")).toHaveValue('8901234567890'));
  });

  it('says that leaving it blank keeps the existing code rather than minting a new one', async () => {
    getMock.mockResolvedValue(product({ barcode: '8901234567890' }));
    renderEditForm();

    expect(await screen.findByText(/leave blank to keep the current one/i)).toBeInTheDocument();
  });
});

describe('Admin ProductForm — duplicate products', () => {
  /**
   * SKU, slug and barcode are unique per store and rejected with a 409, so the only way to create
   * the same product twice is a fresh SKU and no one noticing. Two products may legitimately share
   * a name, so this warns rather than blocks.
   */
  it('warns when a product of the same name already exists', async () => {
    listMock.mockResolvedValue(pageOf([{ ...product(), id: 'p9', name: 'Signet Ring', sku: 'RING-9' } as never]));
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText("Product name"), 'Signet Ring');

    expect(await screen.findByText(/already exists in this store/i)).toBeInTheDocument();
    expect(screen.getByText(/names do not have to be unique/i)).toBeInTheDocument();
  });

  it('does not warn when the name is free', async () => {
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText("Product name"), 'Something Entirely New');

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.queryByText(/already exists in this store/i)).not.toBeInTheDocument();
  });

  /** A near-match is not a duplicate; the search matches substrings, so it is narrowed to exact. */
  it('ignores a product whose name merely contains what was typed', async () => {
    listMock.mockResolvedValue(pageOf([{ ...product(), id: 'p9', name: 'Signet Ring Deluxe', sku: 'RING-9' } as never]));
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText("Product name"), 'Signet Ring');

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.queryByText(/already exists in this store/i)).not.toBeInTheDocument();
  });
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

describe('Admin ProductForm — currency', () => {
  /**
   * A free-text box accepted "inr " and typos that only surfaced as a 400 on save, and a product
   * priced in something other than the store's currency cannot be added to a cart at all — the cart
   * refuses to mix them.
   */
  it('offers currencies as a list rather than free text', async () => {
    renderNewForm();

    const select = await screen.findByLabelText('Currency');
    expect(select.tagName).toBe('SELECT');
  });

  it('preselects the store currency on a new product', async () => {
    renderNewForm();

    await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue('INR'));
  });

  /** A product already priced in an unlisted currency must not be silently re-priced. */
  it('keeps a currency the list does not offer when editing', async () => {
    getMock.mockResolvedValue(product({ currency: 'CHF' }));
    renderEditForm();

    await waitFor(() => expect(screen.getByLabelText('Currency')).toHaveValue('CHF'));
  });
});

describe('Admin ProductForm — messy names', () => {
  /**
   * A non-breaking space survives trim(), and a doubled inner space is invisible on screen — so
   * both look identical to a person and different to ===. Without tidying, the duplicate warning
   * misses exactly the duplicate it exists to catch.
   */
  it('still spots the duplicate when the typed name has a doubled space', async () => {
    listMock.mockResolvedValue(
      pageOf([{ ...product(), id: 'p9', name: 'Signet Ring', sku: 'RING-9' } as never]),
    );
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText('Product name'), 'Signet  Ring');

    expect(await screen.findByText(/already exists in this store/i)).toBeInTheDocument();
  });

  it('still spots it when a non-breaking space came along with a paste', async () => {
    listMock.mockResolvedValue(
      pageOf([{ ...product(), id: 'p9', name: 'Signet Ring', sku: 'RING-9' } as never]),
    );
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText('Product name'), 'Signet Ring ');

    expect(await screen.findByText(/already exists in this store/i)).toBeInTheDocument();
  });

  /** What is compared has to be what is stored, or the warning and the row disagree. */
  it('sends the tidied name rather than what was typed', async () => {
    const user = userEvent.setup();
    renderNewForm();

    await user.type(screen.getByLabelText('Product name'), 'Signet  Ring');

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(listMock.mock.calls.some((c) => c[0]?.search === 'Signet Ring')).toBe(true);
  });
});
