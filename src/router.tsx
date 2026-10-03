import { createBrowserRouter, Navigate } from 'react-router-dom'

// Layouts
import { PublicLayout } from '@/components/layouts/public-layout'
import { ClientLayout } from '@/components/layouts/client-layout'
import { AdminLayout } from '@/components/layouts/admin-layout'

// Guards
import { AuthGuard } from '@/components/shared/auth-guard'
import { AdminGuard } from '@/components/shared/auth-guard'
import { HomeGuard } from '@/components/shared/home-guard'

// Auth
import { AuthPage } from '@/pages/auth'

// Public pages
import { HomePage } from '@/pages/home'
import { TermsPage, PrivacyPage } from '@/pages/legal'

// Client pages
import { DashboardPage } from '@/pages/dashboard'
import { SubmitPage } from '@/pages/submit'
import { OrdersPage } from '@/pages/orders'
import { OrderDetailPage } from '@/pages/order-detail'
import { ShipmentsPage } from '@/pages/shipments'
import { ShipmentDetailPage } from '@/pages/shipment-detail'
import { WalletPage } from '@/pages/wallet'
import { NotificationsPage } from '@/pages/notifications'
import { ProfilePage } from '@/pages/profile'
import { SupportPage } from '@/pages/support'
import { ActivityLogPage } from '@/pages/activity-log'
import { BillingPage } from '@/pages/billing'
import { ProductsPage } from '@/pages/products'
import { ProductDetailPage } from '@/pages/product-detail'
import { CartPage } from '@/pages/cart'
import { CheckoutPage } from '@/pages/checkout'
import { PaymentReturnPage } from '@/pages/payment-return'

// Admin pages
import { AdminDashboard } from '@/pages/admin/dashboard'
import { AdminOrdersPage } from '@/pages/admin/orders'
import { AdminSuppliersPage } from '@/pages/admin/suppliers'
import { AdminQuotesPage } from '@/pages/admin/quotes'
import { AdminShipmentsPage } from '@/pages/admin/shipments'
import { AdminPaymentsPage } from '@/pages/admin/payments'
import { AdminUsersPage } from '@/pages/admin/users'
import { AdminDisputesPage } from '@/pages/admin/disputes'
import { AdminSettingsPage } from '@/pages/admin/settings'
import { AdminShippingConfigPage } from '@/pages/admin/shipping-config'
import { AdminShippingRequestsPage } from '@/pages/admin/shipping-requests'
import { AdminProductsPage } from '@/pages/admin/products'
import { AdminNotificationsPage } from '@/pages/admin/notifications'

export const router = createBrowserRouter([
  // Payment return — public (MonCash/NatCash redirect callback)
  { path: '/payment/return', element: <PaymentReturnPage /> },

  // Auth page (login, register, forgot, otp, reset, denied)
  {
    path: '/auth',
    element: (
      <AuthGuard requireAuth={false}>
        <AuthPage />
      </AuthGuard>
    ),
  },

  // Legacy routes → auth
  { path: '/login',    element: <Navigate to="/auth" replace /> },
  { path: '/register', element: <Navigate to="/auth" replace /> },

  // Public marketing routes (landing page + sub-pages)
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomeGuard><HomePage /></HomeGuard> },
      { path: 'how-it-works', element: <HomePage /> },
      { path: 'prices', element: <HomePage /> },
      { path: 'faq', element: <HomePage /> },
      { path: 'contact', element: <HomePage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
    ],
  },

  // Client routes (authenticated)
  {
    path: '/',
    element: (
      <AuthGuard>
        <ClientLayout />
      </AuthGuard>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'submit', element: <SubmitPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'shipments', element: <ShipmentsPage /> },
      { path: 'shipments/:id', element: <ShipmentDetailPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'activity-log', element: <ActivityLogPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
    ],
  },

  // Admin routes (authenticated + admin role)
  {
    path: '/admin',
    element: (
      <AuthGuard>
        <AdminGuard>
          <AdminLayout />
        </AdminGuard>
      </AuthGuard>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'quotes', element: <AdminQuotesPage /> },
      { path: 'suppliers', element: <AdminSuppliersPage /> },
      { path: 'shipments', element: <AdminShipmentsPage /> },
      { path: 'payments', element: <AdminPaymentsPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'disputes', element: <AdminDisputesPage /> },
      { path: 'analytics', element: <AdminDashboard /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'shipping-config', element: <AdminShippingConfigPage /> },
      { path: 'shipping-requests', element: <AdminShippingRequestsPage /> },
      { path: 'notifications', element: <AdminNotificationsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
    ],
  },

  // Catch-all: send to onboarding if not done, otherwise home
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
