import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import StoreLayout from '@/components/layout/StoreLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import { RequireAdmin, RequireAuth, RequireStaff } from '@/components/guards';
import ScrollToTop from '@/components/ScrollToTop';
import NotFound from '@/pages/NotFound';
import { RouteTitle } from '@/lib/useDocumentTitle';
import {
  AuthFormSkeleton,
  DashboardSkeleton,
  DetailSkeleton,
  FormSkeleton,
  ListSkeleton,
  ProductDetailSkeleton,
  StoreListSkeleton,
} from '@/components/RouteSkeletons';

// ── Every page is code-split so each route ships its own chunk and the initial
//    storefront bundle stays lean (recharts/lucide-heavy admin pages, auth
//    screens, etc. download only when their route is entered). ──────────────

// Auth (each renders its own centered AuthLayout)
const Login = lazy(() => import('@/pages/auth/Login'));
const AdminLogin = lazy(() => import('@/pages/auth/AdminLogin'));
const Register = lazy(() => import('@/pages/auth/Register'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const OAuthCallback = lazy(() => import('@/pages/auth/OAuthCallback'));
const Forbidden = lazy(() => import('@/pages/auth/Forbidden'));

// Storefront
const Home = lazy(() => import('@/pages/store/Home'));
const Products = lazy(() => import('@/pages/store/Products'));
const ProductDetail = lazy(() => import('@/pages/store/ProductDetail'));
const Cart = lazy(() => import('@/pages/store/Cart'));
const Checkout = lazy(() => import('@/pages/store/Checkout'));
const Orders = lazy(() => import('@/pages/store/Orders'));
const OrderDetail = lazy(() => import('@/pages/store/OrderDetail'));
const Account = lazy(() => import('@/pages/store/Account'));
const Addresses = lazy(() => import('@/pages/store/Addresses'));
const AccountSettings = lazy(() => import('@/pages/store/AccountSettings'));

// Admin console
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'));
const Deliverables = lazy(() => import('@/pages/admin/Deliverables'));
const Inventory = lazy(() => import('@/pages/admin/Inventory'));
const ProductForm = lazy(() => import('@/pages/admin/ProductForm'));
const Categories = lazy(() => import('@/pages/admin/Categories'));
const Reports = lazy(() => import('@/pages/admin/Reports'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('@/pages/admin/AdminUserDetail'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

// Dev-only UI-kit showcase. `import.meta.env.DEV` is statically `false` in
// production builds, so Vite drops both this binding and the dynamic import —
// the KitchenSink chunk is never emitted into the prod bundle.
const KitchenSink = import.meta.env.DEV ? lazy(() => import('@/pages/dev/KitchenSink')) : null;

/**
 * Route element wrapper: sets an optional per-route document title and provides
 * the <Suspense> boundary whose fallback is a skeleton matched to the page type.
 * Dynamic pages (detail/edit screens) omit `title` and set their own document
 * title from loaded data via `useDocumentTitle`.
 */
function Page({ title, fallback, children }: { title?: string; fallback: ReactNode; children: ReactNode }) {
  return (
    <>
      {title !== undefined && <RouteTitle title={title} />}
      <Suspense fallback={fallback}>{children}</Suspense>
    </>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Standalone auth screens (each renders its own centered AuthLayout) */}
        <Route path="/login" element={<Page title="Sign in" fallback={<AuthFormSkeleton />}><Login /></Page>} />
        <Route path="/register" element={<Page title="Create account" fallback={<AuthFormSkeleton />}><Register /></Page>} />
        <Route path="/forgot-password" element={<Page title="Forgot password" fallback={<AuthFormSkeleton />}><ForgotPassword /></Page>} />
        <Route path="/reset-password" element={<Page title="Reset password" fallback={<AuthFormSkeleton />}><ResetPassword /></Page>} />
        <Route path="/verify-email" element={<Page title="Verify email" fallback={<AuthFormSkeleton />}><VerifyEmail /></Page>} />
        <Route path="/oauth2-callback" element={<Page title="Signing in" fallback={<AuthFormSkeleton />}><OAuthCallback /></Page>} />
        <Route path="/admin/login" element={<Page title="Admin sign in" fallback={<AuthFormSkeleton />}><AdminLogin /></Page>} />
        <Route path="/admin/forbidden" element={<Page title="Access denied" fallback={<AuthFormSkeleton />}><Forbidden /></Page>} />

        {/* Dev-only UI-kit showcase — never registered in production builds. */}
        {import.meta.env.DEV && KitchenSink && (
          <Route
            path="/dev/kitchen-sink"
            element={
              <Page title="Kitchen sink" fallback={<ListSkeleton />}>
                <KitchenSink />
              </Page>
            }
          />
        )}

        {/* Storefront */}
        <Route element={<StoreLayout />}>
          <Route index element={<Page title="" fallback={<StoreListSkeleton />}><Home /></Page>} />
          <Route path="/products" element={<Page title="Shop" fallback={<StoreListSkeleton />}><Products /></Page>} />
          <Route path="/products/:slug" element={<Page fallback={<ProductDetailSkeleton />}><ProductDetail /></Page>} />

          {/* Customer area — requires any authenticated user */}
          <Route element={<RequireAuth />}>
            <Route path="/cart" element={<Page title="Cart" fallback={<ListSkeleton />}><Cart /></Page>} />
            <Route path="/checkout" element={<Page title="Checkout" fallback={<FormSkeleton />}><Checkout /></Page>} />
            <Route path="/orders" element={<Page title="My orders" fallback={<ListSkeleton />}><Orders /></Page>} />
            <Route path="/orders/:id" element={<Page fallback={<DetailSkeleton />}><OrderDetail /></Page>} />
            <Route path="/account" element={<Page title="Account" fallback={<FormSkeleton />}><Account /></Page>} />
            <Route path="/account/addresses" element={<Page title="Addresses" fallback={<FormSkeleton />}><Addresses /></Page>} />
            <Route path="/account/settings" element={<Page title="Settings" fallback={<FormSkeleton />}><AccountSettings /></Page>} />
          </Route>

          {/* Storefront + global 404 fallback (renders inside StoreLayout chrome). */}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin console — STAFF or ADMIN. Suspense above the layout Outlet
            covers the lazy-loaded admin pages. */}
        <Route path="/admin" element={<RequireStaff />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Page title="Admin" fallback={<DashboardSkeleton />}><Dashboard /></Page>} />
            <Route path="orders" element={<Page title="Orders" fallback={<ListSkeleton />}><AdminOrders /></Page>} />
            <Route path="orders/:id" element={<Page fallback={<DetailSkeleton />}><AdminOrderDetail /></Page>} />
            <Route path="deliverables" element={<Page title="Deliverables" fallback={<ListSkeleton />}><Deliverables /></Page>} />
            <Route path="inventory" element={<Page title="Inventory" fallback={<ListSkeleton />}><Inventory /></Page>} />
            <Route path="inventory/new" element={<Page fallback={<FormSkeleton />}><ProductForm /></Page>} />
            <Route path="inventory/:id" element={<Page fallback={<FormSkeleton />}><ProductForm /></Page>} />
            <Route path="categories" element={<Page title="Categories" fallback={<ListSkeleton />}><Categories /></Page>} />
            <Route path="reports" element={<Page title="Reports" fallback={<DashboardSkeleton />}><Reports /></Page>} />

            {/* ADMIN-only sections */}
            <Route element={<RequireAdmin />}>
              <Route path="users" element={<Page title="Users" fallback={<ListSkeleton />}><AdminUsers /></Page>} />
              <Route path="users/:id" element={<Page fallback={<DetailSkeleton />}><AdminUserDetail /></Page>} />
              <Route path="settings" element={<Page title="Settings" fallback={<FormSkeleton />}><AdminSettings /></Page>} />
            </Route>

            {/* Admin 404 — renders inside AdminLayout chrome. */}
            <Route path="*" element={<NotFound homeTo="/admin" homeLabel="Back to dashboard" />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
