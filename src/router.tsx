import { createBrowserRouter, Navigate } from 'react-router-dom'
import { page } from '@/lib/lazy-page'

// Layouts
import { PublicLayout } from '@/components/layouts/public-layout'

// Guards
import { AuthGuard, SetupGate } from '@/components/shared/auth-guard'
import { AdminGuard, SuperAdminGuard } from '@/components/shared/auth-guard'
import { HomeGuard } from '@/components/shared/home-guard'
import { CatalogShell } from '@/components/shared/catalog-shell'


// Public pages

// Client pages
import { ProductsPage } from '@/pages/products'

// Admin pages
import { RouteError } from '@/pages/route-error'

// Pages and layouts are downloaded when first opened; the visitor's first screens (product feed, sign-up) stay in the first download
const AuthPage = page(() => import('@/pages/auth'), 'AuthPage')
const ClientLayout = page(() => import('@/components/layouts/client-layout'), 'ClientLayout')
const MfaGate = page<{ enroll?: boolean; children?: React.ReactNode }>(() => import('@/components/shared/mfa-gate'), 'MfaGate')
const AdminLayout = page(() => import('@/components/layouts/admin-layout'), 'AdminLayout')
const SetupPage = page(() => import('@/pages/setup'), 'SetupPage')
const TermsPage = page(() => import('@/pages/legal'), 'TermsPage')
const PrivacyPage = page(() => import('@/pages/legal'), 'PrivacyPage')
const DashboardPage = page(() => import('@/pages/dashboard'), 'DashboardPage')
const SubmitPage = page(() => import('@/pages/submit'), 'SubmitPage')
const OrdersPage = page(() => import('@/pages/orders'), 'OrdersPage')
const ProductOrderDetailPage = page(() => import('@/pages/product-order-detail'), 'ProductOrderDetailPage')
const OrderDetailPage = page(() => import('@/pages/order-detail'), 'OrderDetailPage')
const ShipmentsPage = page(() => import('@/pages/shipments'), 'ShipmentsPage')
const ShipmentDetailPage = page(() => import('@/pages/shipment-detail'), 'ShipmentDetailPage')
const WalletPage = page(() => import('@/pages/wallet'), 'WalletPage')
const NotificationsPage = page(() => import('@/pages/notifications'), 'NotificationsPage')
const ProfilePage = page(() => import('@/pages/profile'), 'ProfilePage')
const SupportPage = page(() => import('@/pages/support'), 'SupportPage')
const ActivityLogPage = page(() => import('@/pages/activity-log'), 'ActivityLogPage')
const BillingPage = page(() => import('@/pages/billing'), 'BillingPage')
const WishlistPage = page(() => import('@/pages/wishlist'), 'WishlistPage')
const ResellerPage = page(() => import('@/pages/reseller'), 'ResellerPage')
const AdminResellersPage = page(() => import('@/pages/admin/resellers'), 'AdminResellersPage')
const AdminLabelsPage = page(() => import('@/pages/admin/labels'), 'AdminLabelsPage')
const AdminScanPage = page(() => import('@/pages/admin/scan'), 'AdminScanPage')
const SupportTicketPage = page(() => import('@/pages/support-ticket'), 'SupportTicketPage')
const ProductDetailPage = page(() => import('@/pages/product-detail'), 'ProductDetailPage')
const CartPage = page(() => import('@/pages/cart'), 'CartPage')
const CheckoutPage = page(() => import('@/pages/checkout'), 'CheckoutPage')
const PaymentReturnPage = page(() => import('@/pages/payment-return'), 'PaymentReturnPage')
const AdminDashboard = page(() => import('@/pages/admin/dashboard'), 'AdminDashboard')
const AdminOrdersPage = page(() => import('@/pages/admin/orders'), 'AdminOrdersPage')
const AdminSuppliersPage = page(() => import('@/pages/admin/suppliers'), 'AdminSuppliersPage')
const AdminQuotesPage = page(() => import('@/pages/admin/quotes'), 'AdminQuotesPage')
const AdminShipmentsPage = page(() => import('@/pages/admin/shipments'), 'AdminShipmentsPage')
const AdminPaymentsPage = page(() => import('@/pages/admin/payments'), 'AdminPaymentsPage')
const AdminUsersPage = page(() => import('@/pages/admin/users'), 'AdminUsersPage')
const AdminDisputesPage = page(() => import('@/pages/admin/disputes'), 'AdminDisputesPage')
const AdminSettingsPage = page(() => import('@/pages/admin/settings'), 'AdminSettingsPage')
const AdminProductOrdersPage = page(() => import('@/pages/admin/product-orders'), 'AdminProductOrdersPage')
const AdminDeliveryOptionsPage = page(() => import('@/pages/admin/delivery-options'), 'AdminDeliveryOptionsPage')
const AdminShippingConfigPage = page(() => import('@/pages/admin/shipping-config'), 'AdminShippingConfigPage')
const AdminShippingRequestsPage = page(() => import('@/pages/admin/shipping-requests'), 'AdminShippingRequestsPage')
const AdminProductsPage = page(() => import('@/pages/admin/products'), 'AdminProductsPage')
const AdminNotificationsPage = page(() => import('@/pages/admin/notifications'), 'AdminNotificationsPage')
const AdminAuditLogsPage = page(() => import('@/pages/admin/audit-logs'), 'AdminAuditLogsPage')
const AdminKycPage = page(() => import('@/pages/admin/kyc'), 'AdminKycPage')
const AdminPromosPage = page(() => import('@/pages/admin/promos'), 'AdminPromosPage')
const AdminAdsPage = page(() => import('@/pages/admin/ads'), 'AdminAdsPage')
const AdminInsightsPage = page(() => import('@/pages/admin/insights'), 'AdminInsightsPage')
const AdminErrorsPage = page(() => import('@/pages/admin/errors'), 'AdminErrorsPage')
const AdminReconciliationPage = page(() => import('@/pages/admin/reconciliation'), 'AdminReconciliationPage')

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

  // Public pages (home redirect + legal)
  {
    path: '/',
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      // no landing page: visitors go straight to the product feed, customers to their dashboard
      { index: true, element: <HomeGuard /> },
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

  // Catalogue: open to visitors (without prices), the full app for customers
  {
    path: '/',
    errorElement: <RouteError />,
    element: <CatalogShell />,
    children: [
      { path: 'products', element: <ProductsPage mode="retail" /> },
      { path: 'wholesale', element: <ProductsPage mode="wholesale" /> },
      { path: 'products/:id', element: <ProductDetailPage /> },
    ],
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
      { path: 'product-orders/:id', element: <ProductOrderDetailPage /> },
      { path: 'shipments', element: <ShipmentsPage /> },
      { path: 'shipments/:id', element: <ShipmentDetailPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'support', element: <SupportPage /> },
      { path: 'activity-log', element: <ActivityLogPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'wishlist', element: <WishlistPage /> },
      { path: 'reseller', element: <ResellerPage /> },
      { path: 'support/:id', element: <SupportTicketPage /> },
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
      { path: 'ads', element: <AdminAdsPage /> },
      { path: 'product-orders', element: <AdminProductOrdersPage /> },
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
