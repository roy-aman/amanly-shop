import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageX, Share2 } from 'lucide-react';
import { getProduct, listProducts } from '@/api/catalog';
import { addToCart } from '@/api/cart';
import { ApiError } from '@/lib/http';
import { money, titleCase } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import type { ProductResponse, ProductSummaryResponse, ProductVariantResponse } from '@/lib/types';
import {
  Badge,
  Breadcrumbs,
  Button,
  Carousel,
  EmptyState,
  ImageWithFallback,
  LinkButton,
  PriceTag,
  QuantityStepper,
  RatingStars,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  type Crumb,
} from '@/components/ui';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import WishlistButton from '@/components/WishlistButton';
import { ProductDetailSkeleton } from '@/components/RouteSkeletons';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

const SIMILAR_LIMIT = 8;
const RECENTLY_VIEWED_KEY = 'rc-recently-viewed';
const RECENTLY_VIEWED_CAP = 12;

// ── Recently-viewed persistence (localStorage) ────────────────────────
// Stores lightweight product summaries so the rail can reuse `ProductCard`
// without re-fetching. Most-recent-first, de-duped by id, capped.
function readRecentlyViewed(): ProductSummaryResponse[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ProductSummaryResponse[]) : [];
  } catch {
    return [];
  }
}

function pushRecentlyViewed(summary: ProductSummaryResponse): void {
  const next = [summary, ...readRecentlyViewed().filter((p) => p.id !== summary.id)].slice(0, RECENTLY_VIEWED_CAP);
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // Storage full or unavailable (private mode) — the rail simply won't persist.
  }
}

/** Sort images so the primary comes first, then by explicit sortOrder. */
function sortImages(product: ProductResponse) {
  return [...product.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
}

/** Project the full product onto the summary shape `ProductCard`/the rail expect. */
function toSummary(product: ProductResponse): ProductSummaryResponse {
  const primary = sortImages(product)[0];
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    currency: product.currency,
    status: product.status,
    categoryName: product.categoryName,
    brandId: product.brandId ?? null,
    brandName: product.brandName ?? null,
    primaryImageUrl: primary?.url ?? null,
    stockQuantity: product.stockQuantity,
    ratingAvg: product.ratingAvg ?? null,
    ratingCount: product.ratingCount ?? 0,
  };
}

// ── Variant helpers (WP-3.5) ──────────────────────────────────────────
interface OptionAxis {
  name: string;
  values: string[];
}

/** Derive ordered option axes (e.g. Size, Color) and their distinct values from a
 *  set of variants. Backend serializes each variant's options with sorted keys, so
 *  axis order is stable; values keep first-seen order. */
function deriveOptions(variants: ProductVariantResponse[]): OptionAxis[] {
  const names: string[] = [];
  const valuesByName = new Map<string, string[]>();
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options)) {
      if (!valuesByName.has(name)) {
        names.push(name);
        valuesByName.set(name, []);
      }
      const vals = valuesByName.get(name)!;
      if (!vals.includes(value)) vals.push(value);
    }
  }
  return names.map((name) => ({ name, values: valuesByName.get(name)! }));
}

/** Resolve the single variant matching every selected axis; null until a full,
 *  existing combination is chosen. */
function resolveVariant(
  variants: ProductVariantResponse[],
  selected: Record<string, string>,
  axes: OptionAxis[],
): ProductVariantResponse | null {
  if (axes.some((a) => !selected[a.name])) return null;
  return variants.find((v) => axes.every((a) => v.options[a.name] === selected[a.name])) ?? null;
}

/** Status of an option value given the other axes already chosen:
 *  'incompatible' = no variant has it → disable; 'oos' = exists but all sold out;
 *  'ok' = at least one in-stock variant. */
function valueStatus(
  variants: ProductVariantResponse[],
  selected: Record<string, string>,
  name: string,
  value: string,
): 'ok' | 'oos' | 'incompatible' {
  const matches = variants.filter(
    (v) =>
      v.options[name] === value &&
      Object.keys(selected).every((k) => k === name || v.options[k] === selected[k]),
  );
  if (matches.length === 0) return 'incompatible';
  return matches.some((v) => v.stockQuantity > 0) ? 'ok' : 'oos';
}

