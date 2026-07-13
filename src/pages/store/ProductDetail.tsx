import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ImageOff, Minus, Plus, ShoppingCart, PackageX } from 'lucide-react';
import { getProduct } from '@/api/catalog';
import { addToCart } from '@/api/cart';
import { ApiError } from '@/lib/http';
import { money } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { Button, Badge, Card, Field, Input, PageLoader, EmptyState, LinkButton } from '@/components/ui';

const MAX_QTY = 20;

export default function ProductDetail() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { refresh } = useCart();
  const toast = useToast();

  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [adding, setAdding] = useState(false);

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const product = productQuery.data;

  const images = useMemo(() => {
    if (!product) return [];
    return [...product.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
  }, [product]);

  if (productQuery.isLoading) return <PageLoader />;

  if (productQuery.isError) {
    const err = productQuery.error;
    if (err instanceof ApiError && err.status === 404) {
      return (
        <EmptyState
          icon={<PackageX className="h-10 w-10" />}
          title="Product not found"
          message="This product may have been removed or is no longer available."
          action={<LinkButton to="/products">Back to shop</LinkButton>}
        />
      );
    }
    return (
      <EmptyState
        icon={<PackageX className="h-10 w-10" />}
        title="Could not load product"
        message={err instanceof Error ? err.message : 'Please try again shortly.'}
        action={<LinkButton to="/products">Back to shop</LinkButton>}
      />
    );
  }

  if (!product) return null;

  const outOfStock = product.stockQuantity <= 0;
  const maxQty = Math.max(1, Math.min(product.stockQuantity, MAX_QTY));
  const hasCompare = product.compareAtPrice != null && product.compareAtPrice > product.price;

  async function handleAdd() {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/products/${slug}` } });
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

  const main = images[activeImage] ?? images[0];

  return (
    <div className="space-y-6">
      <nav className="text-sm text-slate-500">
        <Link to="/products" className="hover:text-gold-300">
          Shop
        </Link>
        {product.categoryName && <span> / {product.categoryName}</span>}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-ink-800 bg-ink-850">
            {main ? (
              <img src={main.url} alt={main.altText ?? product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-600">
                <ImageOff className="h-16 w-16" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={
                    'h-16 w-16 overflow-hidden rounded-lg border transition ' +
                    (i === activeImage ? 'border-gold-400' : 'border-ink-700 hover:border-ink-500')
                  }
                >
                  <img src={img.url} alt={img.altText ?? product.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div>
            {product.categoryName && (
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{product.categoryName}</p>
            )}
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-50 sm:text-3xl">{product.name}</h1>
            <p className="mt-1 text-xs text-slate-500">SKU: {product.sku}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-gold-300">{money(product.price, product.currency)}</span>
            {hasCompare && (
              <span className="text-base text-slate-500 line-through">{money(product.compareAtPrice, product.currency)}</span>
            )}
            {outOfStock ? (
              <Badge tone="red">Out of stock</Badge>
            ) : product.stockQuantity <= 5 ? (
              <Badge tone="amber">Only {product.stockQuantity} left</Badge>
            ) : (
              <Badge tone="green">In stock</Badge>
            )}
          </div>

          {product.shortDescription && <p className="text-sm text-slate-300">{product.shortDescription}</p>}

          {/* Quantity + add to cart */}
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Quantity">
              <div className="flex h-10 items-center rounded-lg border border-ink-700 bg-ink-900">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={outOfStock || qty <= 1}
                  className="grid h-full w-10 place-items-center text-slate-300 hover:text-slate-100 disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={qty}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isNaN(n)) return;
                    setQty(Math.max(1, Math.min(maxQty, Math.floor(n))));
                  }}
                  className="h-full w-14 border-0 bg-transparent text-center"
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={outOfStock || qty >= maxQty}
                  className="grid h-full w-10 place-items-center text-slate-300 hover:text-slate-100 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Field>

            <Button onClick={handleAdd} loading={adding} disabled={outOfStock} size="lg">
              <ShoppingCart className="h-4 w-4" />
              {outOfStock ? 'Out of stock' : 'Add to cart'}
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

          {product.description && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-200">Description</h2>
              <p className="whitespace-pre-line text-sm text-slate-400">{product.description}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
