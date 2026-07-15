import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageX, Share2, ShoppingCart } from 'lucide-react';
import { getProduct, listProducts } from '@/api/catalog';
import { addToCart } from '@/api/cart';
import { ApiError } from '@/lib/http';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import type { ProductResponse, ProductSummaryResponse } from '@/lib/types';
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
    primaryImageUrl: primary?.url ?? null,
    stockQuantity: product.stockQuantity,
    ratingAvg: product.ratingAvg ?? null,
    ratingCount: product.ratingCount ?? 0,
  };
}

// ── Desktop main image with cursor-follow hover zoom ──────────────────
function ZoomImage({ src, alt }: { src?: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  return (
    <div
      className="relative aspect-square overflow-hidden rounded-2xl border border-ink-800 bg-ink-850"
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
    <section className="space-y-4">
      <h2 className="text-h3 font-semibold text-slate-100">{title}</h2>
      <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 snap-start sm:w-52">
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

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const product = productQuery.data;

  const images = useMemo(() => (product ? sortImages(product) : []), [product]);

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
  }, [product]);

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

  const outOfStock = product.stockQuantity <= 0;
  const lowStock = !outOfStock && product.stockQuantity <= 5;
  const maxQty = outOfStock ? 1 : product.stockQuantity;

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
    setAdding(true);
    try {
      await addToCart(product.id, qty);
      await refresh();
      toast.success('Added to cart', `${qty} × ${product.name}`);
    } catch (e) {
      toast.error('Could not add to cart', e instanceof Error ? e.message : 'Please try again.');
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
    <div className="space-y-10">
      <Breadcrumbs items={crumbs} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery — hover-zoom on desktop, swipeable Carousel on mobile. */}
        <div>
          {/* Desktop */}
          <div className="hidden space-y-3 md:block" data-testid="pdp-gallery-desktop">
            <ZoomImage src={main?.url} alt={main?.altText ?? product.name} />
            {images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === activeImage}
                    className={cn(
                      'h-16 w-16 overflow-hidden rounded-lg border transition',
                      i === activeImage ? 'border-gold-400' : 'border-ink-700 hover:border-ink-500',
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
                    wrapperClassName="aspect-square w-full rounded-2xl border border-ink-800"
                  />
                ))}
              </Carousel>
            ) : (
              <ImageWithFallback
                alt={product.name}
                wrapperClassName="aspect-square w-full rounded-2xl border border-ink-800"
              />
            )}
          </div>
        </div>

        {/* Buy box */}
        <div className="space-y-5">
          <div>
            {product.categoryName && (
              <p className="text-overline uppercase text-slate-500">{product.categoryName}</p>
            )}
            <h1 className="mt-1 font-display text-h1 text-slate-50 md:text-display">{product.name}</h1>
            {product.ratingAvg != null && (product.ratingCount ?? 0) > 0 && (
              <div className="mt-2">
                <RatingStars value={product.ratingAvg} count={product.ratingCount} size="md" />
              </div>
            )}
            <p className="mt-2 text-caption text-slate-500">SKU: {product.sku}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PriceTag
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              currency={product.currency}
              size="lg"
            />
            {outOfStock ? (
              <Badge tone="red">Out of stock</Badge>
            ) : lowStock ? (
              <Badge tone="amber">Only {product.stockQuantity} left</Badge>
            ) : (
              <Badge tone="green">In stock</Badge>
            )}
          </div>

          {product.shortDescription && <p className="text-body-sm text-slate-300">{product.shortDescription}</p>}

          <div className="flex flex-wrap items-center gap-4">
            <QuantityStepper value={qty} onChange={setQty} min={1} max={maxQty} disabled={outOfStock} />
            <Button onClick={handleAdd} loading={adding} disabled={outOfStock} size="lg">
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? 'Out of stock' : 'Add to cart'}
            </Button>
            <Button variant="outline" size="lg" onClick={handleShare} aria-label="Share this product">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {product.tags.map((t) => (
                <Badge key={t} tone="gray">
                  {t}
                </Badge>
              ))}
            </div>
          )}
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
            <p className="max-w-3xl whitespace-pre-line text-body-sm text-slate-300">{product.description}</p>
          ) : (
            <p className="text-body-sm text-slate-500">No description available for this product yet.</p>
          )}
        </TabsContent>

        <TabsContent value="specs">
          <dl className="max-w-xl divide-y divide-ink-800 overflow-hidden rounded-2xl border border-ink-800">
            {specs.map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-4 px-4 py-3">
                <dt className="text-body-sm font-medium text-slate-400">{row.label}</dt>
                <dd className="col-span-2 break-words text-body-sm text-slate-200">{row.value}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>

        <TabsContent value="reviews">
          <ProductReviews productId={product.id} isAuthenticated={isAuthenticated} />
        </TabsContent>
      </Tabs>

      <ProductRail title="Similar products" products={similar} />
      <ProductRail title="Recently viewed" products={recentlyViewed} />
    </div>
  );
}
