import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { activateRow } from '@/lib/rowActivation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Package, Plus, Trash2 } from 'lucide-react';
import { adminProducts } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type { ProductStatus, ProductSummaryResponse } from '@/lib/types';
import { money } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  Pagination,
  Select,
  SkeletonTable,
} from '@/components/ui';
import { ProductStatusBadge } from '@/components/StatusBadge';
import { BulkProductUpload } from '@/components/admin/BulkProductUpload';

const STATUSES: ProductStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const PAGE_SIZE = 15;

export default function Inventory() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();

  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'ALL'>('ALL');

  const [stockTarget, setStockTarget] = useState<ProductSummaryResponse | null>(null);
  const [stockValue, setStockValue] = useState('0');
  const [deleteTarget, setDeleteTarget] = useState<ProductSummaryResponse | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'inventory', { page, search, status }],
    queryFn: () =>
      adminProducts.list({
        page,
        size: PAGE_SIZE,
        sort: 'createdAt,desc',
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
      }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'inventory'] });

  const stockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => adminProducts.setStock(id, quantity),
    onSuccess: () => {
      invalidate();
      toast.success('Stock updated');
      setStockTarget(null);
    },
    onError: (e) => toast.error('Update failed', e instanceof ApiError ? e.message : undefined),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: ProductStatus }) => adminProducts.changeStatus(id, next),
    onSuccess: () => {
      invalidate();
      toast.success('Status changed');
    },
    onError: (e) => toast.error('Update failed', e instanceof ApiError ? e.message : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminProducts.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('Product deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error('Delete failed', e instanceof ApiError ? e.message : undefined),
  });

  const rows = useMemo(() => data?.content ?? [], [data]);

  function openStock(p: ProductSummaryResponse) {
    setStockTarget(p);
    setStockValue(String(p.stockQuantity));
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Manage products, stock levels, and availability."
        action={
          <LinkButton to="/admin/inventory/new">
            <Plus className="h-4 w-4" /> New product
          </LinkButton>
        }
      />

      <div className="mb-4">
        {/* Exports respect the status filter below, so "export what I am looking
            at" behaves the way it reads. */}
        <BulkProductUpload statusFilter={status === 'ALL' ? undefined : status} />
      </div>

      <Card className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by name or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ProductStatus | 'ALL');
              setPage(0);
            }}
            className="sm:w-44"
          >
            <option value="ALL">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <SkeletonTable rows={8} columns={6} />
        ) : isError ? (
          <EmptyState title="Could not load products" message={(error as Error)?.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title="No products"
            message="Try adjusting your filters, or add a new product."
            action={
              <LinkButton to="/admin/inventory/new">
                <Plus className="h-4 w-4" /> New product
              </LinkButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">SKU</th>
                  <th className="px-3 py-2 font-medium text-right">Price</th>
                  <th className="px-3 py-2 font-medium text-right">Stock</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={activateRow(() => navigate(`/admin/inventory/${p.id}`))}
                    className="cursor-pointer transition hover:bg-ink-800/40"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-700 bg-ink-850">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageOff className="h-4 w-4 text-slate-600" />
                          )}
                        </div>
                        <Link to={`/admin/inventory/${p.id}`} className="font-medium text-slate-100 hover:text-gold-300">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{money(p.price, p.currency)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={p.stockQuantity <= 5 ? 'font-semibold text-rose-400' : 'text-slate-300'}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ProductStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openStock(p)}>
                          Set stock
                        </Button>
                        <Select
                          value={p.status}
                          onChange={(e) => statusMutation.mutate({ id: p.id, next: e.target.value as ProductStatus })}
                          className="h-8 w-28 py-0 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </Select>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(p)}
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-rose-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && <Pagination page={data.number} totalPages={data.totalPages} onChange={setPage} />}
      </Card>

      {/* Set stock modal */}
      <Modal
        open={!!stockTarget}
        onClose={() => setStockTarget(null)}
        title="Set stock quantity"
        footer={
          <>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancel
            </Button>
            <Button
              loading={stockMutation.isPending}
              onClick={() =>
                stockTarget &&
                stockMutation.mutate({ id: stockTarget.id, quantity: Math.max(0, Number(stockValue) || 0) })
              }
            >
              Save
            </Button>
          </>
        }
      >
        {stockTarget && (
          <Field label={`Stock for “${stockTarget.name}”`}>
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

      {/* Delete modal (admin only) */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete product?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          Permanently delete <span className="font-medium text-slate-200">{deleteTarget?.name}</span>? This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
