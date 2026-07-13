import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import StoreLayout from '@/components/layout/StoreLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import { RequireAdmin, RequireAuth, RequireStaff } from '@/components/guards';
import { EmptyState, LinkButton, PageLoader } from '@/components/ui';

// Auth
import Login from '@/pages/auth/Login';
import AdminLogin from '@/pages/auth/AdminLogin';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import VerifyEmail from '@/pages/auth/VerifyEmail';
import OAuthCallback from '@/pages/auth/OAuthCallback';
import Forbidden from '@/pages/auth/Forbidden';

// Storefront
import Home from '@/pages/store/Home';
import Products from '@/pages/store/Products';
import ProductDetail from '@/pages/store/ProductDetail';
import Cart from '@/pages/store/Cart';
import Checkout from '@/pages/store/Checkout';
import Orders from '@/pages/store/Orders';
import OrderDetail from '@/pages/store/OrderDetail';
import Account from '@/pages/store/Account';
import Addresses from '@/pages/store/Addresses';
import AccountSettings from '@/pages/store/AccountSettings';

// Admin — lazy-loaded so the storefront bundle stays lean (recharts etc. only
// download when a staff/admin user actually opens the console).
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

function NotFound() {
  return (
    <div className="py-16">
      <EmptyState
        title="Page not found"
        message="The page you're looking for doesn't exist or has moved."
        action={<LinkButton to="/">Back to home</LinkButton>}
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Standalone auth screens (each renders its own centered AuthLayout) */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/oauth2-callback" element={<OAuthCallback />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/forbidden" element={<Forbidden />} />

      {/* Storefront */}
      <Route element={<StoreLayout />}>
        <Route index element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetail />} />

        {/* Customer area — requires any authenticated user */}
        <Route element={<RequireAuth />}>
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/account" element={<Account />} />
          <Route path="/account/addresses" element={<Addresses />} />
          <Route path="/account/settings" element={<AccountSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Admin console — STAFF or ADMIN. Suspense above the layout Outlet
          covers the lazy-loaded admin pages. */}
      <Route path="/admin" element={<RequireStaff />}>
        <Route
          element={
            <Suspense fallback={<PageLoader />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="deliverables" element={<Deliverables />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/new" element={<ProductForm />} />
          <Route path="inventory/:id" element={<ProductForm />} />
          <Route path="categories" element={<Categories />} />
          <Route path="reports" element={<Reports />} />

          {/* ADMIN-only sections */}
          <Route element={<RequireAdmin />}>
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
