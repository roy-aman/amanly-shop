/* ===================================================================
   DEV-ONLY UI-kit showcase — /dev/kitchen-sink
   Renders every @/components/ui primitive (old + WP-1.2 additions) in its
   key variants/states for visual review. Mounted only when import.meta.env.DEV
   is true (see App.tsx); this file is tree-shaken out of production builds.
   Not part of the app's routes or navigation — a review harness only.
   =================================================================== */
import { useState, type ReactNode } from 'react';
import type { AvailabilitySlot, BusinessHoursEntry } from '@/lib/types';
import { BookingSourceBadge, BookingStatusBadge } from '@/components/BookingStatusBadge';
import { BusinessHoursEditor } from '@/components/admin/BusinessHoursEditor';
import { MoreHorizontal, Pencil, Plus, ShoppingCart, Star, Trash2, TrendingUp, Users } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Carousel,
  DateStrip,
  ConfirmDialog,
  DataTable,
  Drawer,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  EmptyState,
  Field,
  FilterChip,
  ImageWithFallback,
  Input,
  LinkButton,
  Modal,
  PageHeader,
  Pagination,
  PasswordInput,
  PriceTag,
  QuantityStepper,
  RatingStars,
  SearchInput,
  Select,
  Skeleton,
  SlotPicker,
  SkeletonCard,
  SkeletonDetail,
  SkeletonTable,
  SkeletonText,
  Spinner,
  Stat,
  Stepper,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ThemedAreaChart,
  ThemedBarChart,
  ThemedLineChart,
  Tooltip,
  type Column,
} from '@/components/ui';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  ProductStatusBadge,
  UserStatusBadge,
} from '@/components/StatusBadge';

