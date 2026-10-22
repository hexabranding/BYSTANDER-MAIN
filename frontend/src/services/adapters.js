/**
 * Data Adapters for Backend Model <-> Frontend UI Normalization
 *
 * Provides bidirectional transformations between Express/MongoDB schemas
 * and the expectations of Bystander React UI components.
 */

import {
  Activity,
  UtensilsCrossed,
  Bandage,
  HandHeart,
  Pill,
  Accessibility,
  Brain,
  BedDouble,
  MoonStar,
  Sparkles,
  Stethoscope,
} from 'lucide-react'

const MONGO_OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

/**
 * Checks whether an ID string is a valid 24-character hexadecimal MongoDB ObjectId.
 * @param {any} id
 * @returns {boolean}
 */
export const isMongoObjectId = (id) => {
  if (!id || typeof id !== 'string') return false
  return MONGO_OBJECT_ID_REGEX.test(id.trim())
}

/**
 * Resolves an appropriate Lucide icon component for a service based on its slug, name, or category.
 * @param {string} slugOrName
 * @returns {React.ComponentType} Lucide icon component
 */
export const resolveServiceIcon = (slugOrName) => {
  if (!slugOrName || typeof slugOrName !== 'string') return Sparkles

  const term = slugOrName.toLowerCase().trim()

  if (term.includes('monitor') || term.includes('vital')) return Activity
  if (term.includes('feed') || term.includes('hygiene') || term.includes('bath')) return UtensilsCrossed
  if (term.includes('post-surgery') || term.includes('post-op') || term.includes('wound') || term.includes('surgery'))
    return Bandage
  if (term.includes('companion') || term.includes('elderly') || term.includes('elder')) return HandHeart
  if (term.includes('medicat') || term.includes('pill') || term.includes('prescription')) return Pill
  if (term.includes('mobili') || term.includes('physio') || term.includes('transfer')) return Accessibility
  if (term.includes('dementia') || term.includes('alzheimer') || term.includes('memory')) return Brain
  if (term.includes('bedridden') || term.includes('bed')) return BedDouble
  if (term.includes('night') || term.includes('overnight') || term.includes('vigil')) return MoonStar
  if (term.includes('nurs') || term.includes('clinical')) return Stethoscope

  return Sparkles
}

/**
 * Transforms a backend weeklySchedule array into the UI's weekAvailability structure.
 * @param {Array} weeklySchedule
 * @returns {Array} UI weekAvailability array
 */
export const adaptWeeklyScheduleToWeekAvailability = (weeklySchedule) => {
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (!Array.isArray(weeklySchedule) || weeklySchedule.length === 0) {
    return WEEK.map((day) => ({
      day,
      status: 'available',
      slots: ['08:00 – 12:00', '14:00 – 18:00'],
    }))
  }

  const map = new Map(weeklySchedule.map((item) => [item.day, item]))

  return WEEK.map((day) => {
    const item = map.get(day)
    if (!item || !item.isAvailable) {
      return {
        day,
        status: 'blocked',
        slots: [],
      }
    }

    const slots = Array.isArray(item.slots)
      ? item.slots.map((s) => {
          if (typeof s === 'string') return s
          if (s && s.start && s.end) return `${s.start} – ${s.end}`
          return '09:00 – 17:00'
        })
      : []

    return {
      day,
      status: 'available',
      slots: slots.length > 0 ? slots : ['08:00 – 12:00', '14:00 – 18:00'],
    }
  })
}

/**
 * Adapts a backend Service record to the structure expected by frontend components.
 * @param {Object} raw - Backend Service record
 * @returns {Object} Normalized Service object
 */
export const adaptService = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const slug = raw.slug || ''
  const name = raw.name || ''
  const baseRate = Number(raw.baseHourlyRate ?? raw.startingPrice ?? 399)

  const isNight = slug.includes('night') || name.toLowerCase().includes('night')
  const unit = raw.unit || (isNight ? 'shift' : 'hour')

  const tags = Array.isArray(raw.features) && raw.features.length > 0
    ? raw.features
    : Array.isArray(raw.tags) && raw.tags.length > 0
      ? raw.tags
      : [raw.category || 'General Care'].filter(Boolean)

  const shortDesc =
    raw.short ||
    (raw.description ? raw.description.split('.')[0] + '.' : name)

  return {
    ...raw,
    id,
    _id: raw._id ? String(raw._id) : id,
    name,
    slug,
    category: raw.category || 'General Care',
    description: raw.description || '',
    short: shortDesc,
    startingPrice: baseRate,
    baseHourlyRate: baseRate,
    unit,
    popular: Boolean(raw.popular ?? (tags.length >= 3)),
    tags,
    icon:
      typeof raw.icon === 'function' || (typeof raw.icon === 'object' && raw.icon !== null)
        ? raw.icon
        : resolveServiceIcon(slug || name),
    minimumDurationHours: Number(raw.minimumDurationHours) || 1,
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
  }
}

/**
 * Adapts a backend Caregiver record to the structure expected by frontend components.
 * @param {Object} raw - Backend CaregiverProfile record
 * @returns {Object} Normalized Caregiver object
 */
