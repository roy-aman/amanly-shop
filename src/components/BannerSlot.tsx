import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { listBanners } from '@/api/banners';
import type { BannerPlacement, BannerResponse } from '@/lib/types';
import { Carousel, cn } from '@/components/ui';

/**
 * Renders whatever the merchant has booked for one storefront slot.
 *
 * Renders NOTHING when there is nothing live — no heading, no empty state, no
 * reserved space. A merchandising slot with no campaign in it is not a missing
 * feature, and a storefront that says "no banners" looks broken in a way that
 * an absent banner does not.
 *
 * The backend has already filtered by schedule and switched-off state and
 * sorted the result, so there is no client-side date arithmetic here — which
 * also means a banner cannot appear early because a shopper's clock is wrong.
 */
export function BannerSlot({
  placement,
  className,
  variant = 'inline',
}: {
  placement: BannerPlacement;
  className?: string;
  /**
   * `hero` is the top-of-page treatment: edge to edge, square corners, taller,
   * and advancing on its own. `inline` is the boxed card that sits between
   * sections. Only the presentation differs — the same booked banners render
   * either way, so moving the slot never changes what a merchant has to set up.
   */
  variant?: 'inline' | 'hero';
}) {
  const { data } = useQuery({
    queryKey: ['banners', placement],
    queryFn: () => listBanners(placement),
    staleTime: 60_000,
    // A storefront must not fail because merchandising did. No banner is a
    // perfectly good page; an error boundary over the hero is not.
    retry: false,
  });

  const banners = data ?? [];
  if (banners.length === 0) return null;

  if (placement === 'HOME_STRIP') {
    return (
      <div className={className}>
        {banners.map((banner) => (
          <AnnouncementStrip key={banner.id} banner={banner} />
        ))}
      </div>
    );
  }

  if (banners.length === 1) {
    return (
      <div className={className}>
        <BannerImage banner={banners[0]} placement={placement} variant={variant} />
      </div>
    );
  }

  return (
    <div className={className}>
      <Carousel
        loop
        ariaLabel="Promotions"
        rounded={variant !== 'hero'}
        // Long enough to read a headline and decide, which is what the slide is
        // for. Faster reads as a slideshow demo; slower and the second banner a
        // merchant paid for is never seen above the fold.
        autoPlayMs={variant === 'hero' ? 6000 : undefined}
      >
        {banners.map((banner) => (
          <BannerImage key={banner.id} banner={banner} placement={placement} variant={variant} />
        ))}
      </Carousel>
    </div>
  );
}

/**
 * A slim line of type. No image at all — a strip is an announcement, and
 * flattening "free delivery over ₹999" into a picture makes it unreadable on a
 * narrow screen and invisible to a screen reader.
 */
function AnnouncementStrip({ banner }: { banner: BannerResponse }) {
  const content = (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2.5 text-center text-sm">
      {banner.headline && <span className="font-medium text-slate-100">{banner.headline}</span>}
      {banner.subtext && <span className="text-slate-400">{banner.subtext}</span>}
      {banner.linkUrl && banner.ctaLabel && (
        <span className="inline-flex items-center gap-1 text-brand">
          {banner.ctaLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
    </div>
  );

  return (
    <div className="border-b border-ink-700 bg-ink-850">
      {banner.linkUrl ? <BannerLink to={banner.linkUrl}>{content}</BannerLink> : content}
    </div>
  );
}

function BannerImage({
  banner,
  placement,
  variant,
}: {
  banner: BannerResponse;
  placement: BannerPlacement;
  variant: 'inline' | 'hero';
}) {
  const hasText = !!(banner.headline || banner.subtext || banner.ctaLabel);
  const isHero = variant === 'hero';

  const inner = (
    <div
      className={cn(
        'relative overflow-hidden bg-ink-850',
        !isHero && 'rounded-2xl',
        isHero
          ? 'aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]'
          : placement === 'HOME_HERO'
            ? 'aspect-[16/9] sm:aspect-[21/9]'
            : 'aspect-[21/6]',
      )}
    >
      {/* <picture> rather than two <img>s: the browser picks the phone crop
          before it starts downloading, so a mobile visitor never pays for the
          desktop hero. Falls back to the single image when no crop was set. */}
      <picture>
        {banner.mobileImageUrl && <source media="(max-width: 640px)" srcSet={banner.mobileImageUrl} />}
        <img
          src={banner.imageUrl}
          // Empty alt when the banner carries its own visible words: the text
          // below is real text a screen reader already reads, and repeating it
          // as an image description says everything twice.
          alt={hasText ? '' : (banner.altText ?? '')}
          className="h-full w-full object-cover"
          // The top banner is the largest thing above the fold and the one image
          // the page is measured on, so it is fetched immediately rather than
          // lazily — lazy-loading your own LCP element delays it by a round trip.
          loading={isHero ? 'eager' : 'lazy'}
        />
      </picture>

      {hasText && (
        <>
          <span
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950/80 via-ink-950/40 to-transparent"
            aria-hidden
          />
          <div
            className={cn(
              'absolute inset-0 flex flex-col justify-center gap-2 p-6 sm:p-10',
              // Full-bleed, so the copy is held to the same column as the rest of
              // the page instead of running to the edge of a wide monitor.
              isHero ? 'mx-auto max-w-7xl md:pl-8 lg:pl-12' : 'md:max-w-lg',
            )}
          >
            {banner.headline && (
              <h2
                className={cn(
                  'font-display text-slate-50',
                  isHero ? 'max-w-xl text-h1 sm:text-display' : 'text-h2 sm:text-h1',
                )}
              >
                {banner.headline}
              </h2>
            )}
            {banner.subtext && <p className="text-sm text-slate-300 sm:text-base">{banner.subtext}</p>}
            {banner.ctaLabel && (
              <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-ink-950">
                {banner.ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );

  return banner.linkUrl ? <BannerLink to={banner.linkUrl}>{inner}</BannerLink> : inner;
}

/**
 * A banner link may point inside the shop or at a campaign microsite, and the
 * two need different elements — a react-router <Link> to an external URL builds
 * a nonsense in-app route rather than leaving the site.
 */
function BannerLink({ to, children }: { to: string; children: React.ReactNode }) {
  const isExternal = /^https?:\/\//i.test(to);
  if (isExternal) {
    // noopener/noreferrer: the target is merchant-supplied and must not get a
    // handle on this window via `window.opener`.
    return (
      <a href={to} target="_blank" rel="noopener noreferrer" className="block">
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className="block">
      {children}
    </Link>
  );
}
