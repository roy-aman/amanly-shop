import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/context/ThemeContext';
import { StoreGate, StoreProvider } from '@/context/StoreContext';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ToastProvider } from '@/context/ToastContext';
import { TooltipProvider } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Outermost of the app providers: it owns the `dark` class on <html>,
            which every surface below (including portalled dialogs and toasts)
            reads through CSS variables. */}
        <ThemeProvider>
          {/* Above the app providers because which store this is decides what all of them are
              about, and because the "no store here" screen must be able to replace the app
              wholesale. Below ThemeProvider so that screen is themed like everything else. */}
          <StoreProvider>
            <ToastProvider>
              <AuthProvider>
                <CartProvider>
                  <WishlistProvider>
                    <TooltipProvider>
                      <ErrorBoundary>
                        <StoreGate>
                          <App />
                        </StoreGate>
                      </ErrorBoundary>
                    </TooltipProvider>
                  </WishlistProvider>
                </CartProvider>
              </AuthProvider>
            </ToastProvider>
          </StoreProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