export const adaptCaregiver = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.caregiverId || raw.id || '')
  const name = raw.user?.fullName || raw.fullName || raw.name || 'Caregiver'
  const photo = raw.avatar || raw.user?.avatar || raw.photo || ''

  // Rating normalization: backend provides { average: 4.9, count: 42 } or direct number
  let ratingValue = 4.5
  let reviewCount = 0

  if (typeof raw.rating === 'object' && raw.rating !== null) {
    ratingValue = Number(raw.rating.average ?? 4.5)
    reviewCount = Number(raw.rating.count ?? 0)
  } else if (raw.rating !== undefined) {
    ratingValue = Number(raw.rating) || 0
    reviewCount = Number(raw.reviewCount ?? 0)
  }

  // Extract service name strings
  let serviceList = []
  if (Array.isArray(raw.servicesOffered) && raw.servicesOffered.length > 0) {
    serviceList = raw.servicesOffered.map((s) => {
      if (typeof s === 'object' && s !== null) return s.name || s.slug || ''
      return String(s)
    }).filter(Boolean)
  } else if (Array.isArray(raw.services) && raw.services.length > 0) {
    serviceList = raw.services.map((s) => (typeof s === 'object' && s !== null ? s.name || '' : String(s)))
  }

  const isVerified =
    raw.verificationStatus === 'verified' ||
    raw.verificationStatus === 'Verified' ||
    raw.verified === true

  const verificationStatus = raw.verificationStatus || (isVerified ? 'Verified' : 'Pending')

  const weekAvailability =
    Array.isArray(raw.weekAvailability) && raw.weekAvailability.length > 0
      ? raw.weekAvailability
      : adaptWeeklyScheduleToWeekAvailability(raw.weeklySchedule)

  const badges =
    Array.isArray(raw.badges) && raw.badges.length > 0
      ? raw.badges
      : isVerified
        ? ['ID & licence verified']
        : ['Verification Pending']

  return {
    ...raw,
    id,
    _id: raw._id ? String(raw._id) : (isMongoObjectId(id) ? id : undefined),
    caregiverId: raw.caregiverId ? String(raw.caregiverId) : id,
    name,
    fullName: name,
    photo,
    avatar: photo,
    qualification: raw.qualification || 'Caregiver',
    experienceYears: Number(raw.experienceYears) || 0,
    rating: ratingValue,
    reviewCount,
    hourlyRate: Number(raw.hourlyRate) || 0,
    city: raw.city || '',
    area: raw.area || '',
    distanceKm: Number(raw.distanceKm) || Number(raw.maxDistanceKm) || 2.5,
    availability: raw.availabilityStatus || raw.availability || 'Available Now',
    availabilityStatus: raw.availabilityStatus || raw.availability || 'Available Now',
    verified: isVerified,
    verificationStatus,
    services: serviceList,
    servicesOffered: raw.servicesOffered || [],
    careSettings: Array.isArray(raw.careSettings) && raw.careSettings.length > 0
      ? raw.careSettings
      : ['Home Care'],
    languages: Array.isArray(raw.languages) && raw.languages.length > 0
      ? raw.languages
      : ['English', 'Hindi'],
    bio: raw.bio || '',
    specialities:
      Array.isArray(raw.specialities) && raw.specialities.length > 0
        ? raw.specialities
        : Array.isArray(raw.specializations) && raw.specializations.length > 0
          ? raw.specializations
          : serviceList.slice(0, 3).length > 0
            ? serviceList.slice(0, 3)
            : ['Elder Care', 'Post-Op Care'],
    joinedOn: raw.joinedOn || raw.createdAt || new Date().toISOString(),
    trustScore: Number(raw.trustScore) || 95,
    responseRate: Number(raw.responseRate) || 96,
    completedJobs: Number(raw.completedJobs) || 0,
    repeatClients: Number(raw.repeatClients) || 0,
    badges,
    weekAvailability,
    weeklySchedule: raw.weeklySchedule || [],
  }
}

/**
 * Normalizes backend booking status strings to UI casing.
 * @param {string} status
 * @returns {string}
 */
export const normalizeBookingStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Pending'
  const s = status.toLowerCase().trim()
  if (s === 'pending') return 'Pending'
  if (s === 'confirmed') return 'Confirmed'
  if (s === 'in_progress' || s === 'inprogress') return 'In Progress'
  if (s === 'completed') return 'Completed'
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled'
  if (s === 'rejected') return 'Rejected'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/**
 * Converts UI weekAvailability array into backend-compliant 7-day weeklySchedule.
 * @param {Array} weekAvailability
 * @returns {Array} Backend weeklySchedule
 */
export const adaptWeekAvailabilityToWeeklySchedule = (weekAvailability) => {
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const map = new Map((weekAvailability || []).map((w) => [w.day, w]))

  return WEEK.map((day) => {
    const item = map.get(day)
    const isAvailable = Boolean(item && (item.status === 'available' || item.isAvailable === true))

    let slots = []
    if (isAvailable && item && Array.isArray(item.slots)) {
      slots = item.slots
        .map((s) => {
          if (typeof s === 'object' && s !== null && s.start && s.end) {
            return { start: s.start, end: s.end }
          }
          if (typeof s === 'string') {
            const parts = s.split(/[–—-]/).map((p) => p.trim())
            if (parts.length === 2 && parts[0] && parts[1]) {
              return { start: parts[0], end: parts[1] }
            }
          }
          return null
        })
        .filter(Boolean)
    }

    if (isAvailable && slots.length === 0) {
      slots = [{ start: '08:00', end: '18:00' }]
    }

    return {
      day,
      isAvailable,
      slots: isAvailable ? slots : [],
    }
  })
}

/**
 * Builds a timeline array for a booking based on backend lifecycle timestamps and status.
 * @param {Object} raw
 * @param {string} normalizedStatus
 * @returns {Array}
 */
export const buildBookingTimeline = (raw, normalizedStatus) => {
  const createdAt = raw.createdAt || new Date().toISOString()
  const acceptedAt = raw.acceptedAt || null
  const checkInAt = raw.checkIn?.at || null
  const checkOutAt = raw.checkOut?.at || null

  const isConfirmedOrLater = ['Confirmed', 'In Progress', 'Completed'].includes(normalizedStatus)
  const isInProgressOrLater = ['In Progress', 'Completed'].includes(normalizedStatus)
  const isCompleted = normalizedStatus === 'Completed'
  const isCancelled = normalizedStatus === 'Cancelled'
  const isRejected = normalizedStatus === 'Rejected'

  const timeline = [
    { label: 'Booking requested', status: 'completed', at: createdAt },
    {
      label: 'Caretaker assigned',
      status: isConfirmedOrLater ? 'completed' : isRejected ? 'failed' : 'upcoming',
      at: acceptedAt || (isConfirmedOrLater ? createdAt : null),
    },
    {
      label: 'Service started',
      status: isInProgressOrLater ? 'completed' : 'upcoming',
      at: checkInAt,
    },
    {
      label: 'Service completed',
      status: isCompleted ? 'completed' : 'upcoming',
      at: checkOutAt,
    },
    {
      label: 'Payment settled',
      status: isCompleted ? 'completed' : 'upcoming',
      at: isCompleted ? checkOutAt || new Date().toISOString() : null,
    },
  ]

  if (isCancelled) {
    const reason = raw.cancellationReason ? ` — ${raw.cancellationReason}` : ''
    timeline.push({
      label: `Cancelled${reason}`,
      status: 'failed',
      at: raw.cancelledAt || new Date().toISOString(),
    })
  } else if (isRejected) {
    const reason = raw.rejectionReason ? ` — ${raw.rejectionReason}` : ''
    timeline.push({
      label: `Declined by caretaker${reason}`,
      status: 'failed',
      at: raw.rejectedAt || new Date().toISOString(),
    })
  }

  return timeline
}

/**
 * Adapts a backend Booking record into the structure expected by frontend components.
 * @param {Object} raw - Backend Booking record
 * @returns {Object} Normalized Booking object
 */
