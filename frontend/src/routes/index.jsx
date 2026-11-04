import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout } from '@/layouts/PublicLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { CaregiverVerifiedRoute } from '@/components/common/CaregiverVerifiedRoute'
import { CUSTOMER_NAV, CAREGIVER_NAV, ADMIN_NAV, AMBULANCE_NAV } from '@/routes/nav'
import { PageLoader } from '@/components/common/States'

// Public Pages (Code-split lazy chunks)
const HomePage = lazy(() => import('@/pages/public/HomePage'))
const ServicesPage = lazy(() => import('@/pages/public/ServicesPage'))
const PublicBookCaregiverPage = lazy(() => import('@/pages/public/BookCaregiverPage'))
const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const LegalPage = lazy(() => import('@/pages/public/LegalPage'))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage'))

// Auth Pages (Code-split lazy chunks)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const RegisterCustomerPage = lazy(() => import('@/pages/auth/RegisterCustomerPage'))
const RegisterCaregiverPage = lazy(() => import('@/pages/auth/RegisterCaregiverPage'))
const RegisterAmbulancePage = lazy(() => import('@/pages/auth/RegisterAmbulancePage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const VerifyOtpPage = lazy(() => import('@/pages/auth/VerifyOtpPage'))

// Customer Pages (Code-split lazy chunks)
const CustomerDashboard = lazy(() => import('@/pages/customer/DashboardPage'))
const BookCaregiverPage = lazy(() => import('@/pages/customer/BookCaregiverPage'))
const CustomerBookings = lazy(() => import('@/pages/customer/BookingsPage'))
const CustomerBookingDetails = lazy(() => import('@/pages/customer/BookingDetailsPage'))
const CustomerCaregivers = lazy(() => import('@/pages/customer/CaregiversPage'))
const AcceptedCaregiversPage = lazy(() => import('@/pages/customer/AcceptedCaregiversPage'))
const CustomerPayments = lazy(() => import('@/pages/customer/PaymentsPage'))
const CustomerInvoices = lazy(() => import('@/pages/customer/InvoicesPage'))
const CustomerMessages = lazy(() => import('@/pages/customer/MessagesPage'))
const CustomerComplaints = lazy(() => import('@/pages/customer/ComplaintsPage'))
const CustomerReviewsPage = lazy(() => import('@/pages/customer/ReviewsPage'))
const CustomerProfile = lazy(() => import('@/pages/customer/ProfilePage'))
const CustomerAmbulancesPage = lazy(() => import('@/pages/customer/AmbulancesPage'))

// Caregiver Pages (Code-split lazy chunks)
const CaregiverDashboard = lazy(() => import('@/pages/caregiver/DashboardPage'))
const JobsPage = lazy(() => import('@/pages/caregiver/JobsPage'))
const JobDetailsPage = lazy(() => import('@/pages/caregiver/JobDetailsPage'))
const CaregiverBookings = lazy(() => import('@/pages/caregiver/BookingsPage'))
const EarningsPage = lazy(() => import('@/pages/caregiver/EarningsPage'))
const ReviewsPage = lazy(() => import('@/pages/caregiver/ReviewsPage'))
const CaregiverMessages = lazy(() => import('@/pages/caregiver/MessagesPage'))
const DocumentsPage = lazy(() => import('@/pages/caregiver/DocumentsPage'))
const CaregiverProfile = lazy(() => import('@/pages/caregiver/ProfilePage'))
const CaregiverAmbulancesPage = lazy(() => import('@/pages/caregiver/AmbulancesPage'))

// Admin Pages (Code-split lazy chunks)
const AdminDashboard = lazy(() => import('@/pages/admin/DashboardPage'))
const CustomersPage = lazy(() => import('@/pages/admin/CustomersPage'))
const AdminCaregivers = lazy(() => import('@/pages/admin/CaregiversPage'))
const NursingStudentsPage = lazy(() => import('@/pages/admin/NursingStudentsPage'))
const HospitalsPage = lazy(() => import('@/pages/admin/HospitalsPage'))
const VerificationsPage = lazy(() => import('@/pages/admin/VerificationsPage'))
const AdminBookings = lazy(() => import('@/pages/admin/BookingsPage'))
const AdminPayments = lazy(() => import('@/pages/admin/PaymentsPage'))
const CommissionsPage = lazy(() => import('@/pages/admin/CommissionsPage'))
const PayoutsPage = lazy(() => import('@/pages/admin/PayoutsPage'))
const AdminInvoices = lazy(() => import('@/pages/admin/InvoicesPage'))
const AdminComplaints = lazy(() => import('@/pages/admin/ComplaintsPage'))
const BlacklistPage = lazy(() => import('@/pages/admin/BlacklistPage'))
const RatingsPage = lazy(() => import('@/pages/admin/RatingsPage'))
const ReportsPage = lazy(() => import('@/pages/admin/ReportsPage'))
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'))
const AdminAmbulancesPage = lazy(() => import('@/pages/admin/AmbulancesPage'))

// Ambulance Pages (Code-split lazy chunks)
const AmbulanceDashboardPage = lazy(() => import('@/pages/ambulance/DashboardPage'))
const AmbulanceProfilePage = lazy(() => import('@/pages/ambulance/ProfilePage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/book-caregiver" element={<PublicBookCaregiverPage />} />
          <Route path="/caregivers" element={<Navigate to="/book-caregiver" replace />} />
          <Route path="/caregivers/:id" element={<Navigate to="/book-caregiver" replace />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/legal/:doc" element={<LegalPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<LoginPage adminOnly />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/customer" element={<RegisterCustomerPage />} />
          <Route path="/register/caregiver" element={<RegisterCaregiverPage />} />
          <Route path="/register/ambulance" element={<RegisterAmbulancePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />
        </Route>

        <Route
          path="/customer"
          element={
            <ProtectedRoute roles={['customer']}>
              <DashboardLayout nav={CUSTOMER_NAV} variant="customer" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/customer/dashboard" replace />} />
          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="book-caregiver" element={<BookCaregiverPage />} />
          <Route path="bookings" element={<CustomerBookings />} />
          <Route path="bookings/:id" element={<CustomerBookingDetails />} />
          <Route path="accepted-caretakers" element={<AcceptedCaregiversPage />} />
          <Route path="caregivers" element={<AcceptedCaregiversPage />} />
          <Route path="payments" element={<CustomerPayments />} />
          <Route path="invoices" element={<CustomerInvoices />} />
          <Route path="messages" element={<CustomerMessages />} />
          <Route path="complaints" element={<CustomerComplaints />} />
          <Route path="reviews" element={<CustomerReviewsPage />} />
          <Route path="ambulances" element={<CustomerAmbulancesPage />} />
          <Route path="profile" element={<CustomerProfile />} />
        </Route>

        <Route
          path="/caregiver"
          element={
            <ProtectedRoute roles={['caregiver']}>
              <DashboardLayout nav={CAREGIVER_NAV} variant="caregiver" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/caregiver/dashboard" replace />} />
          <Route path="dashboard" element={<CaregiverDashboard />} />
          <Route path="documents" element={<DocumentsPage />} />

          {/* Sections locked until Admin approves caregiver verification */}
          <Route
            path="jobs"
            element={
              <CaregiverVerifiedRoute>
                <JobsPage />
              </CaregiverVerifiedRoute>
            }
          />
          <Route
            path="jobs/:id"
            element={
              <CaregiverVerifiedRoute>
                <JobDetailsPage />
              </CaregiverVerifiedRoute>
            }
          />
          <Route
            path="bookings"
            element={
              <CaregiverVerifiedRoute>
                <CaregiverBookings />
              </CaregiverVerifiedRoute>
            }
          />
          <Route
            path="bookings/:id"
            element={
              <CaregiverVerifiedRoute>
                <JobDetailsPage />
              </CaregiverVerifiedRoute>
            }
          />
          <Route path="schedule" element={<Navigate to="/caregiver/bookings" replace />} />
          <Route
            path="earnings"
            element={
              <CaregiverVerifiedRoute>
                <EarningsPage />
              </CaregiverVerifiedRoute>
            }
          />
          <Route
            path="reviews"
            element={
              <CaregiverVerifiedRoute>
                <ReviewsPage />
              </CaregiverVerifiedRoute>
            }
          />
          <Route
            path="messages"
            element={
              <CaregiverVerifiedRoute>
                <CaregiverMessages />
              </CaregiverVerifiedRoute>
            }
          />
          <Route path="ambulances" element={<CaregiverAmbulancesPage />} />
          <Route path="profile" element={<CaregiverProfile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <DashboardLayout nav={ADMIN_NAV} variant="admin" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="caregivers" element={<AdminCaregivers />} />
          <Route path="ambulances" element={<AdminAmbulancesPage />} />
          <Route path="nursing-students" element={<NursingStudentsPage />} />
          <Route path="hospitals" element={<HospitalsPage />} />
          <Route path="verifications" element={<VerificationsPage />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="commissions" element={<CommissionsPage />} />
          <Route path="payouts" element={<PayoutsPage />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="complaints/:id" element={<AdminComplaints />} />
          <Route path="sos-alerts" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="fraud-alerts" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="blacklist" element={<BlacklistPage />} />
          <Route path="ratings" element={<RatingsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/ambulance"
          element={
            <ProtectedRoute roles={['ambulance']}>
              <DashboardLayout nav={AMBULANCE_NAV} variant="ambulance" />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/ambulance/dashboard" replace />} />
          <Route path="dashboard" element={<AmbulanceDashboardPage />} />
          <Route path="profile" element={<AmbulanceProfilePage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
