import { createContext, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { BOOKINGS } from '@/data/bookings'
import { CAREGIVERS } from '@/data/caregivers'
import { REVIEWS, FAQS, TESTIMONIALS, HOW_IT_WORKS, WHY_CHOOSE } from '@/data/content'
import { AVAILABLE_JOBS, COMPLAINTS, SOS_ALERTS, FRAUD_ALERTS, BLACKLIST, NOTIFICATIONS } from '@/data/operations'
import { VERIFICATIONS } from '@/data/verifications'
import { TRANSACTIONS, PAYOUTS, COMMISSIONS, EARNINGS_TXNS } from '@/data/finance'
import { CONVERSATIONS } from '@/data/messages'
import { bookingRef, uid } from '@/utils/format'

const DataContext = createContext(null)

const seed = () => ({
  bookings: BOOKINGS,
  caregivers: CAREGIVERS,
  verifications: VERIFICATIONS,
  jobs: AVAILABLE_JOBS,
  complaints: COMPLAINTS,
  sos: SOS_ALERTS,
  notifications: NOTIFICATIONS,
  reviews: REVIEWS,
  conversations: CONVERSATIONS,
  transactions: TRANSACTIONS,
  payouts: PAYOUTS,
  commissions: COMMISSIONS,
  earnings: EARNINGS_TXNS,
  blacklist: BLACKLIST,
  frauds: FRAUD_ALERTS,
})

export function DataProvider({ children }) {
  const [store, setStore, clearStore] = useLocalStorage('caremate.store', seed)

  const patch = useCallback((key, updater) => {
    setStore((prev) => ({
      ...prev,
      [key]: typeof updater === 'function' ? updater(prev[key]) : updater,
    }))
  }, [setStore])

  /* ---------------- bookings ---------------- */

  const createBooking = useCallback(
    (payload) => {
      const id = `BK-${Math.floor(4830 + Math.random() * 90)}`
      const now = new Date().toISOString()
      const booking = {
        id,
        ref: bookingRef(),
        status: 'Pending',
        paymentStatus: 'Pending',
        createdAt: now,
        invoiceNo: `INV-2026-${Math.floor(1000 + Math.random() * 8000)}`,
        timeline: [
          { label: 'Booking requested', status: 'completed', at: now },
          { label: 'Caregiver assigned', status: 'upcoming', at: null },
          { label: 'Service started', status: 'upcoming', at: null },
          { label: 'Service completed', status: 'upcoming', at: null },
          { label: 'Payment settled', status: 'upcoming', at: null },
        ],
        ...payload,
      }
      patch('bookings', (list) => [booking, ...list])
      return booking
    },
    [patch],
  )

  const updateBooking = useCallback(
    (id, changes) => {
      patch('bookings', (list) => list.map((b) => (b.id === id ? { ...b, ...changes } : b)))
    },
    [patch],
  )

  const confirmBooking = useCallback(
    (id) => {
      const now = new Date().toISOString()
      patch('bookings', (list) =>
        list.map((b) =>
          b.id === id
            ? {
                ...b,
                status: 'Confirmed',
                paymentStatus: 'Escrow Held',
                timeline: b.timeline.map((t) =>
                  t.label === 'Caregiver assigned' ? { ...t, status: 'completed', at: now } : t,
                ),
              }
            : b,
        ),
      )
    },
    [patch],
  )

  const cancelBooking = useCallback(
    (id, reason = '') => {
      const now = new Date().toISOString()
      patch('bookings', (list) =>
        list.map((b) =>
          b.id === id
            ? {
                ...b,
                status: 'Cancelled',
                paymentStatus: b.paymentStatus === 'Paid' ? 'Refunded' : b.paymentStatus,
                cancelReason: reason,
                timeline: [...b.timeline, { label: `Cancelled${reason ? ` — ${reason}` : ''}`, status: 'completed', at: now }],
              }
            : b,
        ),
      )
    },
    [patch],
  )

  const advanceBooking = useCallback(
    (id, step) => {
      const now = new Date().toISOString()
      const map = {
        start: 'Service started',
        complete: 'Service completed',
        settle: 'Payment settled',
      }
      const label = map[step]
      patch('bookings', (list) =>
        list.map((b) => {
          if (b.id !== id) return b
          const timeline = b.timeline.map((t) => (t.label === label ? { ...t, status: 'completed', at: now } : t))
          const status =
            step === 'start' ? 'In Progress' : step === 'complete' ? 'Completed' : b.status
          const paymentStatus = step === 'settle' ? 'Paid' : b.paymentStatus
          return { ...b, timeline, status, paymentStatus }
        }),
      )
    },
    [patch],
  )

  /* ---------------- jobs ---------------- */

  const acceptJob = useCallback(
    (jobId) => {
      let created = null
      patch('jobs', (list) => list.map((j) => (j.id === jobId ? { ...j, status: 'Accepted' } : j)))
      setStore((prev) => {
        const job = prev.jobs.find((j) => j.id === jobId)
        if (!job) return prev
        created = {
          id: job.bookingId,
          ref: bookingRef(),
          customerId: 'cu-202',
          caregiverId: job.caregiverId,
          service: job.service,
          patient: job.patient,
          careType: job.careType,
          address: `${job.area}, ${job.city}`,
          city: job.city,
          date: job.date,
          startTime: job.shift.split(' – ')[0],
          hours: job.hours,
          status: 'Confirmed',
          paymentStatus: 'Escrow Held',
          createdAt: new Date().toISOString(),
          invoiceNo: `INV-2026-${Math.floor(1000 + Math.random() * 8000)}`,
          hourlyRate: Math.round(job.payment / job.hours),
          subtotal: job.payment,
          platformFee: 49,
          commission: Math.round(job.payment * 0.12),
          tax: Math.round((job.payment + 49) * 0.18),
          total: job.payment + 49 + Math.round((job.payment + 49) * 0.18),
          notes: job.requirements,
          specialInstructions: '',
          timeline: [
            { label: 'Booking requested', status: 'completed', at: job.postedAt },
            { label: 'Caregiver assigned', status: 'completed', at: new Date().toISOString() },
            { label: 'Service started', status: 'upcoming', at: null },
            { label: 'Service completed', status: 'upcoming', at: null },
            { label: 'Payment settled', status: 'upcoming', at: null },
          ],
          isFromJob: true,
        }
        const exists = prev.bookings.some((b) => b.id === job.bookingId)
        return {
          ...prev,
          bookings: exists ? prev.bookings : [created, ...prev.bookings],
          notifications: [
            {
              id: uid('nt'),
              title: 'Job accepted',
              body: `${job.service} on ${job.date} added to your schedule.`,
              time: new Date().toISOString(),
              tone: 'success',
              audience: ['caregiver', 'admin'],
              read: false,
            },
            ...prev.notifications,
          ],
        }
      })
      return created
    },
    [patch, setStore],
  )

  const rejectJob = useCallback(
    (jobId) => {
      patch('jobs', (list) => list.map((j) => (j.id === jobId ? { ...j, status: 'Declined' } : j)))
      patch('notifications', (list) => [
        {
          id: uid('nt'),
          title: 'Job declined',
          body: 'The shift has been released to other verified caregivers.',
          time: new Date().toISOString(),
          tone: 'info',
          audience: ['caregiver', 'admin'],
          read: false,
        },
        ...list,
      ])
    },
    [patch],
  )

  /* ---------------- verification ---------------- */

  const updateDocument = useCallback(
    (verificationId, docId, changes) => {
      patch('verifications', (list) =>
        list.map((v) =>
          v.id === verificationId
            ? {
                ...v,
                documents: v.documents.map((d) => (d.id === docId ? { ...d, ...changes } : d)),
                history: [
                  ...v.history,
                  {
                    at: new Date().toISOString(),
                    action: `Document ${String(changes.status || '').toLowerCase()}`,
                    by: 'Kavya Raman',
                  },
                ],
              }
            : v,
        ),
      )
    },
    [patch],
  )

  const setVerificationStatus = useCallback(
    (verificationId, status, note = '') => {
      patch('verifications', (list) =>
        list.map((v) =>
          v.id === verificationId
            ? {
                ...v,
                status,
                history: [
                  ...v.history,
                  { at: new Date().toISOString(), action: note || `Application ${status.toLowerCase()}`, by: 'Kavya Raman' },
                ],
              }
            : v,
        ),
      )
      const record = store.verifications.find((v) => v.id === verificationId)
      if (record) {
        patch('caregivers', (list) =>
          list.map((c) => (c.id === record.caregiverId ? { ...c, verificationStatus: status, verified: status === 'Verified' } : c)),
        )
      }
    },
    [patch, store.verifications],
  )

  /* ---------------- complaints & SOS ---------------- */

  const createComplaint = useCallback(
    (payload) => {
      const id = `CP-${Math.floor(1200 + Math.random() * 90)}`
      const now = new Date().toISOString()
      const complaint = {
        id,
        status: 'Submitted',
        submittedOn: now,
        internalNotes: [],
        evidence: [],
        resolution: '',
        audit: [{ at: now, action: 'Complaint submitted', by: payload.complainant }],
        ...payload,
      }
      patch('complaints', (list) => [complaint, ...list])
      return complaint
    },
    [patch],
  )

  const updateComplaint = useCallback(
    (id, changes, auditAction = '') => {
      patch('complaints', (list) =>
        list.map((c) =>
          c.id === id
            ? {
                ...c,
                ...changes,
                audit: auditAction
                  ? [...c.audit, { at: new Date().toISOString(), action: auditAction, by: 'Kavya Raman' }]
                  : c.audit,
              }
            : c,
        ),
      )
    },
    [patch],
  )

  const updateSos = useCallback(
    (id, changes, action = '') => {
      patch('sos', (list) =>
        list.map((s) =>
          s.id === id
            ? {
                ...s,
                ...changes,
                timeline: action
                  ? [...s.timeline, { at: new Date().toISOString(), action, by: 'Kavya Raman' }]
                  : s.timeline,
              }
            : s,
        ),
      )
    },
    [patch],
  )

  const createSos = useCallback(
    (payload) => {
      const id = `SOS-${Math.floor(4420 + Math.random() * 60)}`
      const now = new Date().toISOString()
      const alert = {
        id,
        status: 'Open',
        assignedTo: '',
        emergencyContactNotified: true,
        reportedAt: now,
        priority: 'Critical',
        timeline: [
          { at: now, action: 'SOS triggered from booking screen', by: payload.raisedBy },
          { at: now, action: 'Emergency contact notified (SMS)', by: 'System' },
        ],
        ...payload,
      }
      patch('sos', (list) => [alert, ...list])
      return alert
    },
    [patch],
  )

  /* ---------------- messaging, reviews, notifications ---------------- */

  const sendMessage = useCallback(
    (conversationId, text, from = 'me') => {
      patch('conversations', (list) =>
        list.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                unread: 0,
                messages: [...c.messages, { id: uid('m'), from, text, at: new Date().toISOString() }],
              }
            : c,
        ),
      )
    },
    [patch],
  )

  const markConversationRead = useCallback(
    (conversationId) => patch('conversations', (list) => list.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c))),
    [patch],
  )

  const addReview = useCallback(
    (payload) => {
      const review = { id: uid('rv'), date: new Date().toISOString().slice(0, 10), reply: '', ...payload }
      patch('reviews', (list) => [review, ...list])
      return review
    },
    [patch],
  )

  const markNotificationRead = useCallback(
    (id) => patch('notifications', (list) => list.map((n) => (n.id === id ? { ...n, read: true } : n))),
    [patch],
  )

  const markAllNotificationsRead = useCallback(() => patch('notifications', (list) => list.map((n) => ({ ...n, read: true }))), [patch])

  const addNotification = useCallback(
    (payload) => patch('notifications', (list) => [{ id: uid('nt'), time: new Date().toISOString(), read: false, tone: 'info', ...payload }, ...list]),
    [patch],
  )

  /* ---------------- misc ---------------- */

  const addBlacklist = useCallback((entry) => patch('blacklist', (list) => [{ id: uid('BL'), ...entry }, ...list]), [patch])
  const removeBlacklist = useCallback((id) => patch('blacklist', (list) => list.filter((b) => b.id !== id)), [patch])
  const updateFraud = useCallback((id, status) => patch('frauds', (list) => list.map((f) => (f.id === id ? { ...f, status } : f))), [patch])
  const updatePayout = useCallback((id, status) => patch('payouts', (list) => list.map((p) => (p.id === id ? { ...p, status } : p))), [patch])

  const resetDemoData = useCallback(() => clearStore(), [clearStore])

  const value = useMemo(
    () => ({
      ...store,
      staticContent: { faqs: FAQS, testimonials: TESTIMONIALS, howItWorks: HOW_IT_WORKS, whyChoose: WHY_CHOOSE },
      createBooking,
      updateBooking,
      confirmBooking,
      cancelBooking,
      advanceBooking,
      acceptJob,
      rejectJob,
      updateDocument,
      setVerificationStatus,
      createComplaint,
      updateComplaint,
      updateSos,
      createSos,
      sendMessage,
      markConversationRead,
      addReview,
      markNotificationRead,
      markAllNotificationsRead,
      addNotification,
      addBlacklist,
      removeBlacklist,
      updateFraud,
      updatePayout,
      resetDemoData,
    }),
    [
      store,
      createBooking,
      updateBooking,
      confirmBooking,
      cancelBooking,
      advanceBooking,
      acceptJob,
      rejectJob,
      updateDocument,
      setVerificationStatus,
      createComplaint,
      updateComplaint,
      updateSos,
      createSos,
      sendMessage,
      markConversationRead,
      addReview,
      markNotificationRead,
      markAllNotificationsRead,
      addNotification,
      addBlacklist,
      removeBlacklist,
      updateFraud,
      updatePayout,
      resetDemoData,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