export const adaptBooking = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const ref =
    raw.bookingReference ||
    raw.ref ||
    (isMongoObjectId(id) ? `CM-${id.slice(-6).toUpperCase()}` : id)

  const normalizedStatus = normalizeBookingStatus(raw.status)

  // Customer resolution
  let customerId = ''
  let customerName = 'Customer'
  if (raw.customer && typeof raw.customer === 'object') {
    customerId = String(raw.customer._id || raw.customer.id || '')
    customerName = raw.customer.fullName || raw.customer.name || customerName
  } else if (raw.customer) {
    customerId = String(raw.customer)
  } else if (raw.customerId) {
    customerId = String(raw.customerId)
  }

  // Caregiver resolution
  let caregiverId = ''
  let caregiverName = raw.caregiverName || 'Caregiver'
  let caregiverUser = null
  if (raw.caregiver && typeof raw.caregiver === 'object') {
    caregiverId = String(raw.caregiver._id || raw.caregiver.id || '')
    if (raw.caregiver.user && typeof raw.caregiver.user === 'object') {
      caregiverName = raw.caregiver.user.fullName || raw.caregiver.fullName || caregiverName
      caregiverUser = raw.caregiver.user
    } else {
      caregiverName = raw.caregiver.fullName || raw.caregiver.name || caregiverName
    }
  } else if (raw.caregiver) {
    caregiverId = String(raw.caregiver)
  } else if (raw.caregiverId) {
    caregiverId = String(raw.caregiverId)
  }

  // Service resolution
  let serviceName = raw.serviceName || raw.service || 'Care Service'
  let serviceId = ''
  if (raw.service && typeof raw.service === 'object') {
    serviceName = raw.service.name || raw.serviceName || serviceName
    serviceId = String(raw.service._id || raw.service.id || '')
  } else if (raw.service) {
    serviceId = String(raw.service)
  }

  // Scheduling calculation
  let date = raw.date || ''
  let startTime = raw.startTime || '08:00'
  let hours = Number(raw.totalHours ?? raw.hours ?? 1)

  if (raw.startDateTime) {
    const sDate = new Date(raw.startDateTime)
    if (!isNaN(sDate.getTime())) {
      date = sDate.toISOString().slice(0, 10)
      startTime = sDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }

  if (raw.startDateTime && raw.endDateTime) {
    const sTime = new Date(raw.startDateTime).getTime()
    const eTime = new Date(raw.endDateTime).getTime()
    if (!isNaN(sTime) && !isNaN(eTime) && eTime > sTime) {
      hours = Math.round(((eTime - sTime) / (1000 * 60 * 60)) * 10) / 10
    }
  }

  // Pricing normalization
  const rate = Number(raw.hourlyRate ?? 399)
  const subtotal = Number(raw.subtotal ?? (rate * hours))
  const platformFee = Number(raw.platformFee ?? 99)
  const tax = Number(raw.tax ?? Math.round((subtotal + platformFee) * 0.18))
  const total = Number(raw.totalAmount ?? raw.total ?? (subtotal + platformFee + tax))

  // Patient normalization
  const patient = {
    name: raw.patientDetails?.name || raw.patient?.name || 'Patient',
    age: Number(raw.patientDetails?.age ?? raw.patient?.age ?? 0),
    gender: raw.patientDetails?.gender || raw.patient?.gender || 'Other',
    relation: raw.patient?.relation || raw.patientDetails?.relation || 'Family',
    condition: raw.patient?.condition || raw.patientDetails?.condition || '',
    specialInstructions: raw.patientDetails?.specialInstructions || raw.specialInstructions || '',
  }

  // Location normalization
  const addressLine = raw.location?.addressLine || raw.address || ''
  const city = raw.location?.city || raw.city || ''
  const area = raw.location?.area || raw.area || ''
  const careType = raw.location?.careSetting || raw.careType || 'Home Care'
  const fullAddress = [addressLine, area, city].filter(Boolean).join(', ')

  // Verification & Shift tracking
  const checkIn = raw.checkIn || null
  const checkOut = raw.checkOut || null
  const hasCheckedIn = Boolean(checkIn?.at) || ['In Progress', 'Completed'].includes(normalizedStatus)
  const hasCheckedOut = Boolean(checkOut?.at) || normalizedStatus === 'Completed'

  // Canonical invoice number: INV-YYYY-XXXX
  const invYear = raw.createdAt ? new Date(raw.createdAt).getFullYear() : new Date().getFullYear()
  const invSuffix = id.length >= 4 ? id.slice(-4).toUpperCase() : (ref.length >= 4 ? ref.slice(-4).toUpperCase() : '0001')
  const invoiceNo = raw.invoiceNo || `INV-${invYear}-${invSuffix}`

  return {
    ...raw,
    id,
    _id: raw._id ? String(raw._id) : (isMongoObjectId(id) ? id : undefined),
    ref,
    bookingReference: ref,
    invoiceNo,
    customerId,
    customerName,
    customer: typeof raw.customer === 'object' && raw.customer !== null
      ? {
          id: customerId,
          _id: customerId,
          name: customerName,
          fullName: customerName,
          email: raw.customer.email || '',
          phone: raw.customer.phone || '',
          address: raw.customer.address || addressLine || fullAddress,
        }
      : {
          id: customerId,
          name: customerName,
          fullName: customerName,
          email: '',
          phone: '',
          address: addressLine || fullAddress,
        },
    caregiverId,
    caregiverName,
    caregiver: raw.caregiver || null,
    caregiverUser,
    service: serviceName,
    serviceName,
    serviceId,
    patient,
    patientDetails: raw.patientDetails || {
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      specialInstructions: patient.specialInstructions,
    },
    careType,
    address: addressLine || fullAddress,
    fullAddress,
    city,
    area,
    location: raw.location || {
      addressLine: addressLine || fullAddress,
      city,
      area,
      careSetting: careType,
    },
    date,
    startTime,
    hours,
    hourlyRate: rate,
    subtotal,
    platformFee,
    tax,
    total,
    totalAmount: total,
    currency: raw.currency || 'INR',
    status: normalizedStatus,
    rawStatus: raw.status || normalizedStatus.toLowerCase(),
    paymentStatus:
      raw.paymentStatus ||
      (normalizedStatus === 'Completed'
        ? 'Paid'
        : normalizedStatus === 'Cancelled'
          ? 'Refunded'
          : 'Escrow Held'),
    createdAt: raw.createdAt || new Date().toISOString(),
    startDateTime: raw.startDateTime || null,
    endDateTime: raw.endDateTime || null,
    checkIn,
    checkOut,
    hasCheckedIn,
    hasCheckedOut,
    timeline: Array.isArray(raw.timeline) && raw.timeline.length > 0
      ? raw.timeline
      : buildBookingTimeline(raw, normalizedStatus),
  }
}

