import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import StoreLayout from '@/components/layout/StoreLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import PlatformLayout from '@/components/layout/PlatformLayout';
import { RequireAdmin, RequireAuth, RequirePlatformAdmin, RequireStaff } from '@/components/guards';
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
const JoinStore = lazy(() => import('@/pages/auth/JoinStore'));
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
const Wishlist = lazy(() => import('@/pages/store/Wishlist'));
const Addresses = lazy(() => import('@/pages/store/Addresses'));

// Services & bookings. Every route below is dead weight for a shop that only
// sells goods, which is exactly why they are lazy: the chunks are never fetched
// unless someone navigates to one, and nothing links to them when the store has
// bookings switched off.
const Services = lazy(() => import('@/pages/store/Services'));
const ServiceDetail = lazy(() => import('@/pages/store/ServiceDetail'));
const BookService = lazy(() => import('@/pages/store/BookService'));
const MyBookings = lazy(() => import('@/pages/store/MyBookings'));
const MyBookingDetail = lazy(() => import('@/pages/store/MyBookingDetail'));


// Admin console
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'));
const Deliverables = lazy(() => import('@/pages/admin/Deliverables'));
const Inventory = lazy(() => import('@/pages/admin/Inventory'));
const ProductImports = lazy(() => import('@/pages/admin/ProductImports'));
const ProductForm = lazy(() => import('@/pages/admin/ProductForm'));
const Categories = lazy(() => import('@/pages/admin/Categories'));
const Brands = lazy(() => import('@/pages/admin/Brands'));
const Banners = lazy(() => import('@/pages/admin/Banners'));
const AdminReviews = lazy(() => import('@/pages/admin/Reviews'));
const AdminCoupons = lazy(() => import('@/pages/admin/Coupons'));
const Reports = lazy(() => import('@/pages/admin/Reports'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminUserDetail = lazy(() => import('@/pages/admin/AdminUserDetail'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const StoreQrCode = lazy(() => import('@/pages/admin/StoreQrCode'));

// Bookings console. Only rendered for stores the platform has entitled, but the
// routes exist unconditionally: a merchant who is entitled mid-session should
// not need a reload, and every one of these screens states its own case when the
// server says the store has no such plan.
const AdminServices = lazy(() => import('@/pages/admin/AdminServices'));
const AdminServiceCategories = lazy(() => import('@/pages/admin/AdminServiceCategories'));
const AdminStaff = lazy(() => import('@/pages/admin/AdminStaff'));

// Platform console — only a PLATFORM_ADMIN ever loads these chunks.
const PlatformStores = lazy(() => import('@/pages/platform/PlatformStores'));
const PlatformStoreDetail = lazy(() => import('@/pages/platform/PlatformStoreDetail'));
const PlatformStoreMembers = lazy(() => import('@/pages/platform/PlatformStoreMembers'));
const PlatformOperators = lazy(() => import('@/pages/platform/PlatformOperators'));
const PlatformErrors = lazy(() => import('@/pages/platform/PlatformErrors'));

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
        <Route path="/join-store" element={<Page title="Finish joining" fallback={<AuthFormSkeleton />}><JoinStore /></Page>} />
        <Route path="/oauth2-callback" element={<Page title="Signing in" fallback={<AuthFormSkeleton />}><OAuthCallback /></Page>} />
        <Route path="/admin/login" element={<Page title="Platform sign in" fallback={<AuthFormSkeleton />}><AdminLogin /></Page>} />
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

          {/* Services. Browsing and choosing a time stay public: asking someone to
              sign in before they know whether you have a Thursday evening free is
              how a booking flow loses people. The wizard prompts at the last step
              and carries the chosen slot through the round trip. */}
          <Route path="/services" element={<Page fallback={<StoreListSkeleton />}><Services /></Page>} />
          <Route path="/services/:slug" element={<Page fallback={<ProductDetailSkeleton />}><ServiceDetail /></Page>} />
          <Route path="/book/:slug" element={<Page fallback={<FormSkeleton />}><BookService /></Page>} />

          {/* Customer area — requires any authenticated user */}
          <Route element={<RequireAuth />}>
            <Route path="/cart" element={<Page title="Cart" fallback={<ListSkeleton />}><Cart /></Page>} />
            <Route path="/checkout" element={<Page title="Checkout" fallback={<FormSkeleton />}><Checkout /></Page>} />
            <Route path="/orders" element={<Page title="My orders" fallback={<ListSkeleton />}><Orders /></Page>} />
            <Route path="/orders/:id" element={<Page fallback={<DetailSkeleton />}><OrderDetail /></Page>} />
            <Route path="/account" element={<Page title="Account" fallback={<FormSkeleton />}><Account /></Page>} />
            <Route path="/account/wishlist" element={<Page title="Wishlist" fallback={<StoreListSkeleton />}><Wishlist /></Page>} />
            <Route path="/account/addresses" element={<Page title="Addresses" fallback={<FormSkeleton />}><Addresses /></Page>} />
            <Route path="/account/bookings" element={<Page title="My bookings" fallback={<ListSkeleton />}><MyBookings /></Page>} />
            <Route path="/account/bookings/:id" element={<Page fallback={<DetailSkeleton />}><MyBookingDetail /></Page>} />
            {/* Name and password moved into the profile page. Kept as a redirect rather than
                deleted so an existing bookmark or emailed link lands somewhere useful. */}
            <Route path="/account/settings" element={<Navigate to="/account" replace />} />
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
            <Route path="coupons" element={<Page title="Coupons" fallback={<ListSkeleton />}><AdminCoupons /></Page>} />
            <Route path="inventory" element={<Page title="Inventory" fallback={<ListSkeleton />}><Inventory /></Page>} />
            <Route path="inventory/imports" element={<Page title="Import history" fallback={<ListSkeleton />}><ProductImports /></Page>} />
            <Route path="inventory/new" element={<Page fallback={<FormSkeleton />}><ProductForm /></Page>} />
            <Route path="inventory/:id" element={<Page fallback={<FormSkeleton />}><ProductForm /></Page>} />
            <Route path="categories" element={<Page title="Categories" fallback={<ListSkeleton />}><Categories /></Page>} />
            <Route path="brands" element={<Page title="Brands" fallback={<ListSkeleton />}><Brands /></Page>} />
            <Route path="banners" element={<Page title="Banners" fallback={<ListSkeleton />}><Banners /></Page>} />
            <Route path="reviews" element={<Page title="Reviews" fallback={<ListSkeleton />}><AdminReviews /></Page>} />
            <Route path="reports" element={<Page title="Reports" fallback={<DashboardSkeleton />}><Reports /></Page>} />
            {/* STAFF too, not ADMIN-only: the backend allows both, and printing
                a poster for the shop window is counter work. */}
            <Route path="qr-code" element={<Page title="Store QR code" fallback={<FormSkeleton />}><StoreQrCode /></Page>} />
            <Route path="services" element={<Page title="Services" fallback={<ListSkeleton action />}><AdminServices /></Page>} />
            <Route path="service-categories" element={<Page title="Service groups" fallback={<ListSkeleton action />}><AdminServiceCategories /></Page>} />
            <Route path="staff" element={<Page title="Team" fallback={<ListSkeleton action />}><AdminStaff /></Page>} />

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

        {/* Platform console — PLATFORM_ADMIN only. A sibling of /admin rather
            than a section inside it: an operator manages the OTHER stores and
            need not be a member of the one they signed in at. */}
        <Route path="/platform" element={<RequirePlatformAdmin />}>
          <Route element={<PlatformLayout />}>
            <Route index element={<Page title="Stores" fallback={<ListSkeleton />}><PlatformStores /></Page>} />
            <Route path="stores/:storeId" element={<Page fallback={<DetailSkeleton />}><PlatformStoreDetail /></Page>} />
            <Route path="stores/:storeId/members" element={<Page fallback={<ListSkeleton />}><PlatformStoreMembers /></Page>} />
            <Route path="operators" element={<Page title="Operators" fallback={<ListSkeleton />}><PlatformOperators /></Page>} />
            <Route path="errors" element={<Page title="Errors" fallback={<ListSkeleton />}><PlatformErrors /></Page>} />
            <Route path="*" element={<NotFound homeTo="/platform" homeLabel="Back to stores" />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
