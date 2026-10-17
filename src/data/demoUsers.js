export const DEMO_PASSWORD = 'caremate123'

export const DEMO_USERS = [
  {
    id: 'cu-201',
    role: 'customer',
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98204 41127',
    password: DEMO_PASSWORD,
    avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
    city: 'Mumbai, MH',
    area: 'Powai',
    address: 'B-703, Hiranandani Gardens, Powai, Mumbai 400076',
    patientInfo: {
      name: 'Radhika Sharma',
      age: 74,
      relation: 'Mother',
      condition: 'Post hip-replacement recovery, mild hypertension',
    },
    joinedOn: '2024-02-14',
  },
  {
    id: 'cg-101',
    role: 'caregiver',
    name: 'Ananya Deshmukh',
    email: 'ananya.deshmukh@example.com',
    phone: '+91 98219 30044',
    password: DEMO_PASSWORD,
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    caregiverId: 'cg-101',
    city: 'Mumbai, MH',
    area: 'Powai',
    address: '304, Lake View CHS, Chandivali, Powai, Mumbai 400072',
    joinedOn: '2023-04-12',
  },
  {
    id: 'cg-116',
    role: 'caregiver',
    name: 'Ritu Bansal',
    email: 'ritu.bansal@example.com',
    phone: '+91 98250 77412',
    password: DEMO_PASSWORD,
    avatar: 'https://randomuser.me/api/portraits/women/21.jpg',
    caregiverId: 'cg-116',
    city: 'Ahmedabad, GJ',
    area: 'Satellite',
    address: '506, Shilp Chowk, CG Road, Ahmedabad 380009',
    joinedOn: '2026-09-28',
  },
  {
    id: 'ad-001',
    role: 'admin',
    name: 'Kavya Raman',
    email: 'admin@caremate.in',
    phone: '+91 98111 00022',
    password: DEMO_PASSWORD,
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    designation: 'Head of Operations',
    joinedOn: '2023-01-05',
  },
]

export const findDemoUser = (email) =>
  DEMO_USERS.find((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase())

export const demoUsersForRole = (role) => DEMO_USERS.filter((u) => u.role === role)
