import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AmanlyMark, Card, Wordmark } from '@/components/ui';
import { useDarkTheme } from '@/lib/useDarkTheme';
import { BRAND_TAGLINE } from '@/lib/brand';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * `admin` holds the dark console palette. Storefront auth pages pass nothing
   * and follow whatever the shopper chose — signing in should not change the
   * appearance of the site you were just browsing.
   */
  theme?: 'store' | 'admin';
}

/**
 * Shared centred auth shell — brand wordmark over a max-w-md card holding the
 * page's form. Reused by every auth page, including the separate admin sign-in,
 * which passes `theme="admin"` to stay on the console palette.
 */
export default function AuthLayout({ title, subtitle, children, footer, theme = 'store' }: AuthLayoutProps) {
  useDarkTheme(theme === 'admin');

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* The stacked lockup from the brand sheet: mark, name, rule-and-line. */}
        <Link to="/" className="mb-8 flex flex-col items-center text-center">
          <AmanlyMark className="mb-3 h-10 w-10 text-slate-100" />
          <Wordmark size="xl" />
          <span className="mt-2.5 text-caption uppercase tracking-[0.14em] text-slate-500">
            {theme === 'admin' ? 'Admin console' : BRAND_TAGLINE}
          </span>
        </Link>

        <Card className="p-6 sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-h3 text-slate-100">{title}</h1>
            {subtitle && <p className="mt-1.5 text-body-sm text-slate-400">{subtitle}</p>}
          </div>
          {children}
        </Card>

        {footer && <div className="mt-6 text-center text-body-sm text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}