/**
 * Adapts a backend Customer Profile response.
 * @param {Object} raw
 * @returns {Object}
 */
export const adaptCustomerProfile = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const user = raw.user && typeof raw.user === 'object' ? raw.user : raw
  const id = String(user._id || raw._id || user.id || '')

  return {
    id,
    _id: id,
    fullName: user.fullName || raw.fullName || '',
    name: user.fullName || raw.fullName || '',
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.avatar || '',
    role: 'customer',
    defaultAddress: raw.defaultAddress || {
      addressLine: user.address || '',
      city: user.city || '',
      area: user.area || '',
      pincode: '',
    },
    emergencyContact: raw.emergencyContact || {
      name: '',
      phone: '',
      relation: '',
    },
    patients: Array.isArray(raw.patients) ? raw.patients : [],
    careNotes: raw.careNotes || '',
    joinedOn: user.createdAt || raw.createdAt || '',
  }
}

/**
 * Adapts a backend Message document to the UI conversation message contract.
 * @param {Object} raw - Backend message document
 * @param {string} [currentUserId] - ID of the authenticated user to determine 'me' vs 'them'
 * @returns {Object}
 */
export const adaptMessage = (raw, currentUserId) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const senderObj = raw.sender && typeof raw.sender === 'object' ? raw.sender : null
  const senderId = String(senderObj?._id || raw.sender || '')
  const recipientObj = raw.recipient && typeof raw.recipient === 'object' ? raw.recipient : null
  const recipientId = String(recipientObj?._id || raw.recipient || '')

  const isMe = Boolean(currentUserId && String(currentUserId) === senderId)

  return {
    id,
    _id: id,
    bookingId: String(raw.booking?._id || raw.booking || ''),
    from: isMe ? 'me' : 'them',
    text: raw.content || '',
    at: raw.createdAt || new Date().toISOString(),
    senderId,
    senderName: senderObj?.fullName || (isMe ? 'You' : 'Participant'),
    senderRole: raw.senderRole || senderObj?.role || '',
    recipientId,
    recipientName: recipientObj?.fullName || '',
    recipientRole: raw.recipientRole || recipientObj?.role || '',
    read: Boolean(raw.read),
    readAt: raw.readAt || null,
    isFlagged: Boolean(raw.isFlagged),
    flaggedReasons: Array.isArray(raw.flaggedReasons) ? raw.flaggedReasons : [],
  }
}

/**
 * Adapts a backend Notification document to UI notification card/dropdown expectations.
 * @param {Object} raw - Backend notification document
 * @returns {Object}
 */
export const adaptNotification = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const type = String(raw.type || 'info')

  let tone = 'info'
  if (type === 'sos_raised') tone = 'danger'
  else if (type === 'booking_confirmed' || type === 'shift_completed') tone = 'success'
  else if (type === 'shift_started' || type === 'booking_cancelled' || type === 'booking_rejected') tone = 'warning'

  return {
    id,
    _id: id,
    title: raw.title || 'Notification',
    body: raw.message || '',
    message: raw.message || '',
    time: raw.createdAt || new Date().toISOString(),
    createdAt: raw.createdAt || new Date().toISOString(),
    read: Boolean(raw.read),
    tone,
    type,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    idempotencyKey: raw.idempotencyKey || null,
  }
}

/**
 * Adapts a backend SosIncident document to UI model with strict location & dispatch safeguards.
 * @param {Object} raw - Backend SOS incident document
 * @returns {Object}
 */
export const adaptSosIncident = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const incidentNumber = raw.incidentNumber || `SOS-${id.slice(-6).toUpperCase()}`

  const locationRaw = raw.location || {}
  const hasCoords = typeof locationRaw.latitude === 'number' && typeof locationRaw.longitude === 'number'

  const location = {
    isAvailable: Boolean(locationRaw.isAvailable && hasCoords),
    label: locationRaw.label || (hasCoords ? 'Live location shared' : 'Location unavailable'),
    latitude: hasCoords ? locationRaw.latitude : null,
    longitude: hasCoords ? locationRaw.longitude : null,
    lat: hasCoords ? locationRaw.latitude : null,
    lng: hasCoords ? locationRaw.longitude : null,
    accuracy: locationRaw.accuracy ?? null,
  }

  const rawDispatch = raw.emergencyContactNotification || {}
  const emergencyNotification = {
    status: rawDispatch.status || 'not_configured',
    attempted: Boolean(rawDispatch.attempted),
    attemptedAt: rawDispatch.attemptedAt || null,
    contactName: rawDispatch.contactName || null,
    contactRelation: rawDispatch.contactRelation || null,
    notes: rawDispatch.notes || 'External emergency telephony/SMS dispatch is not configured.',
  }

  const timeline = Array.isArray(raw.timeline)
    ? raw.timeline.map((entry, idx) => {
        const actorName = entry.by?.fullName || (
          entry.byRole === 'admin' ? 'Operations Desk' :
          entry.byRole === 'caregiver' ? 'Caretaker' :
          entry.byRole === 'customer' ? 'Customer' : 'System'
        )
        return {
          id: String(entry._id || `tl-${idx}`),
          at: entry.at || entry.createdAt || new Date().toISOString(),
          action: entry.action || 'Incident updated',
          by: actorName,
          byRole: entry.byRole || 'system',
          notes: entry.notes || null,
        }
      })
    : []

  return {
    id,
    _id: id,
    incidentNumber,
    ref: incidentNumber,
    bookingId: String(raw.booking?._id || raw.booking || ''),
    serviceName: raw.booking?.serviceName || 'Care Engagement',
    priority: raw.priority || 'Critical',
    status: raw.status || 'Open',
    summary: raw.summary || '',
    location,
    emergencyContactNotification: emergencyNotification,
    emergencyContactNotified: emergencyNotification.status === 'sent' || emergencyNotification.status === 'delivered',
    timeline,
    reportedAt: raw.createdAt || new Date().toISOString(),
    customer: raw.customer,
    caregiver: raw.caregiverUser?.fullName || (raw.caregiver && typeof raw.caregiver === 'object' ? raw.caregiver.name : 'Assigned Caregiver'),
    raisedBy: raw.raisedBy?.fullName || raw.raisedByRole || 'User',
    userType: raw.raisedByRole
      ? raw.raisedByRole.charAt(0).toUpperCase() + raw.raisedByRole.slice(1)
      : raw.userType || 'Customer',
    assignedTo: raw.assignedTo?.fullName || raw.assignedTo || null,
  }
}

