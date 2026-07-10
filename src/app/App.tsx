import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireRole } from '@/features/auth/RequireRole';
import { RoleRedirect } from '@/features/auth/RoleRedirect';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { AdminInvitePage } from '@/features/auth/AdminInvitePage';
import { TeamInvitePage } from '@/features/auth/TeamInvitePage';
import { TeamEmployeesPage } from '@/features/team/TeamEmployeesPage';
import { AdminHomePage } from '@/app/pages/AdminHomePage';
import { ManagerDashboardPage } from '@/app/pages/ManagerDashboardPage';
import { ProcurementHomePage } from '@/app/pages/ProcurementHomePage';
import { EmployeeTasksPage } from '@/app/pages/EmployeeTasksPage';
import { ForbiddenPage } from '@/app/pages/ForbiddenPage';
import { ProductListPage } from '@/features/products/ProductListPage';
import { ProductCreatePage } from '@/features/products/ProductCreatePage';
import { ProductHubPage } from '@/features/products/ProductHubPage';
import { ProductBomPage } from '@/features/products/ProductBomPage';
import { ProductFormEditorPage } from '@/features/products/ProductFormEditorPage';
import { InventoryPage } from '@/features/vendors/InventoryPage';
import { OrderListPage } from '@/features/procurement/OrderListPage';
import { OrderCreatePage } from '@/features/procurement/OrderCreatePage';
import { OrderDetailPage } from '@/features/procurement/OrderDetailPage';
import { ManagerAnalyticsPage } from '@/features/analytics/ManagerAnalyticsPage';
import { VendorDamageReportPage } from '@/features/analytics/VendorDamageReportPage';
import { SerialTracePage } from '@/features/traceability/SerialTracePage';
import { InstallPrompt } from '@/features/notifications/InstallPrompt';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';

function ManagerRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={['manager', 'senior_manager']}>{children}</RequireRole>
    </RequireAuth>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['admin']}>
                  <AdminHomePage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/admin/invite"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['admin']}>
                  <AdminInvitePage />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ManagerRoute>
                <ManagerDashboardPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ManagerRoute>
                <OrderListPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/orders/new"
            element={
              <ManagerRoute>
                <OrderCreatePage />
              </ManagerRoute>
            }
          />
          <Route
            path="/orders/:prId"
            element={
              <ManagerRoute>
                <OrderDetailPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ManagerRoute>
                <ProductListPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/new"
            element={
              <ManagerRoute>
                <ProductCreatePage />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/:productId"
            element={
              <ManagerRoute>
                <ProductHubPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/:productId/bom"
            element={
              <ManagerRoute>
                <ProductBomPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/:productId/assembly"
            element={
              <ManagerRoute>
                <ProductFormEditorPage formKind="assembly" />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/:productId/qc"
            element={
              <ManagerRoute>
                <ProductFormEditorPage formKind="qc" />
              </ManagerRoute>
            }
          />
          <Route
            path="/products/:productId/installation"
            element={
              <ManagerRoute>
                <ProductFormEditorPage formKind="installation" />
              </ManagerRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['manager', 'senior_manager', 'procurement']}>
                  <InventoryPage />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/team"
            element={
              <ManagerRoute>
                <TeamEmployeesPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/team/invite"
            element={
              <ManagerRoute>
                <TeamInvitePage />
              </ManagerRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ManagerRoute>
                <ManagerAnalyticsPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/reports/vendor-damage"
            element={
              <ManagerRoute>
                <VendorDamageReportPage />
              </ManagerRoute>
            }
          />
          <Route
            path="/trace"
            element={
              <ManagerRoute>
                <SerialTracePage />
              </ManagerRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/procurement"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['procurement']}>
                  <ProcurementHomePage />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/tasks"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['employee']}>
                  <EmployeeTasksPage />
                </RequireRole>
              </RequireAuth>
            }
          />

          <Route
            path="/forbidden"
            element={
              <RequireAuth>
                <ForbiddenPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <InstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}
