import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createBooking,
  getBookings,
  getBookingById,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  requestCheckInOtp,
  verifyCheckIn,
  requestCheckOutOtp,
  verifyCheckOut,
} from '../src/services/bookingService.js'
import { adaptBooking, isMongoObjectId } from '../src/services/adapters.js'

describe('Step 12D — Booking Lifecycle & OTP Integration Tests', () => {
  let mockFetchCalls = []
  let originalFetch = globalThis.fetch

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // 1. POST /api/bookings (Create booking)
      if (urlStr.endsWith('/api/bookings') && method === 'POST') {
        if (!body.caregiverId || !body.serviceId) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'caregiverId and serviceId are required ObjectIds',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const newId = '6711a1b2c3d4e5f6a7b8c9d0'
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Booking request created successfully',
            data: {
              _id: newId,
              bookingReference: 'CM-C9D0AA',
              customer: '67119999c3d4e5f6a7b8c999',
              caregiver: body.caregiverId,
              service: body.serviceId,
              serviceName: 'Post-Surgery Care',
              serviceCategory: 'Clinical Care',
              hourlyRate: 649,
              totalHours: 6,
              totalAmount: 4793,
              currency: 'INR',
              startDateTime: body.startDateTime,
              endDateTime: body.endDateTime,
              location: body.location,
              patientDetails: body.patientDetails,
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 2. GET /api/bookings (List bookings)
      if (urlStr.includes('/api/bookings') && method === 'GET' && !urlStr.match(/\/api\/bookings\/[0-9a-fA-F]{24}/)) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                _id: '6711a1b2c3d4e5f6a7b8c9d0',
                bookingReference: 'CM-C9D0AA',
                customer: {
                  _id: '67119999c3d4e5f6a7b8c999',
                  fullName: 'Priya Sharma',
                  email: 'priya@example.com',
                },
                caregiver: {
                  _id: '67118888c3d4e5f6a7b8c888',
                  fullName: 'Aarav Patel',
                  user: { fullName: 'Aarav Patel' },
                  hourlyRate: 649,
                },
                service: {
                  _id: '67117777c3d4e5f6a7b8c777',
                  name: 'Post-Surgery Care',
                },
                status: 'pending',
                startDateTime: '2026-10-20T08:00:00.000Z',
                endDateTime: '2026-10-20T14:00:00.000Z',
                totalAmount: 4793,
                hourlyRate: 649,
                totalHours: 6,
                location: { addressLine: '123 Main St', city: 'Mumbai', careSetting: 'Home Care' },
                patientDetails: { name: 'Radhika Sharma', age: 74, gender: 'Female' },
              },
            ],
            pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 3. GET /api/bookings/:id
      if (urlStr.match(/\/api\/bookings\/[0-9a-fA-F]{24}$/) && method === 'GET') {
        const id = urlStr.split('/').pop()
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: id,
              bookingReference: 'CM-C9D0AA',
              customer: { _id: '67119999c3d4e5f6a7b8c999', fullName: 'Priya Sharma' },
              caregiver: { _id: '67118888c3d4e5f6a7b8c888', fullName: 'Aarav Patel' },
              serviceName: 'Post-Surgery Care',
              status: 'confirmed',
              startDateTime: '2026-10-20T08:00:00.000Z',
              endDateTime: '2026-10-20T14:00:00.000Z',
              totalAmount: 4793,
              location: { addressLine: '123 Main St', city: 'Mumbai', careSetting: 'Home Care' },
              patientDetails: { name: 'Radhika Sharma', age: 74, gender: 'Female' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 4. PATCH /api/bookings/:id/accept
      if (urlStr.includes('/accept') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Booking request accepted successfully',
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              status: 'confirmed',
              acceptedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 5. PATCH /api/bookings/:id/reject
      if (urlStr.includes('/reject') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Booking request rejected successfully',
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              status: 'rejected',
              rejectionReason: body?.reason || 'Declined',
              rejectedAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 6. PATCH /api/bookings/:id/cancel
      if (urlStr.includes('/cancel') && method === 'PATCH') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              status: 'cancelled',
              cancellationReason: body?.reason || 'User cancelled',
              cancelledAt: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 7. POST /api/bookings/:id/checkin/otp
      if (urlStr.includes('/checkin/otp') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-in OTP generated successfully',
            otp: '482190',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            maxAttempts: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 8. POST /api/bookings/:id/checkin/verify
      if (urlStr.includes('/checkin/verify') && method === 'POST') {
        if (body?.otp !== '482190') {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Invalid check-in OTP. 4 attempt(s) remaining.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-in verified successfully. Shift is now in progress.',
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              status: 'in_progress',
              checkIn: { at: new Date().toISOString(), location: body?.location },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 9. POST /api/bookings/:id/checkout/otp
      if (urlStr.includes('/checkout/otp') && method === 'POST') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-out OTP generated successfully',
            otp: '654321',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            maxAttempts: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 10. POST /api/bookings/:id/checkout/verify
      if (urlStr.includes('/checkout/verify') && method === 'POST') {
        if (body?.otp !== '654321') {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Invalid check-out OTP. 4 attempt(s) remaining.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Check-out verified successfully. Shift is marked completed.',
            data: {
              _id: '6711a1b2c3d4e5f6a7b8c9d0',
              status: 'completed',
              checkOut: { at: new Date().toISOString() },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  })

  it('1. Creates booking with valid ObjectIds, UTC ISO timestamps, location and patient details', async () => {
    const payload = {
      caregiverId: '67118888c3d4e5f6a7b8c888',
      serviceId: '67117777c3d4e5f6a7b8c777',
      startDateTime: '2026-10-20T08:00:00.000Z',
      endDateTime: '2026-10-20T14:00:00.000Z',
      timezone: 'Asia/Kolkata',
      location: {
        addressLine: 'Flat 703, Tower B',
        city: 'Mumbai',
        area: 'Powai',
        careSetting: 'Home Care',
      },
      patientDetails: {
        name: 'Radhika Sharma',
        age: 74,
        gender: 'Female',
        specialInstructions: 'Walker assistance',
      },
    }

    const booking = await createBooking(payload)

    assert.strictEqual(booking.id, '6711a1b2c3d4e5f6a7b8c9d0')
    assert.strictEqual(booking.ref, 'CM-C9D0AA')
    assert.strictEqual(booking.status, 'Pending')
    assert.strictEqual(booking.service, 'Post-Surgery Care')
    assert.strictEqual(booking.patient.name, 'Radhika Sharma')
    assert.strictEqual(booking.patient.age, 74)
    assert.strictEqual(booking.total, 4793)

    // Check fetch payload
    const lastCall = mockFetchCalls[0]
    assert.strictEqual(lastCall.method, 'POST')
    assert.strictEqual(lastCall.body.caregiverId, '67118888c3d4e5f6a7b8c888')
    assert.strictEqual(lastCall.body.serviceId, '67117777c3d4e5f6a7b8c777')
  })

  it('2. Rejects booking creation when required fields are missing without fake success', async () => {
    await assert.rejects(
      async () => {
        await createBooking({ caregiverId: null, serviceId: null })
      },
      (err) => {
        assert.ok(err.message.includes('required ObjectIds'))
        return true
      },
    )
  })

  it('3. Fetches role-scoped bookings list and normalizes with adapters', async () => {
    const { bookings, pagination } = await getBookings({ status: 'pending' })

    assert.strictEqual(bookings.length, 1)
    const b = bookings[0]
    assert.strictEqual(b.id, '6711a1b2c3d4e5f6a7b8c9d0')
    assert.strictEqual(b.status, 'Pending')
    assert.strictEqual(b.customerName, 'Priya Sharma')
    assert.strictEqual(b.caregiverName, 'Aarav Patel')
    assert.strictEqual(pagination.total, 1)
  })

  it('4. Retrieves single booking by 24-character hexadecimal ObjectId', async () => {
    const booking = await getBookingById('6711a1b2c3d4e5f6a7b8c9d0')

    assert.strictEqual(booking.id, '6711a1b2c3d4e5f6a7b8c9d0')
    assert.strictEqual(booking.status, 'Confirmed')
    assert.strictEqual(isMongoObjectId(booking.id), true)
  })

  it('5. Caregiver accepts pending booking and transitions to Confirmed', async () => {
    const booking = await acceptBooking('6711a1b2c3d4e5f6a7b8c9d0')

    assert.strictEqual(booking.status, 'Confirmed')
    const acceptCall = mockFetchCalls.find((c) => c.url.includes('/accept'))
    assert.strictEqual(acceptCall.method, 'PATCH')
  })

  it('6. Caregiver declines/rejects booking with optional reason', async () => {
    const booking = await rejectBooking('6711a1b2c3d4e5f6a7b8c9d0', 'Not available this weekend')

    assert.strictEqual(booking.status, 'Rejected')
    const rejectCall = mockFetchCalls.find((c) => c.url.includes('/reject'))
    assert.strictEqual(rejectCall.method, 'PATCH')
    assert.strictEqual(rejectCall.body.reason, 'Not available this weekend')
  })

  it('7. Participant cancels booking engagement', async () => {
    const booking = await cancelBooking('6711a1b2c3d4e5f6a7b8c9d0', 'Patient admitted to hospital')

    assert.strictEqual(booking.status, 'Cancelled')
    const cancelCall = mockFetchCalls.find((c) => c.url.includes('/cancel'))
    assert.strictEqual(cancelCall.method, 'PATCH')
    assert.strictEqual(cancelCall.body.reason, 'Patient admitted to hospital')
  })

  it('8. Customer requests check-in OTP and receives authoritative 6-digit code', async () => {
    const result = await requestCheckInOtp('6711a1b2c3d4e5f6a7b8c9d0')

    assert.strictEqual(result.otp, '482190')
    assert.strictEqual(/^\d{6}$/.test(result.otp), true)
    assert.strictEqual(result.maxAttempts, 5)
    assert.ok(result.expiresAt)
  })

  it('9. Caregiver verifies check-in OTP and transitions booking to In Progress', async () => {
    const updated = await verifyCheckIn('6711a1b2c3d4e5f6a7b8c9d0', {
      otp: '482190',
      selfieUrl: 'data:image/jpeg;base64,mockselfie',
      location: '123 Main St, Mumbai',
    })

    assert.strictEqual(updated.status, 'In Progress')
    assert.strictEqual(updated.hasCheckedIn, true)
  })

  it('10. Rejects invalid check-in OTP without advancing state', async () => {
    await assert.rejects(
      async () => {
        await verifyCheckIn('6711a1b2c3d4e5f6a7b8c9d0', {
          otp: '000000',
        })
      },
      (err) => {
        assert.ok(err.message.includes('Invalid check-in OTP'))
        return true
      },
    )
  })

  it('11. Customer requests check-out OTP and caregiver verifies completion', async () => {
    const otpRes = await requestCheckOutOtp('6711a1b2c3d4e5f6a7b8c9d0')
    assert.strictEqual(otpRes.otp, '654321')

    const completed = await verifyCheckOut('6711a1b2c3d4e5f6a7b8c9d0', {
      otp: '654321',
      selfieUrl: 'data:image/jpeg;base64,mockselfie2',
    })

    assert.strictEqual(completed.status, 'Completed')
    assert.strictEqual(completed.hasCheckedOut, true)
  })
})
