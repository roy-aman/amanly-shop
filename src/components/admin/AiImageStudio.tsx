import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { aiImages } from '@/api/ai';
import { ApiError } from '@/lib/http';
import type { GeneratePromptsRequest, ImageView } from '@/lib/types';
import { Badge, Button, Card, ImageWithFallback, Modal, Spinner, Textarea, cn } from '@/components/ui';

const ALL_VIEWS: ImageView[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

const VIEW_LABEL: Record<ImageView, string> = {
  FRONT: 'Front',
  BACK: 'Back',
  LEFT: 'Left',
  RIGHT: 'Right',
  TOP: 'Top',
  BOTTOM: 'Bottom',
};

/** One row of the studio: a view, the words that will produce it, and how it went. */
interface Draft {
  key: string;
  view: ImageView | null;
  prompt: string;
  status: 'idle' | 'generating' | 'done' | 'failed';
  /**
   * Has this side ever been sent. Distinct from `status`, which goes back to
   * `generating` on a retry — this is what decides whether the side belongs to the
   * footer (never run) or to its own card (run at least once), and that must not
   * flip back while a retry is in flight.
   */
  started?: boolean;
  url?: string;
  error?: string;
  /** Already kept. Shown so a merchant collecting six sides can see their progress. */
  used?: boolean;
}

export function useAiQuota() {
  return useQuery({
    queryKey: ['media', 'ai-quota'],
    queryFn: () => aiImages.quota(),
    staleTime: 5 * 60_000,
    // Not being entitled is a normal answer, and a failure here must not block
    // the form — uploading and pasting still work.
    retry: false,
  });
}

interface AiImageStudioProps {
  open: boolean;
  onClose: () => void;
  /** What the prompts are drafted from. */
  context: GeneratePromptsRequest;
  /** Called with the URL of a generated image the merchant chose to keep. */
  onUse: (url: string, view: ImageView | null) => void;
  /** Categories get one representative image; only products have sides. */
  singleImage?: boolean;
  /**
   * Close after a merchant keeps an image. True for a field that holds ONE URL;
   * false where several are being collected, since closing after the first
   * would mean reopening and redrafting for every remaining side.
   */
  closeOnUse?: boolean;
}

/**
 * Draft prompts from the catalogue, edit them, generate, keep what works.
 *
 * The editing step is the whole design. Generating straight from a template
 * would make this a slot machine — the merchant would find out the prompt was
 * wrong only after paying for the picture. Here the expensive call always runs
 * on words somebody has read, which is also how Midjourney-style tools and
 * Shopify's own media generator work.
 */
export function AiImageStudio({
  open,
  onClose,
  context,
  onUse,
  singleImage = false,
  closeOnUse = true,
}: AiImageStudioProps) {
  const quota = useAiQuota();
  const [selectedViews, setSelectedViews] = useState<ImageView[]>(['FRONT']);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);

  // Reopening with a different product must not show the last one's prompts.
  useEffect(() => {
    if (!open) {
      setDrafts([]);
      setDraftError(null);
    }
  }, [open]);

  const remaining = quota.data?.remaining ?? null;
  const allowed = quota.data?.allowed === true;
  const secondsEach = quota.data?.approxSecondsPerImage ?? 10;

  const draft = useMutation({
    mutationFn: () =>
      aiImages.draftPrompts({
        ...context,
        views: singleImage ? undefined : selectedViews,
        forCategory: singleImage,
      }),
    onSuccess: (suggestions) => {
      setDraftError(null);
      setDrafts(
        suggestions.map((s, i) => ({
          key: s.view ?? `single-${i}`,
          view: s.view,
          prompt: s.prompt,
          status: 'idle',
        })),
      );
    },
    onError: (e: unknown) =>
      setDraftError(e instanceof ApiError ? e.message : 'Could not draft prompts.'),
  });

  function toggleView(view: ImageView) {
    setSelectedViews((current) =>
      current.includes(view) ? current.filter((v) => v !== view) : [...current, view],
    );
  }

  function patch(key: string, changes: Partial<Draft>) {
    setDrafts((current) => current.map((d) => (d.key === key ? { ...d, ...changes } : d)));
  }

  /**
   * Fires one request per draft and lets each settle on its own.
   *
   * Deliberately not a single call for all six: each takes about ten seconds, so
   * one request would run for a minute and be cut off in transit. Running them
   * separately also means a side that fails does not take the others with it —
   * hence `allSettled` rather than `all`.
   */
  async function generateAll(targets: Draft[]) {
    const runnable = targets.filter((d) => d.prompt.trim().length > 0);
    runnable.forEach((d) => patch(d.key, { status: 'generating', started: true, error: undefined }));

    await Promise.allSettled(
      runnable.map(async (d) => {
        try {
          // isBundle is deliberately absent: it belongs to the bundle flow, not to every
          // product photograph. The API treats it as optional and defaults it to false.
          //
          // productType is sent because the generation service asks what kind of thing it
          // is drawing. The category is the better answer where there is one; the product
          // name stands in otherwise. Omitting it is safe — the API substitutes a generic
          // value rather than failing — so this buys a better picture, not a working call.
          const result = await aiImages.generateImage({
            prompt: d.prompt.trim(),
            view: d.view,
            productType: context.categoryName || context.productName || undefined,
          });
          patch(d.key, { status: 'done', url: result.url });
        } catch (e) {
          patch(d.key, {
            status: 'failed',
            error: e instanceof ApiError ? e.message : 'Generation failed.',
          });
        }
      }),
    );
    void quota.refetch();
  }

  const busy = drafts.some((d) => d.status === 'generating');
  const outOfQuota = remaining !== null && remaining <= 0;

  /**
   * What the footer button acts on: the sides that have never produced an image.
   *
   * It stops the batch button re-running sides that already succeeded — each is a metered
   * ten-second call, so "generate" on a 5-of-6 set used to spend six generations to gain
   * one — and it decides whether the footer button is worth showing at all. Below two, it
   * would do exactly what the card's own button does, which is why "Generate" appeared
   * twice for a single side.
   */
  const ungenerated = drafts.filter((d) => !d.started);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate images with AI"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {/* Only where it does something the per-side buttons cannot: run the lot in
              one go. For a single side it was a second button with the same effect. */}
          {ungenerated.length > 1 && (
            <Button
              loading={busy}
              disabled={!allowed || outOfQuota}
              onClick={() => generateAll(ungenerated)}
            >
              <Sparkles className="h-4 w-4" />
              Generate all {ungenerated.length}
            </Button>
          )}
        </>
      }
    >
      {quota.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !allowed ? (
        <NotEntitled />
      ) : (
        <div className="space-y-5">
          {!singleImage && (
            <section>
              <p className="rc-label">Sides to generate</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALL_VIEWS.map((view) => {
                  const on = selectedViews.includes(view);
                  return (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleView(view)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm transition',
                        on
                          ? 'border-brand bg-brand/15 text-brand'
                          : 'border-ink-700 text-slate-400 hover:border-ink-600 hover:text-slate-200',
                      )}
                    >
                      {VIEW_LABEL[view]}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              loading={draft.isPending}
              disabled={!singleImage && selectedViews.length === 0}
              onClick={() => draft.mutate()}
            >
              <RefreshCw className="h-4 w-4" />
              {drafts.length > 0 ? 'Redraft prompts' : 'Draft prompts'}
            </Button>
            <QuotaNote remaining={remaining} count={singleImage ? 1 : selectedViews.length} secondsEach={secondsEach} />
          </div>

          {draftError && <p className="text-sm text-danger-400">{draftError}</p>}

          {drafts.length === 0 ? (
            <p className="text-sm text-slate-500">
              Draft prompts from this item's category, brand and name — then edit them before anything is
              generated.
            </p>
          ) : (
            /*
             * The list scrolls inside itself rather than growing the dialog.
             *
             * Selecting more sides added more cards, the dialog grew, and because it is
             * centred it grew UPWARDS too — carrying "Sides to generate" and "Redraft
             * prompts" above the top of the window. The whole overlay is what scrolls, so
             * the only control for choosing sides became unreachable exactly when there
             * was most reason to use it.
             *
             * The bound is the viewport minus this dialog's own chrome — title bar, the
             * two header rows, footer, padding — rather than a flat fraction of it. A
             * fraction still overflows on a short window, which is the case that broke in
             * the first place. The floor keeps the list usable if the window is shorter
             * than the chrome. The shared Modal, which six other pages depend on, is left
             * alone.
             */
            <div className="-mr-2 max-h-[max(14rem,calc(100vh-22rem))] space-y-4 overflow-y-auto pr-2">
              {drafts.map((d) => (
                <DraftRow
                  key={d.key}
                  draft={d}
                  disabled={outOfQuota}
                  onPromptChange={(prompt) => patch(d.key, { prompt })}
                  onRegenerate={() => generateAll([d])}
                  used={d.used}
                  onUse={() => {
                    if (!d.url) return;
                    onUse(d.url, d.view);
                    if (closeOnUse) onClose();
                    else patch(d.key, { used: true });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DraftRow({
  draft,
  disabled,
  used,
  onPromptChange,
  onRegenerate,
  onUse,
}: {
  draft: Draft;
  disabled: boolean;
  used?: boolean;
  onPromptChange: (prompt: string) => void;
  onRegenerate: () => void;
  onUse: () => void;
}) {
  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        {draft.view ? <Badge tone="gray">{VIEW_LABEL[draft.view]}</Badge> : <Badge tone="gray">Image</Badge>}
        {used ? (
          <Badge tone="green">Added</Badge>
        ) : (
          draft.status === 'done' && <Badge tone="gray">Generated</Badge>
        )}
        {draft.status === 'failed' && <Badge tone="red">Failed</Badge>}
      </div>

      <Textarea
        rows={3}
        aria-label={draft.view ? `Prompt for ${VIEW_LABEL[draft.view]}` : 'Prompt'}
        value={draft.prompt}
        onChange={(e) => onPromptChange(e.target.value)}
      />

      {draft.error && (
        <p className="flex items-start gap-2 text-sm text-danger-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {draft.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900">
          {draft.url ? (
            <ImageWithFallback src={draft.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-600">
              <Sparkles className="h-5 w-5" />
            </div>
          )}
          {draft.status === 'generating' && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
              <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Always present: one side at a time is the careful way to spend a metered
              generation, so this is the primary control and the footer is the shortcut. */}
          <Button
            size="sm"
            variant="outline"
            loading={draft.status === 'generating'}
            disabled={disabled || !draft.prompt.trim()}
            onClick={onRegenerate}
          >
            <Sparkles className="h-4 w-4" />
            {draft.status === 'failed' ? 'Try again' : draft.status === 'done' ? 'Regenerate' : 'Generate'}
          </Button>
          {draft.status === 'done' && (
            <Button size="sm" variant={used ? 'ghost' : 'primary'} onClick={onUse}>
              <Check className="h-4 w-4" /> {used ? 'Add again' : 'Use this'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Sets expectations before a long wait rather than after it. Ten seconds each is
 * measured, not guessed, and six views really is about a minute.
 */
function QuotaNote({
  remaining,
  count,
  secondsEach,
}: {
  remaining: number | null;
  count: number;
  secondsEach: number;
}) {
  const estimate = Math.max(count, 1) * secondsEach;
  return (
    <span className="text-xs text-slate-500">
      About {estimate}s for {count === 1 ? 'one image' : `${count} images`}
      {remaining !== null && ` · ${remaining} generation${remaining === 1 ? '' : 's'} left`}
    </span>
  );
}

function NotEntitled() {
  return (
    <div className="space-y-2 py-2">
      <p className="text-sm text-slate-300">AI image generation is not enabled for this store.</p>
      <p className="text-sm text-slate-500">
        Ask the platform team to switch it on. In the meantime you can still upload an image file or paste an
        image URL.
      </p>
    </div>
  );
}
