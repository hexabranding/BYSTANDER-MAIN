import { Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout } from '@/layouts/PublicLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { CUSTOMER_NAV, CAREGIVER_NAV, ADMIN_NAV } from '@/routes/nav'

import { HomePage } from '@/pages/public/HomePage'
import { ServicesPage } from '@/pages/public/ServicesPage'
import { CaregiversPage } from '@/pages/public/CaregiversPage'
import { CaregiverDetailsPage } from '@/pages/public/CaregiverDetailsPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { NotFoundPage } from '@/pages/public/NotFoundPage'

import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { RegisterCustomerPage } from '@/pages/auth/RegisterCustomerPage'
import { RegisterCaregiverPage } from '@/pages/auth/RegisterCaregiverPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { VerifyOtpPage } from '@/pages/auth/VerifyOtpPage'

import { DashboardPage as CustomerDashboard } from '@/pages/customer/DashboardPage'
import { BookCaregiverPage } from '@/pages/customer/BookCaregiverPage'
import { BookingsPage as CustomerBookings } from '@/pages/customer/BookingsPage'
import { BookingDetailsPage as CustomerBookingDetails } from '@/pages/customer/BookingDetailsPage'
import { CaregiversPage as CustomerCaregivers } from '@/pages/customer/CaregiversPage'
import { PaymentsPage as CustomerPayments } from '@/pages/customer/PaymentsPage'
import { InvoicesPage as CustomerInvoices } from '@/pages/customer/InvoicesPage'
import { MessagesPage as CustomerMessages } from '@/pages/customer/MessagesPage'
import { ComplaintsPage as CustomerComplaints } from '@/pages/customer/ComplaintsPage'
import { ProfilePage as CustomerProfile } from '@/pages/customer/ProfilePage'

import { DashboardPage as CaregiverDashboard } from '@/pages/caregiver/DashboardPage'
import { JobsPage } from '@/pages/caregiver/JobsPage'
import { JobDetailsPage } from '@/pages/caregiver/JobDetailsPage'
import { BookingsPage as CaregiverBookings } from '@/pages/caregiver/BookingsPage'
import { SchedulePage } from '@/pages/caregiver/SchedulePage'
import { EarningsPage } from '@/pages/caregiver/EarningsPage'
import { ReviewsPage } from '@/pages/caregiver/ReviewsPage'
import { MessagesPage as CaregiverMessages } from '@/pages/caregiver/MessagesPage'
import { DocumentsPage } from '@/pages/caregiver/DocumentsPage'
import { ProfilePage as CaregiverProfile } from '@/pages/caregiver/ProfilePage'

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
import { SosAlertsPage } from '@/pages/admin/SosAlertsPage'
import { FraudAlertsPage } from '@/pages/admin/FraudAlertsPage'
import { BlacklistPage } from '@/pages/admin/BlacklistPage'
import { RatingsPage } from '@/pages/admin/RatingsPage'
import { ReportsPage } from '@/pages/admin/ReportsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/caregivers" element={<CaregiversPage />} />
        <Route path="/caregivers/:id" element={<CaregiverDetailsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/customer" element={<RegisterCustomerPage />} />
        <Route path="/register/caregiver" element={<RegisterCaregiverPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
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
        <Route path="caregivers" element={<CustomerCaregivers />} />
        <Route path="payments" element={<CustomerPayments />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="messages" element={<CustomerMessages />} />
        <Route path="complaints" element={<CustomerComplaints />} />
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
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:id" element={<JobDetailsPage />} />
        <Route path="bookings" element={<CaregiverBookings />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="earnings" element={<EarningsPage />} />
        <Route path="reviews" element={<ReviewsPage />} />
        <Route path="messages" element={<CaregiverMessages />} />
        <Route path="documents" element={<DocumentsPage />} />
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
        <Route path="sos-alerts" element={<SosAlertsPage />} />
        <Route path="fraud-alerts" element={<FraudAlertsPage />} />
        <Route path="blacklist" element={<BlacklistPage />} />
        <Route path="ratings" element={<RatingsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