const DOCUMENT_TYPE_LABELS = {
  identity: 'Government Photo ID',
  address_proof: 'Address Proof',
  nursing_registration: 'Nursing Council Registration',
  college_id: 'College / Institute ID',
  police_clearance: 'Police Clearance Certificate',
  bank_verification: 'Bank Account Proof',
  other: 'Supporting Document',
}

export const normalizeVerificationStatus = (status) => {
  if (!status) return 'Pending'
  const s = String(status).toLowerCase().trim()
  if (s === 'under_review' || s === 'under review') return 'Under Review'
  if (s === 'verified') return 'Verified'
  if (s === 'rejected') return 'Rejected'
  return 'Pending'
}

/**
 * Adapts an individual document metadata object for admin verification UI.
 * @param {Object} doc - Raw backend document record
 * @returns {Object}
 */
export const adaptVerificationDocument = (doc) => {
  if (!doc || typeof doc !== 'object') return doc
  const id = String(doc._id || doc.id || '')
  const docType = doc.documentType || 'other'
  const type =
    DOCUMENT_TYPE_LABELS[docType] ||
    doc.type ||
    docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const status = normalizeVerificationStatus(doc.verificationStatus || doc.status)
  const reviewer = doc.reviewedBy?.fullName || doc.reviewedBy || 'Operations Desk'

  const fileUrl =
    doc.fileUrl ||
    doc.fileData ||
    doc.dataUrl ||
    (typeof doc.fileKey === 'string' &&
    (doc.fileKey.startsWith('data:') || doc.fileKey.startsWith('http') || doc.fileKey.startsWith('/'))
      ? doc.fileKey
      : null)

  return {
    id,
    _id: id,
    type,
    documentType: docType,
    file: doc.fileName || `${docType}.pdf`,
    fileName: doc.fileName || `${docType}.pdf`,
    fileUrl,
    uploadedOn: doc.createdAt || doc.uploadedOn || new Date().toISOString(),
    status,
    verificationStatus: (doc.verificationStatus || status).toLowerCase(),
    feedback: doc.reviewerNotes || doc.feedback || '',
    reviewerNotes: doc.reviewerNotes || doc.feedback || '',
    reviewedBy: reviewer,
    reviewedAt: doc.reviewedAt || null,
  }
}

/**
 * Adapts a Caregiver verification application dossier for admin verification UI.
 * @param {Object} raw - Backend CaregiverProfile with populated user and documents
 * @returns {Object}
 */
export const adaptVerificationRecord = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = String(raw._id || raw.id || '')
  const user = raw.user && typeof raw.user === 'object' ? raw.user : {}
  const name = user.fullName || raw.name || raw.fullName || 'Caretaker'
  const avatar = user.avatar || raw.avatar || ''
  const qualification = raw.qualification || 'Certified Caregiver'
  const regNo = raw.nursingRegNo || raw.regNo || 'N/A'
  const city = raw.city || 'Mumbai, MH'
  const submittedOn = raw.createdAt || raw.submittedOn || new Date().toISOString()
  const overallScore =
    typeof raw.trustScore === 'number'
      ? raw.trustScore
      : typeof raw.overallScore === 'number'
        ? raw.overallScore
        : 75
  const status = normalizeVerificationStatus(raw.verificationStatus || raw.status)

  const rawDocs = Array.isArray(raw.documents) ? raw.documents : []
  const documents = rawDocs.map(adaptVerificationDocument)

  // Construct auditable action history
  let history = []
  if (Array.isArray(raw.history) && raw.history.length > 0) {
    history = raw.history
  } else {
    history.push({
      at: submittedOn,
      action: 'Application submitted for verification',
      by: name,
    })
    documents.forEach((d) => {
      if (d.reviewedAt) {
        history.push({
          at: d.reviewedAt,
          action: `${d.type} marked ${d.status}${d.feedback ? `: ${d.feedback}` : ''}`,
          by: d.reviewedBy || 'Operations Desk',
        })
      }
    })
    if (status === 'Verified' || status === 'Rejected') {
      history.push({
        at: raw.updatedAt || new Date().toISOString(),
        action: `Application marked ${status}`,
        by: 'Operations Desk',
      })
    }
  }

  return {
    id,
    _id: id,
    caregiverId: id,
    userId: String(user._id || raw.userId || ''),
    name,
    avatar,
    qualification,
    regNo,
    city,
    submittedOn,
    overallScore,
    status,
    verificationStatus: (raw.verificationStatus || status).toLowerCase(),
    documents,
    history,
    bio: raw.bio || '',
    hourlyRate: raw.hourlyRate || 0,
    experienceYears: raw.experienceYears || 0,
  }
}

/**
 * Adapts backend customer directory record for administrative UI.
 * Normalizes identity, profile, and aggregated booking stats.
 *
 * @param {Object} raw - Backend customer object
 * @returns {Object} UI-ready customer account record
 */
