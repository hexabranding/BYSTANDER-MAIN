import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isMongoObjectId,
  resolveServiceIcon,
  adaptWeeklyScheduleToWeekAvailability,
  adaptService,
  adaptCaregiver,
} from '../src/services/adapters.js'
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
} from 'lucide-react'

describe('Step 12C - API-to-UI Data Adapters', () => {
  it('1. Correctly identifies 24-character hexadecimal MongoDB ObjectIds vs legacy mock IDs', () => {
    // Valid 24-char hex ObjectIds
    assert.strictEqual(isMongoObjectId('6711a1b2c3d4e5f6a7b8c9d0'), true)
    assert.strictEqual(isMongoObjectId('507f1f77bcf86cd799439011'), true)
    assert.strictEqual(isMongoObjectId('64c72ef21a4f89d345678901'), true)

    // Legacy mock IDs & slugs
    assert.strictEqual(isMongoObjectId('cg-101'), false)
    assert.strictEqual(isMongoObjectId('svc-monitoring'), false)
    assert.strictEqual(isMongoObjectId('elderly-care'), false)
    assert.strictEqual(isMongoObjectId(''), false)
    assert.strictEqual(isMongoObjectId(null), false)
    assert.strictEqual(isMongoObjectId(undefined), false)
    assert.strictEqual(isMongoObjectId(12345), false)
    assert.strictEqual(isMongoObjectId('6711a1b2c3d4e5f6a7b8c9d'), false) // 23 chars
    assert.strictEqual(isMongoObjectId('6711a1b2c3d4e5f6a7b8c9d000'), false) // 26 chars
    assert.strictEqual(isMongoObjectId('6711a1b2c3d4e5f6a7b8c9z0'), false) // contains non-hex 'z'
  })

  it('2. Resolves stable Lucide icon components from service slug or name', () => {
    assert.strictEqual(resolveServiceIcon('patient-monitoring'), Activity)
    assert.strictEqual(resolveServiceIcon('vitals-check'), Activity)
    assert.strictEqual(resolveServiceIcon('feeding-and-hygiene-support'), UtensilsCrossed)
    assert.strictEqual(resolveServiceIcon('post-surgery-care'), Bandage)
    assert.strictEqual(resolveServiceIcon('companionship'), HandHeart)
    assert.strictEqual(resolveServiceIcon('elderly-care'), HandHeart)
    assert.strictEqual(resolveServiceIcon('medication-reminders'), Pill)
    assert.strictEqual(resolveServiceIcon('mobility-assistance'), Accessibility)
    assert.strictEqual(resolveServiceIcon('dementia-and-alzheimers-support'), Brain)
    assert.strictEqual(resolveServiceIcon('bedridden-patient-care'), BedDouble)
    assert.strictEqual(resolveServiceIcon('night-duty-care'), MoonStar)
    // Fallback for unknown
    assert.strictEqual(resolveServiceIcon('custom-specialty-service'), Sparkles)
    assert.strictEqual(resolveServiceIcon(''), Sparkles)
    assert.strictEqual(resolveServiceIcon(null), Sparkles)
  })

  it('3. Adapts backend weeklySchedule into UI weekAvailability', () => {
    const backendSchedule = [
      {
        day: 'Mon',
        isAvailable: true,
        slots: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
      },
      {
        day: 'Tue',
        isAvailable: false,
        slots: [],
      },
    ]

    const adapted = adaptWeeklyScheduleToWeekAvailability(backendSchedule)
    assert.strictEqual(Array.isArray(adapted), true)
    assert.strictEqual(adapted.length, 7) // all 7 weekdays

    const mon = adapted.find((d) => d.day === 'Mon')
    assert.strictEqual(mon.status, 'available')
    assert.deepStrictEqual(mon.slots, ['08:00 – 12:00', '14:00 – 18:00'])

    const tue = adapted.find((d) => d.day === 'Tue')
    assert.strictEqual(tue.status, 'blocked')
    assert.deepStrictEqual(tue.slots, [])
  })

  it('4. Normalizes backend Service model to UI contract with startingPrice, tags, and icon', () => {
    const rawBackendService = {
      _id: '6711a1b2c3d4e5f6a7b8c9d0',
      name: 'Patient Monitoring',
      slug: 'patient-monitoring',
      description: 'Vitals tracking and round-the-clock observation at home.',
      category: 'Clinical',
      features: ['Vitals check', 'Daily reports', 'Post-discharge'],
      baseHourlyRate: 499,
      minimumDurationHours: 2,
      isActive: true,
    }

    const adapted = adaptService(rawBackendService)

    assert.strictEqual(adapted.id, '6711a1b2c3d4e5f6a7b8c9d0')
    assert.strictEqual(adapted.name, 'Patient Monitoring')
    assert.strictEqual(adapted.startingPrice, 499)
    assert.strictEqual(adapted.baseHourlyRate, 499)
    assert.strictEqual(adapted.unit, 'hour')
    assert.strictEqual(adapted.icon, Activity)
    assert.strictEqual(adapted.popular, true) // >= 3 features
    assert.deepStrictEqual(adapted.tags, ['Vitals check', 'Daily reports', 'Post-discharge'])
    assert.strictEqual(adapted.short, 'Vitals tracking and round-the-clock observation at home.')
  })

  it('5. Normalizes backend Caregiver model with rating, services, and verification', () => {
    const rawBackendCaregiver = {
      _id: '6711a1b2c3d4e5f6a7b8c9e1',
      fullName: 'Sunita Rao',
      avatar: 'https://example.com/avatar.jpg',
      qualification: 'B.Sc Nursing',
      experienceYears: 8,
      bio: 'Experienced nurse specialized in post-surgery recovery.',
      languages: ['English', 'Hindi', 'Marathi'],
      city: 'Pune',
      area: 'Kothrud',
      maxDistanceKm: 15,
      hourlyRate: 550,
      servicesOffered: [
        { _id: '6711a1b2c3d4e5f6a7b8c9d0', name: 'Post-Surgery Care', slug: 'post-surgery-care' },
        { _id: '6711a1b2c3d4e5f6a7b8c9d1', name: 'Patient Monitoring', slug: 'patient-monitoring' },
      ],
      availabilityStatus: 'Available Now',
      verificationStatus: 'verified',
      rating: {
        average: 4.85,
        count: 56,
      },
      trustScore: 97,
      completedJobs: 89,
      badges: ['Top Rated', 'Verified Nurse'],
    }

    const adapted = adaptCaregiver(rawBackendCaregiver)

    assert.strictEqual(adapted.id, '6711a1b2c3d4e5f6a7b8c9e1')
    assert.strictEqual(adapted.name, 'Sunita Rao')
    assert.strictEqual(adapted.photo, 'https://example.com/avatar.jpg')
    assert.strictEqual(adapted.qualification, 'B.Sc Nursing')
    assert.strictEqual(adapted.experienceYears, 8)
    assert.strictEqual(adapted.rating, 4.85) // Normalized to number
    assert.strictEqual(adapted.reviewCount, 56) // Extracted count
    assert.strictEqual(adapted.hourlyRate, 550)
    assert.strictEqual(adapted.verified, true) // verificationStatus === 'verified'
    assert.strictEqual(adapted.availability, 'Available Now')
    assert.deepStrictEqual(adapted.services, ['Post-Surgery Care', 'Patient Monitoring'])
    assert.strictEqual(adapted.trustScore, 97)
    assert.strictEqual(adapted.completedJobs, 89)
    assert.strictEqual(adapted.distanceKm, 15)
  })

  it('6. Does NOT claim unverified sample caregiver is verified', () => {
    const unverifiedProfile = {
      id: 'cg-unverified',
      fullName: 'Pending Applicant',
      verificationStatus: 'pending',
      verified: false,
      hourlyRate: 400,
    }

    const adapted = adaptCaregiver(unverifiedProfile)
    assert.strictEqual(adapted.verified, false)
    assert.strictEqual(adapted.verificationStatus, 'pending')
    assert.deepStrictEqual(adapted.badges, ['Verification Pending'])
  })
})
