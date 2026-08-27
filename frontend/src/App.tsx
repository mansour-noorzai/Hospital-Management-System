import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from '@/store';
import { queryClient } from '@/lib/queryClient';
import { useAppSelector } from '@/store/hooks';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthInitializer } from '@/components/Auth/AuthInitializer';
import { RealtimeQuerySync } from '@/components/Auth/RealtimeQuerySync';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { PageErrorBoundary } from '@/components/Shared/PageErrorBoundary';

const SignIn = lazy(() => import('@/pages/public/SignIn').then((module) => ({ default: module.SignIn })));
const SignUp = lazy(() => import('@/pages/public/SignUp').then((module) => ({ default: module.SignUp })));
const ForgotPassword = lazy(() => import('@/pages/public/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('@/pages/public/ResetPassword').then((module) => ({ default: module.ResetPassword })));
const ChangePassword = lazy(() => import('@/pages/public/ChangePassword').then((module) => ({ default: module.ChangePassword })));
const Unauthorized = lazy(() => import('@/pages/public/Unauthorized').then((module) => ({ default: module.Unauthorized })));
const NotFound = lazy(() => import('@/pages/public/NotFound').then((module) => ({ default: module.NotFound })));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard').then((module) => ({ default: module.AdminDashboard })));
const AdminPatients = lazy(() => import('@/pages/admin/Patients').then((module) => ({ default: module.AdminPatients })));
const AdminStaff = lazy(() => import('@/pages/admin/Staff').then((module) => ({ default: module.AdminStaff })));
const AdminBilling = lazy(() => import('@/pages/admin/Billing').then((module) => ({ default: module.AdminBilling })));
const AdminAppointments = lazy(() => import('@/pages/admin/Appointments').then((module) => ({ default: module.AdminAppointments })));
const DoctorDashboard = lazy(() => import('@/pages/doctor/Dashboard').then((module) => ({ default: module.DoctorDashboard })));
const DoctorSchedule = lazy(() => import('@/pages/doctor/Schedule').then((module) => ({ default: module.DoctorSchedule })));
const NurseDashboard = lazy(() => import('@/pages/nurse/Dashboard').then((module) => ({ default: module.NurseDashboard })));
const ReceptionistDashboard = lazy(() => import('@/pages/receptionist/Dashboard').then((module) => ({ default: module.ReceptionistDashboard })));
const PatientDashboard = lazy(() => import('@/pages/patient/Dashboard').then((module) => ({ default: module.PatientDashboard })));
const BookAppointment = lazy(() => import('@/pages/patient/BookAppointment').then((module) => ({ default: module.BookAppointment })));
const PatientAppointments = lazy(() => import('@/pages/patient/Appointments').then((module) => ({ default: module.PatientAppointments })));
const PatientBilling = lazy(() => import('@/pages/patient/Billing').then((module) => ({ default: module.PatientBilling })));
const PatientInvoiceDetail = lazy(() => import('@/pages/patient/InvoiceDetail').then((module) => ({ default: module.PatientInvoiceDetail })));
const PatientLabResults = lazy(() => import('@/pages/patient/LabResults').then((module) => ({ default: module.PatientLabResults })));
const PatientLabResultDetail = lazy(() => import('@/pages/patient/LabResultDetail').then((module) => ({ default: module.PatientLabResultDetail })));
const DoctorLabOrders = lazy(() => import('@/pages/doctor/LabOrders').then((module) => ({ default: module.DoctorLabOrders })));
const AdminLabManagement = lazy(() => import('@/pages/admin/LabManagement').then((module) => ({ default: module.AdminLabManagement })));
const DoctorPrescriptions = lazy(() => import('@/pages/doctor/Prescriptions').then((module) => ({ default: module.DoctorPrescriptions })));
const NurseDispensingQueue = lazy(() => import('@/pages/nurse/DispensingQueue').then((module) => ({ default: module.NurseDispensingQueue })));
const PatientPrescriptions = lazy(() => import('@/pages/patient/Prescriptions').then((module) => ({ default: module.PatientPrescriptions })));
const AdminPharmacyManagement = lazy(() => import('@/pages/admin/PharmacyManagement').then((module) => ({ default: module.AdminPharmacyManagement })));
const AdminInventoryManagement = lazy(() => import('@/pages/admin/InventoryManagement').then((module) => ({ default: module.AdminInventoryManagement })));
const NurseInventoryView = lazy(() => import('@/pages/nurse/InventoryView').then((module) => ({ default: module.NurseInventoryView })));
const AdminDocumentManagement = lazy(() => import('@/pages/admin/DocumentManagement').then((module) => ({ default: module.AdminDocumentManagement })));
const DoctorDocuments = lazy(() => import('@/pages/doctor/Documents').then((module) => ({ default: module.DoctorDocuments })));
const PatientDocuments = lazy(() => import('@/pages/patient/Documents').then((module) => ({ default: module.PatientDocuments })));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics').then((module) => ({ default: module.AdminAnalytics })));
const AdminSettings = lazy(() => import('@/pages/admin/Settings').then((module) => ({ default: module.AdminSettings })));
const AdminUserManagement = lazy(() => import('@/pages/admin/UserManagement').then((module) => ({ default: module.AdminUserManagement })));
const AdminDepartments = lazy(() => import('@/pages/admin/Departments').then((module) => ({ default: module.AdminDepartments })));
const AdminRolesPermissions = lazy(() => import('@/pages/admin/RolesPermissions').then((module) => ({ default: module.AdminRolesPermissions })));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AuditLogs').then((module) => ({ default: module.AdminAuditLogs })));
const MyProfile = lazy(() => import('@/pages/shared/Profile').then((module) => ({ default: module.MyProfile })));

function DashboardRouter() {
  const user = useAppSelector(s => s.auth.user);

  if (!user) return <Navigate to="/sign-in" replace />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'doctor':
      return <Navigate to="/doctor/dashboard" replace />;
    case 'nurse':
      return <Navigate to="/nurse/dashboard" replace />;
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    case 'receptionist':
      return <Navigate to="/receptionist/dashboard" replace />;
    default:
      return <Navigate to="/sign-in" replace />;
  }
}

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <PreferencesProvider>
          <BrowserRouter>
            <AuthInitializer>
          <RealtimeQuerySync />
          <Suspense fallback={<RouteLoading />}>
          <Routes>
            {/* Public routes */}
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/profile" element={<Page route={<MyProfile />} />} />
              <Route path="/patients" element={<RolePage roles={['admin', 'doctor', 'nurse', 'receptionist']} route={<AdminPatients />} />} />

              <Route path="/admin/dashboard" element={<RolePage roles={['admin']} route={<AdminDashboard />} />} />
              <Route path="/admin/users" element={<RolePage roles={['admin']} route={<AdminUserManagement />} />} />
              <Route path="/admin/roles" element={<RolePage roles={['admin']} route={<AdminRolesPermissions />} />} />
              <Route path="/admin/audit-logs" element={<RolePage roles={['admin']} route={<AdminAuditLogs />} />} />
              <Route path="/admin/departments" element={<RolePage roles={['admin']} route={<AdminDepartments />} />} />
              <Route path="/admin/staff" element={<RolePage roles={['admin']} route={<AdminStaff />} />} />
              <Route path="/admin/appointments" element={<RolePage roles={['admin', 'receptionist']} route={<AdminAppointments />} />} />
              <Route path="/admin/billing" element={<RolePage roles={['admin', 'receptionist']} route={<AdminBilling />} />} />
              <Route path="/admin/billing/:id" element={<RolePage roles={['admin', 'receptionist']} route={<AdminBilling />} />} />
              <Route path="/admin/lab" element={<RolePage roles={['admin', 'nurse']} route={<AdminLabManagement />} />} />
              <Route path="/admin/lab/:id" element={<RolePage roles={['admin', 'nurse']} route={<AdminLabManagement />} />} />
              <Route path="/admin/pharmacy" element={<RolePage roles={['admin']} route={<AdminPharmacyManagement />} />} />
              <Route path="/admin/pharmacy/:id" element={<RolePage roles={['admin']} route={<AdminPharmacyManagement />} />} />
              <Route path="/admin/inventory" element={<RolePage roles={['admin']} route={<AdminInventoryManagement />} />} />
              <Route path="/admin/documents" element={<RolePage roles={['admin']} route={<AdminDocumentManagement />} />} />
              <Route path="/admin/documents/:id" element={<RolePage roles={['admin']} route={<AdminDocumentManagement />} />} />
              <Route path="/admin/analytics" element={<RolePage roles={['admin']} route={<AdminAnalytics />} />} />
              <Route path="/admin/settings" element={<RolePage roles={['admin']} route={<AdminSettings />} />} />
              <Route path="/admin/user-management" element={<Navigate to="/admin/users" replace />} />
              <Route path="/admin/patients" element={<Navigate to="/patients" replace />} />
              <Route path="/admin/hospital-settings" element={<Navigate to="/admin/settings" replace />} />

              <Route path="/doctor/dashboard" element={<RolePage roles={['doctor']} route={<DoctorDashboard />} />} />
              <Route path="/doctor/schedule" element={<RolePage roles={['doctor']} route={<DoctorSchedule />} />} />
              <Route path="/doctor/lab" element={<RolePage roles={['doctor']} route={<DoctorLabOrders />} />} />
              <Route path="/doctor/prescriptions" element={<RolePage roles={['doctor']} route={<DoctorPrescriptions />} />} />
              <Route path="/doctor/documents" element={<RolePage roles={['doctor']} route={<DoctorDocuments />} />} />

              <Route path="/receptionist/dashboard" element={<RolePage roles={['receptionist']} route={<ReceptionistDashboard />} />} />

              <Route path="/nurse/dashboard" element={<RolePage roles={['nurse']} route={<NurseDashboard />} />} />
              <Route path="/nurse/dispensing" element={<RolePage roles={['nurse']} route={<NurseDispensingQueue />} />} />
              <Route path="/nurse/inventory" element={<RolePage roles={['nurse']} route={<NurseInventoryView />} />} />

              <Route path="/patient/dashboard" element={<RolePage roles={['patient']} route={<PatientDashboard />} />} />
              <Route path="/patient/book-appointment" element={<RolePage roles={['patient']} route={<BookAppointment />} />} />
              <Route path="/patient/appointments" element={<RolePage roles={['patient']} route={<PatientAppointments />} />} />
              <Route path="/patient/billing" element={<RolePage roles={['patient']} route={<PatientBilling />} />} />
              <Route path="/patient/billing/:id" element={<RolePage roles={['patient']} route={<PatientInvoiceDetail />} />} />
              <Route path="/patient/lab" element={<RolePage roles={['patient']} route={<PatientLabResults />} />} />
              <Route path="/patient/lab/:id" element={<RolePage roles={['patient']} route={<PatientLabResultDetail />} />} />
              <Route path="/patient/prescriptions" element={<RolePage roles={['patient']} route={<PatientPrescriptions />} />} />
              <Route path="/patient/documents" element={<RolePage roles={['patient']} route={<PatientDocuments />} />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
            </AuthInitializer>
          </BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        </PreferencesProvider>
      </QueryClientProvider>
    </Provider>
  );
}

type AppRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient';

function RouteLoading() {
  return (
    <div className="grid min-h-[320px] place-items-center p-6" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        <span className="text-xs font-semibold text-muted-foreground">Loading workspace…</span>
      </div>
    </div>
  );
}

function Page({ route }: { route: React.ReactNode }) {
  return <PageErrorBoundary>{route}</PageErrorBoundary>;
}

function RolePage({ roles, route }: { roles: AppRole[]; route: React.ReactNode }) {
  return <ProtectedRoute allowedRoles={roles}><Page route={route} /></ProtectedRoute>;
}