export const adaptCustomerAccount = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw._id || raw.id || '')
  const name = raw.fullName || raw.name || 'Customer'
  const email = raw.email || ''
  const phone = raw.phone || ''
  const avatar = raw.avatar || ''
  const city = raw.city || raw.defaultAddress?.city || '—'
  const area = raw.area || raw.defaultAddress?.area || ''

  // Normalize status: active -> 'Active', suspended -> 'Suspended', blocked -> 'Blocked'
  const rawStatus = (raw.status || '').toLowerCase()
  let status = 'Active'
  if (rawStatus === 'suspended') status = 'Suspended'
  else if (rawStatus === 'blocked') status = 'Blocked'
  else if (rawStatus === 'pending_verification') status = 'Inactive'
  else if (raw.status === 'Inactive') status = 'Inactive'

  return {
    ...raw,
    id,
    _id: id,
    name,
    fullName: name,
    email,
    phone,
    avatar,
    city,
    area,
    status,
    accountStatus: raw.status || 'active',
    isSuspended: rawStatus === 'suspended',
    isBlocked: rawStatus === 'blocked',
    statusReason: raw.statusReason || '',
    statusUpdatedAt: raw.statusUpdatedAt || null,
    totalBookings: Number(raw.totalBookings) || 0,
    totalSpent: Number(raw.totalSpent) || 0,
    patients: Array.isArray(raw.patients) ? raw.patients : [],
    patientsCount: Number(raw.patientsCount) || (Array.isArray(raw.patients) ? raw.patients.length : 0),
    emergencyContact: raw.emergencyContact || null,
    lastLoginAt: raw.lastLoginAt || null,
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

/**
 * Adapts backend caregiver directory record for administrative oversight.
 * Normalizes credentials, verification status, and account suspension flags.
 *
 * @param {Object} raw - Backend caregiver object
 * @returns {Object} UI-ready caregiver account record
 */
export const adaptCaregiverAccount = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw._id || raw.id || '')
  const userId = raw.userId ? String(raw.userId) : ''
  const name = raw.name || raw.fullName || 'Caregiver'
  const photo = raw.photo || raw.avatar || ''
  const qualification = raw.qualification || 'Caregiver'
  const regNo = raw.regNo || raw.nursingRegNo || '—'
  const experienceYears = Number(raw.experienceYears) || 0
  const hourlyRate = Number(raw.hourlyRate) || 0
  const city = raw.city || ''
  const area = raw.area || ''
  const services = Array.isArray(raw.services) ? raw.services : []
  const careSettings = Array.isArray(raw.careSettings) ? raw.careSettings : ['Home Care']
  const availabilityStatus = raw.availabilityStatus || 'Available Now'
  const rating = Number(raw.rating) || 5.0
  const reviewCount = Number(raw.ratingCount ?? raw.reviewCount) || 0
  const completedJobs = Number(raw.completedJobs) || 0
  const trustScore = Number(raw.trustScore) || 50
  const badges = Array.isArray(raw.badges) ? raw.badges : []

  const rawVerif = (raw.verificationStatus || '').toLowerCase()
  let verificationStatus = 'Pending'
  if (rawVerif === 'verified') verificationStatus = 'Verified'
  else if (rawVerif === 'under_review') verificationStatus = 'Under Review'
  else if (rawVerif === 'rejected') verificationStatus = 'Rejected'

  const rawUserStatus = (raw.status || '').toLowerCase()
  const isSuspended = rawUserStatus === 'suspended' || raw.isSuspended === true
  const isBlocked = rawUserStatus === 'blocked' || raw.isBlocked === true

  let status = 'Active'
  if (isSuspended) status = 'Suspended'
  else if (isBlocked) status = 'Blocked'
  else if (raw.status) status = raw.status

  return {
    ...raw,
    id,
    _id: id,
    userId,
    caregiverId: id,
    name,
    fullName: name,
    photo,
    avatar: photo,
    qualification,
    regNo,
    nursingRegNo: regNo,
    experienceYears,
    hourlyRate,
    city,
    area,
    services,
    careSettings,
    availabilityStatus,
    rating,
    reviewCount,
    ratingCount: reviewCount,
    verified: verificationStatus === 'Verified',
    verificationStatus,
    status,
    accountStatus: rawUserStatus || 'active',
    isSuspended,
    isBlocked,
    statusReason: raw.statusReason || '',
    statusUpdatedAt: raw.statusUpdatedAt || null,
    completedJobs,
    trustScore,
    badges,
    lastLoginAt: raw.lastLoginAt || null,
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

/**
 * Adapts backend flagged message record for administrative moderation queue.
 *
 * @param {Object} raw - Backend flagged message object
 * @returns {Object} UI-ready flagged message moderation record
 */
export const adaptFlaggedMessage = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw._id || raw.id || '')
  const bookingId = raw.bookingId || raw.booking?._id || String(raw.booking || '')
  const bookingNumber =
    raw.bookingNumber ||
    raw.booking?.bookingNumber ||
    (bookingId ? `BK-${bookingId.slice(-4).toUpperCase()}` : '—')
  const bookingStatus = raw.bookingStatus || raw.booking?.status || 'unknown'

  const senderId = raw.senderId || raw.sender?._id || String(raw.sender || '')
  const senderName = raw.senderName || raw.sender?.fullName || 'User'
  const senderRole = raw.senderRole || 'customer'
  const senderStatus = raw.senderStatus || raw.sender?.status || 'active'

  const recipientId = raw.recipientId || raw.recipient?._id || String(raw.recipient || '')
  const recipientName = raw.recipientName || raw.recipient?.fullName || 'User'
  const recipientRole = raw.recipientRole || 'caregiver'
  const recipientStatus = raw.recipientStatus || raw.recipient?.status || 'active'

  return {
    ...raw,
    id,
    _id: id,
    bookingId,
    bookingNumber,
    bookingStatus,
    senderId,
    senderName,
    senderRole,
    senderStatus,
    recipientId,
    recipientName,
    recipientRole,
    recipientStatus,
    content: raw.content || '',
    isFlagged: raw.isFlagged ?? true,
    flaggedReasons: Array.isArray(raw.flaggedReasons) ? raw.flaggedReasons : [],
    flaggedAt: raw.flaggedAt || raw.createdAt || new Date().toISOString(),
    createdAt: raw.createdAt || new Date().toISOString(),
  }
}

/**
 * Normalizes complaint status string for display in UI components.
 *
 * @param {string} status
 * @returns {string} Capitalized display status
 */
