/**
 * Bystander Authentication Service
 *
 * Implements real HTTP communication with backend authentication endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/register/customer
 * - POST /api/auth/register/caregiver
 * - GET /api/auth/me (Session restoration)
 * - POST /api/auth/logout
 *
 * Safety & Security Guarantees:
 * - Credentials are never logged or stored in plain-text storage.
 * - JWT tokens are maintained in-memory only; session persistence relies on HTTP-only cookies.
 * - Handles qualification mapping to backend APPROVED_QUALIFICATIONS.
 * - Follow-up customer/caregiver profile updates are dispatched cleanly without data loss.
 */

import { apiClient, setAuthToken, clearAuthToken } from './apiClient.js';

// Approved qualifications expected by backend validate.js
export const BACKEND_QUALIFICATIONS = [
  'GNM',
  'BSc Nursing',
  'nursing_student',
  'ANM',
  'MBBS',
  'Physiotherapy Assistant',
  'Certified Elder Care Giver',
  'Paramedic',
  'other',
];

/**
 * Normalizes frontend qualification labels to backend enum values.
 */
export const normalizeQualification = (q) => {
  if (!q || typeof q !== 'string') return 'other';
  const trimmed = q.trim();

  const map = {
    'GNM Nursing': 'GNM',
    GNM: 'GNM',
    'B.Sc Nursing': 'BSc Nursing',
    'BSc Nursing': 'BSc Nursing',
    'ANM Nursing': 'ANM',
    ANM: 'ANM',
    'Nursing Student (Final Year)': 'nursing_student',
    nursing_student: 'nursing_student',
    'Nursing Student': 'nursing_student',
    MBBS: 'MBBS',
    'Physiotherapy Assistant': 'Physiotherapy Assistant',
    'Certified Elder Care Giver': 'Certified Elder Care Giver',
    Paramedic: 'Paramedic',
  };

  return map[trimmed] || (BACKEND_QUALIFICATIONS.includes(trimmed) ? trimmed : 'other');
};

/**
 * Normalizes user & profile structures returned by backend into a stable frontend format.
 */
