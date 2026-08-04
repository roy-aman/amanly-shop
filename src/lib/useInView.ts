import { useLayoutEffect, useRef, useState } from 'react';

/** What `useInView` reports, mapped straight onto the `data-reveal` attribute. */
export type RevealState = 'pending' | 'in' | undefined;

/**
 * Reveals an element once it scrolls into view. Pair with the `rc-reveal`
 * class: `<section ref={ref} className="rc-reveal" data-reveal={state}>`.
 *
 * Fails VISIBLE, which is the whole design of this hook. The naive version —
 * base CSS of `opacity: 0`, flipped by an observer — means any environment
 * where the callback doesn't run (no IntersectionObserver, a crawler, a
 * scripting error earlier in the tree) renders a blank page. So nothing is
 * hidden until this hook has confirmed, before paint, that it can observe:
 * no attribute → no `opacity: 0` rule → content shows.
 *
 * Hand-rolled rather than pulling in an animation library — the requirement is
 * "fade sections up once", which IntersectionObserver does at no bundle cost.
 *
 * Reveals once and disconnects; re-animating on every scroll-back gets tiring.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T>,
  RevealState,
] {
  const ref = useRef<T>(null);
  const [state, setState] = useState<RevealState>(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Hide before first paint, so the element never flashes in and then out.
    setState('pending');

    // Second safety net. An observer always delivers one callback per observed
    // element, intersecting or not — so the first callback proves it is alive
    // and we can trust it for the rest of the page. If nothing arrives at all,
    // something is wrong with the environment and hidden content would never
    // come back: reveal it rather than lose it.
    let alive = false;
    const failsafe = window.setTimeout(() => {
      if (!alive) setState('in');
    }, 1500);

    const observer = new IntersectionObserver(
      (entries) => {
        alive = true;
        window.clearTimeout(failsafe);
        if (entries.some((e) => e.isIntersecting)) {
          setState('in');
          observer.disconnect();
        }
      },
      // A small negative bottom margin so a section has finished animating by
      // the time it is properly on screen — but not so large that a section
      // already on screen at load fails to trigger.
      { rootMargin: '0px 0px -5% 0px', threshold: 0 },
    );
    observer.observe(el);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, []);

  return [ref, state];
}
