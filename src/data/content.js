export const REVIEWS = [
  {
    id: 'rv-01',
    bookingId: 'BK-4802',
    caregiverId: 'cg-110',
    customerId: 'cu-201',
    customerName: 'Priya Sharma',
    rating: 5,
    date: '2026-09-29',
    comment:
      'Sunil was incredibly patient with my mother during meals. He kept the kitchen spotless and sent a short update every evening. Highly recommended for elder care.',
    reply: 'Thank you Priya. Mrs. Sharma is a wonderful patient to look after.',
  },
  {
    id: 'rv-02',
    bookingId: 'BK-4795',
    caregiverId: 'cg-103',
    customerId: 'cu-201',
    customerName: 'Priya Sharma',
    rating: 5,
    date: '2026-09-17',
    comment:
      'Meera genuinely connected with my mother within a day. The companionship sessions lifted her mood noticeably.',
    reply: '',
  },
  {
    id: 'rv-03',
    bookingId: 'BK-4810',
    caregiverId: 'cg-103',
    customerId: 'cu-203',
    customerName: 'Lakshmi Venkatesan',
    rating: 5,
    date: '2026-10-06',
    comment:
      'Excellent handling of my grandfather’s dementia episodes. She used the orientation board technique and it really worked.',
    reply: 'Thank you. Happy to continue with the same routine.',
  },
  {
    id: 'rv-04',
    bookingId: 'BK-4800',
    caregiverId: 'cg-104',
    customerId: 'cu-204',
    customerName: 'Imran Shaikh',
    rating: 4,
    date: '2026-09-28',
    comment:
      'Dr. Sana was thorough and coordinated well with the oncology team. Arrived 15 minutes late on one day but called ahead.',
    reply: 'Apologies for the delay — traffic on ORR. Glad the review went well.',
  },
  {
    id: 'rv-05',
    bookingId: 'BK-4816',
    caregiverId: 'cg-109',
    customerId: 'cu-201',
    customerName: 'Priya Sharma',
    rating: 5,
    date: '2026-10-09',
    comment:
      'Farah’s vitals chart is meticulous. She spotted a BP spike before we did and alerted the doctor immediately.',
    reply: '',
  },
  {
    id: 'rv-06',
    bookingId: 'BK-4765',
    caregiverId: 'cg-115',
    customerId: 'cu-205',
    customerName: 'Nandini Bose',
    rating: 5,
    date: '2026-08-25',
    comment:
      'Arjun helped my husband walk from the wheelchair to the balcony every day. Six weeks later he is walking with a stick.',
    reply: 'That is wonderful to hear. Keep up with the home exercises.',
  },
  {
    id: 'rv-07',
    bookingId: 'BK-4752',
    caregiverId: 'cg-113',
    customerId: 'cu-203',
    customerName: 'Lakshmi Venkatesan',
    rating: 4,
    date: '2026-08-09',
    comment:
      'Reliable overnight support and clear morning handover notes. Would like slightly more frequent repositioning logs.',
    reply: 'Noted — I have updated my log template for the next shift.',
  },
  {
    id: 'rv-08',
    bookingId: 'BK-4760',
    caregiverId: 'cg-114',
    customerId: 'cu-206',
    customerName: 'Vikram Patel',
    rating: 5,
    date: '2026-08-16',
    comment: 'Grace is cheerful and punctual. My mother looks forward to her visits.',
    reply: '',
  },
  {
    id: 'rv-09',
    bookingId: 'BK-4821',
    caregiverId: 'cg-101',
    customerId: 'cu-201',
    customerName: 'Priya Sharma',
    rating: 5,
    date: '2026-10-07',
    comment:
      'Ananya handled post-surgery care beautifully — dressing, medication timing and daily reports to our family group.',
    reply: 'Thank you, wishing Mrs. Radhika a speedy recovery.',
  },
  {
    id: 'rv-10',
    bookingId: 'BK-4824',
    caregiverId: 'cg-106',
    customerId: 'cu-203',
    customerName: 'Lakshmi Venkatesan',
    rating: 5,
    date: '2026-10-08',
    comment:
      'Joseph has been doing night duty for my grandfather for months. Completely trustworthy and alert through the night.',
    reply: 'Appreciate the trust, ma’am.',
  },
]

export const reviewsForCaregiver = (caregiverId) =>
  REVIEWS.filter((r) => r.caregiverId === caregiverId)

