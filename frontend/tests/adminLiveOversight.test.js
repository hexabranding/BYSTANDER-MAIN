import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getSosIncidents,
  getSosById,
  assignSos,
  addTimelineNote,
  resolveSos,
} from '../src/services/sosService.js'
import {
  getBookings,
  getBookingById,
  cancelBooking,
} from '../src/services/bookingService.js'
import {
  getVerifications,
  getVerificationById,
  updateDocumentStatus,
  updateCaregiverVerificationStatus,
} from '../src/services/adminService.js'
import {
  adaptSosIncident,
  adaptBooking,
  adaptVerificationRecord,
  adaptVerificationDocument,
} from '../src/services/adapters.js'

describe('Step 13B — Admin Live Oversight & Operational Safety Tests', () => {
  let mockFetchCalls = []

  const MOCK_ADMIN_ID = '67119999c3d4e5f6a7b8c999'
  const MOCK_CAREGIVER_ID = '67118888c3d4e5f6a7b8c888'
  const MOCK_BOOKING_ID = '6711a1b2c3d4e5f6a7b8c9d0'
  const MOCK_SOS_ID = '6711c1d2e3f4a5b6c7d8e9f0'
  const MOCK_DOC_ID = '6711f1e2d3c4b5a697887766'

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // 1. GET /api/sos
      if (urlStr.includes('/api/sos') && !urlStr.includes('/api/sos/') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_SOS_ID,
                incidentNumber: 'SOS-9E9F0',
                booking: {
                  _id: MOCK_BOOKING_ID,
                  serviceName: 'Dementia Care Vigil',
                  status: 'confirmed',
                },
                priority: 'Critical',
                status: 'Open',
                summary: 'Patient experiencing severe disorientation and agitation.',
                location: {
                  isAvailable: false,
                  label: 'Location not shared',
                  latitude: null,
                  longitude: null,
                },
                emergencyContactNotification: {
                  status: 'not_configured',
                  attempted: false,
                  notes: 'External emergency telephony/SMS dispatch is not configured.',
                },
                timeline: [
                  {
                    at: new Date().toISOString(),
                    action: 'SOS Incident Raised',
                    byRole: 'caregiver',
                  },
                ],
                createdAt: new Date().toISOString(),
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 2. PATCH /api/sos/:id/assign
      if (urlStr.includes(`/api/sos/${MOCK_SOS_ID}/assign`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'SOS incident assigned to operations desk',
            data: {
              _id: MOCK_SOS_ID,
              incidentNumber: 'SOS-9E9F0',
              status: 'Under Investigation',
              assignedTo: { _id: MOCK_ADMIN_ID, fullName: 'Operations Admin' },
              timeline: [
                {
                  at: new Date().toISOString(),
                  action: 'Assigned to Operations Desk',
                  byRole: 'admin',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 3. PATCH /api/sos/:id/resolve
      if (urlStr.includes(`/api/sos/${MOCK_SOS_ID}/resolve`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'SOS incident marked as Resolved',
            data: {
              _id: MOCK_SOS_ID,
              incidentNumber: 'SOS-9E9F0',
              status: 'Resolved',
              resolution: {
                resolvedAt: new Date().toISOString(),
                resolvedBy: MOCK_ADMIN_ID,
                resolutionNotes: body.resolutionNotes,
              },
              timeline: [
                {
                  at: new Date().toISOString(),
                  action: 'Incident Closed as Resolved',
                  byRole: 'admin',
                  notes: body.resolutionNotes,
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 4. GET /api/bookings (Platform-wide admin listing)
      if (urlStr.includes('/api/bookings') && !urlStr.includes('/api/bookings/') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_BOOKING_ID,
                bookingReference: 'BK-OCT-9901',
                customer: { _id: '67117777c3d4e5f6a7b8c777', fullName: 'Anita Roy' },
                caregiver: {
                  _id: MOCK_CAREGIVER_ID,
                  qualification: 'BSc Nursing',
                  user: { fullName: 'Pooja Varma' },
                },
                service: { name: 'Post-Surgery Recovery', baseHourlyRate: 599 },
                status: 'confirmed',
                totalAmount: 4200,
                startDateTime: '2026-10-25T08:00:00.000Z',
                endDateTime: '2026-10-25T14:00:00.000Z',
                location: { city: 'Mumbai', addressLine: 'Bandra West' },
                patientDetails: { name: 'Dev Roy', age: 72 },
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 5. PATCH /api/bookings/:id/cancel
      if (urlStr.includes(`/api/bookings/${MOCK_BOOKING_ID}/cancel`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
              _id: MOCK_BOOKING_ID,
              status: 'cancelled',
              cancellationReason: body.reason,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // In-progress booking rejection: /api/bookings/in_progress_id/cancel
      if (urlStr.includes('/api/bookings/671199999999999999999999/cancel') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Cannot cancel a booking engagement that is actively in progress. Please contact support.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 6. GET /api/admin/verifications
      if (urlStr.includes('/api/admin/verifications') && !urlStr.includes('/documents/') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: MOCK_CAREGIVER_ID,
                user: {
                  _id: '67115555c3d4e5f6a7b8c555',
                  fullName: 'Sunita Rao',
                  email: 'sunita.rao@example.com',
                  phone: '+919876543210',
                  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
                  status: 'pending_verification',
                },
                qualification: 'BSc Nursing',
                nursingRegNo: 'MNC-2023-7766',
                city: 'Mumbai, MH',
                verificationStatus: 'under_review',
                trustScore: 80,
                createdAt: '2026-10-12T10:00:00.000Z',
                documents: [
                  {
                    _id: MOCK_DOC_ID,
                    documentType: 'nursing_registration',
                    fileName: 'council_reg.pdf',
                    fileSize: 184000,
                    mimeType: 'application/pdf',
                    verificationStatus: 'under_review',
                    reviewerNotes: 'Under review by operations desk.',
                    createdAt: '2026-10-12T10:05:00.000Z',
                  },
                ],
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 7. PATCH /api/admin/verifications/documents/:documentId
      if (urlStr.includes(`/api/admin/verifications/documents/${MOCK_DOC_ID}`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Document status updated to 'verified'",
            data: {
              _id: MOCK_DOC_ID,
              documentType: 'nursing_registration',
              fileName: 'council_reg.pdf',
              verificationStatus: 'verified',
              reviewerNotes: body.notes || 'Approved by admin',
              reviewedBy: { fullName: 'Operations Admin' },
              reviewedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 8. PATCH /api/admin/verifications/:id/status
      if (urlStr.includes(`/api/admin/verifications/${MOCK_CAREGIVER_ID}/status`) && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Caregiver verification status updated to 'verified'",
            data: {
              _id: MOCK_CAREGIVER_ID,
              verificationStatus: 'verified',
              trustScore: body.trustScore || 90,
              user: {
                _id: '67115555c3d4e5f6a7b8c555',
                fullName: 'Sunita Rao',
                status: 'active',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ success: false, error: { message: 'Not Found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })

  // ---------------------------------------------------------------------------
  // 1. Admin SOS Incident Management & Triage
  // ---------------------------------------------------------------------------
  it('1. Fetches live SOS incidents and verifies authoritative dispatch status', async () => {
    const result = await getSosIncidents()
    assert.equal(result.incidents.length, 1)

    const incident = result.incidents[0]
    assert.equal(incident.id, MOCK_SOS_ID)
    assert.equal(incident.priority, 'Critical')
    assert.equal(incident.status, 'Open')
    assert.equal(incident.location.isAvailable, false)
    // Authoritative dispatch status: unconfigured external telephony
    assert.equal(incident.emergencyContactNotification.status, 'not_configured')
    assert.equal(incident.emergencyContactNotified, false)
    assert.match(incident.emergencyContactNotification.notes, /not configured/i)
  })

  it('2. Assigns SOS incident to operations desk and updates timeline note', async () => {
    const updated = await assignSos(MOCK_SOS_ID, MOCK_ADMIN_ID)
    assert.equal(updated.id, MOCK_SOS_ID)
    assert.equal(updated.status, 'Under Investigation')

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.equal(lastCall.method, 'PATCH')
    assert.match(lastCall.url, new RegExp(`/api/sos/${MOCK_SOS_ID}/assign`))
    assert.equal(lastCall.body.assignedTo, MOCK_ADMIN_ID)
  })

  it('3. Resolves SOS incident with required operational resolution notes', async () => {
    const resolutionNotes = 'Caregiver confirmed patient stabilized; family contacted manually.'
    const resolved = await resolveSos(MOCK_SOS_ID, {
      status: 'Resolved',
      resolutionNotes,
    })
    assert.equal(resolved.id, MOCK_SOS_ID)
    assert.equal(resolved.status, 'Resolved')

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.equal(lastCall.method, 'PATCH')
    assert.equal(lastCall.body.status, 'Resolved')
    assert.equal(lastCall.body.resolutionNotes, resolutionNotes)
  })

  // ---------------------------------------------------------------------------
  // 2. Admin Booking Oversight & Permitted Cancellation
  // ---------------------------------------------------------------------------
  it('4. Retrieves platform-wide bookings for admin oversight', async () => {
    const result = await getBookings()
    assert.equal(result.bookings.length, 1)

    const booking = result.bookings[0]
    assert.equal(booking.id, MOCK_BOOKING_ID)
    assert.equal(booking.customerName, 'Anita Roy')
    assert.equal(booking.caregiverName, 'Pooja Varma')
    assert.equal(booking.service, 'Post-Surgery Recovery')
    assert.equal(booking.status, 'Confirmed')
  })

  it('5. Cancels an eligible confirmed booking engagement with required reason', async () => {
    const reason = 'Emergency shift cancellation approved by operations desk'
    const cancelled = await cancelBooking(MOCK_BOOKING_ID, reason)
    assert.equal(cancelled.id, MOCK_BOOKING_ID)
    assert.equal(cancelled.status, 'Cancelled')

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.equal(lastCall.method, 'PATCH')
    assert.equal(lastCall.body.reason, reason)
  })

  it('6. Rejects cancellation of an in-progress booking without claiming fake success', async () => {
    const inProgressId = '671199999999999999999999'
    await assert.rejects(
      async () => {
        await cancelBooking(inProgressId, 'Shift cancellation attempted')
      },
      (err) => {
        assert.match(err.message, /in progress/i)
        return true
      },
    )
  })

  // ---------------------------------------------------------------------------
  // 3. Caregiver Verification & Document Review
  // ---------------------------------------------------------------------------
  it('7. Retrieves caregiver verification queue with masked document metadata', async () => {
    const result = await getVerifications()
    assert.equal(result.verifications.length, 1)

    const record = result.verifications[0]
    assert.equal(record.id, MOCK_CAREGIVER_ID)
    assert.equal(record.name, 'Sunita Rao')
    assert.equal(record.qualification, 'BSc Nursing')
    assert.equal(record.regNo, 'MNC-2023-7766')
    assert.equal(record.status, 'Under Review')
    assert.equal(record.documents.length, 1)

    const doc = record.documents[0]
    assert.equal(doc.id, MOCK_DOC_ID)
    assert.equal(doc.type, 'Nursing Council Registration')
    assert.equal(doc.status, 'Under Review')
    // Security check: private fileKey must NEVER be present
    assert.equal(doc.fileKey, undefined)
  })

  it('8. Approves an individual document with admin audit notes', async () => {
    const updatedDoc = await updateDocumentStatus(MOCK_DOC_ID, {
      status: 'verified',
      notes: 'State nursing council registration active and verified.',
    })
    assert.equal(updatedDoc.id, MOCK_DOC_ID)
    assert.equal(updatedDoc.status, 'Verified')
    assert.equal(updatedDoc.reviewerNotes, 'State nursing council registration active and verified.')

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.equal(lastCall.method, 'PATCH')
    assert.equal(lastCall.body.status, 'verified')
  })

  it('9. Updates overall caregiver verification status and trust score', async () => {
    const updatedCaregiver = await updateCaregiverVerificationStatus(MOCK_CAREGIVER_ID, {
      status: 'verified',
      reason: 'All submitted identity and nursing credentials verified.',
      trustScore: 92,
    })
    assert.equal(updatedCaregiver.id, MOCK_CAREGIVER_ID)
    assert.equal(updatedCaregiver.status, 'Verified')
    assert.equal(updatedCaregiver.overallScore, 92)

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.equal(lastCall.method, 'PATCH')
    assert.equal(lastCall.body.status, 'verified')
    assert.equal(lastCall.body.trustScore, 92)
  })

  it('10. Client-side input validation rejects invalid IDs and missing status', async () => {
    await assert.rejects(
      async () => {
        await updateDocumentStatus('', { status: 'verified' })
      },
      /identifier is required/i,
    )

    await assert.rejects(
      async () => {
        await updateDocumentStatus(MOCK_DOC_ID, {})
      },
      /status is required/i,
    )

    await assert.rejects(
      async () => {
        await updateCaregiverVerificationStatus('', { status: 'verified' })
      },
      /identifier is required/i,
    )
  })
})
