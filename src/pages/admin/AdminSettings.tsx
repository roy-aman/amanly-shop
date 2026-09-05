import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, CreditCard, MessageCircle, QrCode, Tag, Trash2, Truck, Type } from 'lucide-react';
import { adminStore } from '@/api/admin';
import { ApiError } from '@/lib/http';
import type {
  StoreSettingsResponse,
  StoreUpiSettingsResponse,
  UpdateCommerceSettingsRequest,
  UpdatePaymentSettingsRequest,
  UpiApp,
  UpdateStorefrontContentRequest,
  UpdateStoreLexiconRequest,
  UpdateWhatsappSettingsRequest,
} from '@/lib/types';
import { LEXICON_DEFAULTS } from '@/lib/lexicon';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoader, Select, Textarea } from '@/components/ui';
import { cn } from '@/components/ui/cn';

/**
 * One settings section, folded down to a single line once it is set up.
 *
 * A settings page is read far more often than it is edited, and six forms open at once is a wall
 * of inputs to scroll past in order to change one number. Folded, each section states what it is
 * currently set to — which is the question a merchant opening this page is usually asking — and
 * opens on request.
 *
 * <p>A section starts open only when it has nothing set yet, so a new shop is walked through the
 * things it genuinely has to fill in rather than being handed six closed boxes. Settings whose
 * "off" or "default" state is a perfectly good answer (the wording, WhatsApp) count as settled and
 * start folded, or they would nag every merchant who is happy with the defaults forever.
 *
 * @param summary  what this section is set to right now, in a few words. Shown only when folded,
 *                 so it has to answer the question without the form underneath it.
 * @param onToggle owned by the caller rather than held here, so a card can fold itself when its
 *                 save succeeds — which is the whole point of "fold once done".
 */
function SettingsSection({
  icon,
  title,
  summary,
  badge,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary: ReactNode;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{title}</span>
            {badge}
          </span>
          {/* Only when folded: open, the form below says all of this and more, and a summary
              sitting above it is one more thing to read that cannot be acted on. */}
          {!open && <span className="mt-1 block text-caption text-slate-400">{summary}</span>}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-caption text-slate-400">
          {open ? 'Close' : 'Change'}
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </button>

      {open && <div className="mt-4">{children}</div>}
    </Card>
  );
}

export default function AdminSettings() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'store'],
    queryFn: () => adminStore.get(),
  });

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return <EmptyState title="Could not load settings" message={(error as Error)?.message} />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Delivery, tax, payment and messaging for your store." />
      <div className="space-y-6">
        <StorefrontCard store={data} />
        <LexiconCard store={data} />
        <CommerceCard store={data} />
        <PaymentsCard store={data} />
        <UpiAppsCard store={data} />
        <WhatsappCard store={data} />
      </div>
    </div>
  );
}

// ── Storefront opening screen ─────────────────────────────────────────
/**
 * The three lines on the shop's first screen.
 *
 * Empty is not the same as blank here: an empty field means "use the default",
 * and the default is shown as placeholder text so a merchant can see what they
 * are replacing — and get it back by clearing the box. Pre-filling the inputs
 * with the default would make that impossible to express.
 */
const HERO_DEFAULTS = {
  eyebrow: 'Considered essentials for men.',
  headline: 'Fewer things.\nBetter made.',
  subtext: 'A tight edit of everyday pieces — chosen for fit, fabric, and how they wear over time.',
};

function StorefrontCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [eyebrow, setEyebrow] = useState(store.heroEyebrow ?? '');
  const [headline, setHeadline] = useState(store.heroHeadline ?? '');
  const [subtext, setSubtext] = useState(store.heroSubtext ?? '');
  // Open only for a shop that has not written its own opening screen yet.
  const [open, setOpen] = useState(!(store.heroEyebrow || store.heroHeadline || store.heroSubtext));

  useEffect(() => {
    setEyebrow(store.heroEyebrow ?? '');
    setHeadline(store.heroHeadline ?? '');
    setSubtext(store.heroSubtext ?? '');
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateStorefrontContentRequest) => adminStore.updateStorefrontContent(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      // The storefront reads these from the public bootstrap, which is cached for
      // minutes — without this the merchant reloads the shop and sees the old words.
      qc.invalidateQueries({ queryKey: ['public-store'] });
      toast.success('Storefront copy saved');
      setOpen(false);
    },
    onError: (e) => toast.error('Could not save', e instanceof Error ? e.message : 'Please try again.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ heroEyebrow: eyebrow, heroHeadline: headline, heroSubtext: subtext });
  }

  return (
    <SettingsSection
      icon={<Type className="h-4 w-4 text-gold-400" />}
      title="Storefront opening screen"
      summary={
        // The headline is the line a merchant would recognise their own shop by; the other two
        // sit around it. Only its first line, because it is deliberately multi-line.
        store.heroHeadline?.split('\n')[0].trim() ||
        store.heroEyebrow?.trim() ||
        'Using the default wording'
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <p className="text-caption text-slate-400">
        The words shoppers see first. Leave a box empty to use the wording shown in grey. These
        appear only while no home-page banner is running — a live banner takes the first screen
        instead.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Field label="Small line above" hint="A short line of context.">
          <Input
            aria-label="Small line above"
            maxLength={120}
            placeholder={HERO_DEFAULTS.eyebrow}
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
          />
        </Field>

        <Field label="Headline" hint="Each new line becomes its own line on the page.">
          <Textarea
            aria-label="Headline"
            rows={2}
            maxLength={200}
            placeholder={HERO_DEFAULTS.headline}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
        </Field>

        <Field label="Sentence underneath">
          <Textarea
            aria-label="Sentence underneath"
            rows={2}
            maxLength={400}
            placeholder={HERO_DEFAULTS.subtext}
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
          />
        </Field>

        <Button type="submit" loading={mutation.isPending}>
          Save copy
        </Button>
      </form>
    </SettingsSection>
  );
}

// ── What this shop calls things ───────────────────────────────────────
/**
 * The rename form.
 *
 * Every store on the platform runs these same pages; this is where a merchant
 * decides what the things on them are called. A bakery's customers browse cakes
 * by occasion, and its staff open a nav item that says Cakes — same code, same
 * routes, different words, and no developer involved in changing them.
 *
 * Two rules shape the form, and both come from "clearing a box must undo a
 * rename". The inputs hold OVERRIDES only, never the defaults, with the default
 * shown as placeholder — pre-filling would make "use the platform's word"
 * impossible to express. And the save is a FULL REPLACE, so what is submitted is
 * every rename the store has; a term cleared here is a term that reverts.
 *
 * The list of terms comes from the server (`lexiconDefaults`) rather than from
 * this file, so a term added in a later backend release appears here without a
 * console release. This bundle's own defaults are only the fallback.
 */
const TERM_GROUPS: { heading: string; hint: string; keys: string[] }[] = [
  {
    heading: 'What you sell',
    hint: 'Shown to customers, all over the shop.',
    keys: ['product', 'products', 'category', 'categories', 'brand', 'brands', 'variant', 'variants'],
  },
  {
    heading: 'Buying',
    hint: 'The bag, the checkout, and what a customer calls what they have bought.',
    keys: ['cart', 'order', 'orders', 'coupon', 'coupons', 'wishlist', 'review', 'reviews'],
  },
  {
    heading: 'Appointments',
    hint: 'Only shown to customers if your shop takes bookings.',
    keys: ['service', 'services', 'booking', 'bookings', 'staffMember', 'staff'],
  },
  {
    heading: 'This console',
    hint: 'The navigation you and your team read all day.',
    keys: [
      'nav.overview', 'nav.dashboard', 'nav.catalog', 'nav.inventory', 'nav.categories',
      'nav.brands', 'nav.banners', 'nav.reviews', 'nav.sales', 'nav.orders', 'nav.deliverables',
      'nav.coupons', 'nav.bookings', 'nav.diary', 'nav.services', 'nav.serviceGroups', 'nav.team',
      'nav.serviceReviews', 'nav.bookingSetup', 'nav.people', 'nav.users', 'nav.insights',
      'nav.reports', 'nav.system', 'nav.storeQr', 'nav.settings',
    ],
  },
];

function LexiconCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [terms, setTerms] = useState<Record<string, string>>(store.lexicon ?? {});
  // The long "this console" group inside the form, distinct from the section fold itself.
  const [consoleOpen, setConsoleOpen] = useState(false);
  // Folded from the start: running the platform's own words is a perfectly good answer, and a
  // section that stayed open until you renamed something would nag every shop that never will.
  const [open, setOpen] = useState(false);

  useEffect(() => setTerms(store.lexicon ?? {}), [store]);

  // Server-supplied where available: a term this console has never heard of is
  // still renameable, and one that has been retired stops being offered.
  const defaults: Record<string, string> = store.lexiconDefaults ?? LEXICON_DEFAULTS;

  const mutation = useMutation({
    mutationFn: (body: UpdateStoreLexiconRequest) => adminStore.updateLexicon(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      // The storefront AND this console's own navigation read the resolved words
      // from the public bootstrap, which is cached for minutes. Without this the
      // merchant saves "Cakes" and the sidebar still says Inventory.
      qc.invalidateQueries({ queryKey: ['public-store'] });
      toast.success('Wording saved');
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'UNKNOWN_LEXICON_TERM') {
        toast.error('That word does not belong to anything', e.message);
        return;
      }
      toast.error('Could not save', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function set(key: string, value: string) {
    setTerms((prev) => {
      const next = { ...prev };
      // A cleared box is a removed override, not an empty word. Keeping "" would
      // send a blank the server then has to interpret, and would leave the field
      // looking edited when it has been reset.
      if (value.trim()) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate({ terms });
  }

  const renamed = Object.keys(terms).length;

  return (
    <SettingsSection
      icon={<Tag className="h-4 w-4 text-gold-400" />}
      title="What you call things"
      summary={renamed > 0 ? `${renamed} renamed` : 'Using the platform’s own words'}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <p className="text-caption text-slate-400">
        Your shop runs the same pages as every shop on the platform — this is what the things on them
        are called. Sell cakes by occasion rather than products by category. Leave a box empty to keep
        the word shown in grey.
        {renamed > 0 && <> You have renamed {renamed} of them.</>}
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-5">
        {TERM_GROUPS.map((group, i) => {
          // The console group is long and most merchants never open it, so it is
          // collapsed until asked for rather than pushing the save button off the
          // screen for everyone.
          const collapsible = i === TERM_GROUPS.length - 1;
          if (collapsible && !consoleOpen) {
            return (
              <Button key={group.heading} type="button" variant="ghost" onClick={() => setConsoleOpen(true)}>
                Rename this console too
              </Button>
            );
          }
          return (
            <div key={group.heading}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.heading}
              </p>
              <p className="mt-0.5 text-caption text-slate-400">{group.hint}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.keys
                  .filter((key) => key in defaults)
                  .map((key) => (
                    <Field key={key} label={defaults[key]}>
                      <Input
                        aria-label={`Your word for ${defaults[key]}`}
                        maxLength={60}
                        placeholder={defaults[key]}
                        value={terms[key] ?? ''}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </Field>
                  ))}
              </div>
            </div>
          );
        })}

        <Button type="submit" loading={mutation.isPending}>
          Save wording
        </Button>
      </form>
    </SettingsSection>
  );
}

// ── Delivery & tax (WP-P.6) ───────────────────────────────────────────
function CommerceCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  // Every field is applied as sent, so the form starts from the current values
  // and submits all of them; a partial save would zero what it omitted.
  const [shipping, setShipping] = useState(String(store.shippingFlatAmount ?? 0));
  const [threshold, setThreshold] = useState(store.freeShippingThreshold == null ? '' : String(store.freeShippingThreshold));
  const [taxRate, setTaxRate] = useState(String(store.taxRatePercent ?? 0));
  const [inclusive, setInclusive] = useState(store.pricesIncludeTax ?? true);
  const [pickupEnabled, setPickupEnabled] = useState(store.pickupEnabled ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Always has a value — zero delivery and zero tax is a real answer, not an unset one — so this
  // opens folded and states its figures rather than asking to be filled in.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setShipping(String(store.shippingFlatAmount ?? 0));
    setThreshold(store.freeShippingThreshold == null ? '' : String(store.freeShippingThreshold));
    setTaxRate(String(store.taxRatePercent ?? 0));
    setInclusive(store.pricesIncludeTax ?? true);
    setPickupEnabled(store.pickupEnabled ?? false);
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateCommerceSettingsRequest) => adminStore.updateCommerce(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      // The public bootstrap carries the same figures, so the storefront's
      // estimates would otherwise keep quoting the old delivery charge.
      qc.invalidateQueries({ queryKey: ['public-store'] });
      toast.success('Delivery & tax saved', 'Applies to future orders; placed orders keep their own figures.');
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.hasFieldErrors()) setErrors(e.fieldErrorMap());
      else toast.error('Could not save', e instanceof Error ? e.message : 'Please try again.');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const shippingNum = Number(shipping);
    const rateNum = Number(taxRate);
    const thresholdNum = threshold.trim() === '' ? null : Number(threshold);
    if (!Number.isFinite(shippingNum) || shippingNum < 0) next.shipping = 'Must be zero or more';
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) next.taxRate = 'Must be between 0 and 100';
    if (thresholdNum != null && (!Number.isFinite(thresholdNum) || thresholdNum < 0)) {
      next.threshold = 'Must be zero or more, or empty for never free';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    mutation.mutate({
      shippingFlatAmount: shippingNum,
      freeShippingThreshold: thresholdNum,
      taxRatePercent: rateNum,
      pricesIncludeTax: inclusive,
      pickupEnabled,
    });
  }

  return (
    <SettingsSection
      icon={<Truck className="h-4 w-4 text-gold-400" />}
      title="Delivery & tax"
      summary={[
        Number(store.shippingFlatAmount ?? 0) > 0
          ? `Delivery ${store.currency} ${store.shippingFlatAmount}`
          : 'Free delivery',
        store.freeShippingThreshold != null && `free over ${store.currency} ${store.freeShippingThreshold}`,
        Number(store.taxRatePercent ?? 0) > 0
          ? `${store.taxRatePercent}% tax ${store.pricesIncludeTax ? 'included' : 'at checkout'}`
          : 'no tax',
        store.pickupEnabled && 'pickup allowed',
      ]
        .filter(Boolean)
        .join(' · ')}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <p className="text-caption text-slate-400">
        Applies to orders placed from now on. Orders already placed keep the figures snapshotted at the time, so
        changing these never rewrites an invoice.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery charge" error={errors.shipping} hint={`Flat, in ${store.currency}.`}>
            <Input type="number" min={0} step="0.01" value={shipping} invalid={!!errors.shipping} onChange={(e) => setShipping(e.target.value)} />
          </Field>
          <Field
            label="Free delivery over"
            error={errors.threshold}
            hint="Compared against the total after any discount. Empty = never free."
          >
            <Input type="number" min={0} step="0.01" value={threshold} invalid={!!errors.threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
        </div>

        <Field label="Tax rate (%)" error={errors.taxRate}>
          <Input type="number" min={0} max={100} step="0.001" value={taxRate} invalid={!!errors.taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 p-3 transition hover:bg-ink-800/60">
          <input
            type="checkbox"
            className="mt-1 accent-gold-400"
            checked={pickupEnabled}
            onChange={(e) => setPickupEnabled(e.target.checked)}
          />
          <span>
            <span className="block text-body-sm text-slate-100">Allow in-person pickup</span>
            <span className="block text-caption text-slate-400">
              Shoppers may collect their order themselves instead of having it shipped — no address
              required, no delivery charge. Uses your business address as the pickup location.
            </span>
          </span>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-body-sm font-medium text-slate-300">How prices are entered</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 p-3 transition hover:bg-ink-800/60">
            <input type="radio" className="mt-1 accent-gold-400" checked={inclusive} onChange={() => setInclusive(true)} />
            <span>
              <span className="block text-body-sm text-slate-100">Prices include tax</span>
              <span className="block text-caption text-slate-400">
                Shoppers see “incl. tax” and the total is what the price says.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 p-3 transition hover:bg-ink-800/60">
            <input type="radio" className="mt-1 accent-gold-400" checked={!inclusive} onChange={() => setInclusive(false)} />
            <span>
              <span className="block text-body-sm text-slate-100">Tax added at checkout</span>
              <span className="block text-caption text-slate-400">
                Shoppers see “+ tax at checkout” and tax is charged on goods and delivery.
              </span>
            </span>
          </label>
        </fieldset>

        <Button type="submit" loading={mutation.isPending}>
          Save delivery &amp; tax
        </Button>
      </form>
    </SettingsSection>
  );
}

// ── Payments ──────────────────────────────────────────────────────────
/**
 * Which ways of paying this store accepts.
 *
 * Two rules shape this card. A method the platform has not provisioned for this
 * store is not shown at all — the Razorpay account belongs to the platform, so
 * there are no gateway credentials here and no dead toggle to explain. And the
 * detail a method needs (the UPI id) appears only once that method is switched
 * on, so a box is never asking for something the store is not using.
 *
 * The one exception is a method already switched on whose entitlement has since
 * gone away: that stays visible, badged, so the merchant can turn it off.
 */
function PaymentsCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [codEnabled, setCodEnabled] = useState(store.codEnabled);
  const [onlineEnabled, setOnlineEnabled] = useState(store.onlinePaymentEnabled);
  const [manualUpiEnabled, setManualUpiEnabled] = useState(store.manualUpiEnabled ?? false);
  const [manualUpiVpa, setManualUpiVpa] = useState(store.manualUpiVpa ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A shop accepting no payment at all cannot be sold from, so that is the one state here worth
  // opening for — every other combination is a decision the merchant has already made.
  const [open, setOpen] = useState(
    !(store.codEnabled || store.onlinePaymentEnabled || (store.manualUpiEnabled ?? false)),
  );

  const manualUpiAllowed = store.manualUpiAllowed ?? false;
  const showOnline = store.razorpayConfigured || store.onlinePaymentEnabled;
  const showManualUpi = manualUpiAllowed || (store.manualUpiEnabled ?? false);

  useEffect(() => {
    setCodEnabled(store.codEnabled);
    setOnlineEnabled(store.onlinePaymentEnabled);
    setManualUpiEnabled(store.manualUpiEnabled ?? false);
    setManualUpiVpa(store.manualUpiVpa ?? '');
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdatePaymentSettingsRequest) => adminStore.updatePayment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('Payment settings saved');
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not save', e.message);
      } else {
        toast.error('Could not save');
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // A UPI id is what the QR pays into, so the method is meaningless without one.
    if (manualUpiEnabled && !manualUpiVpa.trim()) {
      setErrors({ manualUpiVpa: 'Required to accept manual UPI' });
      return;
    }
    setErrors({});
    mutation.mutate({
      codEnabled,
      onlinePaymentEnabled: onlineEnabled,
      manualUpiEnabled,
      manualUpiVpa: manualUpiVpa.trim() || null,
    });
  }

  return (
    <SettingsSection
      icon={<CreditCard className="h-4 w-4 text-gold-400" />}
      title="Payments"
      summary={
        [
          store.codEnabled && 'Cash on delivery',
          store.onlinePaymentEnabled && 'Online payments',
          (store.manualUpiEnabled ?? false) && `Manual UPI${store.manualUpiVpa ? ` (${store.manualUpiVpa})` : ''}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'No payment method enabled — customers cannot check out'
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={codEnabled} onChange={(e) => setCodEnabled(e.target.checked)} />
          Enable cash on delivery (COD)
        </label>

        {showOnline && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={onlineEnabled}
              onChange={(e) => setOnlineEnabled(e.target.checked)}
            />
            Enable online payments (cards, UPI, netbanking)
          </label>
        )}

        {showManualUpi && (
          <div className="border-t border-ink-700 pt-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={manualUpiEnabled}
                  onChange={(e) => setManualUpiEnabled(e.target.checked)}
                />
                Enable Manual UPI
              </label>
              {!manualUpiAllowed && <Badge tone="gray">No longer on your plan</Badge>}
            </div>
            <p className="mt-1 text-caption text-slate-400">
              Shoppers scan a QR and pay your UPI id directly from whichever UPI app they use — you
              see the money arrive in your own app and mark the order paid. No gateway, no automatic
              verification.
            </p>
            {manualUpiEnabled && (
              <Field
                label="Your default UPI id"
                error={errors.manualUpiVpa}
                hint="What the QR pays into, e.g. shopowner@upi. Customers can pay it from any UPI app — the app you registered it with doesn't limit who can pay you."
                className="mt-3"
              >
                <Input
                  value={manualUpiVpa}
                  invalid={!!errors.manualUpiVpa}
                  onChange={(e) => setManualUpiVpa(e.target.value)}
                  placeholder="shopowner@upi"
                />
              </Field>
            )}
          </div>
        )}

        <Button type="submit" loading={mutation.isPending}>
          Save payment settings
        </Button>
      </form>
    </SettingsSection>
  );
}

// ── UPI applications & token verification ─────────────────────────────
/**
 * Every app the platform can name, for the "add an app" picker. Labels match the server's, with
 * one deliberate exception: OTHER. The server calls it "UPI" because that is what a *customer*
 * should see on a button — naming a handle held with some bank the shopper has never heard of
 * tells them nothing. A merchant scanning this list is asking a different question ("where is my
 * app?"), and "UPI" is no answer to it, so here it says so plainly.
 */
const UPI_APP_CHOICES: { app: UpiApp; label: string; pickerLabel?: string }[] = [
  { app: 'GOOGLE_PAY', label: 'Google Pay' },
  { app: 'PHONEPE', label: 'PhonePe' },
  { app: 'PAYTM', label: 'Paytm' },
  { app: 'BHIM', label: 'BHIM' },
  { app: 'AMAZON_PAY', label: 'Amazon Pay' },
  { app: 'WHATSAPP_PAY', label: 'WhatsApp Pay' },
  { app: 'CRED', label: 'CRED' },
  { app: 'MOBIKWIK', label: 'MobiKwik' },
  { app: 'FREECHARGE', label: 'Freecharge' },
  // Short in the configured row, where it sits in a fixed-width column; spelled out in the
  // picker, which is the only place a merchant is looking for it and has room to say it.
  { app: 'OTHER', label: 'Other', pickerLabel: 'Other — my app is not listed' },
];

interface UpiRow {
  app: UpiApp;
  upiId: string;
  enabled: boolean;
}

/**
 * The shop's UPI accounts, and the one decision that makes several of them worth having.
 *
 * The copy here does more work than usual, because the mistake this card exists to prevent is one
 * a merchant makes naturally: they register a UPI id through Google Pay, so they assume their
 * customers need Google Pay. They do not — `upi://pay` is an open standard and any UPI app pays
 * any handle. Reading "configure Google Pay" as "my customers must use Google Pay" is exactly the
 * error the storefront used to make out loud, one level up.
 *
 * So the card says plainly what the apps are for: they matter only once token verification is on,
 * where the customer picks the app they will pay from and the payment is directed at the id held
 * WITH that app — which is what lets a staff member find one token in one account's ledger instead
 * of hunting across all of them.
 */
function UpiAppsCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'store', 'upi-settings'],
    queryFn: () => adminStore.upiSettings(),
    enabled: store.manualUpiEnabled ?? false,
  });

  const [rows, setRows] = useState<UpiRow[]>([]);
  const [tokenVerification, setTokenVerification] = useState(false);
  const [addApp, setAddApp] = useState<UpiApp | ''>('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRows(data.configs.map((c) => ({ app: c.app, upiId: c.upiId, enabled: c.enabled })));
    setTokenVerification(data.tokenVerificationEnabled);
    // Decided here rather than in useState, because the accounts arrive on their own request and
    // there is nothing to judge "set up or not" by until they do. A shop with verification on and
    // no accounts configured cannot take a direct UPI payment at all, so that one opens.
    setOpen(data.tokenVerificationEnabled && data.configs.length === 0);
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      adminStore.updateUpiSettings({
        tokenVerificationEnabled: tokenVerification,
        configs: rows.map((r) => ({ app: r.app, upiId: r.upiId.trim(), enabled: r.enabled })),
      }),
    onSuccess: (saved: StoreUpiSettingsResponse) => {
      qc.setQueryData(['admin', 'store', 'upi-settings'], saved);
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('UPI settings saved');
      setOpen(false);
    },
    onError: (e) => toast.error('Could not save', e instanceof ApiError ? e.message : undefined),
  });

  // Nothing to configure for a shop not taking direct UPI at all; the switch for that lives one
  // card up, and duplicating it here would be two doors to one setting.
  if (!store.manualUpiEnabled) return null;

  // The several-accounts-and-tokens flow is an operator grant, and without it this whole card is
  // not this shop's to fill in: one UPI id, paid from any app, is the entire setup. Hidden rather
  // than disabled, because a card explaining a capability the merchant cannot have is an advert,
  // and the one exception is a store still switched on from before the grant was withdrawn — that
  // stays visible, badged, so they can see why their checkout changed and turn it off.
  const verificationAllowed = data?.tokenVerificationAllowed ?? false;
  if (!verificationAllowed && !data?.tokenVerificationEnabled) return null;

  const unused = UPI_APP_CHOICES.filter((c) => !rows.some((r) => r.app === c.app));

  return (
    <SettingsSection
      icon={<QrCode className="h-4 w-4 text-gold-400" />}
      title="UPI accounts & verification"
      badge={!verificationAllowed ? <Badge tone="gray">No longer on your plan</Badge> : undefined}
      summary={
        !tokenVerification
          ? 'Token verification off — one UPI id, paid from any app'
          : rows.length === 0
            ? 'Verification on, but no accounts added yet'
            : `${rows.length} account${rows.length === 1 ? '' : 's'} · ${rows.filter((r) => r.enabled).length} offered at checkout`
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-caption text-slate-400">
          Ordinary UPI payments go to your default UPI id above, and customers pay it from whichever
          app they already have — Google Pay, PhonePe, anything. You never need more than one id for
          that.
        </p>

        {!verificationAllowed && (
          <p className="text-caption text-warning-300">
            Token verification is no longer on your plan, so your checkout is back to ordinary UPI.
            Your apps are kept — switch this off to tidy the card, or ask us to restore it.
          </p>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={tokenVerification}
            // Still un-tickable when withdrawn: the server refuses it, and offering a switch that
            // cannot be turned on is worse than not offering one.
            disabled={!verificationAllowed && !tokenVerification}
            onChange={(e) => setTokenVerification(e.target.checked)}
          />
          <span>
            Verify payments by token
            <span className="mt-1 block text-caption text-slate-400">
              Adds a step at checkout: the customer picks which UPI app they&apos;ll pay from, gets a
              short token, and pays the id you hold with that app. You then look for that one token
              in that one account before marking the order paid. Leave this off unless you actually
              reconcile that way.
            </span>
          </span>
        </label>

        {tokenVerification && (
          <div className="space-y-3 border-t border-ink-700 pt-4">
            <p className="text-caption text-slate-400">
              The apps below are what the customer chooses from. Each one needs the UPI id you
              receive money at <em>in that app</em>, so the payment lands where you&apos;ll look for
              it.
            </p>

            {isLoading && <p className="text-caption text-slate-400">Loading…</p>}

            {rows.map((row, i) => (
              <div key={row.app} className="flex flex-wrap items-center gap-2">
                <span className="w-28 shrink-0 text-sm text-slate-300">
                  {UPI_APP_CHOICES.find((c) => c.app === row.app)?.label ?? row.app}
                </span>
                <Input
                  value={row.upiId}
                  placeholder="shopowner@okaxis"
                  className="min-w-[12rem] flex-1"
                  onChange={(e) =>
                    setRows((r) => r.map((x, j) => (j === i ? { ...x, upiId: e.target.value } : x)))
                  }
                />
                <label className="flex items-center gap-1.5 text-caption text-slate-400">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) =>
                      setRows((r) => r.map((x, j) => (j === i ? { ...x, enabled: e.target.checked } : x)))
                    }
                  />
                  Offer to customers
                </label>
                <button
                  type="button"
                  aria-label={`Remove ${row.app}`}
                  className="rounded p-1.5 text-slate-500 hover:text-danger-300"
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}

            {rows.length === 0 && !isLoading && (
              <p className="text-caption text-slate-400">
                No apps yet. Add at least one — the customer&apos;s first step is choosing from this
                list.
              </p>
            )}

            {unused.length > 0 && (
              <div className="flex items-center gap-2">
                {/* The shared Select, not a hand-rolled one. This was the only bare `<select>` in
                    the app, and it carried `bg-transparent`: with no background of its own the
                    control and its option list fall back to the browser's own canvas, which does
                    not flip with the theme the way `--ink-*` does, so light text landed on a light
                    popup and the choices could not be read in dark mode. */}
                <Select
                  value={addApp}
                  onChange={(e) => setAddApp(e.target.value as UpiApp | '')}
                  className="w-auto"
                >
                  <option value="">Add an app…</option>
                  {unused.map((c) => (
                    <option key={c.app} value={c.app}>
                      {c.pickerLabel ?? c.label}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!addApp}
                  onClick={() => {
                    if (!addApp) return;
                    setRows((r) => [...r, { app: addApp, upiId: '', enabled: true }]);
                    setAddApp('');
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        )}

        <Button type="submit" loading={mutation.isPending}>
          Save UPI settings
        </Button>
      </form>
    </SettingsSection>
  );
}

// ── WhatsApp ──────────────────────────────────────────────────────────
/**
 * Connection details show only while the integration is switched on — the same
 * rule the payments card follows. Turning it off leaves the stored credentials
 * alone; they are simply not asked about.
 */
function WhatsappCard({ store }: { store: StoreSettingsResponse }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [enabled, setEnabled] = useState(store.whatsappEnabled);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Opt-in, and off is a perfectly good answer — so folded either way rather than sitting open
  // asking to be configured on the settings page of every shop that will never use it.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEnabled(store.whatsappEnabled);
  }, [store]);

  const mutation = useMutation({
    mutationFn: (body: UpdateWhatsappSettingsRequest) => adminStore.updateWhatsapp(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('WhatsApp settings saved');
      setAccessToken('');
      setAppSecret('');
      setOpen(false);
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        if (e.hasFieldErrors()) setErrors(e.fieldErrorMap());
        toast.error('Could not save', e.message);
      } else {
        toast.error('Could not save');
      }
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    mutation.mutate({
      enabled,
      phoneNumberId: phoneNumberId.trim() || undefined,
      verifyToken: verifyToken.trim() || undefined,
      accessToken: accessToken.trim() || undefined,
      appSecret: appSecret.trim() || undefined,
    });
  }

  return (
    <SettingsSection
      icon={<MessageCircle className="h-4 w-4 text-emerald-400" />}
      title="WhatsApp"
      badge={
        <Badge tone={store.whatsappEnabled ? 'green' : 'gray'}>
          {store.whatsappEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      }
      summary={
        store.whatsappEnabled
          ? 'Order notifications are sent over WhatsApp'
          : 'Not sending WhatsApp notifications'
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable WhatsApp notifications
        </label>

        {enabled && (
          <>
            <Field label="Phone Number ID" error={errors.phoneNumberId}>
              <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
            </Field>
            <Field label="Verify Token" error={errors.verifyToken}>
              <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
            </Field>
            <Field
              label="Access Token"
              error={errors.accessToken}
              hint="Write-only — secrets are never returned. Leave blank to keep current."
            >
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="leave blank to keep current"
                autoComplete="new-password"
              />
            </Field>
            <Field
              label="App Secret"
              error={errors.appSecret}
              hint="Write-only. Leave blank to keep current."
            >
              <Input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="leave blank to keep current"
                autoComplete="new-password"
              />
            </Field>
          </>
        )}

        <Button type="submit" loading={mutation.isPending}>
          Save WhatsApp settings
        </Button>
      </form>
    </SettingsSection>
  );
}