const DEMO_SLOTS: AvailabilitySlot[] = [
  { startsAt: '2026-08-21T03:30:00Z', endsAt: '2026-08-21T04:30:00Z', localTime: '09:00' },
  { startsAt: '2026-08-21T04:30:00Z', endsAt: '2026-08-21T05:30:00Z', localTime: '10:00' },
  { startsAt: '2026-08-21T07:30:00Z', endsAt: '2026-08-21T08:30:00Z', localTime: '13:00' },
  { startsAt: '2026-08-21T09:30:00Z', endsAt: '2026-08-21T10:30:00Z', localTime: '15:00' },
  { startsAt: '2026-08-21T12:30:00Z', endsAt: '2026-08-21T13:30:00Z', localTime: '18:00' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink-800 pt-8">
      <h2 className="mb-4 text-h3 text-slate-100">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

interface DemoRow {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock: number;
}
const DEMO_ROWS: DemoRow[] = [
  { id: 1, name: 'Aurelia Silk Scarf', sku: 'SCF-001', price: 89, stock: 12 },
  { id: 2, name: 'Onyx Leather Wallet', sku: 'WAL-114', price: 145, stock: 0 },
  { id: 3, name: 'Gilded Ceramic Vase', sku: 'VAS-203', price: 62, stock: 47 },
  { id: 4, name: 'Marble Chess Set', sku: 'CHS-300', price: 310, stock: 3 },
];

const CHART_DATA = [
  { label: 'Mon', revenue: 1200, orders: 18 },
  { label: 'Tue', revenue: 2100, orders: 27 },
  { label: 'Wed', revenue: 800, orders: 11 },
  { label: 'Thu', revenue: 1650, orders: 22 },
  { label: 'Fri', revenue: 2600, orders: 34 },
  { label: 'Sat', revenue: 3050, orders: 41 },
  { label: 'Sun', revenue: 1980, orders: 25 },
];

export default function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerSide, setDrawerSide] = useState<null | 'left' | 'right' | 'top' | 'bottom'>(null);
  const [qty, setQty] = useState(1);
  const [page, setPage] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [chips, setChips] = useState<Record<string, boolean>>({ 'In stock': true, 'On sale': false, New: false });
  const [search, setSearch] = useState('');
  const [bookingDate, setBookingDate] = useState('2026-08-21');
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [hours, setHours] = useState<BusinessHoursEntry[]>([
    { weekday: 1, openTime: '09:00', closeTime: '18:00' },
    { weekday: 2, openTime: '09:00', closeTime: '18:00' },
  ]);

  const columns: Column<DemoRow>[] = [
    { key: 'name', header: 'Product', sortable: true },
    { key: 'sku', header: 'SKU', sortable: true },
    { key: 'price', header: 'Price', sortable: true, align: 'right', render: (r) => <PriceTag price={r.price} size="sm" /> },
    {
      key: 'stock',
      header: 'Stock',
      sortable: true,
      align: 'right',
      render: (r) => (r.stock === 0 ? <Badge tone="red">Out</Badge> : <span>{r.stock}</span>),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="UI Kitchen Sink"
        subtitle="Dev-only showcase of every @/components/ui primitive. Not shipped to production."
        action={<Badge tone="gold">DEV</Badge>}
      />

      <div className="space-y-10">
        <Section title="Buttons">
          <div className="space-y-3">
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </Row>
            <Row>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
              <Button variant="primary" size="sm">
                <Plus className="h-4 w-4" /> Icon
              </Button>
            </Row>
            <Row>
              <LinkButton to="/dev/kitchen-sink" variant="outline">
                LinkButton
              </LinkButton>
            </Row>
          </div>
        </Section>

        <Section title="Badges & status badges">
          <div className="space-y-3">
            <Row>
              {(['gold', 'green', 'red', 'blue', 'amber', 'purple', 'gray'] as const).map((t) => (
                <Badge key={t} tone={t}>
                  {t}
                </Badge>
              ))}
            </Row>
            <Row>
              <OrderStatusBadge status="PROCESSING" />
              <OrderStatusBadge status="SHIPPED" />
              <OrderStatusBadge status="DELIVERED" />
              <PaymentStatusBadge status="PAID" />
              <PaymentStatusBadge status="FAILED" />
              <ProductStatusBadge status="ACTIVE" />
              <UserStatusBadge status="LOCKED" />
            </Row>
          </div>
        </Section>

        <Section title="Form fields">
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Name" hint="As it appears on your ID">
              <Input placeholder="Jane Doe" />
            </Field>
            <Field label="Email" required error="Enter a valid email">
              <Input invalid defaultValue="not-an-email" />
            </Field>
            <Field label="Password">
              <PasswordInput placeholder="••••••••" />
            </Field>
            <Field label="Country">
              <Select defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                <option>United States</option>
                <option>India</option>
              </Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea placeholder="Anything we should know?" />
            </Field>
            <div className="sm:col-span-2">
              <SearchInput onSearch={setSearch} placeholder="Debounced search…" />
              <p className="mt-1 text-xs text-slate-500">Last debounced value: {search || '—'}</p>
            </div>
          </div>
        </Section>

        <Section title="Cards, empty & loaders">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <h3 className="text-h4 text-slate-100">Card</h3>
              <p className="mt-1 text-sm text-slate-400">Resting panel surface with border + shadow.</p>
            </Card>
            <Card className="flex items-center justify-center p-5">
              <Spinner className="h-8 w-8" />
            </Card>
            <EmptyState title="Nothing here" message="No records match your filters yet." action={<Button size="sm">Add one</Button>} />
          </div>
        </Section>

        <Section title="Skeletons">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Skeleton className="h-8 w-40" />
              <SkeletonText lines={3} />
            </div>
            <SkeletonCard />
            <SkeletonTable rows={3} columns={4} />
            <SkeletonDetail />
          </div>
        </Section>

        <Section title="Stats & charts">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Revenue"
              value="$12,480"
              icon={<TrendingUp className="h-5 w-5" />}
              delta={{ value: 12.5, label: 'vs. last week' }}
            />
            <Stat
              label="Customers"
              value="1,204"
              icon={<Users className="h-5 w-5" />}
              delta={{ value: -3.1, label: 'vs. last week' }}
            />
            <Stat label="Avg. order" value="$86.40" delta={{ value: 4.2, positiveIsGood: true }} hint="30-day" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <p className="mb-2 text-overline uppercase text-slate-500">Area</p>
              <ThemedAreaChart data={CHART_DATA} xKey="label" series={[{ key: 'orders', name: 'Orders' }]} height={200} />
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-overline uppercase text-slate-500">Line</p>
              <ThemedLineChart data={CHART_DATA} xKey="label" series={[{ key: 'revenue', name: 'Revenue' }]} height={200} />
            </Card>
            <Card className="p-4">
              <p className="mb-2 text-overline uppercase text-slate-500">Bar</p>
              <ThemedBarChart data={CHART_DATA} xKey="label" series={[{ key: 'orders', name: 'Orders' }]} height={200} />
            </Card>
          </div>
        </Section>

        <Section title="Tabs, accordion & breadcrumbs">
          <Breadcrumbs
            items={[{ label: 'Home', to: '/' }, { label: 'Catalog', to: '/products' }, { label: 'Silk Scarf' }]}
            className="mb-4"
          />
          <Tabs defaultValue="desc">
            <TabsList>
              <TabsTrigger value="desc">Description</TabsTrigger>
              <TabsTrigger value="specs">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
            </TabsList>
            <TabsContent value="desc">
              <p className="text-sm text-slate-400">A hand-finished silk scarf with a gilded border.</p>
            </TabsContent>
            <TabsContent value="specs">
              <p className="text-sm text-slate-400">100% mulberry silk · 90×90cm · Dry clean only.</p>
            </TabsContent>
            <TabsContent value="reviews">
              <RatingStars value={4.5} count={128} />
            </TabsContent>
          </Tabs>
          <Accordion type="single" collapsible defaultValue="ship" className="mt-6 max-w-xl">
            <AccordionItem value="ship" title="Shipping & delivery">
              Free shipping over $50. Delivered in 3–5 business days.
            </AccordionItem>
            <AccordionItem value="returns" title="Returns">
              30-day returns on unworn items with tags attached.
            </AccordionItem>
          </Accordion>
        </Section>

        <Section title="Overlays: menu, tooltip, modal, drawer, confirm">
          <Row>
            <DropdownMenu trigger={<Button variant="outline">Actions ▾</Button>}>
              <DropdownMenuLabel>Manage</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => {}}>
                <Pencil className="h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => {}}>
                <ShoppingCart className="h-4 w-4" /> Add to cart
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => {}}>
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenu>

            <Tooltip content="Rated 4.5 / 5">
              <Button variant="ghost">
                <Star className="h-4 w-4" /> Hover me
              </Button>
            </Tooltip>

            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete… (confirm)
            </Button>
            <Button variant="outline" onClick={() => setDrawerSide('right')}>
              Drawer (right)
            </Button>
            <Button variant="outline" onClick={() => setDrawerSide('left')}>
              Drawer (left)
            </Button>
          </Row>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example modal"
            footer={
              <>
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>Save</Button>
              </>
            }
          >
            <p className="text-sm text-slate-400">The legacy hand-rolled Modal, unchanged for existing pages.</p>
          </Modal>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Delete this product?"
            description="This action cannot be undone."
            destructive
            confirmLabel="Delete"
            onConfirm={() => setConfirmOpen(false)}
          />

          <Drawer
            open={drawerSide !== null}
            onOpenChange={(o) => !o && setDrawerSide(null)}
            side={drawerSide ?? 'right'}
            title="Slide-out panel"
            description="Radix-backed drawer (focus trap, Escape, scroll-lock)."
            footer={<Button fullWidth onClick={() => setDrawerSide(null)}>Done</Button>}
          >
            <p className="text-sm text-slate-400">Reused by WP-1.3 for the mobile nav & mini-cart.</p>
          </Drawer>
        </Section>

        <Section title="Commerce bits">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <p className="text-overline uppercase text-slate-500">Price tags</p>
              <PriceTag price={89} size="lg" />
              <PriceTag price={62} compareAtPrice={99} />
              <PriceTag price={310} compareAtPrice={399} size="sm" />
            </div>
            <div className="space-y-3">
              <p className="text-overline uppercase text-slate-500">Rating</p>
              <RatingStars value={5} />
              <RatingStars value={3.5} count={42} />
              <RatingStars value={1} size="lg" />
            </div>
            <div className="space-y-3">
              <p className="text-overline uppercase text-slate-500">Quantity</p>
              <QuantityStepper value={qty} onChange={setQty} max={10} />
              <QuantityStepper value={qty} onChange={setQty} size="sm" />
            </div>
          </div>
          <Row>
            {Object.entries(chips).map(([label, on]) => (
              <FilterChip key={label} selected={on} onClick={() => setChips((c) => ({ ...c, [label]: !c[label] }))}>
                {label}
              </FilterChip>
            ))}
            <FilterChip onRemove={() => {}}>category: Accessories</FilterChip>
          </Row>
        </Section>

        <Section title="Media: image fallback & carousel">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400"
                alt="A watch"
                wrapperClassName="aspect-square rounded-xl"
              />
              <ImageWithFallback src="https://broken.example/nope.jpg" alt="Broken" wrapperClassName="aspect-square rounded-xl" />
            </div>
            <Carousel ariaLabel="Demo carousel">
              {['#e0b040', '#38bdf8', '#34d399'].map((c) => (
                <div key={c} className="flex aspect-[16/9] items-center justify-center" style={{ background: `${c}22` }}>
                  <span className="text-h3" style={{ color: c }}>
                    Slide
                  </span>
                </div>
              ))}
            </Carousel>
          </div>
        </Section>

        <Section title="Stepper">
          <Stepper
            className="max-w-2xl"
            current={1}
            steps={[
              { label: 'Address', description: 'Where to ship' },
              { label: 'Payment', description: 'How to pay' },
              { label: 'Review', description: 'Confirm order' },
            ]}
          />
        </Section>

        <Section title="DataTable">
          <Row>
            <Button size="sm" variant="outline" onClick={() => setTableLoading((v) => !v)}>
              Toggle loading ({tableLoading ? 'on' : 'off'})
            </Button>
          </Row>
          <div className="mt-3">
            <DataTable
              columns={columns}
              data={DEMO_ROWS}
              getRowKey={(r) => r.id}
              loading={tableLoading}
              stickyHeader
              defaultSort={{ key: 'name', dir: 'asc' }}
              rowActions={() => (
                <DropdownMenu trigger={<Button variant="ghost" size="sm" aria-label="Row actions"><MoreHorizontal className="h-4 w-4" /></Button>}>
                  <DropdownMenuItem onSelect={() => {}}>Edit</DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => {}}>Delete</DropdownMenuItem>
                </DropdownMenu>
              )}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            (Click a sortable header to re-sort. Sticky header, row actions, loading + empty states shown.)
          </p>
          <div className="mt-4">
            <DataTable columns={columns} data={[]} getRowKey={(r) => r.id} empty="No products found." />
          </div>
          <Pagination page={page} totalPages={5} onChange={setPage} />
        </Section>

        <Section title="Booking: date strip & slot picker">
          <div className="max-w-2xl space-y-6">
            <DateStrip value={bookingDate} onChange={setBookingDate} timezone="Asia/Kolkata" daysToShow={5} />
            <SlotPicker slots={DEMO_SLOTS} value={slot?.startsAt} onChange={setSlot} />
            <p className="text-xs text-slate-500">
              Times render from the slot's own store-local label, never from the browser's clock. An
              empty list is a normal answer — closed, full, or beyond the shop's booking window:
            </p>
            <SlotPicker slots={[]} onChange={() => {}} />
            <p className="text-xs text-slate-500">Loading:</p>
            <SlotPicker slots={[]} loading onChange={() => {}} />
          </div>
        </Section>

        <Section title="Booking: status & source badges">
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status="CONFIRMED" />
            <BookingStatusBadge status="COMPLETED" />
            <BookingStatusBadge status="CANCELLED" />
            <BookingStatusBadge status="NO_SHOW" />
            <BookingSourceBadge source="ONLINE" />
            <BookingSourceBadge source="WALK_IN" />
            <BookingSourceBadge source="PHONE" />
          </div>
        </Section>

        <Section title="Booking: opening hours editor">
          <div className="max-w-2xl">
            <BusinessHoursEditor value={hours} onChange={setHours} />
            <p className="mt-2 text-xs text-slate-500">
              A closed day is the absence of an entry, not a flag on one — unchecking removes it from
              the list the server is sent.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
