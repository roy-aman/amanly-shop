import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Star, Trash2 } from 'lucide-react';
import { adminCategories, adminProducts } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type {
  CreateProductRequest,
  ProductImageRequest,
  UpdateProductRequest,
} from '@/lib/types';
import { useToast } from '@/context/ToastContext';
import { Button, Card, Field, Input, PageHeader, PageLoader, Select, Textarea } from '@/components/ui';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  price: string;
  compareAtPrice: string;
  currency: string;
  categoryId: string;
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
  price: '',
  compareAtPrice: '',
  currency: 'USD',
  categoryId: '',
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

  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftImages, setDraftImages] = useState<DraftImage[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const categoriesQ = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => adminCategories.list(),
  });

  const productQ = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: () => adminProducts.get(id as string),
    enabled: isEdit,
  });

  // Populate the form once the product loads (edit mode).
  useEffect(() => {
    const p = productQ.data;
    if (!p) return;
    setForm({
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: String(p.price),
      compareAtPrice: p.compareAtPrice != null ? String(p.compareAtPrice) : '',
      currency: p.currency,
      categoryId: p.categoryId ?? '',
      shortDescription: p.shortDescription ?? '',
      description: p.description ?? '',
      weight: p.weight != null ? String(p.weight) : '',
      sellingUnit: p.sellingUnit ?? '',
      tags: p.tags.join(', '),
      stockQuantity: String(p.stockQuantity),
    });
  }, [productQ.data]);

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
        description: form.description.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        price,
        compareAtPrice: compareAt,
        currency: form.currency.trim().toUpperCase(),
        categoryId: form.categoryId || null,
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
        price,
        compareAtPrice: compareAt,
        currency: form.currency.trim().toUpperCase(),
        categoryId: form.categoryId || null,
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

  if (isEdit && productQ.isLoading) return <PageLoader />;

  const categories = categoriesQ.data ?? [];
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
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} />
          </Field>

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
            <Field label="Currency" required error={errors.currency} hint="3-letter code">
              <Input
                value={form.currency}
                onChange={(e) => set('currency', e.target.value.toUpperCase())}
                maxLength={3}
                invalid={!!errors.currency}
              />
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Images</h2>
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
            {draftImages.length === 0 ? (
              <p className="text-sm text-slate-500">No images yet. You can also add them after creating the product.</p>
            ) : (
              <div className="space-y-3">
                {draftImages.map((im, idx) => (
                  <div key={idx} className="rounded-xl border border-ink-700 bg-ink-850 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Image URL" className="sm:col-span-2">
                        <Input
                          value={im.url}
                          onChange={(e) =>
                            setDraftImages((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)),
                            )
                          }
                        />
                      </Field>
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

      {/* Images manager — EDIT mode only */}
      {isEdit && <ImagesManager productId={id as string} />}
    </div>
  );
}

// ── Images manager (edit mode) ────────────────────────────────────────
function ImagesManager({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ url: '', altText: '', sortOrder: '0', isPrimary: false });

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

  const images = productQ.data?.images ?? [];

  return (
    <Card className="mt-6 space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-200">Images</h2>

      {images.length === 0 ? (
        <p className="text-sm text-slate-500">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((im) => (
            <div key={im.id} className="group relative overflow-hidden rounded-xl border border-ink-700 bg-ink-850">
              <img src={im.url} alt={im.altText ?? ''} className="aspect-square w-full object-cover" />
              {im.isPrimary && (
                <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-gold-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-ink-950">
                  <Star className="h-2.5 w-2.5" /> Primary
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteMutation.mutate(im.id)}
                disabled={deleteMutation.isPending}
                className="absolute right-1.5 top-1.5 rounded-md bg-ink-950/80 p-1 text-rose-400 opacity-0 transition group-hover:opacity-100"
                aria-label="Delete image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Add image</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Image URL" className="sm:col-span-2">
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
          </Field>
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