// ── Desktop main image with cursor-follow hover zoom ──────────────────
function ZoomImage({ src, alt }: { src?: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  return (
    <div
      // Square-cornered and borderless, on the same pale tile as the cards: a
      // rounded, outlined frame around product photography reads app-like.
      className="relative aspect-[4/5] overflow-hidden bg-ink-850"
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin({
          x: ((e.clientX - r.left) / r.width) * 100,
          y: ((e.clientY - r.top) / r.height) * 100,
        });
      }}
    >
      <ImageWithFallback
        src={src}
        alt={alt}
        wrapperClassName="h-full w-full"
        className={cn('transition-transform duration-200 ease-out', zoom && 'cursor-zoom-in')}
        style={{ transform: zoom ? 'scale(2)' : 'scale(1)', transformOrigin: `${origin.x}% ${origin.y}%` }}
        data-testid="pdp-main-image"
      />
    </div>
  );
}

// ── Horizontal snap-scroll rail of product cards ──────────────────────
function ProductRail({ title, products }: { title: string; products: ProductSummaryResponse[] }) {
  if (products.length === 0) return null;
  return (
    <section>
      <h2 className="border-b border-ink-700 pb-5 font-display text-h2 text-slate-100">{title}</h2>
      <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:gap-6">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 snap-start sm:w-56">
            <ProductCard product={p} variant="grid" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { refresh } = useCart();
  const toast = useToast();

  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductSummaryResponse[]>([]);
  // Selected option axes for variant products (e.g. { size: 'M', color: 'Red' }).
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const product = productQuery.data;

  const images = useMemo(() => (product ? sortImages(product) : []), [product]);

  // ── Variant derivation (WP-3.5) ─────────────────────────────────────
  // Only ACTIVE variants are purchasable; a product with ≥1 active variant is
  // variant-based (requires a selection + variantId to add). A product with only
  // inactive variants (or none) behaves exactly like a variantless product.
  const activeVariants = useMemo(
    () => (product?.variants ?? []).filter((v) => v.active),
    [product],
  );
  const requiresVariant = activeVariants.length > 0;
  const optionAxes = useMemo(() => deriveOptions(activeVariants), [activeVariants]);
  const selectedVariant = useMemo(
    () => (requiresVariant ? resolveVariant(activeVariants, selectedOptions, optionAxes) : null),
    [requiresVariant, activeVariants, selectedOptions, optionAxes],
  );

  // Similar products: same category, self excluded. Only runs once we know the category.
  const similarQuery = useQuery({
    queryKey: ['similar', product?.categoryId, product?.id],
    queryFn: () => listProducts({ categoryId: product!.categoryId!, size: SIMILAR_LIMIT + 1 }),
    enabled: !!product?.categoryId,
  });
  const similar = useMemo(
    () => (similarQuery.data?.content ?? []).filter((p) => p.id !== product?.id).slice(0, SIMILAR_LIMIT),
    [similarQuery.data, product?.id],
  );

  useDocumentTitle(product?.name ?? 'Product');

  // On each product view: snapshot the prior list (minus self) for the rail, then
  // record this product for next time. Also reset the per-product UI selections.
  useEffect(() => {
    if (!product) return;
    setRecentlyViewed(readRecentlyViewed().filter((p) => p.id !== product.id));
    pushRecentlyViewed(toSummary(product));
    setActiveImage(0);
    setQty(1);
    setSelectedOptions({});
  }, [product]);

  // When a variant resolves, reset the quantity and swap to its pinned image (if any).
  useEffect(() => {
    if (!selectedVariant) return;
    setQty(1);
    if (selectedVariant.imageId) {
      const idx = images.findIndex((im) => im.id === selectedVariant.imageId);
      if (idx >= 0) setActiveImage(idx);
    }
  }, [selectedVariant, images]);

  if (productQuery.isLoading) return <ProductDetailSkeleton />;

  if (productQuery.isError) {
    const err = productQuery.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <EmptyState
        icon={<PackageX className="h-10 w-10" />}
        title={notFound ? 'Product not found' : 'Could not load product'}
        message={
          notFound
            ? 'This product may have been removed or is no longer available.'
            : err instanceof Error
              ? err.message
              : 'Please try again shortly.'
        }
        action={<LinkButton to="/products">Back to shop</LinkButton>}
      />
    );
  }

  if (!product) return null;

  // Availability/stock resolve to the selected variant for a variant product, else
  // to the product itself. `needsSelection` is true while a variant product has no
  // valid full combination chosen (also covers an unavailable combo).
  const fullySelected = !requiresVariant || optionAxes.every((a) => selectedOptions[a.name]);
  const needsSelection = requiresVariant && !selectedVariant;
  const activeStock = requiresVariant ? selectedVariant?.stockQuantity ?? 0 : product.stockQuantity;
  const outOfStock = !needsSelection && activeStock <= 0;
  const lowStock = !outOfStock && !needsSelection && activeStock <= 5;
  const maxQty = outOfStock || needsSelection ? 1 : activeStock;

  // Effective price: the resolved variant's price, else the product's; a variant
  // product with no selection shows the active-variant price range.
  const variantPrices = activeVariants.map((v) => v.effectivePrice);
  const minVariantPrice = variantPrices.length ? Math.min(...variantPrices) : product.price;
  const maxVariantPrice = variantPrices.length ? Math.max(...variantPrices) : product.price;

  const main = images[activeImage] ?? images[0];

  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }];
  if (product.categoryName) {
    crumbs.push({
      label: product.categoryName,
      to: product.categoryId ? `/products?categoryId=${product.categoryId}` : '/products',
    });
  }
  crumbs.push({ label: product.name });

  const specs = [
    { label: 'SKU', value: product.sku },
    product.categoryName ? { label: 'Category', value: product.categoryName } : null,
    product.sellingUnit ? { label: 'Sold by', value: product.sellingUnit } : null,
    product.weight != null ? { label: 'Weight', value: String(product.weight) } : null,
    product.tags.length > 0 ? { label: 'Tags', value: product.tags.join(', ') } : null,
  ].filter((r): r is { label: string; value: string } => r !== null);

  async function handleAdd() {
    if (!product) return;
    // Match the app-wide gated pattern (see components/guards.tsx / Login.tsx):
    // send unauthenticated users to /login with a `from` so they return here.
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname + location.search } });
      return;
    }
    // Variant products require a chosen variant (backend rejects add-without-variant
    // with 400 VARIANT_REQUIRED). The button is disabled until then, but guard anyway.
    if (requiresVariant && !selectedVariant) {
      toast.info('Choose your options', 'Please select an option before adding to cart.');
      return;
    }
    setAdding(true);
    try {
      await addToCart(product.id, qty, requiresVariant ? selectedVariant?.id : undefined);
      await refresh();
      const label = selectedVariant ? `${product.name} (${selectedVariant.optionsLabel})` : product.name;
      toast.success('Added to cart', `${qty} × ${label}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VARIANT_REQUIRED') {
        toast.error('Choose your options', 'Please select an option before adding to cart.');
      } else {
        toast.error('Could not add to cart', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleShare() {
    if (!product) return;
    const url = window.location.href;
    const shareData = { title: product.name, text: product.shortDescription ?? product.name, url };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', 'Product link copied to your clipboard.');
    } catch {
      toast.info('Share this product', url);
    }
  }

  return (
    <div className="space-y-20">
      <Breadcrumbs items={crumbs} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Gallery — hover-zoom on desktop, swipeable Carousel on mobile. */}
        <div>
          {/* Desktop */}
          <div className="hidden md:block" data-testid="pdp-gallery-desktop">
            <ZoomImage src={main?.url} alt={main?.altText ?? product.name} />
            {images.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === activeImage}
                    className={cn(
                      // Selection is a solid ink outline, not a gold one: it is a
                      // state, and gold does not survive on white.
                      'h-20 w-16 overflow-hidden bg-ink-850 outline-offset-2 transition',
                      i === activeImage ? 'outline outline-1 outline-slate-100' : 'opacity-70 hover:opacity-100',
                    )}
                  >
                    <ImageWithFallback src={img.url} alt="" wrapperClassName="h-full w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile */}
          <div className="md:hidden">
            {images.length > 0 ? (
              <Carousel
                ariaLabel={`${product.name} images`}
                showDots={images.length > 1}
                showArrows={images.length > 1}
              >
                {images.map((img) => (
                  <ImageWithFallback
                    key={img.id}
                    src={img.url}
                    alt={img.altText ?? product.name}
                    wrapperClassName="aspect-[4/5] w-full bg-ink-850"
                  />
                ))}
              </Carousel>
            ) : (
              <ImageWithFallback alt={product.name} wrapperClassName="aspect-[4/5] w-full bg-ink-850" />
            )}
          </div>
        </div>

        {/* Buy box — sticky on desktop so the price and CTA stay reachable while
            the gallery scrolls. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div>
            {product.categoryName && (
              <p className="text-overline uppercase text-slate-500">{product.categoryName}</p>
            )}
            {/* h1, not display: a product name is a label, not a brand statement,
                and display type wraps a long name into a wall. */}
            <h1 className="mt-3 font-display text-h1 text-slate-100">{product.name}</h1>
            {product.brandName && (
              <p className="mt-2 text-body-sm text-slate-400">
                {product.brandId ? (
                  <Link
                    to={`/products?brandId=${product.brandId}`}
                    className="rounded text-slate-300 underline decoration-ink-600 underline-offset-4 transition hover:text-slate-100 hover:decoration-slate-100"
                  >
                    {product.brandName}
                  </Link>
                ) : (
                  <span className="text-slate-300">{product.brandName}</span>
                )}
              </p>
            )}
            {product.ratingAvg != null && (product.ratingCount ?? 0) > 0 && (
              <div className="mt-3">
                <RatingStars value={product.ratingAvg} count={product.ratingCount} size="md" />
              </div>
            )}
          </div>

          <div className="mt-6">
            {needsSelection ? (
              minVariantPrice === maxVariantPrice ? (
                <PriceTag price={minVariantPrice} currency={product.currency} size="lg" />
              ) : (
                <span className="text-h2 font-semibold text-slate-100">
                  {money(minVariantPrice, product.currency)} – {money(maxVariantPrice, product.currency)}
                </span>
              )
            ) : (
              <PriceTag
                price={requiresVariant && selectedVariant ? selectedVariant.effectivePrice : product.price}
                compareAtPrice={product.compareAtPrice}
                currency={product.currency}
                size="lg"
              />
            )}

            {/* Availability reads as a line of text rather than a coloured pill.
                A green "In stock" badge on every product is noise; the states
                that matter (low, gone, unavailable) still carry their colour. */}
            <p
              className={cn(
                'mt-2 text-caption',
                needsSelection && fullySelected && 'text-danger-300',
                !needsSelection && outOfStock && 'text-danger-300',
                !needsSelection && lowStock && 'text-warning-300',
                !needsSelection && !outOfStock && !lowStock && 'text-slate-500',
                needsSelection && !fullySelected && 'text-slate-500',
              )}
            >
              {needsSelection
                ? fullySelected
                  ? 'This combination is unavailable'
                  : 'Select options to see availability'
                : outOfStock
                  ? 'Out of stock'
                  : lowStock
                    ? `Only ${activeStock} left`
                    : 'In stock'}
            </p>
          </div>

          {product.shortDescription && (
            <p className="mt-6 text-body text-slate-400">{product.shortDescription}</p>
          )}

          {/* Variant selector (WP-3.5) — one radiogroup per option axis. */}
          {requiresVariant && (
            <div className="mt-8 space-y-6" data-testid="pdp-variant-selector">
              {optionAxes.map((axis) => (
                <div key={axis.name}>
                  <p className="mb-3 text-overline uppercase text-slate-500">
                    {titleCase(axis.name)}
                    {selectedOptions[axis.name] && (
                      <span className="ml-2 normal-case tracking-normal text-slate-100">
                        {selectedOptions[axis.name]}
                      </span>
                    )}
                  </p>
                  <div role="radiogroup" aria-label={axis.name} className="flex flex-wrap gap-2">
                    {axis.values.map((value) => {
                      const status = valueStatus(activeVariants, selectedOptions, axis.name, value);
                      const isSelected = selectedOptions[axis.name] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          aria-label={`${axis.name}: ${value}${status === 'oos' ? ' (out of stock)' : ''}`}
                          disabled={status === 'incompatible'}
                          onClick={() => setSelectedOptions((prev) => ({ ...prev, [axis.name]: value }))}
                          className={cn(
                            'min-w-[3rem] border px-4 py-2.5 text-body-sm transition',
                            isSelected
                              ? 'border-primary bg-primary text-primary-fg'
                              : 'border-ink-600 text-slate-200 hover:border-slate-100',
                            status === 'incompatible' && 'cursor-not-allowed opacity-40',
                            status === 'oos' && !isSelected && 'text-slate-500 line-through',
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedVariant && <p className="text-caption text-slate-500">SKU: {selectedVariant.sku}</p>}
            </div>
          )}

          {/* Actions — the primary sits alone and full-width; quantity above it,
              secondary actions demoted to text so nothing competes with it. */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-overline uppercase text-slate-500">Qty</span>
              <QuantityStepper
                value={qty}
                onChange={setQty}
                min={1}
                max={maxQty}
                disabled={outOfStock || needsSelection}
              />
            </div>

            <Button
              onClick={handleAdd}
              loading={adding}
              disabled={outOfStock || needsSelection}
              size="xl"
              fullWidth
            >
              {needsSelection
                ? fullySelected
                  ? 'Unavailable'
                  : 'Select options'
                : outOfStock
                  ? 'Out of stock'
                  : 'Add to bag'}
            </Button>

            <div className="flex items-center gap-6 pt-1">
              <WishlistButton
                productId={product.id}
                productName={product.name}
                variant="inline"
                withLabel
                className="!h-auto !border-0 !bg-transparent !px-0 text-slate-400 hover:text-slate-100"
              />
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share this product"
                className="flex items-center gap-2 rounded text-body-sm text-slate-400 transition hover:text-slate-100"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </button>
            </div>
          </div>

          <dl className="mt-10 divide-y divide-ink-700 border-t border-ink-700">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-body-sm text-slate-500">SKU</dt>
              <dd className="text-body-sm text-slate-300">{product.sku}</dd>
            </div>
            {product.tags.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <dt className="text-body-sm text-slate-500">Tags</dt>
                <dd className="flex flex-wrap gap-2">
                  {product.tags.map((t) => (
                    <Badge key={t} tone="gray">
                      {t}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Tabbed detail */}
      <Tabs defaultValue="description">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="description">
          {product.description ? (
            <p className="max-w-2xl whitespace-pre-line text-body text-slate-400">{product.description}</p>
          ) : (
            <p className="text-body-sm text-slate-500">No description available for this product yet.</p>
          )}
        </TabsContent>

        <TabsContent value="specs">
          <dl className="max-w-xl divide-y divide-ink-700 border-y border-ink-700">
            {specs.map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-4 py-3.5">
                <dt className="text-body-sm text-slate-500">{row.label}</dt>
                <dd className="col-span-2 break-words text-body-sm text-slate-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>

        <TabsContent value="reviews">
          <ProductReviews productId={product.id} isAuthenticated={isAuthenticated} />
        </TabsContent>
      </Tabs>

      <ProductRail title="You may also like" products={similar} />
      <ProductRail title="Recently viewed" products={recentlyViewed} />
    </div>
  );
}