export const normalizeComplaintStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Submitted'
  const s = status.trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (s) {
    case 'submitted':
      return 'Submitted'
    case 'under_review':
    case 'in_review':
    case 'review':
      return 'Under Review'
    case 'action_taken':
    case 'investigation':
    case 'investigating':
    case 'under_investigation':
      return 'Investigation'
    case 'resolved':
      return 'Resolved'
    case 'dismissed':
    case 'rejected':
      return 'Dismissed'
    default:
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

/**
 * Denormalizes UI complaint status string to backend enum value.
 *
 * @param {string} status
 * @returns {string} Backend complaint enum value
 */
export const denormalizeComplaintStatus = (status) => {
  if (!status || typeof status !== 'string') return 'submitted'
  const s = status.trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (s) {
    case 'submitted':
      return 'submitted'
    case 'under_review':
    case 'in_review':
      return 'under_review'
    case 'investigation':
    case 'action_taken':
      return 'action_taken'
    case 'resolved':
      return 'resolved'
    case 'dismissed':
      return 'dismissed'
    default:
      return s
  }
}

/**
 * Adapts backend Complaint document into UI component structure.
 *
 * @param {Object} raw - Backend complaint document
 * @returns {Object} Normalized UI complaint record
 */
export const adaptComplaint = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw._id || raw.id || '')
  const complaintNumber = raw.complaintNumber || id

  const complainantObj = raw.complainant && typeof raw.complainant === 'object' ? raw.complainant : null
  const complainantName =
    complainantObj?.fullName ||
    (typeof raw.complainant === 'string' && !isMongoObjectId(raw.complainant)
      ? raw.complainant
      : raw.complainantName || 'Customer')
  const complainantRole = complainantObj?.role || raw.complainantRole || 'customer'
  const complainantType = complainantRole === 'caregiver' ? 'Caregiver' : 'Customer'

  const respondentObj = raw.respondent && typeof raw.respondent === 'object' ? raw.respondent : null
  const respondentName =
    respondentObj?.fullName ||
    (typeof raw.respondent === 'string' && !isMongoObjectId(raw.respondent)
      ? raw.respondent
      : raw.respondentName || raw.against || 'CareMate Platform')
  const respondentRole =
    respondentObj?.role || raw.respondentRole || (raw.againstType ? raw.againstType.toLowerCase() : 'platform')
  const againstType = respondentRole === 'caregiver' ? 'Caregiver' : respondentRole === 'customer' ? 'Customer' : 'Platform'

  const bookingObj = raw.booking && typeof raw.booking === 'object' ? raw.booking : null
  const bookingId =
    bookingObj?.bookingNumber ||
    (raw.booking ? String(raw.booking._id || raw.booking) : raw.bookingId || '')

  const status = normalizeComplaintStatus(raw.status)

  const audit = Array.isArray(raw.timeline)
    ? raw.timeline.map((t) => ({
        at: t.at || new Date().toISOString(),
        action: t.action || 'Status update',
        by: t.byRole
          ? t.byRole.charAt(0).toUpperCase() + t.byRole.slice(1)
          : (typeof t.by === 'string' ? t.by : 'Admin'),
      }))
    : (Array.isArray(raw.audit) ? raw.audit : [])

  const internalNotes = Array.isArray(raw.internalNotes)
    ? raw.internalNotes.map((n) => ({
        id: n._id || String(n.id || ''),
        note: n.note || '',
        by: n.byName || (n.by && typeof n.by === 'object' ? n.by.fullName : 'Admin'),
        at: n.at || new Date().toISOString(),
      }))
    : []

  const resolution =
    raw.resolution?.resolutionDetails ||
    (typeof raw.resolution === 'string' ? raw.resolution : '')

  return {
    ...raw,
    _id: id,
    id: complaintNumber,
    dbId: id,
    complaintNumber,
    bookingId,
    bookingNumber: bookingObj?.bookingNumber || bookingId,
    booking: bookingObj,
    subject: raw.subject || '',
    description: raw.description || '',
    category: raw.category || 'Other',
    priority: raw.priority || 'Medium',
    status,
    rawStatus: raw.status || 'submitted',
    complainant: complainantName,
    complainantType,
    complainantObj,
    against: respondentName,
    againstType,
    respondentObj,
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    internalNotes,
    resolution,
    audit,
    submittedOn: raw.createdAt || raw.submittedOn || new Date().toISOString(),
    createdAt: raw.createdAt || raw.submittedOn || new Date().toISOString(),
  }
}

/**
 * Normalizes backend transaction status enum to UI display status
 */
export const normalizePaymentStatus = (status) => {
  if (!status) return 'Escrow Held'
  const norm = String(status).trim().toLowerCase()
  if (norm === 'escrow_held' || norm === 'escrow held') return 'Escrow Held'
  if (norm === 'released') return 'Released'
  if (norm === 'refunded') return 'Refunded'
  if (norm === 'disputed') return 'Disputed'
  if (norm === 'pending') return 'Pending'
  if (norm === 'paid') return 'Paid'
  return 'Escrow Held'
}

/**
 * Normalizes backend payout status enum to UI display status
 */
export const normalizePayoutStatus = (status) => {
  if (!status) return 'Pending'
  const norm = String(status).trim().toLowerCase()
  if (norm === 'pending') return 'Pending'
  if (norm === 'processing') return 'Processing'
  if (norm === 'settled') return 'Settled'
  if (norm === 'failed') return 'Failed'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

/**
 * Adapts backend Transaction document to UI financial model
 */
export const adaptTransaction = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = raw.transactionNumber || (raw._id ? `TXN-${String(raw._id).slice(-6).toUpperCase()}` : raw.id || 'TXN-000')
  const dateStr = raw.createdAt
    ? new Date(raw.createdAt).toISOString().slice(0, 10)
    : (raw.date || new Date().toISOString().slice(0, 10))

  const bookingObj = raw.booking && typeof raw.booking === 'object' ? raw.booking : null
  const bookingId = bookingObj
    ? (bookingObj.bookingNumber || (bookingObj._id ? String(bookingObj._id) : ''))
    : (raw.booking ? String(raw.booking) : raw.bookingId || '—')

  const customerObj = raw.customer && typeof raw.customer === 'object' ? raw.customer : null
  const customerName = customerObj?.fullName || customerObj?.name || raw.customerName || 'Customer'

  const caregiverObj = raw.caregiver && typeof raw.caregiver === 'object' ? raw.caregiver : null
  const caregiverUserObj = caregiverObj?.user && typeof caregiverObj.user === 'object' ? caregiverObj.user : null
  const caregiverName = caregiverUserObj?.fullName || caregiverUserObj?.name || caregiverObj?.fullName || caregiverObj?.name || raw.caregiverUser?.fullName || raw.caregiverName || 'Caretaker'

  const service = bookingObj?.serviceName || raw.serviceName || raw.service || 'Healthcare Caretaking'
  const amount = Number(raw.amount || 0)
  const commission = Number(raw.breakdown?.commission ?? raw.commission ?? Math.round(amount * 0.12))
  const payout = Number(raw.breakdown?.caregiverPayout ?? raw.payout ?? Math.max(0, amount - commission))

  return {
    ...raw,
    _id: raw._id || id,
    id,
    bookingId,
    customerId: customerObj?._id || raw.customerId || '',
    caregiverId: caregiverObj?._id || raw.caregiverId || '',
    customerName,
    caregiverName,
    service,
    date: dateStr,
    amount,
    commission,
    payout,
    method: raw.paymentMethod || raw.method || 'UPI · HDFC',
    status: normalizePaymentStatus(raw.status),
    type: raw.type === 'refund' ? 'Refund' : (raw.type || 'Booking Payment'),
    breakdown: raw.breakdown || {
      baseAmount: Math.max(0, amount - commission),
      platformFee: 49,
      tax: Math.round(amount * 0.18),
      commission,
      caregiverPayout: payout,
    },
    isSimulated: Boolean(raw.isSimulated ?? true),
  }
}

/**
 * Adapts backend Payout document to UI model
 */
