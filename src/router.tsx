import { createBrowserRouter, Navigate } from 'react-router-dom'

// Layouts
import { PublicLayout } from '@/components/layouts/public-layout'
import { ClientLayout } from '@/components/layouts/client-layout'
import { MfaGate } from '@/components/shared/mfa-gate'
import { AdminLayout } from '@/components/layouts/admin-layout'

// Guards
import { SetupPage } from '@/pages/setup'
import { AuthGuard, SetupGate } from '@/components/shared/auth-guard'
import { AdminGuard, SuperAdminGuard } from '@/components/shared/auth-guard'
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
import { WishlistPage } from '@/pages/wishlist'
import { ResellerPage } from '@/pages/reseller'
import { AdminResellersPage } from '@/pages/admin/resellers'
import { AdminLabelsPage } from '@/pages/admin/labels'
import { AdminScanPage } from '@/pages/admin/scan'
import { SupportTicketPage } from '@/pages/support-ticket'
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
import { AdminDeliveryOptionsPage } from '@/pages/admin/delivery-options'
import { AdminShippingConfigPage } from '@/pages/admin/shipping-config'
import { AdminShippingRequestsPage } from '@/pages/admin/shipping-requests'
import { AdminProductsPage } from '@/pages/admin/products'
import { AdminNotificationsPage } from '@/pages/admin/notifications'
import { AdminAuditLogsPage } from '@/pages/admin/audit-logs'
import { AdminKycPage } from '@/pages/admin/kyc'
import { AdminPromosPage } from '@/pages/admin/promos'
import { AdminInsightsPage } from '@/pages/admin/insights'
import { RouteError } from '@/pages/route-error'
import { AdminErrorsPage } from '@/pages/admin/errors'
import { AdminReconciliationPage } from '@/pages/admin/reconciliation'

export const router = createBrowserRouter([
  // Payment return — public (MonCash/NatCash redirect callback)
  { path: '/payment/return', element: <PaymentReturnPage />, errorElement: <RouteError /> },

  // Auth page (login, register, forgot, otp, reset, denied)
  {
    path: '/auth',
    errorElement: <RouteError />,
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
    errorElement: <RouteError />,
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

  // Account setup (authenticated clients, once)
  {
    path: '/setup',
    errorElement: <RouteError />,
    element: (
      <AuthGuard>
        <MfaGate enroll={false}><SetupPage /></MfaGate>
      </AuthGuard>
    ),
  },

  // Client routes (authenticated)
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <AuthGuard>
        <MfaGate enroll={false}><SetupGate><ClientLayout /></SetupGate></MfaGate>
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
      { path: 'wishlist', element: <WishlistPage /> },
      { path: 'reseller', element: <ResellerPage /> },
      { path: 'support/:id', element: <SupportTicketPage /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
    ],
  },

  // Admin routes (authenticated + admin role)
  {
    path: '/admin',
    errorElement: <RouteError />,
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
      { path: 'delivery-options', element: <AdminDeliveryOptionsPage /> },
      { path: 'shipping-config', element: <AdminShippingConfigPage /> },
      { path: 'shipping-requests', element: <AdminShippingRequestsPage /> },
      { path: 'notifications', element: <AdminNotificationsPage /> },
      { path: 'insights', element: <AdminInsightsPage /> },
      { path: 'errors', element: <SuperAdminGuard><AdminErrorsPage /></SuperAdminGuard> },
      { path: 'audit-logs', element: <SuperAdminGuard><AdminAuditLogsPage /></SuperAdminGuard> },
      { path: 'kyc', element: <AdminKycPage /> },
      { path: 'resellers', element: <AdminResellersPage /> },
      { path: 'labels/:id', element: <AdminLabelsPage /> },
      { path: 'scan', element: <AdminScanPage /> },
      { path: 'promos', element: <SuperAdminGuard><AdminPromosPage /></SuperAdminGuard> },
      { path: 'reconciliation', element: <SuperAdminGuard><AdminReconciliationPage /></SuperAdminGuard> },
      { path: 'settings', element: <SuperAdminGuard><AdminSettingsPage /></SuperAdminGuard> },
    ],
  },

  // Catch-all: send to onboarding if not done, otherwise home
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
