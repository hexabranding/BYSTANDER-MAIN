import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCounts,
} from '../src/services/messageService.js'
import {
  getNotifications,
  getUnreadCount,
  markOneAsRead,
  markAllAsRead,
} from '../src/services/notificationService.js'
import {
  raiseSos,
  getSosIncidents,
  getSosById,
  addTimelineNote,
} from '../src/services/sosService.js'
import {
  adaptMessage,
  adaptNotification,
  adaptSosIncident,
} from '../src/services/adapters.js'

describe('Step 12E — Messaging, Notifications & SOS Integration Tests', () => {
  let mockFetchCalls = []

  const MOCK_USER_ID = '67119999c3d4e5f6a7b8c999'
  const MOCK_CAREGIVER_USER_ID = '67118888c3d4e5f6a7b8c888'
  const MOCK_BOOKING_ID = '6711a1b2c3d4e5f6a7b8c9d0'
  const MOCK_MESSAGE_ID = '6711e1f2a3b4c5d6e7f8a9b0'
  const MOCK_NOTIFICATION_ID = '6711d1e2f3a4b5c6d7e8f9a0'
  const MOCK_SOS_ID = '6711c1d2e3f4a5b6c7d8e9f0'

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // ---------------- MESSAGING ROUTES ----------------

      // 1. GET /api/messages/unread
      if (urlStr.includes('/api/messages/unread') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              totalUnread: 3,
              unreadByBooking: [
                { bookingId: MOCK_BOOKING_ID, unreadCount: 3 },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 2. POST /api/messages (Send message)
      if (urlStr.endsWith('/api/messages') && method === 'POST') {
        if (!body.bookingId || !body.content) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'bookingId and non-empty content are required',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Simulate closed booking check
        if (body.bookingId === '6711deaddeaddeaddeaddead') {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Cannot send messages for a booking in 'cancelled' status. Messaging is only permitted during pending, confirmed, or in-progress care engagements.",
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const isFlagged = body.content.includes('9876543210') || body.content.includes('@upi')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Message sent successfully',
            data: {
              _id: MOCK_MESSAGE_ID,
              booking: body.bookingId,
              sender: {
                _id: MOCK_USER_ID,
                fullName: 'Priya Sharma',
                email: 'priya@example.com',
                role: 'customer',
              },
              senderRole: 'customer',
              recipient: {
                _id: MOCK_CAREGIVER_USER_ID,
                fullName: 'Ananya Deshmukh',
                email: 'ananya@example.com',
                role: 'caregiver',
              },
              recipientRole: 'caregiver',
              content: body.content,
              isFlagged,
              flaggedReasons: isFlagged ? ['Potential off-platform phone number detected'] : [],
              read: false,
              createdAt: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 3. GET /api/messages/booking/:bookingId
      if (urlStr.includes('/api/messages/booking/') && method === 'GET') {
        const id = urlStr.split('/api/messages/booking/')[1]?.split('?')[0]
        if (id === '671140300000000000000403') {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'You are not authorized to view messages for this booking',
            }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: '6711msg111111111111111111',
                booking: id,
                sender: { _id: MOCK_CAREGIVER_USER_ID, fullName: 'Ananya Deshmukh', role: 'caregiver' },
                senderRole: 'caregiver',
                recipient: { _id: MOCK_USER_ID, fullName: 'Priya Sharma', role: 'customer' },
                recipientRole: 'customer',
                content: 'I have arrived and taken Mrs. Radhika’s BP reading.',
                read: true,
                createdAt: '2026-10-18T08:00:00.000Z',
              },
              {
                _id: '6711msg222222222222222222',
                booking: id,
                sender: { _id: MOCK_USER_ID, fullName: 'Priya Sharma', role: 'customer' },
                senderRole: 'customer',
                recipient: { _id: MOCK_CAREGIVER_USER_ID, fullName: 'Ananya Deshmukh', role: 'caregiver' },
                recipientRole: 'caregiver',
                content: 'Thank you Ananya, please keep me posted on the vitals.',
                read: false,
                createdAt: '2026-10-18T08:05:00.000Z',
              },
            ],
            pagination: { total: 2, page: 1, limit: 20, pages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 4. PATCH /api/messages/booking/:bookingId/read
      if (urlStr.includes('/api/messages/booking/') && urlStr.endsWith('/read') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Messages marked as read successfully',
            data: { modifiedCount: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // ---------------- NOTIFICATIONS ROUTES ----------------

      // 5. GET /api/notifications/unread
      if (urlStr.includes('/api/notifications/unread') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: { count: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 6. GET /api/notifications
      if (urlStr.includes('/api/notifications') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_NOTIFICATION_ID,
                recipient: MOCK_USER_ID,
                type: 'booking_confirmed',
                title: 'Booking Confirmed',
                message: 'Your caregiver Ananya Deshmukh has confirmed your visit.',
                read: false,
                createdAt: new Date().toISOString(),
              },
              {
                _id: '6711d2e3f4a5b6c7d8e9f002',
                recipient: MOCK_USER_ID,
                type: 'sos_raised',
                title: '🚨 Emergency SOS Incident Raised',
                message: 'Emergency SOS was raised for booking #C9D0AA',
                read: true,
                createdAt: new Date(Date.now() - 3600000).toISOString(),
              },
            ],
            pagination: { total: 2, page: 1, limit: 20, pages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 7. PATCH /api/notifications/:id/read
      if (urlStr.includes('/api/notifications/') && urlStr.endsWith('/read') && method === 'PATCH') {
        const id = urlStr.split('/api/notifications/')[1].split('/read')[0]
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Notification marked as read',
            data: {
              _id: id,
              recipient: MOCK_USER_ID,
              type: 'booking_confirmed',
              title: 'Booking Confirmed',
              message: 'Your caregiver has confirmed your visit.',
              read: true,
              updatedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 8. PATCH /api/notifications/read-all
      if (urlStr.endsWith('/api/notifications/read-all') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Notifications marked as read',
            data: { modifiedCount: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // ---------------- SOS ROUTES ----------------

      // 9. POST /api/sos (Raise SOS)
      if (urlStr.endsWith('/api/sos') && method === 'POST') {
        if (!body.bookingId || !body.summary || body.summary.length < 5) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Emergency summary must be at least 5 characters',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Simulate closed booking check
        if (body.bookingId === '6711deaddeaddeaddeaddead') {
          return new Response(
            JSON.stringify({
              success: false,
              message: "Cannot raise an SOS for a booking with status 'cancelled'. SOS can only be raised for confirmed, in-progress, or active care engagements.",
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'SOS incident raised successfully',
            data: {
              _id: MOCK_SOS_ID,
              incidentNumber: 'SOS-20261019-84721',
              booking: body.bookingId,
              raisedBy: { _id: MOCK_USER_ID, fullName: 'Priya Sharma' },
              raisedByRole: 'customer',
              customer: { _id: MOCK_USER_ID, fullName: 'Priya Sharma' },
              caregiverUser: { _id: MOCK_CAREGIVER_USER_ID, fullName: 'Ananya Deshmukh' },
              priority: body.priority || 'Critical',
              status: 'Open',
              location: body.location || { isAvailable: false, label: 'Location not shared' },
              summary: body.summary,
              emergencyContactNotification: {
                status: 'not_configured',
                attempted: false,
                attemptedAt: null,
                contactName: 'Ramesh Sharma',
                contactRelation: 'Spouse',
                notes: 'Automated SMS/Telephony emergency dispatch provider is not configured in this environment.',
              },
              timeline: [
                {
                  _id: '6711tl111111111111111111',
                  at: new Date().toISOString(),
                  action: 'SOS Incident Raised',
                  by: { _id: MOCK_USER_ID, fullName: 'Priya Sharma' },
                  byRole: 'customer',
                  notes: body.summary,
                },
              ],
              createdAt: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 10. GET /api/sos
      if (urlStr.includes('/api/sos') && method === 'GET' && !urlStr.includes('/api/sos/')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_SOS_ID,
                incidentNumber: 'SOS-20261019-84721',
                booking: MOCK_BOOKING_ID,
                priority: 'Critical',
                status: 'Open',
                summary: 'Patient feeling severe dizziness and chest tightness.',
                location: { isAvailable: false, label: 'Location not shared' },
                emergencyContactNotification: {
                  status: 'not_configured',
                  attempted: false,
                  notes: 'Automated dispatch is not configured.',
                },
                timeline: [
                  {
                    at: new Date().toISOString(),
                    action: 'SOS Incident Raised',
                    byRole: 'customer',
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: { total: 1, page: 1, limit: 20, pages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 11. GET /api/sos/:id
      if (urlStr.includes('/api/sos/') && method === 'GET') {
        const id = urlStr.split('/api/sos/')[1]
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: id,
              incidentNumber: 'SOS-20261019-84721',
              booking: MOCK_BOOKING_ID,
              priority: 'Critical',
              status: 'Open',
              summary: 'Patient feeling severe dizziness and chest tightness.',
              location: {
                isAvailable: true,
                label: 'Hiranandani Gardens, Powai',
                latitude: 19.1176,
                longitude: 72.906,
                accuracy: 12.5,
              },
              emergencyContactNotification: {
                status: 'not_configured',
                attempted: false,
                notes: 'Automated dispatch is not configured.',
              },
              timeline: [
                {
                  at: '2026-10-19T09:00:00.000Z',
                  action: 'SOS Incident Raised',
                  byRole: 'customer',
                  notes: 'Urgent assistance needed',
                },
              ],
              createdAt: '2026-10-19T09:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 12. POST /api/sos/:id/timeline
      if (urlStr.includes('/api/sos/') && urlStr.endsWith('/timeline') && method === 'POST') {
        const id = urlStr.split('/api/sos/')[1].split('/timeline')[0]
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Timeline note appended successfully',
            data: {
              _id: id,
              incidentNumber: 'SOS-20261019-84721',
              timeline: [
                {
                  at: new Date().toISOString(),
                  action: body.action,
                  byRole: 'customer',
                  notes: body.notes || null,
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    }
  })

  // ==================== MESSAGING TESTS ====================

  it('1. Sends message with bookingId and adapts response with from: me and timestamp', async () => {
    const res = await sendMessage(MOCK_BOOKING_ID, 'Hello Ananya, please confirm arrival time.', MOCK_USER_ID)

    assert.equal(res.id, MOCK_MESSAGE_ID)
    assert.equal(res.bookingId, MOCK_BOOKING_ID)
    assert.equal(res.from, 'me')
    assert.equal(res.text, 'Hello Ananya, please confirm arrival time.')
    assert.equal(res.isFlagged, false)
    assert.equal(res.senderName, 'Priya Sharma')
    assert.equal(res.recipientName, 'Ananya Deshmukh')
  })

  it('2. Detects and flags off-platform phone number patterns without blocking dispatch', async () => {
    const res = await sendMessage(MOCK_BOOKING_ID, 'Call me directly on 9876543210', MOCK_USER_ID)

    assert.equal(res.isFlagged, true)
    assert.ok(res.flaggedReasons.length > 0)
    assert.equal(res.flaggedReasons[0], 'Potential off-platform phone number detected')
  })

  it('3. Rejects sending a message client-side when content is empty or bookingId is invalid', async () => {
    await assert.rejects(
      async () => sendMessage(MOCK_BOOKING_ID, '   '),
      /Message content cannot be empty/,
    )

    await assert.rejects(
      async () => sendMessage('invalid-id', 'Hello'),
      /A valid booking identifier \(ObjectId\) is required/,
    )
  })

  it('4. Rejects sending message for cancelled booking without fake success', async () => {
    await assert.rejects(
      async () => sendMessage('6711deaddeaddeaddeaddead', 'Hello there'),
      /Cannot send messages for a booking in 'cancelled' status/,
    )
  })

  it('5. Retrieves paginated message history and marks incoming messages as read', async () => {
    const history = await getMessages(MOCK_BOOKING_ID, { limit: 20 }, MOCK_USER_ID)
    assert.equal(history.messages.length, 2)
    assert.equal(history.pagination.total, 2)
    // First message is from caretaker
    assert.equal(history.messages[0].from, 'them')
    assert.equal(history.messages[0].senderName, 'Ananya Deshmukh')
    // Second message is from caller
    assert.equal(history.messages[1].from, 'me')

    const readRes = await markMessagesAsRead(MOCK_BOOKING_ID)
    assert.equal(readRes.modifiedCount, 1)

    const unread = await getUnreadCounts()
    assert.equal(unread.totalUnread, 3)
    assert.equal(unread.unreadByBooking.length, 1)
  })

  it('6. Propagates 403 Forbidden when unauthorized user accesses booking messages', async () => {
    await assert.rejects(
      async () => getMessages('671140300000000000000403'),
      /You are not authorized to view messages for this booking/,
    )
  })

  // ==================== NOTIFICATIONS TESTS ====================

  it('7. Fetches paginated notifications and adapts tone and unread status accurately', async () => {
    const res = await getNotifications({ limit: 10 })
    assert.equal(res.notifications.length, 2)
    assert.equal(res.notifications[0].tone, 'success') // booking_confirmed -> success
    assert.equal(res.notifications[0].read, false)
    assert.equal(res.notifications[1].tone, 'danger') // sos_raised -> danger
    assert.equal(res.notifications[1].read, true)

    const unread = await getUnreadCount()
    assert.equal(unread.count, 2)
  })

  it('8. Marks single notification as read and marks all as read in bulk', async () => {
    const markedOne = await markOneAsRead(MOCK_NOTIFICATION_ID)
    assert.equal(markedOne.id, MOCK_NOTIFICATION_ID)
    assert.equal(markedOne.read, true)

    const markedAll = await markAllAsRead()
    assert.equal(markedAll.modifiedCount, 2)
  })

  // ==================== SOS TESTS ====================

  it('9. Raises emergency SOS with zero fabricated coordinates when location is unavailable', async () => {
    const res = await raiseSos({
      bookingId: MOCK_BOOKING_ID,
      summary: 'Patient fell down and is unable to stand up.',
      priority: 'Critical',
      location: { isAvailable: false, label: 'Location not shared' },
    })

    assert.equal(res.id, MOCK_SOS_ID)
    assert.equal(res.incidentNumber, 'SOS-20261019-84721')
    assert.equal(res.status, 'Open')
    assert.equal(res.location.isAvailable, false)
    assert.equal(res.location.latitude, null)
    assert.equal(res.location.longitude, null)

    // Authority check: Emergency dispatch status must explicitly reflect not_configured
    assert.equal(res.emergencyContactNotification.status, 'not_configured')
    assert.equal(res.emergencyContactNotified, false)
    assert.ok(res.emergencyContactNotification.notes.includes('not configured'))
  })

  it('10. Raises emergency SOS with genuine device coordinates when permission granted', async () => {
    const res = await raiseSos({
      bookingId: MOCK_BOOKING_ID,
      summary: 'Extreme breathing difficulty observed.',
      priority: 'High',
      location: {
        latitude: 19.1176,
        longitude: 72.906,
        accuracy: 15.0,
        label: 'Powai, Mumbai',
      },
    })

    const postCall = mockFetchCalls.find((c) => c.url.endsWith('/api/sos') && c.body?.priority === 'High')
    assert.ok(postCall)
    assert.equal(postCall.body.location.isAvailable, true)
    assert.equal(postCall.body.location.latitude, 19.1176)
    assert.equal(postCall.body.location.longitude, 72.906)
  })

  it('11. Rejects SOS creation client-side when summary is under 5 characters', async () => {
    await assert.rejects(
      async () =>
        raiseSos({
          bookingId: MOCK_BOOKING_ID,
          summary: 'Help',
        }),
      /Emergency summary must be at least 5 characters/,
    )
  })

  it('12. Rejects SOS for cancelled booking without fake success', async () => {
    await assert.rejects(
      async () =>
        raiseSos({
          bookingId: '6711deaddeaddeaddeaddead',
          summary: 'Patient experiencing chest pains',
        }),
      /Cannot raise an SOS for a booking with status 'cancelled'/,
    )
  })

  it('13. Retrieves SOS incident details and appends operational timeline note', async () => {
    const incident = await getSosById(MOCK_SOS_ID)
    assert.equal(incident.id, MOCK_SOS_ID)
    assert.equal(incident.incidentNumber, 'SOS-20261019-84721')
    assert.equal(incident.location.isAvailable, true)
    assert.equal(incident.location.latitude, 19.1176)

    const updated = await addTimelineNote(MOCK_SOS_ID, {
      action: 'Family member arrived at hospital',
      notes: 'Patient stabilized',
    })
    assert.equal(updated.id, MOCK_SOS_ID)
  })
})
