export const STATUS_STYLES = {
  pending: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  'pending-verification': 'bg-warning-50 text-warning-700 ring-warning-400/50',
  'under-review': 'bg-warning-50 text-warning-700 ring-warning-400/50',
  reviewing: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  'in-review': 'bg-warning-50 text-warning-700 ring-warning-400/50',
  verified: 'bg-success-50 text-success-700 ring-success-500/40',
  approved: 'bg-success-50 text-success-700 ring-success-500/40',
  confirmed: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  active: 'bg-success-50 text-success-700 ring-success-500/40',
  'in-progress': 'bg-accent-50 text-accent-600 ring-accent-500/40',
  ongoing: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  'service-started': 'bg-accent-50 text-accent-600 ring-accent-500/40',
  completed: 'bg-success-50 text-success-700 ring-success-500/40',
  resolved: 'bg-success-50 text-success-700 ring-success-500/40',
  paid: 'bg-success-50 text-success-700 ring-success-500/40',
  'paid-secured': 'bg-success-50 text-success-700 ring-success-500/40',
  released: 'bg-success-50 text-success-700 ring-success-500/40',
  settled: 'bg-success-50 text-success-700 ring-success-500/40',
  cancelled: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  rejected: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  failed: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  blacklisted: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  blocked: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  suspended: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  critical: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  escalated: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  refunded: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  disputed: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  investigation: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  'under-investigation': 'bg-warning-50 text-warning-700 ring-warning-400/50',
  high: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  medium: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  low: 'bg-info-50 text-info-700 ring-info-500/40',
  info: 'bg-info-50 text-info-700 ring-info-500/40',
  new: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  submitted: 'bg-info-50 text-info-700 ring-info-500/40',
  draft: 'bg-slate-100 text-slate-600 ring-slate-400/40',
  scheduled: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  assigned: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  open: 'bg-danger-50 text-danger-600 ring-danger-500/40',
  available: 'bg-success-50 text-success-700 ring-success-500/40',
  unavailable: 'bg-slate-100 text-slate-600 ring-slate-400/40',
  accepted: 'bg-success-50 text-success-700 ring-success-500/40',
  declined: 'bg-slate-100 text-slate-600 ring-slate-400/40',
  expired: 'bg-slate-100 text-slate-600 ring-slate-400/40',
  processing: 'bg-accent-50 text-accent-600 ring-accent-500/40',
  refundedPartial: 'bg-warning-50 text-warning-700 ring-warning-400/50',
  dismissed: 'bg-slate-100 text-slate-600 ring-slate-400/40',
  'action-taken': 'bg-accent-50 text-accent-600 ring-accent-500/40',
  'not-uploaded': 'bg-slate-100 text-slate-600 ring-slate-400/40',
}

export const STATUS_DOT = {
  pending: 'bg-warning-400',
  'under-review': 'bg-warning-400',
  reviewing: 'bg-warning-400',
  verified: 'bg-success-500',
  'not-uploaded': 'bg-slate-400',

  approved: 'bg-success-500',
  confirmed: 'bg-accent-400',
  active: 'bg-success-500',
  'in-progress': 'bg-accent-400',
  completed: 'bg-success-500',
  resolved: 'bg-success-500',
  dismissed: 'bg-slate-400',
  'action-taken': 'bg-accent-400',
  paid: 'bg-success-500',
  cancelled: 'bg-danger-500',
  rejected: 'bg-danger-500',
  failed: 'bg-danger-500',
  blacklisted: 'bg-danger-500',
  blocked: 'bg-danger-500',
  suspended: 'bg-danger-500',
  critical: 'bg-danger-500',
  open: 'bg-danger-500',
  high: 'bg-danger-500',
  medium: 'bg-warning-400',
  low: 'bg-info-500',
  new: 'bg-accent-400',
  submitted: 'bg-info-500',
  draft: 'bg-slate-400',
}

export const PRIORITY_TONE = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export const BOOKING_STATUSES = [
  'Pending',
  'Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
]

export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Refunded', 'Failed', 'Escrow Held']

export const VERIFICATION_STATUSES = ['Pending', 'Verified', 'Rejected', 'Under Review']

export const COMPLAINT_STATUSES = [
  'Submitted',
  'Under Review',
  'Investigation',
  'Resolved',
  'Dismissed',
]

export const PLATFORM_COMMISSION = 0.12
export const GST_RATE = 0.18
export const PLATFORM_FEE = 49

export const CARE_TYPES = [
  'Patient Monitoring',
  'Feeding & Hygiene Support',
  'Post-Surgery Care',
  'Companionship',
  'Medication Reminders',
  'Mobility Assistance',
  'Dementia & Alzheimer’s Support',
  'Bedridden Patient Care',
  'Night-Duty Care',
]

export const CITIES = [
  'Mumbai, MH',
  'Pune, MH',
  'Bengaluru, KA',
  'Delhi NCR',
  'Hyderabad, TS',
  'Chennai, TN',
  'Ahmedabad, GJ',
  'Kolkata, WB',
]

export const LANGUAGES = [
  'English',
  'Hindi',
  'Marathi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Kannada',
  'Gujarati',
  'Malayalam',
  'Punjabi',
]

export const QUALIFICATIONS = [
  'GNM Nursing',
  'B.Sc Nursing',
  'ANM Nursing',
  'MBBS',
  'Physiotherapy Assistant',
  'Certified Elder Care Giver',
  'Nursing Student (Final Year)',
  'Paramedic',
]
