import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Boxes, Pencil, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { adminCategories, adminProducts, adminProductVariants } from '@/api/admin';
import { listBrands } from '@/api/catalog';
import { ApiError } from '@/lib/http';
import { AiImageStudio, useAiQuota } from '@/components/admin/AiImageStudio';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { money } from '@/lib/format';
import type {
  CreateProductRequest,
  CreateVariantRequest,
  GeneratePromptsRequest,
  ProductImageRequest,
  ProductVariantResponse,
  UpdateProductRequest,
  UpdateVariantRequest,
} from '@/lib/types';
import { useStore } from '@/context/StoreContext';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, Field, Input, Modal, PageHeader, Select, Textarea } from '@/components/ui';
import { FormSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Currencies offered on the product form.
 *
 * A free-text box accepted "inr ", "Rs" and typos that only surfaced as a 400 on save, and a
 * product whose currency does not match the store's cannot be added to a cart at all — the cart
 * refuses to mix them. The store's own currency is preselected and listed first, so the ordinary
 * case is one the merchant never has to think about.
 */
const CURRENCIES: { code: string; label: string }[] = [
  { code: 'INR', label: 'Indian rupee' },
  { code: 'USD', label: 'US dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'Pound sterling' },
  { code: 'AED', label: 'UAE dirham' },
  { code: 'AUD', label: 'Australian dollar' },
  { code: 'CAD', label: 'Canadian dollar' },
  { code: 'SGD', label: 'Singapore dollar' },
  { code: 'JPY', label: 'Japanese yen' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface FormState {
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  price: string;
  compareAtPrice: string;
  currency: string;
  categoryId: string;
  brandId: string;
  shortDescription: string;
  description: string;
  weight: string;
  sellingUnit: string;
  tags: string;
  stockQuantity: string;
}

const EMPTY: FormState = {
  name: '',
  slug: '',
  sku: '',
  barcode: '',
  price: '',
  compareAtPrice: '',
  currency: 'USD',
  categoryId: '',
  brandId: '',
  shortDescription: '',
  description: '',
  weight: '',
  sellingUnit: '',
  tags: '',
  stockQuantity: '0',
};

interface DraftImage {
  url: string;
  altText: string;
  sortOrder: string;
  isPrimary: boolean;
}

function toTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const { store } = useStore();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);
  const [studioOpen, setStudioOpen] = useState(false);
  // Asked for up front so the button is hidden rather than offered and refused.
  const aiQuota = useAiQuota();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const categoriesQ = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminCategories.list(),
  });

  const brandsQ = useQuery({ queryKey: ['brands'], queryFn: () => listBrands() });

  const productQ = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => adminProducts.get(id as string),
    enabled: isEdit,
  });

  /**
   * Warns when a product of this name already exists — the one duplicate the API cannot catch.
   *
   * SKU, slug and barcode are unique per store and rejected outright with a 409, so the only way to
   * create the same product twice is to give it a fresh SKU and not notice. Whether that is a
   * mistake is not something the server can decide: two products may legitimately share a name. So
   * this warns and lets the merchant carry on, rather than blocking a create that may be correct.
   *
   * Create only — on an edit the product's own name matches itself.
   */
  const nameToCheck = form.name.trim();
  const duplicatesQ = useQuery({
    queryKey: ['admin', 'product-name-check', nameToCheck],
    queryFn: () => adminProducts.list({ search: nameToCheck, size: 5 }),
    enabled: !isEdit && nameToCheck.length >= 3,
    staleTime: 30_000,
  });
  // The search matches names AND SKUs by substring, so it is narrowed to an exact name match here.
  const sameName = (duplicatesQ.data?.content ?? []).filter(
    (p) => p.name.trim().toLowerCase() === nameToCheck.toLowerCase(),
  );

  // Populate the form once the product loads (edit mode).
  useEffect(() => {
    const p = productQ.data;
    if (!p) return;
    setForm({
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      barcode: p.barcode ?? '',
      price: String(p.price),
      compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
      currency: p.currency,
      categoryId: p.categoryId ?? '',
      brandId: p.brandId ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      weight: p.weight != null ? String(p.weight) : '',
      sellingUnit: p.sellingUnit ?? '',
      tags: p.tags.join(', '),
      stockQuantity: String(p.stockQuantity),
    });
  }, [productQ.data]);

  useDocumentTitle(isEdit ? productQ.data?.name ?? 'Edit product' : 'New product');

  // A new product is priced in the store's own currency unless told otherwise. The cart refuses to
  // mix currencies, so anything else is unsellable alongside the rest of the catalogue.
  useEffect(() => {
    if (!isEdit && store?.currency) set('currency', store.currency);
  }, [isEdit, store?.currency]);

  // Auto-suggest slug from name until the user edits it (create mode only).
  const suggestedSlug = useMemo(() => slugify(form.name), [form.name]);
  useEffect(() => {
    if (!isEdit && !slugTouched) set('slug', suggestedSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedSlug, slugTouched, isEdit]);

  const createMutation = useMutation({
    mutationFn: (body: CreateProductRequest) => adminProducts.create(body),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      toast.success('Product created', created.name);
      navigate(`/admin/inventory/${created.id}`);
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: (body: UpdateProductRequest) => adminProducts.update(id as string, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['admin', 'product', id] });
      toast.success('Product saved');
    },
    onError: handleError,
  });

  function handleError(e: unknown) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      toast.error('Could not save', e.message);
    } else {
      toast.error('Could not save', 'An unexpected error occurred.');
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const price = Number(form.price);
    const compareAt = form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null;
    const weight = form.weight.trim() ? Number(form.weight) : null;
    const sellingUnit = form.sellingUnit.trim() || null;
    const stock = form.stockQuantity.trim() ? Number(form.stockQuantity) : 0;

    if (isEdit) {
      const body: UpdateProductRequest = {
        name: form.name.trim(),
        // Blank means keep: the API does not clear or regenerate a barcode on edit.
        barcode: form.barcode.trim() || undefined,
        description: form.description.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        price,
        compareAtPrice: compareAt,
        currency: form.currency.trim().toUpperCase(),
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        weight,
        sellingUnit,
        tags: toTags(form.tags),
        stockQuantity: stock,
      };
      updateMutation.mutate(body);
    } else {
      const body: CreateProductRequest = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        sku: form.sku.trim().toUpperCase(),
        barcode: form.barcode.trim() || undefined,
        price,
        compareAtPrice: compareAt,
        currency: form.currency.trim().toUpperCase(),
        categoryId: form.categoryId || null,
        brandId: form.brandId || null,
        description: form.description.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        weight,
        sellingUnit,
        tags: toTags(form.tags),
        stockQuantity: stock,
        images: draftImages
          .filter((im) => im.url.trim())
          .map<ProductImageRequest>((im) => ({
            url: im.url.trim(),
            altText: im.altText.trim() || null,
            sortOrder: Number(im.sortOrder) || 0,
            isPrimary: im.isPrimary,
          })),
      };
      createMutation.mutate(body);
    }
  }

  // In edit mode the studio drafts prompts from the SAVED product. Here there is no
  // saved product to read, so what the merchant has typed so far is passed through
  // instead — and withheld entirely until they have named the thing, because a prompt
  // drafted from an empty form describes nothing.
  //
  // Declared above the loading return: it is a hook, and a hook that runs only on
  // some renders is a crash, not a subtlety.
  const draftAiContext = useMemo<GeneratePromptsRequest | undefined>(() => {
    const productName = form.name.trim();
    if (!productName) return undefined;
    return {
      productName,
      categoryName: categoriesQ.data?.find((c) => c.id === form.categoryId)?.name ?? null,
      brandName: brandsQ.data?.find((b) => b.id === form.brandId)?.name ?? null,
    };
  }, [form.name, form.categoryId, form.brandId, categoriesQ.data, brandsQ.data]);

  if (isEdit && productQ.isLoading) return <FormSkeleton />;

  const categories = categoriesQ.data ?? [];
  const brands = brandsQ.data ?? [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="max-w-4xl">
      <Link to="/admin/inventory" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to inventory
      </Link>
      <PageHeader title={isEdit ? 'Edit product' : 'New product'} />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Basics</h2>
          <Field label="Name" required error={errors.name}>
            <Input
              aria-label="Product name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              invalid={!!errors.name}
            />
          </Field>

          {sameName.length > 0 ? (
            <div className="-mt-2 rounded-lg border border-warning-700/40 bg-warning-900/15 p-3">
              <p className="text-body-sm text-warning-200">
                {sameName.length === 1 ? 'A product' : `${sameName.length} products`} called &ldquo;{form.name.trim()}
                &rdquo; already {sameName.length === 1 ? 'exists' : 'exist'} in this store.
              </p>
              <ul className="mt-2 space-y-1">
                {sameName.map((p) => (
                  <li key={p.id} className="text-caption text-slate-300">
                    <Link to={`/admin/inventory/${p.id}`} className="underline hover:text-slate-100">
                      {p.sku}
                    </Link>{' '}
                    · {money(p.price, p.currency)} · {p.status.toLowerCase()}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-slate-400">
                Edit that one instead if this is the same product. Carry on if it is genuinely different — names do not
                have to be unique, only SKUs do.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Slug"
              required
              error={errors.slug}
              hint={isEdit ? 'Read-only — cannot be changed after creation.' : 'lowercase-with-hyphens'}
            >
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set('slug', e.target.value);
                }}
                invalid={!!errors.slug || (!isEdit && !!form.slug && !SLUG_RE.test(form.slug))}
                readOnly={isEdit}
                disabled={isEdit}
              />
            </Field>
            <Field
              label="SKU"
              required
              error={errors.sku}
              hint={isEdit ? 'Read-only — cannot be changed after creation.' : 'UPPERCASE / digits / hyphen'}
            >
              <Input
                value={form.sku}
                onChange={(e) => set('sku', e.target.value.toUpperCase())}
                invalid={!!errors.sku}
                readOnly={isEdit}
                disabled={isEdit}
              />
            </Field>
          </div>

          {/* The product's own barcode. Only meaningful while it has no variants:
              once it does, each variant scans separately and carries its own. */}
          <Field
            label="Barcode"
            error={errors.barcode}
            hint={
              isEdit
                ? 'EAN-13. Leave blank to keep the current one — it is printed on shelf labels, so an edit here does not regenerate it.'
                : 'EAN-13. Leave blank and one is generated. Must be free across every product and variant in this store.'
            }
          >
            <Input
              aria-label="Barcode"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
              invalid={!!errors.barcode}
              placeholder="8901234567890"
              inputMode="numeric"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" error={errors.categoryId}>
              <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">— No category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'— '.repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Brand" error={errors.brandId}>
              <Select value={form.brandId} onChange={(e) => set('brandId', e.target.value)}>
                <option value="">— No brand —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                {/* The assigned brand may be inactive (absent from the active list) — keep it selectable. */}
                {form.brandId && !brands.some((b) => b.id === form.brandId) && (
                  <option value={form.brandId}>{productQ.data?.brandName ?? 'Current brand'}</option>
                )}
              </Select>
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Pricing & stock</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Price" required error={errors.price}>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                invalid={!!errors.price}
              />
            </Field>
            <Field label="Compare-at price" error={errors.compareAtPrice}>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.compareAtPrice}
                onChange={(e) => set('compareAtPrice', e.target.value)}
              />
            </Field>
            <Field
              label="Currency"
              required
              error={errors.currency}
              hint={store?.currency ? `This store trades in ${store.currency}.` : undefined}
            >
              <Select
                aria-label="Currency"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              >
                {/* A product already priced in something not listed keeps its own code rather than
                    being silently re-priced by the select falling back to its first option. */}
                {!CURRENCIES.some((c) => c.code === form.currency) && form.currency ? (
                  <option value={form.currency}>{form.currency}</option>
                ) : null}
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Stock quantity" error={errors.stockQuantity}>
              <Input
                type="number"
                min={0}
                value={form.stockQuantity}
                onChange={(e) => set('stockQuantity', e.target.value)}
              />
            </Field>
            <Field label="Weight" error={errors.weight} hint="Optional, in your unit of choice">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
              />
            </Field>
            <Field label="Selling unit" error={errors.sellingUnit} hint="Optional, e.g. per piece, per kg, 500g">
              <Input
                value={form.sellingUnit}
                onChange={(e) => set('sellingUnit', e.target.value)}
                placeholder="per piece"
                maxLength={50}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-200">Details</h2>
          <Field label="Short description" error={errors.shortDescription}>
            <Input value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />
          </Field>
          <Field label="Description" error={errors.description}>
            <Textarea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Tags" error={errors.tags} hint="Comma-separated">
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="new, featured, sale" />
          </Field>
        </Card>

        {/* Images repeater — CREATE mode only */}
        {!isEdit && (
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">Images</h2>
              <div className="flex flex-wrap gap-2">
                {/* Generation was previously reachable only after saving, via the edit screen's
                    image manager — so the one moment a merchant has no photographs was the one
                    moment they could not generate any. */}
                {aiQuota.data?.allowed && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setStudioOpen(true)}>
                    <Sparkles className="h-4 w-4" /> Generate with AI
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraftImages((prev) => [
                      ...prev,
                      { url: '', altText: '', sortOrder: String(prev.length), isPrimary: prev.length === 0 },
                    ])
                  }
                >
                  <Plus className="h-4 w-4" /> Add image
                </Button>
              </div>
            </div>
            {draftImages.length === 0 ? (
              <p className="text-sm text-slate-500">No images yet. You can also add them after creating the product.</p>
            ) : (
              <div className="space-y-3">
                {draftImages.map((im, idx) => (
                  <div key={idx} className="rounded-xl border border-ink-700 bg-ink-850 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <ImageUploadField
                        label="Image"
                        className="sm:col-span-2"
                        aspect="square"
                        value={im.url}
                        onChange={(url) =>
                          setDraftImages((prev) => prev.map((x, i) => (i === idx ? { ...x, url } : x)))
                        }
                        aiContext={draftAiContext}
                      />
                      <Field label="Alt text">
                        <Input
                          value={im.altText}
                          onChange={(e) =>
                            setDraftImages((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, altText: e.target.value } : x)),
                            )
                          }
                        />
                      </Field>
                      <Field label="Sort order">
                        <Input
                          type="number"
                          value={im.sortOrder}
                          onChange={(e) =>
                            setDraftImages((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, sortOrder: e.target.value } : x)),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="radio"
                          name="primaryImage"
                          checked={im.isPrimary}
                          onChange={() =>
                            setDraftImages((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === idx })))
                          }
                        />
                        Primary
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDraftImages((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4 text-rose-400" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* There is no saved product to read yet, so the prompts are drafted from what the
                merchant has typed so far — the name, and the category and brand they picked. */}
            <AiImageStudio
              open={studioOpen}
              onClose={() => setStudioOpen(false)}
              closeOnUse={false}
              context={{
                productName: form.name.trim() || null,
                categoryName: categories.find((c) => c.id === form.categoryId)?.name ?? null,
                brandName: brands.find((b) => b.id === form.brandId)?.name ?? null,
              }}
              onUse={(url, view) =>
                setDraftImages((prev) => [
                  ...prev,
                  {
                    url,
                    altText: view ? `${view.charAt(0)}${view.slice(1).toLowerCase()} view` : '',
                    sortOrder: String(prev.length),
                    // The first image becomes the thumbnail; later ones must not steal that role.
                    isPrimary: prev.length === 0,
                  },
                ])
              }
            />
          </Card>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
          <Link to="/admin/inventory" className="text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </Link>
        </div>
      </form>

      {/* Variants + images managers — EDIT mode only (both need a saved productId) */}
      {isEdit ? (
        <>
          <VariantsManager productId={id as string} />
          <ImagesManager productId={id as string} />
        </>
      ) : (
        <Card className="mt-6 space-y-2 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Boxes className="h-4 w-4 text-gold-400" /> Variants
          </h2>
          <p className="text-sm text-slate-500">
            Variants (e.g. size or colour) are managed after the product exists. Create this product first, then
            add its variants from the edit screen. Adding the first active variant makes the product variant-based —
            shoppers then pick an option before adding it to the cart.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── Variants manager (edit mode) ──────────────────────────────────────
interface OptionRow {
  key: string;
  value: string;
}

interface VariantFormState {
  sku: string;
  barcode: string;
  options: OptionRow[];
  price: string;
  stockQuantity: string;
  imageId: string;
  active: boolean;
}

const EMPTY_VARIANT: VariantFormState = {
  sku: '',
  barcode: '',
  options: [{ key: '', value: '' }],
  price: '',
  stockQuantity: '0',
  imageId: '',
  active: true,
};

const VARIANT_SKU_RE = /^[A-Z0-9-]{2,50}$/;

function rowsToOptions(rows: OptionRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = r.key.trim();
    const v = r.value.trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function optionsToRows(options: Record<string, string>): OptionRow[] {
  const rows = Object.entries(options).map(([key, value]) => ({ key, value }));
  return rows.length ? rows : [{ key: '', value: '' }];
}

function VariantsManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductVariantResponse | null>(null);
  const [form, setForm] = useState<VariantFormState>({ ...EMPTY_VARIANT });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stockTarget, setStockTarget] = useState<ProductVariantResponse | null>(null);
  const [stockValue, setStockValue] = useState('0');
  const [deleteTarget, setDeleteTarget] = useState<ProductVariantResponse | null>(null);
  // The "+" tile: adds a photo to the product's gallery and pins it to this
  // variant in one step, because the merchant is thinking about the variant in
  // front of them, not about the product's image list further down the page.
  const [addingImage, setAddingImage] = useState(false);

  const productQ = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminProducts.get(productId),
  });
  const variantsQ = useQuery({
    queryKey: ['admin', 'product-variants', productId],
    queryFn: () => adminProductVariants.list(productId),
  });

  const images = productQ.data?.images ?? [];
  const currency = productQ.data?.currency ?? 'USD';
  const variants = variantsQ.data ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['admin', 'product-variants', productId] });
    // The product's variant list / variant-based flag changed too.
    qc.invalidateQueries({ queryKey: ['admin', 'product', productId] });
    qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });
  }

  function onError(e: unknown, title: string) {
    if (e instanceof ApiError) {
      if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else if (e.code === 'VARIANT_SKU_EXISTS') setErrors({ sku: 'This SKU is already in use.' });
      else if (e.code === 'VARIANT_OPTIONS_EXISTS') setErrors({ options: 'A variant with these options already exists.' });
      // Carries the established axis names, which is the one thing the merchant needs to see.
      else if (e.code === 'VARIANT_OPTIONS_MISMATCH') setErrors({ options: e.message });
      else if (e.code === 'BARCODE_ALREADY_IN_USE' || e.code === 'INVALID_BARCODE')
        setErrors({ barcode: e.message });
      toast.error(title, e.message);
    } else {
      toast.error(title, 'An unexpected error occurred.');
    }
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateVariantRequest) => adminProductVariants.create(productId, body),
    onSuccess: () => {
      invalidate();
      toast.success('Variant added');
      closeForm();
    },
    onError: (e) => onError(e, 'Could not add variant'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ variantId, body }: { variantId: string; body: UpdateVariantRequest }) =>
      adminProductVariants.update(productId, variantId, body),
    onSuccess: () => {
      invalidate();
      toast.success('Variant updated');
      closeForm();
    },
    onError: (e) => onError(e, 'Could not update variant'),
  });
  const stockMutation = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      adminProductVariants.setStock(productId, variantId, quantity),
    onSuccess: () => {
      invalidate();
      toast.success('Stock updated');
      setStockTarget(null);
    },
    onError: (e) => onError(e, 'Could not update stock'),
  });
  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => adminProductVariants.remove(productId, variantId),
    onSuccess: () => {
      invalidate();
      toast.success('Variant deleted');
      setDeleteTarget(null);
    },
    onError: (e) => onError(e, 'Could not delete variant'),
  });

  /**
   * Every variant of a product must sit on the same option axes — one `Size` carrying S, M and L,
   * not an option per size. Get it wrong and the storefront derives one selector per axis name,
   * finds no variant that satisfies all of them at once, and the product silently becomes
   * unbuyable: the price stays a range and "Add to cart" never enables.
   *
   * So the axes are seeded from the variants that already exist and their names are then fixed;
   * after the first variant there is only a value left to type. The backend enforces the same rule,
   * but a form that cannot express the mistake beats an error explaining it.
   */
  const establishedAxes = Object.keys(variantsQ.data?.[0]?.options ?? {});

  const addImageMutation = useMutation({
    mutationFn: (url: string) =>
      adminProducts.addImages(productId, [
        { url, altText: null, sortOrder: images.length, isPrimary: images.length === 0 },
      ]),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: ['admin', 'product', productId] });
      // Pin the one that was just added. Matching on URL rather than assuming the
      // last element: the server owns ordering, and sortOrder is a request, not a
      // guarantee.
      const added = product.images.find((im) => !images.some((existing) => existing.id === im.id));
      if (added) setField('imageId', added.id);
      setAddingImage(false);
      toast.success('Image added');
    },
    onError: (e) => onError(e, 'Could not add the image'),
  });

  function openCreate() {
    setErrors({});
    setEditTarget(null);
    setForm({
      ...EMPTY_VARIANT,
      options: establishedAxes.length
        ? establishedAxes.map((key) => ({ key, value: '' }))
        : [{ key: '', value: '' }],
    });
    setFormOpen(true);
  }
  function openEdit(v: ProductVariantResponse) {
    setErrors({});
    setEditTarget(v);
    setForm({
      sku: v.sku,
      barcode: v.barcode ?? '',
      options: optionsToRows(v.options),
      price: v.priceOverride != null ? String(v.priceOverride) : '',
      stockQuantity: String(v.stockQuantity),
      imageId: v.imageId ?? '',
      active: v.active,
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
    setErrors({});
  }
  function openStock(v: ProductVariantResponse) {
    setStockTarget(v);
    setStockValue(String(v.stockQuantity));
  }

  function setField<K extends keyof VariantFormState>(key: K, value: VariantFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setOptionRow(idx: number, patch: Partial<OptionRow>) {
    setForm((f) => ({ ...f, options: f.options.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!editTarget) {
      if (!form.sku.trim()) next.sku = 'SKU is required';
      else if (!VARIANT_SKU_RE.test(form.sku.trim())) next.sku = 'Uppercase letters, digits and hyphens (2–50 chars)';
    }
    if (Object.keys(rowsToOptions(form.options)).length === 0) {
      next.options = 'Add at least one option (e.g. Size = M)';
    }
    if (form.price.trim() && Number(form.price) <= 0) next.price = 'Price must be greater than 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const options = rowsToOptions(form.options);
    const price = form.price.trim() ? Number(form.price) : null;
    const imageId = form.imageId || null;
    if (editTarget) {
      updateMutation.mutate({
        variantId: editTarget.id,
        // Blank is deliberately sent as undefined, not '': the API reads blank as
        // "keep the current barcode", and '' would be a value it must validate.
        body: { barcode: form.barcode.trim() || undefined, options, price, imageId, active: form.active },
      });
    } else {
      createMutation.mutate({
        sku: form.sku.trim().toUpperCase(),
        barcode: form.barcode.trim() || undefined,
        options,
        price,
        stockQuantity: Number(form.stockQuantity) || 0,
        imageId,
        active: form.active,
      });
    }
  }

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Boxes className="h-4 w-4 text-gold-400" /> Variants
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add variant
        </Button>
      </div>

      {variantsQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading variants…</p>
      ) : variants.length === 0 ? (
        <p className="text-sm text-slate-500">
          No variants. This product sells by its own price and stock. Add a variant to sell it by size, colour, etc. —
          the first active variant makes it variant-based.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-medium">Options</th>
                <th className="px-2 py-2 font-medium">SKU</th>
                <th className="px-2 py-2 font-medium">Barcode</th>
                <th className="px-2 py-2 font-medium text-right">Price</th>
                <th className="px-2 py-2 font-medium text-right">Stock</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {variants.map((v) => (
                <tr key={v.id}>
                  <td className="px-2 py-3 text-slate-200">{v.optionsLabel}</td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-500">{v.sku}</td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-500">{v.barcode ?? '—'}</td>
                  <td className="px-2 py-3 text-right text-slate-300">
                    {money(v.effectivePrice, currency)}
                    {v.priceOverride == null && <span className="ml-1 text-xs text-slate-600">(base)</span>}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <span className={v.stockQuantity <= 5 ? 'font-semibold text-rose-400' : 'text-slate-300'}>
                      {v.stockQuantity}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Badge tone={v.active ? 'green' : 'gray'}>{v.active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openStock(v)}>
                        Set stock
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)} aria-label={`Edit ${v.sku}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(v)} aria-label={`Delete ${v.sku}`}>
                        <Trash2 className="h-4 w-4 text-danger-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit variant form */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editTarget ? `Edit variant ${editTarget.sku}` : 'Add variant'}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button loading={createMutation.isPending || updateMutation.isPending} onClick={submit}>
              {editTarget ? 'Save' : 'Add variant'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="SKU"
            required
            error={errors.sku}
            hint={editTarget ? 'SKU is immutable — create a new variant to change it.' : 'UPPERCASE / digits / hyphen'}
          >
            <Input
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value.toUpperCase())}
              invalid={!!errors.sku}
              readOnly={!!editTarget}
              disabled={!!editTarget}
            />
          </Field>

          <Field
            label="Barcode"
            error={errors.barcode}
            hint={
              editTarget
                ? 'Leave blank to keep the current barcode. Printed labels stay valid.'
                : 'Leave blank and one is generated. Enter a real EAN-13 if the item already has one.'
            }
          >
            <Input
              value={form.barcode}
              placeholder="2001234567893"
              inputMode="numeric"
              onChange={(e) => setField('barcode', e.target.value)}
              invalid={!!errors.barcode}
            />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="rc-label">Options</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setForm((f) => ({ ...f, options: [...f.options, { key: '', value: '' }] }))}
              >
                <Plus className="h-3.5 w-3.5" /> Add option
              </Button>
            </div>
            <div className="space-y-2">
              {form.options.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    aria-label={`Option ${idx + 1} name`}
                    placeholder="Size"
                    value={row.key}
                    // Locked once the product's first variant has set the axes: renaming one here
                    // would split the storefront selector in two and make the product unbuyable.
                    readOnly={establishedAxes.length > 0}
                    title={establishedAxes.length > 0
                      ? 'Fixed by this product’s first variant — every variant shares the same options'
                      : undefined}
                    onChange={(e) => setOptionRow(idx, { key: e.target.value })}
                  />
                  <span className="text-slate-500">=</span>
                  <Input
                    aria-label={`Option ${idx + 1} value`}
                    placeholder="M"
                    value={row.value}
                    onChange={(e) => setOptionRow(idx, { value: e.target.value })}
                  />
                  {form.options.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove option ${idx + 1}`}
                      onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))}
                    >
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {errors.options && <p className="mt-1 text-xs text-danger-300">{errors.options}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Price override" error={errors.price} hint="Optional · blank inherits the product price">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                invalid={!!errors.price}
              />
            </Field>
            {!editTarget && (
              <Field label="Initial stock">
                <Input
                  type="number"
                  min={0}
                  value={form.stockQuantity}
                  onChange={(e) => setField('stockQuantity', e.target.value)}
                />
              </Field>
            )}
            <Field
              label="Image"
              hint={
                images.length
                  ? 'Optional · pick the photo that represents this variant'
                  : 'Add a photo to the product below, then pin one here'
              }
              className="sm:col-span-2"
            >
              {/* Thumbnails rather than a dropdown: picking an image by its alt text
                  means reading a label to guess at a picture, which is the one thing
                  a picture makes unnecessary. */}
              <div className="flex flex-wrap items-center gap-2">
                {images.map((im, i) => {
                  const selected = form.imageId === im.id;
                  return (
                    <button
                      key={im.id}
                      type="button"
                      onClick={() => setField('imageId', selected ? '' : im.id)}
                      aria-pressed={selected}
                      aria-label={im.altText || `Image ${i + 1}`}
                      title={im.altText || `Image ${i + 1}`}
                      className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition ${
                        selected
                          ? 'border-amber-400 ring-2 ring-amber-400/30'
                          : 'border-ink-700 hover:border-ink-500'
                      }`}
                    >
                      <img src={im.url} alt="" className="h-full w-full object-cover" />
                      {im.isPrimary && (
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] text-white">
                          Primary
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setAddingImage(true)}
                  aria-label="Add an image"
                  title="Add an image"
                  className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-ink-600 text-slate-500 transition hover:border-amber-400 hover:text-amber-400"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setField('active', e.target.checked)}
              className="h-4 w-4 accent-gold-400"
            />
            Active (purchasable)
          </label>
        </div>
      </Modal>

      {/* Set variant stock */}
      <Modal
        open={!!stockTarget}
        onClose={() => setStockTarget(null)}
        title="Set variant stock"
        footer={
          <>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={stockMutation.isPending}
              onClick={() =>
                stockTarget &&
                stockMutation.mutate({ variantId: stockTarget.id, quantity: Math.max(0, Number(stockValue) || 0) })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {stockTarget && (
          <Field label={`Stock for ${stockTarget.optionsLabel}`}>
            <Input
              type="number"
              min={0}
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
              autoFocus
            />
          </Field>
        )}
      </Modal>

      {/* The "+" tile. ImageUploadField already bundles upload, paste and AI
          generation, so the tile reuses it rather than growing a second, subtly
          different way to get a picture into the catalogue. */}
      <Modal
        open={addingImage}
        onClose={() => setAddingImage(false)}
        title="Add an image"
      >
        <ImageUploadField
          label="Product image"
          value=""
          hint="Uploaded here, it joins the product's gallery and is pinned to this variant."
          aspect="square"
          aiContext={
            productQ.data
              ? { productName: productQ.data.name, categoryName: productQ.data.categoryName ?? undefined }
              : undefined
          }
          onChange={(url) => {
            if (!url) return;
            addImageMutation.mutate(url);
          }}
        />
      </Modal>

      {/* Delete variant */}
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this variant?"
        description={
          deleteTarget
            ? `Permanently delete variant ${deleteTarget.sku} (${deleteTarget.optionsLabel}). Deleting the last variant returns the product to selling by its own price and stock. Placed order lines keep their variant snapshot.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </Card>
  );
}

// ── Images manager (edit mode) ────────────────────────────────────────
function ImagesManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ url: '', altText: '', sortOrder: '0', isPrimary: false });
  const [studioOpen, setStudioOpen] = useState(false);
  // Asked for up front so the button is hidden rather than offered and refused.
  const aiQuota = useAiQuota();

  const productQ = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: () => adminProducts.get(productId),
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['admin', 'product', productId] });

  const addMutation = useMutation({
    mutationFn: (image: ProductImageRequest) => adminProducts.addImages(productId, [image]),
    onSuccess: () => {
      refetch();
      toast.success('Image added');
      setForm({ url: '', altText: '', sortOrder: '0', isPrimary: false });
    },
    onError: (e) => toast.error('Could not add image', e instanceof ApiError ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => adminProducts.deleteImage(productId, imageId),
    onSuccess: () => {
      refetch();
      toast.success('Image removed');
    },
    onError: (e) => toast.error('Could not remove image', e instanceof ApiError ? e.message : undefined),
  });

  // Which image is primary decides the listing thumbnail and what the product page
  // opens on. It could previously only be chosen at the moment of adding, so getting
  // it wrong meant deleting the image and adding it again.
  const primaryMutation = useMutation({
    mutationFn: (imageId: string) => adminProducts.setPrimaryImage(productId, imageId),
    onSuccess: () => {
      refetch();
      toast.success('Primary image updated');
    },
    onError: (e) =>
      toast.error('Could not change the primary image', e instanceof ApiError ? e.message : undefined),
  });

  const images = productQ.data?.images ?? [];

  return (
    <Card className="mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">Images</h2>
        {aiQuota.data?.allowed && (
          <Button type="button" size="sm" variant="outline" onClick={() => setStudioOpen(true)}>
            <Sparkles className="h-4 w-4" /> Generate with AI
          </Button>
        )}
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-slate-500">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((im) => (
            <div key={im.id} className="group relative overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
              <img src={im.url} alt={im.altText ?? ''} className="aspect-square w-full object-cover" />
              {im.isPrimary ? (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-gold-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                  <Star className="h-2.5 w-2.5" /> Primary
                </span>
              ) : (
                /* Shown outright rather than on hover: promoting an image is the ordinary
                   way to work here, it is not destructive, and a hover-only control is
                   invisible on a touchscreen and undiscoverable everywhere else. */
                <button
                  type="button"
                  onClick={() => primaryMutation.mutate(im.id)}
                  disabled={primaryMutation.isPending}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-ink-950/75 py-1.5 text-[11px] font-medium text-slate-300 transition hover:bg-ink-950/90 hover:text-gold-300 disabled:opacity-60"
                  aria-label={`Make ${im.altText || 'this image'} the primary image`}
                >
                  <Star className="h-3 w-3" /> Make primary
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteMutation.mutate(im.id)}
                disabled={deleteMutation.isPending}
                className="absolute right-1.5 top-1.5 rounded-md bg-ink-950/80 p-1 text-rose-400 opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
                aria-label="Delete image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Prompts are drafted from the SAVED product, so the model is told the
          real category, brand and name rather than whatever is in the form. */}
      <AiImageStudio
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        context={{ productId }}
        closeOnUse={false}
        onUse={(url, view) =>
          addMutation.mutate({
            url,
            altText: view ? `${view.charAt(0)}${view.slice(1).toLowerCase()} view` : null,
            sortOrder: images.length,
            // The first image a product gets becomes its thumbnail; later ones must not
            // silently steal that role.
            isPrimary: images.length === 0,
          })
        }
      />

      <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Add image</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Upload, paste or generate — then "Add image" attaches it. AI lives on the
              header button rather than in here, because that one adds several views in a
              single pass and two Generate buttons doing different things would be a trap. */}
          <ImageUploadField
            label="Image"
            className="sm:col-span-2"
            aspect="square"
            hint="Upload a file or paste a URL, then add it to the product."
            value={form.url}
            onChange={(url) => setForm((f) => ({ ...f, url }))}
          />
          <Field label="Alt text">
            <Input value={form.altText} onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))} />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
            />
            Set as primary
          </label>
          <Button
            type="button"
            size="sm"
            loading={addMutation.isPending}
            disabled={!form.url.trim()}
            onClick={() =>
              addMutation.mutate({
                url: form.url.trim(),
                altText: form.altText.trim() || null,
                sortOrder: Number(form.sortOrder) || 0,
                isPrimary: form.isPrimary,
              })
            }
          >
            <Plus className="h-4 w-4" /> Add image
          </Button>
        </div>
      </div>
    </Card>
  );
}
