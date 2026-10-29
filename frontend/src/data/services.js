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
} from 'lucide-react'

export const SERVICES = [
  {
    id: 'svc-monitoring',
    name: 'Patient Monitoring',
    short: 'Vitals, recovery tracking and round-the-clock observation at home.',
    description:
      'A trained caretaker tracks blood pressure, pulse, sugar levels, oxygen saturation and medication response, and keeps the family updated with structured daily reports.',
    icon: Activity,
    image: '/services/svc-monitoring.jpg',
    startingPrice: 449,
    unit: 'hour',
    popular: true,
    tags: ['Vitals', 'Daily reports', 'Post-discharge'],
  },
  {
    id: 'svc-feeding',
    name: 'Feeding & Hygiene Support',
    short: 'Assisted feeding, bathing, oral care and personal hygiene support.',
    description:
      'Compassionate assistance with feeding plans, tube feeding coordination, bathing, dressing, diaper changes and infection-safe hygiene routines for patients with limited mobility.',
    icon: UtensilsCrossed,
    image: '/services/svc-feeding.jpg',
    startingPrice: 399,
    unit: 'hour',
    popular: true,
    tags: ['Assisted feeding', 'Bathing', 'Diaper care'],
  },
  {
    id: 'svc-post-surgery',
    name: 'Post-Surgery Care',
    short: 'Wound care, mobility support and recovery monitoring after discharge.',
    description:
      'Specialised post-operative support including dressing changes under guidance, drain management, pain monitoring, mobilisation and coordination with the treating hospital.',
    icon: Bandage,
    image: '/services/svc-post-surgery.jpg',
    startingPrice: 599,
    unit: 'hour',
    popular: true,
    tags: ['Wound care', 'Dressing', 'Recovery'],
  },
  {
    id: 'svc-companionship',
    name: 'Companionship',
    short: 'Conversation, light walks, hobbies and emotional companionship.',
    description:
      'Warm, patient companionship for seniors living alone — conversation, reading, light exercises, temple or park walks, and regular family updates.',
    icon: HandHeart,
    image: '/services/svc-companionship.jpg',
    startingPrice: 329,
    unit: 'hour',
    popular: false,
    tags: ['Elder care', 'Emotional support', 'Day care'],
  },
  {
    id: 'svc-medication',
    name: 'Medication Reminders',
    short: 'On-time dosage reminders and prescription adherence tracking.',
    description:
      'Strict timetable-based medicine reminders, refill alerts, prescription logging and escalation to the family if a dose is missed.',
    icon: Pill,
    image: '/services/svc-medication.jpg',
    startingPrice: 299,
    unit: 'hour',
    popular: false,
    tags: ['Dosage alerts', 'Refills', 'Adherence'],
  },
  {
    id: 'svc-mobility',
    name: 'Mobility Assistance',
    short: 'Safe transfers, walking support and physio-assisted movement.',
    description:
      'Trained handling for bed-to-wheelchair transfers, walking support, fall prevention, brace and prosthesis care, and assisted physiotherapy routines.',
    icon: Accessibility,
    image: '/services/svc-mobility.jpg',
    startingPrice: 479,
    unit: 'hour',
    popular: false,
    tags: ['Transfers', 'Fall prevention', 'Physio assist'],
  },
  {
    id: 'svc-dementia',
    name: 'Dementia & Alzheimer’s Support',
    short: 'Specialised memory-care routines with trained dementia handlers.',
    description:
      'Calm, structured support for memory-care patients — orientation cues, wandering prevention, safe nutrition, behavioural de-escalation and caretaker respite.',
    icon: Brain,
    image: '/services/svc-dementia.jpg',
    startingPrice: 649,
    unit: 'hour',
    popular: false,
    tags: ['Memory care', 'Behavioural support', 'Respite'],
  },
  {
    id: 'svc-bedridden',
    name: 'Bedridden Patient Care',
    short: 'Pressure-relief, positioning, nutrition and skin integrity care.',
    description:
      'Full-time bedridden care including two-hourly repositioning, bedsore prevention, catheter and stoma awareness, nutrition management and hygiene.',
    icon: BedDouble,
    image: '/services/svc-bedridden.jpg',
    startingPrice: 699,
    unit: 'hour',
    popular: true,
    tags: ['Bedsores', 'Positioning', 'Long-term'],
  },
  {
    id: 'svc-night',
    name: 'Night-Duty Care',
    short: 'Overnight vigilance for patients who need support through the night.',
    description:
      'Overnight supervision for patients at risk of falls, nocturnal agitation, breathing difficulty or those recovering from surgery, with handover notes in the morning.',
    icon: MoonStar,
    image: '/services/svc-night.jpg',
    startingPrice: 749,
    unit: 'shift',
    popular: false,
    tags: ['12-hour shift', 'Vigilance', 'Handover'],
  },
]

export const getServiceById = (id) => SERVICES.find((s) => s.id === id)
export const getServiceByName = (name) =>
  SERVICES.find((s) => s.name.toLowerCase() === String(name || '').toLowerCase())
export const serviceNames = SERVICES.map((s) => s.name)
