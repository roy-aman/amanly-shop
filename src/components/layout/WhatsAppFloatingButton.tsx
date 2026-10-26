import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, X } from 'lucide-react';
import { getPublicStore } from '@/api/store';

export function WhatsAppFloatingButton() {
  const { data: store } = useQuery({
    queryKey: ['public-store'],
    queryFn: getPublicStore,
  });

  const [dismissed, setDismissed] = useState(false);

  // If store doesn't have a configured WhatsApp number, don't show
  if (!store?.whatsappNumber || dismissed) {
    return null;
  }

  const cleanPhone = store.whatsappNumber.replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    return null;
  }
  const isCommerce = store.features?.includes('WHATSAPP_COMMERCE') ?? false;
  const message = encodeURIComponent(
    isCommerce
      ? `Hi ${store.name}! I would like to browse products and place an order on WhatsApp.`
      : `Hi ${store.name}! I would like to inquire about your products.`
  );
  const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 group">
      {/* Tooltip badge */}
      <div className="hidden sm:flex items-center gap-2 bg-ink-950/95 text-slate-100 text-xs px-3.5 py-2 rounded-full border border-emerald-500/30 shadow-lg shadow-ink-950/80 backdrop-blur-sm animate-fade-in">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-medium">Order on WhatsApp</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="text-slate-400 hover:text-slate-200 transition ml-1"
          aria-label="Dismiss WhatsApp badge"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Floating Action Button */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat and Order on WhatsApp"
        className="flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white shadow-xl shadow-emerald-950/50 hover:scale-105 active:scale-95 hover:shadow-emerald-500/25 border border-emerald-400/30 transition-all duration-200"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}