export const adaptPayout = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const id = raw.payoutNumber || (raw._id ? `PO-${String(raw._id).slice(-6).toUpperCase()}` : raw.id || 'PO-000')
  const requestedOn = raw.requestedOn
    ? new Date(raw.requestedOn).toISOString().slice(0, 10)
    : (raw.date || new Date().toISOString().slice(0, 10))

  const caregiverObj = raw.caregiver && typeof raw.caregiver === 'object' ? raw.caregiver : null
  const caregiverUserObj = caregiverObj?.user && typeof caregiverObj.user === 'object' ? caregiverObj.user : null
  const caregiverName = caregiverUserObj?.fullName || caregiverUserObj?.name || caregiverObj?.fullName || caregiverObj?.name || raw.caregiverUser?.fullName || raw.caregiverName || 'Caretaker'

  const method = raw.disbursalMethod || raw.method || 'HDFC •••• 4412'

  return {
    ...raw,
    _id: raw._id || id,
    id,
    caregiverId: caregiverObj?._id || raw.caregiverId || '',
    caregiverName,
    period: raw.period || 'Current Period',
    jobs: Number(raw.jobsCount ?? raw.jobs ?? 1),
    gross: Number(raw.gross || 0),
    commission: Number(raw.commission || 0),
    net: Number(raw.net || 0),
    status: normalizePayoutStatus(raw.status),
    method,
    bank: method,
    requestedOn,
    settledAt: raw.settledAt || null,
    notes: raw.notes || '',
    isSimulated: Boolean(raw.isSimulated ?? true),
  }
}

/**
 * Adapts commission item to UI model
 */
export const adaptCommission = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const txnSuffix = raw.transactionNumber ? raw.transactionNumber.split('-').pop() : ''
  const id = raw.id || raw.commissionId || (txnSuffix ? `CM-${txnSuffix}` : 'CM-000')
  const isSettled = raw.status === 'released' || raw.status === 'Settled'

  const bookingObj = raw.booking && typeof raw.booking === 'object' ? raw.booking : null
  const bookingId = raw.bookingId || bookingObj?.bookingNumber || (bookingObj?._id ? String(bookingObj._id) : '—')

  const caregiverObj = raw.caregiver && typeof raw.caregiver === 'object' ? raw.caregiver : null
  const caregiverUserObj = caregiverObj?.user && typeof caregiverObj.user === 'object' ? caregiverObj.user : null
  const caregiverName = caregiverUserObj?.fullName || caregiverUserObj?.name || caregiverObj?.fullName || caregiverObj?.name || raw.caregiverUser?.fullName || raw.caregiverName || 'Caretaker'

  const commissionAmount = Number(raw.breakdown?.commission ?? raw.commission ?? (raw.amount ? Math.round(raw.amount * 0.12) : 0))
  const baseAmount = Number(raw.base || raw.breakdown?.baseAmount || (raw.amount ? Math.max(0, Math.round(raw.amount / 1.18) - 49) : 0))

  return {
    ...raw,
    id,
    bookingId,
    caregiverName,
    base: baseAmount,
    rate: raw.rate || '12%',
    amount: commissionAmount,
    date: raw.date || (raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
    status: isSettled ? 'Settled' : 'Accrued',
  }
}

/**
 * Adapts a backend Booking document (or adapted booking) to the Caregiver Job representation.
 * @param {Object} raw - Booking record
 * @returns {Object} Job representation
 */
export const adaptBookingToJob = (raw) => {
  if (!raw || typeof raw !== 'object') return raw

  const b = adaptBooking(raw)
  const id = String(b.id || b._id || '')
  const displayId = b.ref || (isMongoObjectId(id) ? `JOB-${id.slice(-4).toUpperCase()}` : id)

  // Status mapping: Pending -> Open, Confirmed/InProgress/Completed -> Accepted, Rejected/Cancelled -> Declined
  let status = 'Open'
  const normStatus = (b.status || '').toLowerCase()
  if (normStatus === 'pending') {
    status = 'Open'
  } else if (['confirmed', 'in progress', 'completed', 'in_progress'].includes(normStatus)) {
    status = 'Accepted'
  } else if (['rejected', 'cancelled', 'canceled'].includes(normStatus)) {
    status = 'Declined'
  }

  // Derive human-friendly shift string
  let shift = b.shift
  if (!shift) {
    if (b.startDateTime && b.endDateTime) {
      try {
        const s = new Date(b.startDateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        const e = new Date(b.endDateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        shift = `${s} – ${e}`
      } catch {
        shift = `${b.startTime || '09:00'} (${b.hours || 6}h)`
      }
    } else {
      shift = `${b.startTime || '09:00'} (${b.hours || 6}h)`
    }
  }

  const patientName = b.patient?.name || b.patientDetails?.name || 'Patient'
  const patientAge = Number(b.patient?.age ?? b.patientDetails?.age ?? 60)
  const patientRelation = b.patient?.relation || b.patientDetails?.relation || 'Family'

  const requirements =
    b.requirements ||
    b.specialInstructions ||
    b.patient?.specialInstructions ||
    b.patientDetails?.specialInstructions ||
    'Standard patient bedside monitoring and compassionate care support.'

  const hours = Number(b.hours || b.totalHours || 6)
  const payment = Number(b.totalAmount || b.payment || b.subtotal || Math.round(hours * 399))

  return {
    ...b,
    id,
    displayId,
    bookingId: id,
    service: b.service || b.serviceName || 'Bedside Care',
    customerName: b.customerName || (b.customer && (b.customer.fullName || b.customer.name)) || 'Customer',
    caregiverId: b.caregiverId || '',
    city: b.city || b.location?.city || 'Mumbai',
    area: b.area || b.location?.area || 'Bandra West',
    distanceKm: Number(b.distanceKm || 3.2),
    date: b.date || (b.startDateTime ? new Date(b.startDateTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
    shift,
    hours,
    payment,
    careType: b.careType || b.location?.careSetting || 'Home Care',
    patient: {
      name: patientName,
      age: patientAge,
      relation: patientRelation,
      gender: b.patient?.gender || b.patientDetails?.gender || 'Other',
      condition: b.patient?.condition || b.patientDetails?.condition || '',
    },
    requirements,
    urgency: b.urgency || (hours >= 8 ? 'High' : 'Medium'),
    postedAt: b.postedAt || b.createdAt || new Date().toISOString(),
    status,
    rawBooking: b,
  }
}

export default {
  isMongoObjectId,
  resolveServiceIcon,
  adaptWeeklyScheduleToWeekAvailability,
  adaptWeekAvailabilityToWeeklySchedule,
  adaptService,
  adaptCaregiver,
  adaptBooking,
  adaptBookingToJob,
  adaptCustomerProfile,
  adaptMessage,
  adaptNotification,
  adaptSosIncident,
  adaptVerificationDocument,
  adaptVerificationRecord,
  adaptCustomerAccount,
  adaptCaregiverAccount,
  adaptFlaggedMessage,
  adaptComplaint,
  normalizeBookingStatus,
  normalizeVerificationStatus,
  normalizeComplaintStatus,
  denormalizeComplaintStatus,
  buildBookingTimeline,
  normalizePaymentStatus,
  normalizePayoutStatus,
  adaptTransaction,
  adaptPayout,
  adaptCommission,
}


