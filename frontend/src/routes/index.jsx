import { Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout } from '@/layouts/PublicLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { CaregiverVerifiedRoute } from '@/components/common/CaregiverVerifiedRoute'
import { CUSTOMER_NAV, CAREGIVER_NAV, ADMIN_NAV, AMBULANCE_NAV } from '@/routes/nav'

import { HomePage } from '@/pages/public/HomePage'
import { ServicesPage } from '@/pages/public/ServicesPage'
import { BookCaregiverPage as PublicBookCaregiverPage } from '@/pages/public/BookCaregiverPage'
import { CaregiversPage } from '@/pages/public/CaregiversPage'
import { CaregiverDetailsPage } from '@/pages/public/CaregiverDetailsPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { LegalPage } from '@/pages/public/LegalPage'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { RegisterCustomerPage } from '@/pages/auth/RegisterCustomerPage'
import { RegisterCaregiverPage } from '@/pages/auth/RegisterCaregiverPage'
import { RegisterAmbulancePage } from '@/pages/auth/RegisterAmbulancePage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { VerifyOtpPage } from '@/pages/auth/VerifyOtpPage'

import { DashboardPage as CustomerDashboard } from '@/pages/customer/DashboardPage'
import { BookCaregiverPage } from '@/pages/customer/BookCaregiverPage'
import { BookingsPage as CustomerBookings } from '@/pages/customer/BookingsPage'
import { BookingDetailsPage as CustomerBookingDetails } from '@/pages/customer/BookingDetailsPage'
import { CaregiversPage as CustomerCaregivers } from '@/pages/customer/CaregiversPage'
import { AcceptedCaregiversPage } from '@/pages/customer/AcceptedCaregiversPage'
import { PaymentsPage as CustomerPayments } from '@/pages/customer/PaymentsPage'
import { InvoicesPage as CustomerInvoices } from '@/pages/customer/InvoicesPage'
import { MessagesPage as CustomerMessages } from '@/pages/customer/MessagesPage'
import { ComplaintsPage as CustomerComplaints } from '@/pages/customer/ComplaintsPage'
import { ReviewsPage as CustomerReviewsPage } from '@/pages/customer/ReviewsPage'
import { ProfilePage as CustomerProfile } from '@/pages/customer/ProfilePage'
import { CustomerAmbulancesPage } from '@/pages/customer/AmbulancesPage'

import { DashboardPage as CaregiverDashboard } from '@/pages/caregiver/DashboardPage'
import { JobsPage } from '@/pages/caregiver/JobsPage'
import { JobDetailsPage } from '@/pages/caregiver/JobDetailsPage'
import { BookingsPage as CaregiverBookings } from '@/pages/caregiver/BookingsPage'
import { EarningsPage } from '@/pages/caregiver/EarningsPage'
import { ReviewsPage } from '@/pages/caregiver/ReviewsPage'
import { MessagesPage as CaregiverMessages } from '@/pages/caregiver/MessagesPage'
import { DocumentsPage } from '@/pages/caregiver/DocumentsPage'
import { ProfilePage as CaregiverProfile } from '@/pages/caregiver/ProfilePage'
import { CaregiverAmbulancesPage } from '@/pages/caregiver/AmbulancesPage'

import { DashboardPage as AdminDashboard } from '@/pages/admin/DashboardPage'
import { CustomersPage } from '@/pages/admin/CustomersPage'
import { CaregiversPage as AdminCaregivers } from '@/pages/admin/CaregiversPage'
import { NursingStudentsPage } from '@/pages/admin/NursingStudentsPage'
import { HospitalsPage } from '@/pages/admin/HospitalsPage'
import { VerificationsPage } from '@/pages/admin/VerificationsPage'
import { BookingsPage as AdminBookings } from '@/pages/admin/BookingsPage'
import { PaymentsPage as AdminPayments } from '@/pages/admin/PaymentsPage'
import { CommissionsPage } from '@/pages/admin/CommissionsPage'
import { PayoutsPage } from '@/pages/admin/PayoutsPage'
import { InvoicesPage as AdminInvoices } from '@/pages/admin/InvoicesPage'
import { ComplaintsPage as AdminComplaints } from '@/pages/admin/ComplaintsPage'
import { BlacklistPage } from '@/pages/admin/BlacklistPage'
import { RatingsPage } from '@/pages/admin/RatingsPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { AdminAmbulancesPage } from '@/pages/admin/AmbulancesPage'

import { AmbulanceDashboardPage } from '@/pages/ambulance/DashboardPage'
import { AmbulanceProfilePage } from '@/pages/ambulance/ProfilePage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/book-caregiver" element={<PublicBookCaregiverPage />} />
        <Route path="/caregivers" element={<CaregiversPage />} />
        <Route path="/caregivers/:id" element={<CaregiverDetailsPage />} />
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
  )
}

export default AppRoutes
