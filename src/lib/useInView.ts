import { useEffect, useRef, useState } from 'react';

/**
 * Reveals an element once it scrolls into view. Pair with the `rc-reveal`
 * class: `<section ref={ref} className="rc-reveal" data-inview={shown}>`.
 *
 * Deliberately hand-rolled rather than pulling in an animation library — the
 * whole requirement is "fade sections up once", and IntersectionObserver does
 * that in ~20 lines with no bundle cost.
 *
 * Reveals once and disconnects: re-animating on every scroll-back is the kind
 * of motion that gets tiring fast. Elements already in view on first paint are
 * revealed immediately, so above-the-fold content never waits on an observer.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(): [
  React.RefObject<T>,
  boolean,
] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer (older browsers, jsdom in tests): show the content rather
    // than leaving it invisible forever. Failing open is the only safe default.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      // Fire slightly before the element's edge reaches the viewport so the
      // section has finished animating by the time it is properly on screen.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}