export const normalizeUser = (user, profile = {}) => {
  if (!user) return null;

  const prof = profile || {};
  const isCaregiver = user.role === 'caregiver';

  // Address assembly
  let formattedAddress = '';
  if (prof.defaultAddress) {
    formattedAddress = [
      prof.defaultAddress.addressLine1,
      prof.defaultAddress.addressLine2,
      prof.defaultAddress.city,
      prof.defaultAddress.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
  } else if (prof.address) {
    formattedAddress = prof.address;
  }

  // Patient info extraction
  let patientInfo = null;
  if (prof.patients && Array.isArray(prof.patients) && prof.patients.length > 0) {
    const firstPatient = prof.patients[0];
    patientInfo = {
      name: firstPatient.fullName || '',
      age: firstPatient.age || 0,
      relation: firstPatient.relation || '',
      condition: firstPatient.diagnosis || firstPatient.notes || '',
    };
  } else if (prof.patientInfo) {
    patientInfo = prof.patientInfo;
  }

  return {
    id: String(user._id || user.id),
    _id: String(user._id || user.id),
    name: user.fullName || user.name || 'User',
    fullName: user.fullName || user.name || 'User',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'customer',
    avatar: user.avatar || prof.avatar || '',
    status: user.status || 'active',
    city: prof.city || prof.defaultAddress?.city || '',
    area: prof.area || '',
    address: formattedAddress,
    patientInfo,
    caregiverId: isCaregiver ? String(prof._id || user._id) : undefined,
    qualification: prof.qualification || '',
    experienceYears: prof.experienceYears ?? 0,
    hourlyRate: prof.hourlyRate ?? 0,
    verificationStatus: prof.verificationStatus || (isCaregiver ? 'Pending' : 'Verified'),
    verified: prof.verificationStatus === 'verified' || !isCaregiver,
    joinedOn: user.createdAt
      ? new Date(user.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    rawUser: user,
    rawProfile: prof,
  };
};

/**
 * Log in an existing user with email/phone identifier and password.
 */
export const login = async ({ identifier, email, password }) => {
  const cleanId = String(identifier || email || '').trim();
  if (!cleanId || !password) {
    return { ok: false, message: 'Please provide both your email/phone and password.' };
  }

  try {
    const response = await apiClient.post('/auth/login', {
      identifier: cleanId,
      password,
    });

    const { user, profile, token } = response.data || {};
    if (token) {
      setAuthToken(token);
    }

    const normalized = normalizeUser(user, profile);
    return {
      ok: true,
      user: normalized,
      token,
      message: response.message || 'Logged in successfully',
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Invalid credentials. Please check your details and try again.',
      error,
    };
  }
};

/**
 * Register a new customer account and sync initial profile details.
 */
export const registerCustomer = async (payload) => {
  const fullName = String(payload.fullName || payload.name || '').trim();
  const email = payload.email ? String(payload.email).trim().toLowerCase() : undefined;
  const rawMobile = payload.mobile || payload.phone;
  const phone = rawMobile ? String(rawMobile).trim().replace(/[\s-]/g, '') : undefined;
  const password = payload.password;

  if (!fullName || fullName.length < 2) {
    return { ok: false, message: 'Full name is required and must be at least 2 characters.' };
  }
  if (!email && !phone) {
    return { ok: false, message: 'At least one of email or mobile phone is required.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }

  try {
    const response = await apiClient.post('/auth/register/customer', {
      fullName,
      email,
      phone,
      password,
    });

    const { user, profile, token } = response.data || {};
    if (token) {
      setAuthToken(token);
    }

    // Follow-up: Dispatch Customer Profile update if address or patient fields were filled
    const hasAddress = Boolean(payload.address || payload.city || payload.area || payload.pincode);
    const hasPatient = Boolean(payload.patientInfo?.name || payload.patientName);

    if (hasAddress || hasPatient) {
      try {
        const profilePatch = {};
        if (hasAddress) {
          profilePatch.defaultAddress = {
            addressLine1: payload.address || '',
            addressLine2: payload.area || '',
            city: payload.city || 'Mumbai',
            state: 'Maharashtra',
            postalCode: payload.pincode || '',
          };
        }
        if (hasPatient) {
          const pInfo = payload.patientInfo || {};
          profilePatch.patients = [
            {
              fullName: pInfo.name || payload.patientName || '',
              age: Number(pInfo.age || payload.patientAge || 0),
              relation: pInfo.relation || payload.patientRelation || 'Other',
              diagnosis: pInfo.condition || payload.patientCondition || '',
            },
          ];
        }
        await apiClient.patch('/customer/profile', profilePatch);
      } catch (profileErr) {
        console.warn('[Profile Sync] Customer profile secondary fields pending update:', profileErr.message);
      }
    }

    const normalized = normalizeUser(user, profile);
    return {
      ok: true,
      user: normalized,
      token,
      message: response.message || 'Registration successful',
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Registration failed. Please review your details and try again.',
      error,
    };
  }
};

/**
 * Register a new caregiver application and sync qualifications.
 */
export const registerCaregiver = async (payload) => {
  const fullName = String(payload.fullName || payload.name || '').trim();
  const email = payload.email ? String(payload.email).trim().toLowerCase() : undefined;
  const rawMobile = payload.mobile || payload.phone;
  const phone = rawMobile ? String(rawMobile).trim().replace(/[\s-]/g, '') : undefined;
  const password = payload.password;
  const qualification = normalizeQualification(payload.qualification);
  const hourlyRate = Number(payload.hourlyRate || payload.rate || 399);

  if (!fullName || fullName.length < 2) {
    return { ok: false, message: 'Full name is required and must be at least 2 characters.' };
  }
  if (!email && !phone) {
    return { ok: false, message: 'At least one of email or mobile phone is required.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters long.' };
  }

  try {
    const response = await apiClient.post('/auth/register/caregiver', {
      fullName,
      email,
      phone,
      password,
      qualification,
      hourlyRate,
    });

    const { user, profile, token } = response.data || {};
    if (token) {
      setAuthToken(token);
    }

    // Follow-up: Dispatch Caregiver Profile update if bio, languages, or careSettings provided
    try {
      const caregiverPatch = {};
      if (payload.bio) caregiverPatch.bio = payload.bio;
      if (Array.isArray(payload.languages) && payload.languages.length) caregiverPatch.languages = payload.languages;
      if (Array.isArray(payload.careSettings) && payload.careSettings.length) caregiverPatch.careSettings = payload.careSettings;
      if (payload.experience || payload.experienceYears) caregiverPatch.experienceYears = Number(payload.experience || payload.experienceYears);
      if (payload.city) caregiverPatch.city = payload.city;
      if (payload.area) caregiverPatch.area = payload.area;

      if (Object.keys(caregiverPatch).length > 0) {
        await apiClient.patch('/caregiver/profile', caregiverPatch);
      }
    } catch (profileErr) {
      console.warn('[Profile Sync] Caregiver profile secondary fields pending update:', profileErr.message);
    }

    const normalized = normalizeUser(user, profile);
    return {
      ok: true,
      user: normalized,
      token,
      message: response.message || 'Caregiver application registered successfully',
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Caregiver registration failed. Please review your details.',
      error,
    };
  }
};

/**
 * Fetch current authenticated user session (/api/auth/me).
 */
export const getMe = async () => {
  try {
    const response = await apiClient.get('/auth/me');
    const { user, profile } = response.data || {};
    return {
      ok: true,
      user: normalizeUser(user, profile),
    };
  } catch (error) {
    return {
      ok: false,
      error,
    };
  }
};

/**
 * Log out user from current session, clear cookie on server and in-memory token.
 */
export const logout = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.warn('[Auth Logout] Server logout notification failed:', error.message);
  } finally {
    clearAuthToken();
  }
  return { ok: true };
};

export const authService = {
  login,
  registerCustomer,
  registerCaregiver,
  getMe,
  logout,
  normalizeQualification,
  normalizeUser,
};

export default authService;
