import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ImageOff, Link2, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { mediaApi } from '@/api/media';
import { ApiError } from '@/lib/http';
import type { GeneratePromptsRequest } from '@/lib/types';
import { Button, Field, ImageWithFallback, Input, cn } from '@/components/ui';
import { AiImageStudio, useAiQuota } from './AiImageStudio';

/**
 * Shared query for the store's upload entitlement and quota.
 *
 * Keyed so every instance of this control on a page shares one result — a
 * banner form with three image fields must not fire three identical requests.
 * Long `staleTime` because an entitlement is changed by a platform operator
 * roughly never, and re-fetching it per keystroke would be absurd.
 */
export function useUploadQuota() {
  return useQuery({
    queryKey: ['media', 'quota'],
    queryFn: () => mediaApi.quota(),
    staleTime: 5 * 60_000,
    // A store without the entitlement is a normal answer, not a failure; and if
    // the call itself breaks we fall back to URL-only rather than blocking the
    // form, so there is nothing worth retrying for.
    retry: false,
  });
}

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Square preview for tiles, wide for heroes and strips. */
  aspect?: 'square' | 'wide';
  className?: string;
  /**
   * Supplying this offers "Generate" alongside upload and paste. Omit it where
   * AI makes no sense — a banner's artwork is a designed campaign asset, not a
   * product photograph.
   */
  aiContext?: GeneratePromptsRequest;
  /** Categories get one representative image rather than six sides. */
  aiSingleImage?: boolean;
}

/**
 * One image: pick a file, or paste a URL.
 *
 * Both halves always exist, and that is deliberate. Uploading is a
 * platform-granted entitlement with a quota, so it can be switched off or run
 * out — and when it does, the merchant must still be able to point at an image
 * they host themselves rather than be stuck. Pasting is the floor; uploading is
 * the convenience on top. This is how Shopify's media fields behave too.
 *
 * The value handed back is always a URL string, so every caller stores exactly
 * what it stored before this control existed.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  aspect = 'wide',
  className,
  aiContext,
  aiSingleImage = false,
}: ImageUploadFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const quota = useUploadQuota();
  // Asked for unconditionally when a context is supplied so the button can be
  // hidden rather than offered and then refused.
  const aiQuota = useAiQuota();
  const canGenerate = !!aiContext && aiQuota.data?.allowed === true;

  const canUpload = quota.data?.allowed === true;
  const remaining = quota.data?.remaining ?? null;
  const outOfQuota = remaining !== null && remaining <= 0;

  const upload = useMutation({
    mutationFn: (file: File) => mediaApi.uploadImages([file]),
    onSuccess: (uploaded) => {
      setUploadError(null);
      // Single file in, single URL out — but read it defensively rather than
      // assuming, so a partial response surfaces as a message instead of
      // silently writing `undefined` into the form.
      const url = uploaded[0]?.url;
      if (url) onChange(url);
      else setUploadError('The upload succeeded but returned no URL.');
      void quota.refetch();
    },
    onError: (e: unknown) => {
      setUploadError(
        e instanceof ApiError ? e.message : 'Could not upload that image. Please try again.',
      );
    },
  });

  function pick(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    upload.mutate(file);
    // Clear the input so choosing the SAME file again still fires `change` —
    // otherwise a failed upload cannot be retried by re-picking the same photo.
    if (fileInput.current) fileInput.current.value = '';
  }

  return (
    <Field label={label} hint={hint} error={error ?? uploadError ?? undefined} required={required} className={className}>
      <div className="space-y-2">
        <div className="flex items-start gap-3">
          {/* Preview. Shows what is actually stored, so a bad paste is visible
              immediately rather than at the next storefront page load. */}
          <div
            className={cn(
              'relative shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900',
              aspect === 'square' ? 'h-20 w-20' : 'h-20 w-36',
            )}
          >
            {value ? (
              <ImageWithFallback src={value} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-600">
                <ImageOff className="h-5 w-5" />
              </div>
            )}
            {upload.isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="pl-9"
                placeholder="https://… or /path"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                invalid={!!error}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canUpload && (
                <>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => pick(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={upload.isPending}
                    disabled={outOfQuota}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Upload
                  </Button>
                </>
              )}
              {canGenerate && (
                <Button type="button" size="sm" variant="outline" onClick={() => setStudioOpen(true)}>
                  <Sparkles className="h-4 w-4" /> Generate
                </Button>
              )}
              {value && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
                  <X className="h-4 w-4" /> Clear
                </Button>
              )}
              <UploadAvailability allowed={canUpload} remaining={remaining} outOfQuota={outOfQuota} />
            </div>
          </div>
        </div>
      </div>

      {aiContext && (
        <AiImageStudio
          open={studioOpen}
          onClose={() => setStudioOpen(false)}
          context={aiContext}
          singleImage={aiSingleImage}
          onUse={(url) => onChange(url)}
        />
      )}
    </Field>
  );
}

/**
 * Says why the upload button is missing or disabled.
 *
 * Without this the control silently degrades to a text box and the merchant is
 * left wondering whether uploading is broken or simply not theirs to use.
 */
function UploadAvailability({
  allowed,
  remaining,
  outOfQuota,
}: {
  allowed: boolean;
  remaining: number | null;
  outOfQuota: boolean;
}) {
  if (!allowed) {
    return <span className="text-xs text-slate-500">Uploading is not enabled for this store — paste a URL.</span>;
  }
  if (outOfQuota) {
    return <span className="text-xs text-amber-400">Upload limit reached — paste a URL instead.</span>;
  }
  if (remaining !== null) {
    return <span className="text-xs text-slate-500">{remaining} upload{remaining === 1 ? '' : 's'} left</span>;
  }
  return null;
}
