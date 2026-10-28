import {
  LayoutDashboard,
  CalendarPlus,
  Users,
  CalendarRange,
  Wallet,
  Receipt,
  MessageSquare,
  LifeBuoy,
  UserRound,
  Briefcase,
  ClipboardList,
  Star,
  FileCheck2,
  Building2,
  GraduationCap,
  ShieldCheck,
  CreditCard,
  Percent,
  Banknote,
  Siren,
  Ban,
  Settings,
  FileSpreadsheet,
} from 'lucide-react'

export const CUSTOMER_NAV = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', to: '/customer/dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Care',
    items: [
      { label: 'Book Caretaker', to: '/customer/book-caregiver', icon: CalendarPlus },
      { label: 'Accepted Caretakers', to: '/customer/accepted-caretakers', icon: Users },
      { label: 'My Bookings', to: '/customer/bookings', icon: CalendarRange },
    ],
  },
  {
    section: 'Payments',
    items: [
      { label: 'Payments', to: '/customer/payments', icon: Wallet },
      { label: 'Invoices', to: '/customer/invoices', icon: Receipt },
    ],
  },
  {
    section: 'Support',
    items: [
      { label: 'Messages', to: '/customer/messages', icon: MessageSquare, badge: 'key:unreadCustomer' },
      { label: 'Complaints', to: '/customer/complaints', icon: LifeBuoy },
      { label: 'My Reviews', to: '/customer/reviews', icon: Star },
    ],
  },
  {
    section: 'Emergency',
    items: [{ label: 'Ambulance Help', to: '/customer/ambulances', icon: Siren, tone: 'danger' }],
  },
  {
    section: 'Account',
    items: [{ label: 'Profile', to: '/customer/profile', icon: UserRound }],
  },
]

export const CAREGIVER_NAV = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', to: '/caregiver/dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Work',
    items: [
      { label: 'Available Jobs', to: '/caregiver/jobs', icon: Briefcase, badge: 'key:openJobs' },
      { label: 'My Bookings', to: '/caregiver/bookings', icon: ClipboardList },
    ],
  },
  {
    section: 'Earnings',
    items: [
      { label: 'Earnings', to: '/caregiver/earnings', icon: Wallet },
      { label: 'Reviews', to: '/caregiver/reviews', icon: Star },
    ],
  },
  {
    section: 'Emergency',
    items: [{ label: 'Ambulance Dispatch', to: '/caregiver/ambulances', icon: Siren, tone: 'danger' }],
  },
  {
    section: 'Account',
    items: [
      { label: 'Messages', to: '/caregiver/messages', icon: MessageSquare, badge: 'key:unreadCaregiver' },
      { label: 'Documents', to: '/caregiver/documents', icon: FileCheck2 },
      { label: 'Profile', to: '/caregiver/profile', icon: UserRound },
    ],
  },
]

export const ADMIN_NAV = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'People',
    items: [
      { label: 'Customers', to: '/admin/customers', icon: Users },
      { label: 'Caretakers', to: '/admin/caregivers', icon: Briefcase },
      { label: 'Ambulances', to: '/admin/ambulances', icon: Siren },
      { label: 'Nursing Students', to: '/admin/nursing-students', icon: GraduationCap },
      { label: 'Hospitals', to: '/admin/hospitals', icon: Building2 },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Verifications', to: '/admin/verifications', icon: ShieldCheck, badge: 'key:pendingVerifications' },
      { label: 'Bookings', to: '/admin/bookings', icon: ClipboardList },
      { label: 'Complaints', to: '/admin/complaints', icon: LifeBuoy },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Payments', to: '/admin/payments', icon: CreditCard },
      { label: 'Commissions', to: '/admin/commissions', icon: Percent },
      { label: 'Payouts', to: '/admin/payouts', icon: Banknote },
      { label: 'Invoices', to: '/admin/invoices', icon: Receipt },
    ],
  },
  {
    section: 'Trust & Safety',
    items: [
      { label: 'Blacklist', to: '/admin/blacklist', icon: Ban },
      { label: 'Ratings', to: '/admin/ratings', icon: Star },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Reports', to: '/admin/reports', icon: FileSpreadsheet },
      { label: 'Settings', to: '/admin/settings', icon: Settings },
    ],
  },
]

export const AMBULANCE_NAV = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', to: '/ambulance/dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Account',
    items: [{ label: 'Vehicle Profile', to: '/ambulance/profile', icon: UserRound }],
  },
]

export const HOME_FOR_ROLE = {
  customer: '/customer/dashboard',
  caregiver: '/caregiver/dashboard',
  admin: '/admin/dashboard',
  ambulance: '/ambulance/dashboard',
}
