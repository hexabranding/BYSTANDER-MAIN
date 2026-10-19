import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  getCustomerProfile,
  updateCustomerProfile,
  getCaregiverProfile,
  updateCaregiverProfile,
  PERMITTED_CUSTOMER_PROFILE_FIELDS,
  PERMITTED_CAREGIVER_PROFILE_FIELDS,
} from '../src/services/profileService.js'
import {
  getCaregiverAvailability,
  updateCaregiverAvailability,
  validateWeeklyScheduleContract,
} from '../src/services/availabilityService.js'
import {
  adaptBooking,
  adaptCustomerProfile,
  adaptWeekAvailabilityToWeeklySchedule,
  normalizeBookingStatus,
} from '../src/services/adapters.js'

describe('Step 12D — Profiles & Caregiver Availability Tests', () => {
  let mockFetchCalls = []
  let originalFetch = globalThis.fetch

  beforeEach(() => {
    mockFetchCalls = []
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url)
      const method = (options.method || 'GET').toUpperCase()
      const body = options.body ? JSON.parse(options.body) : null
      mockFetchCalls.push({ url: urlStr, method, body, headers: options.headers })

      // 1. GET /api/customer/profile
      if (urlStr.endsWith('/api/customer/profile') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: '67119999c3d4e5f6a7b8c999',
              fullName: 'Priya Sharma',
              email: 'priya@example.com',
              phone: '+919820441127',
              role: 'customer',
              defaultAddress: {
                addressLine: 'B-703, Hiranandani',
                city: 'Mumbai',
                area: 'Powai',
              },
              patients: [
                {
                  name: 'Radhika Sharma',
                  age: 74,
                  relation: 'Mother',
                  condition: 'Post hip surgery',
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 2. PATCH /api/customer/profile
      if (urlStr.endsWith('/api/customer/profile') && method === 'PATCH') {
        // Enforce that protected fields are not sent
        if (body.role || body.verificationStatus || body.status) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Attempted to modify protected fields',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Customer profile updated successfully',
            data: {
              _id: '67119999c3d4e5f6a7b8c999',
              fullName: body.fullName || 'Priya Sharma',
              defaultAddress: body.defaultAddress || {},
              patients: body.patients || [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 3. GET /api/caregiver/profile
      if (urlStr.endsWith('/api/caregiver/profile') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              _id: '67118888c3d4e5f6a7b8c888',
              bio: 'Experienced clinical caretaker with ICU background.',
              qualification: 'General Duty Assistant (GDA)',
              experienceYears: 5,
              hourlyRate: 649,
              city: 'Mumbai',
              area: 'Powai',
              languages: ['English', 'Hindi', 'Marathi'],
              careSettings: ['Home Care', 'Hospital Care'],
              verificationStatus: 'verified',
              user: {
                fullName: 'Aarav Patel',
                email: 'aarav@example.com',
                phone: '+919876543210',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 4. PATCH /api/caregiver/profile
      if (urlStr.endsWith('/api/caregiver/profile') && method === 'PATCH') {
        // Enforce that protected fields are not sent
        if (body.verificationStatus || body.role || body.rating || body.trustScore) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Protected fields cannot be updated by caregiver',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Caregiver profile updated successfully',
            data: {
              _id: '67118888c3d4e5f6a7b8c888',
              ...body,
              verificationStatus: 'verified',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 5. GET /api/caregiver/availability
      if (urlStr.endsWith('/api/caregiver/availability') && method === 'GET') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              timezone: 'Asia/Kolkata',
              availabilityStatus: 'Available Now',
              weeklySchedule: [
                { day: 'Mon', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
                { day: 'Tue', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
                { day: 'Wed', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
                { day: 'Thu', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
                { day: 'Fri', isAvailable: true, slots: [{ start: '08:00', end: '16:00' }] },
                { day: 'Sat', isAvailable: false, slots: [] },
                { day: 'Sun', isAvailable: false, slots: [] },
              ],
              dateExceptions: [
                {
                  date: '2026-10-25',
                  isAvailable: false,
                  reason: 'Family event',
                  slots: [],
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      // 6. PUT /api/caregiver/availability
      if (urlStr.endsWith('/api/caregiver/availability') && method === 'PUT') {
        const schedule = body?.weeklySchedule
        if (!Array.isArray(schedule) || schedule.length !== 7) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Weekly schedule must contain exactly 7 weekdays (Mon-Sun)',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Caregiver availability updated successfully',
            data: body,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({ success: false }), { status: 404 })
    }
  })

  it('1. Retrieves customer profile and adapts to UI model', async () => {
    const profile = await getCustomerProfile()

    assert.strictEqual(profile.id, '67119999c3d4e5f6a7b8c999')
    assert.strictEqual(profile.fullName, 'Priya Sharma')
    assert.strictEqual(profile.email, 'priya@example.com')
    assert.strictEqual(profile.defaultAddress.city, 'Mumbai')
    assert.strictEqual(profile.patients.length, 1)
  })

  it('2. Strips protected fields when updating customer profile', async () => {
    const updates = {
      fullName: 'Priya S. Sharma',
      role: 'admin', // Should be stripped by allowlist
      status: 'active', // Should be stripped
      verificationStatus: 'verified', // Should be stripped
      defaultAddress: {
        addressLine: 'Apt 101, Lake View',
        city: 'Mumbai',
        area: 'Powai',
      },
    }

    const res = await updateCustomerProfile(updates)
    assert.strictEqual(res.fullName, 'Priya S. Sharma')

    const lastCall = mockFetchCalls[0]
    assert.strictEqual(lastCall.body.role, undefined)
    assert.strictEqual(lastCall.body.verificationStatus, undefined)
    assert.strictEqual(lastCall.body.fullName, 'Priya S. Sharma')
  })

  it('3. Retrieves caregiver profile and strips protected fields on update', async () => {
    const profile = await getCaregiverProfile()
    assert.strictEqual(profile.fullName, 'Aarav Patel')
    assert.strictEqual(profile.hourlyRate, 649)

    const updates = {
      bio: 'Updated bio with 6+ years hospital experience.',
      hourlyRate: 699,
      verificationStatus: 'bypassed', // Should be stripped
      trustScore: 100, // Should be stripped
    }

    const updated = await updateCaregiverProfile(updates)
    assert.strictEqual(updated.bio, 'Updated bio with 6+ years hospital experience.')

    const lastCall = mockFetchCalls[mockFetchCalls.length - 1]
    assert.strictEqual(lastCall.body.verificationStatus, undefined)
    assert.strictEqual(lastCall.body.trustScore, undefined)
    assert.strictEqual(lastCall.body.hourlyRate, 699)
  })

  it('4. Retrieves caregiver availability and normalizes to weekAvailability', async () => {
    const avail = await getCaregiverAvailability()

    assert.strictEqual(avail.weeklySchedule.length, 7)
    assert.strictEqual(avail.weekAvailability.length, 7)
    assert.strictEqual(avail.weekAvailability[0].day, 'Mon')
    assert.strictEqual(avail.weekAvailability[0].status, 'available')
    assert.strictEqual(avail.weekAvailability[5].day, 'Sat')
    assert.strictEqual(avail.weekAvailability[5].status, 'blocked')
    assert.strictEqual(avail.dateExceptions.length, 1)
    assert.strictEqual(avail.dateExceptions[0].date, '2026-10-25')
  })

  it('5. Validates 7-day schedule contract and converts weekAvailability to weeklySchedule', async () => {
    const weekAvailability = [
      { day: 'Mon', status: 'available', slots: ['08:00 – 16:00'] },
      { day: 'Tue', status: 'available', slots: ['08:00 – 16:00'] },
      { day: 'Wed', status: 'available', slots: ['08:00 – 16:00'] },
      { day: 'Thu', status: 'available', slots: ['08:00 – 16:00'] },
      { day: 'Fri', status: 'available', slots: ['08:00 – 16:00'] },
      { day: 'Sat', status: 'blocked', slots: [] },
      { day: 'Sun', status: 'blocked', slots: [] },
    ]

    const weeklySchedule = adaptWeekAvailabilityToWeeklySchedule(weekAvailability)
    assert.strictEqual(weeklySchedule.length, 7)
    assert.strictEqual(weeklySchedule[0].day, 'Mon')
    assert.strictEqual(weeklySchedule[0].isAvailable, true)
    assert.strictEqual(weeklySchedule[0].slots[0].start, '08:00')
    assert.strictEqual(weeklySchedule[0].slots[0].end, '16:00')

    // Validates successfully
    assert.doesNotThrow(() => validateWeeklyScheduleContract(weeklySchedule))

    // Fails if missing weekdays
    assert.throws(
      () => validateWeeklyScheduleContract(weeklySchedule.slice(0, 5)),
      /Weekly schedule is incomplete/,
    )
  })

  it('6. Updates availability with 7-day schedule and date exceptions', async () => {
    const weekAvailability = [
      { day: 'Mon', status: 'available', slots: ['09:00 – 17:00'] },
      { day: 'Tue', status: 'available', slots: ['09:00 – 17:00'] },
      { day: 'Wed', status: 'available', slots: ['09:00 – 17:00'] },
      { day: 'Thu', status: 'available', slots: ['09:00 – 17:00'] },
      { day: 'Fri', status: 'available', slots: ['09:00 – 17:00'] },
      { day: 'Sat', status: 'available', slots: ['10:00 – 14:00'] },
      { day: 'Sun', status: 'blocked', slots: [] },
    ]

    const result = await updateCaregiverAvailability({
      timezone: 'Asia/Kolkata',
      weekAvailability,
      dateExceptions: [{ date: '2026-10-31', isAvailable: false, reason: 'Diwali break', slots: [] }],
    })

    assert.strictEqual(result.weeklySchedule.length, 7)
    assert.strictEqual(result.dateExceptions.length, 1)
    assert.strictEqual(result.dateExceptions[0].reason, 'Diwali break')
  })

  it('7. Adapts normalized booking statuses to proper UI title-case', () => {
    assert.strictEqual(normalizeBookingStatus('pending'), 'Pending')
    assert.strictEqual(normalizeBookingStatus('confirmed'), 'Confirmed')
    assert.strictEqual(normalizeBookingStatus('in_progress'), 'In Progress')
    assert.strictEqual(normalizeBookingStatus('completed'), 'Completed')
    assert.strictEqual(normalizeBookingStatus('cancelled'), 'Cancelled')
    assert.strictEqual(normalizeBookingStatus('rejected'), 'Rejected')
  })
})
