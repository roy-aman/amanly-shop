import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, QrCode, RefreshCw } from 'lucide-react';
import { mediaApi } from '@/api/media';
import { getPublicStore } from '@/api/store';
import { ApiError } from '@/lib/http';
import type { QrCodeParams } from '@/lib/types';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';

const SIZES = [256, 512, 1024, 2048];

interface FormState {
  useStoreHome: boolean;
  url: string;
  size: number;
  withCaption: boolean;
  title: string;
  subtitle: string;
}

const INITIAL_FORM: FormState = {
  useStoreHome: true,
  url: '',
  size: 512,
  withCaption: true,
  title: '',
  subtitle: '',
};

/**
 * Turns the form into request parameters, and the subtlety is all in the
 * caption: the API treats an omitted `title` as "use the default" and an empty
 * one as "leave that line out". Sending `''` for a blank input would therefore
 * strip the heading from every poster where the merchant simply did not type
 * one, so a blank field is sent as *absent* and only the caption switch sends
 * the empty string.
 */
function toParams(form: FormState): QrCodeParams {
  return {
    url: form.useStoreHome ? undefined : form.url.trim() || undefined,
    size: form.size,
    title: form.withCaption ? form.title.trim() || undefined : '',
    subtitle: form.withCaption ? form.subtitle.trim() || undefined : '',
  };
}

export default function StoreQrCode() {
  // Only for the placeholder text and the download filename — the code itself
  // is built server-side, so nothing here depends on this having loaded.
  const { data: store } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
    staleTime: 5 * 60_000,
  });
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  // What was last asked for, as opposed to what is currently typed. Keeping the
  // two apart stops the poster regenerating on every keystroke.
  const [params, setParams] = useState<QrCodeParams>(() => toParams(INITIAL_FORM));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const {
    data: poster,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'qr-code', params],
    queryFn: () => mediaApi.qrCode(params),
    // The code is derived from the store's current domain, so a cached one can
    // outlive the address it points at. Cheap to regenerate; do not hold it.
    staleTime: 0,
    retry: false,
  });

  const message =
    error instanceof ApiError ? error.message : error ? 'Could not generate the code.' : null;

  const fileName = `${store?.slug ?? 'store'}-qr-code.png`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store QR code"
        subtitle="A printable code for your window, counter or flyers. Anyone who scans it lands on your shop."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card className="space-y-5 p-5">
          <Field
            label="Where it goes"
            hint="Your home page is filled in for you — no need to know the address."
          >
            {/* Field renders its label without htmlFor, so the control is
                unlabelled to a screen reader unless it names itself. */}
            <Select
              aria-label="Where it goes"
              value={form.useStoreHome ? 'home' : 'custom'}
              onChange={(e) => set('useStoreHome', e.target.value === 'home')}
            >
              <option value="home">My shop's home page</option>
              <option value="custom">A specific page</option>
            </Select>
          </Field>

          {!form.useStoreHome && (
            <Field
              label="Page address"
              hint="Must start with http:// or https://"
              required
            >
              <Input
                aria-label="Page address"
                value={form.url}
                placeholder="https://example.com/products/kurta"
                onChange={(e) => set('url', e.target.value)}
              />
            </Field>
          )}

          <Field label="Size" hint="Bigger prints sharper. 1024 suits a poster, 512 a counter card.">
            <Select
              aria-label="Size"
              value={String(form.size)}
              onChange={(e) => set('size', Number(e.target.value))}
            >
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} × {size} px
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300"
              checked={form.withCaption}
              onChange={(e) => set('withCaption', e.target.checked)}
            />
            Print a message above the code
          </label>

          {form.withCaption && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Heading" hint="Leave blank to use the suggestion">
                <Input
                  value={form.title}
                  placeholder={`Welcome to ${store?.name ?? 'your shop'}`}
                  onChange={(e) => set('title', e.target.value)}
                />
              </Field>
              <Field label="Below it" hint="Leave blank to use the suggestion">
                <Input
                  value={form.subtitle}
                  placeholder="Scan to visit us online"
                  onChange={(e) => set('subtitle', e.target.value)}
                />
              </Field>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => setParams(toParams(form))} disabled={isFetching}>
              <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              {isFetching ? 'Generating…' : 'Generate'}
            </Button>
            {message && <p className="text-sm text-red-600">{message}</p>}
          </div>
        </Card>

        <Card className="flex flex-col items-center gap-4 p-5">
          {isFetching && !poster ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : poster ? (
            <>
              {/* The API returns the PNG inline precisely so this can be a plain
                  <img> and a plain download link — the endpoint needs a Bearer
                  token, so a URL here would 401. */}
              <img
                src={poster.dataUri}
                alt={`QR code linking to ${poster.url}`}
                className="w-full max-w-xs rounded border border-neutral-200 bg-white"
              />
              <p className="break-all text-center text-xs text-neutral-500">{poster.url}</p>
              <p className="text-xs text-neutral-400">
                {poster.widthPx} × {poster.heightPx} px
              </p>
              <a
                href={poster.dataUri}
                download={fileName}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <Download className="h-4 w-4" /> Download PNG
              </a>
            </>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-neutral-400">
              <QrCode className="h-10 w-10" />
              <p className="text-sm">Your code will appear here.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