export const FAQS = [
  {
    q: 'How are caretakers verified on CareMate?',
    a: 'Every caretaker submits a government identity document, nursing registration certificate or nursing student college ID, and an address proof. Our operations team reviews each document manually, checks the registration number against the state nursing council, and only then flips the profile to Verified. A police clearance certificate is optional but earns a higher trust badge.',
  },
  {
    q: 'Can I book care inside a hospital?',
    a: 'Yes. During booking you can choose Home Care or Hospital Care and enter the ward or room number. Hospital rules on visitor timings still apply and our caretaker will work within them.',
  },
  {
    q: 'What happens if my caretaker cancels at the last minute?',
    a: 'You are notified immediately and CareMate automatically offers the shift to two verified backups with matching skills. If nobody accepts, the escrow amount is refunded to your original payment method within 3–5 working days.',
  },
  {
    q: 'How does payment work?',
    a: 'The estimated amount is held in escrow when you confirm a booking. It is released to the caretaker only after the service is completed and you mark the shift as done. CareMate deducts a 12% platform commission from the caretaker side — families never pay a hidden fee.',
  },
  {
    q: 'Do you provide emergency (SOS) support?',
    a: 'Every active booking has an SOS button. Pressing it raises a priority alert to our on-call operations desk, notifies your emergency contact and flags the incident to an admin who stays on the line until it is resolved.',
  },
  {
    q: 'Can I request the same caretaker again?',
    a: 'Yes — most families do. You can rebook from your past bookings in one tap, and repeat caretakers are shown first in your matching results.',
  },
]

export const TESTIMONIALS = [
  {
    id: 'tm-1',
    name: 'Priya Sharma',
    role: 'Daughter, Mumbai',
    avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
    rating: 5,
    quote:
      'We booked Ananya for my mother’s hip-replacement recovery. The daily written handover meant I could fly back to work knowing exactly how each hour went. CareMate felt like an extension of our family.',
  },
  {
    id: 'tm-2',
    name: 'Arun Malhotra',
    role: 'Son, Delhi NCR',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    rating: 5,
    quote:
      'Dad wanders at night. Rajesh handled twelve consecutive night shifts without a single complaint and kept a log we still show his neurologist. The verification process is genuinely strict.',
  },
  {
    id: 'tm-3',
    name: 'Lakshmi Venkatesan',
    role: 'Granddaughter, Chennai',
    avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    rating: 5,
    quote:
      'Twenty-seven bookings in one year and not one no-show. The escrow release after each shift means nobody is chasing payments — we just focus on grandfather.',
  },
  {
    id: 'tm-4',
    name: 'Imran Shaikh',
    role: 'Son, Hyderabad',
    avatar: 'https://randomuser.me/api/portraits/men/75.jpg',
    rating: 4,
    quote:
      'The hospital-care option saved us. We entered the ward number and a nurse-trained caretaker arrived within four hours of my mother being moved out of ICU.',
  },
]

export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Tell us what care you need',
    description:
      'Choose the service, patient details, home or hospital location, and the duration — a few hours, several days or a full week.',
  },
  {
    step: '02',
    title: 'Match with verified caretakers',
    description:
      'We surface verified caretakers with the right qualification, distance, availability and rating for your requirement.',
  },
  {
    step: '03',
    title: 'Confirm and pay into escrow',
    description:
      'Review the itemised estimate, confirm the request, and the amount is held securely until the shift is completed.',
  },
  {
    step: '04',
    title: 'Track, rate and rebook',
    description:
      'Follow check-in/check-out updates, message your caretaker, download invoices and rebook in one tap.',
  },
]

export const WHY_CHOOSE = [
  {
    icon: 'ShieldCheck',
    title: 'Rigid 4-step verification',
    description:
      'Identity, nursing registration, address and optional police clearance — each document reviewed by a human before a profile goes live.',
  },
  {
    icon: 'BadgeCheck',
    title: 'Only qualified professionals',
    description:
      'GNM, B.Sc, ANM, MBBS and certified elder-care caretakers. Nursing students work under a supervised scope of practice.',
  },
  {
    icon: 'Wallet',
    title: 'Escrow-protected payments',
    description:
      'Money moves only after service completion. Cancellations and disputes are refunded with a documented trail.',
  },
  {
    icon: 'Siren',
    title: 'SOS on every booking',
    description:
      'One tap escalates to our on-call desk, notifies your emergency contact and opens a tracked incident.',
  },
  {
    icon: 'MessageSquare',
    title: 'Direct, in-app messaging',
    description:
      'Talk to your caretaker before, during and after the shift without sharing personal phone numbers.',
  },
  {
    icon: 'Receipt',
    title: 'Transparent pricing',
    description:
      'Itemised estimate with platform charges and tax shown upfront. No surge pricing, no surprise bills.',
  },
]
