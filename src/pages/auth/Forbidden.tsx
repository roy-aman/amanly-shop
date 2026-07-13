import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { LinkButton } from '@/components/ui';
import AuthLayout from '@/components/layout/AuthLayout';

export default function Forbidden() {
  return (
    <AuthLayout
      title="Access denied"
      footer={
        <Link to="/admin/login" className="font-medium text-gold-400 hover:text-gold-300">
          Switch accounts
        </Link>
      }
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10">
          <ShieldAlert className="h-6 w-6 text-rose-400" />
        </div>
        <p className="text-sm text-slate-400">
          Your account doesn&apos;t have permission to view the admin console.
        </p>
      </div>
      <LinkButton to="/" fullWidth>
        Return to storefront
      </LinkButton>
    </AuthLayout>
  );
}
