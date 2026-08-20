import { ArrowLeft, ArrowRight, ImageOff, Star, Trash2 } from 'lucide-react';

import type { ServiceImageRequest } from '@/lib/types';
import { Button, Input, cn } from '@/components/ui';
import { ImageUploadField } from '@/components/admin/ImageUploadField';

const MAX_IMAGES = 12;

/**
 * A service's pictures, in the order customers will see them.
 *
 * The first one is the thumbnail — the picture that stands for the service in the
 * menu, in the booking summary and in the confirmation email. That is said on the
 * tile rather than in a caption somewhere, because "first" is not obviously
 * meaningful until something tells you it is, and there is no separate "primary"
 * flag to set: a flag and an order can disagree, and then something has to decide
 * which wins.
 *
 * Reordering is arrows rather than drag and drop. Dragging is nicer with a mouse
 * and unusable with a keyboard or on a phone, and this list is rarely longer than
 * four.
 */
export function ServiceGalleryEditor({
  value,
  onChange,
  serviceName,
  categoryName,
}: {
  value: ServiceImageRequest[];
  onChange: (next: ServiceImageRequest[]) => void;
  /** Only to draft a better AI prompt. */
  serviceName: string;
  categoryName?: string | null;
}) {
  const move = (index: number, by: number) => {
    const next = [...value];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const setAlt = (index: number, altText: string) =>
    onChange(value.map((image, i) => (i === index ? { ...image, altText } : image)));

  const add = (url: string) => {
    if (!url.trim() || value.length >= MAX_IMAGES) return;
    onChange([...value, { url: url.trim(), altText: '' }]);
  };

  return (
    <div className="space-y-4">
      {value.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 py-3 text-body-sm text-slate-400">
          <ImageOff className="h-4 w-4 shrink-0" aria-hidden />
          No pictures yet. The first one you add becomes the thumbnail.
        </p>
      ) : (
        <ul className="space-y-3">
          {value.map((image, index) => (
            <li
              key={`${image.url}-${index}`}
              className={cn(
                'flex flex-wrap items-start gap-4 rounded-xl border px-3 py-3',
                index === 0 ? 'border-primary/40 bg-primary/5' : 'border-ink-700',
              )}
            >
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </div>

              <div className="min-w-[12rem] flex-1">
                {index === 0 && (
                  <p className="mb-1.5 inline-flex items-center gap-1 text-caption text-primary">
                    <Star className="h-3 w-3" aria-hidden /> Thumbnail — shown wherever one picture fits
                  </p>
                )}
                <Input
                  aria-label={`Description of picture ${index + 1}`}
                  value={image.altText ?? ''}
                  onChange={(e) => setAlt(index, e.target.value)}
                  placeholder="Describe what is shown"
                  maxLength={300}
                />
                <p className="mt-1 truncate text-caption text-slate-600">{image.url}</p>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move picture ${index + 1} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move picture ${index + 1} later`}
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove picture ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-danger-400" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {value.length < MAX_IMAGES ? (
        // The upload control hands back a URL and is then cleared, so it always
        // reads as "add another" rather than as the field holding the last one.
        <ImageUploadField
          label={value.length === 0 ? 'Add a picture' : 'Add another'}
          value=""
          onChange={add}
          aiSingleImage
          aiContext={{
            subject: 'CATEGORY',
            categoryName: [serviceName, categoryName].filter(Boolean).join(' — ') || null,
            forCategory: true,
          }}
        />
      ) : (
        <p className="text-caption text-slate-500">That is the most pictures one service can have.</p>
      )}
    </div>
  );
}
