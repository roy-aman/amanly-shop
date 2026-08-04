import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { Card } from '@/components/ui';
import { useDarkTheme } from '@/lib/useDarkTheme';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `admin` keeps the dark console palette; storefront auth pages are light. */
  theme?: 'store' | 'admin';
}

/**
 * Shared centered auth shell — ambient dark background, a Crown-branded
 * "Royal Commerce" header, and a max-w-md card holding the page's form.
 * Reused across every auth page for visual consistency.
 */
export default function AuthLayout({ title, subtitle, children, footer, theme = 'store' }: AuthLayoutProps) {
  useDarkTheme(theme === 'admin');

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/10 shadow-glow">
            <Crown className="h-6 w-6 text-gold-400" />
          </div>
          <span className="font-display text-lg font-semibold tracking-wide text-slate-100">Royal Commerce</span>
        </Link>

        <Card className="p-6 shadow-lift sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="text-h3 text-slate-100">{title}</h1>
            {subtitle && <p className="mt-1 text-body-sm text-slate-400">{subtitle}</p>}
          </div>
          {children}
        </Card>

        {footer && <div className="mt-5 text-center text-body-sm text-slate-400">{footer}</div>}
      </div>
    </div>
  );
}
