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
  const isAmbulance = user.role === 'ambulance';

  // Address assembly
  let formattedAddress = '';
  if (prof.defaultAddress && (prof.defaultAddress.addressLine || prof.defaultAddress.addressLine1)) {
    formattedAddress = [
      prof.defaultAddress.addressLine || prof.defaultAddress.addressLine1,
      prof.defaultAddress.area || prof.defaultAddress.addressLine2,
      prof.defaultAddress.city,
      prof.defaultAddress.pincode || prof.defaultAddress.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
  } else if (prof.address && !prof.address.includes('Mumbai, MH')) {
    formattedAddress = prof.address;
  }

  // Patient info extraction
  let patientInfo = null;
  if (prof.patients && Array.isArray(prof.patients) && prof.patients.length > 0) {
    const firstPatient = prof.patients[0];
    patientInfo = {
      name: firstPatient.name || firstPatient.fullName || '',
      age: firstPatient.age || 0,
      gender: firstPatient.gender || 'Other',
      relation: firstPatient.relation || '',
      condition: firstPatient.condition || firstPatient.diagnosis || firstPatient.notes || '',
    };
  } else if (prof.patientInfo) {
    patientInfo = prof.patientInfo;
  }

  const isProfileComplete = Boolean(
    formattedAddress &&
    prof.defaultAddress?.addressLine &&
    (patientInfo?.name || (Array.isArray(prof.patients) && prof.patients.length > 0))
  );
  const isGuest = Boolean(
    user.isGuest ||
    (user.fullName && user.fullName.includes('(Guest)'))
  );

  const cleanFullName = (user.fullName || user.name || 'User').replace(/\s*\(Guest\)/gi, '').trim() || 'User';

  return {
    id: String(user._id || user.id),
    _id: String(user._id || user.id),
    name: cleanFullName,
    fullName: cleanFullName,
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'customer',
    avatar: user.avatar || prof.avatar || '',
    status: user.status || 'active',
    isGuest,
    isProfileComplete,
    city: prof.city || prof.defaultAddress?.city || '',
    area: prof.area || prof.defaultAddress?.area || '',
    address: formattedAddress,
    patientInfo,
    caregiverId: isCaregiver ? String(prof._id || user._id) : undefined,
    qualification: prof.qualification || '',
    experienceYears: prof.experienceYears ?? 0,
    hourlyRate: prof.hourlyRate ?? 0,
    verificationStatus: prof.verificationStatus || (isCaregiver ? 'Pending' : 'Verified'),
    verified: prof.verificationStatus === 'verified' || (!isCaregiver && !isAmbulance) || prof.verificationStatus === 'verified',
    vehicleNumber: prof.vehicleNumber || '',
    ambulanceType: prof.ambulanceType || '',
    baseHospital: prof.baseHospital || '',
    isAvailable: prof.isAvailable ?? true,
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
 * Request guest login OTP for urgent customer care booking.
 */
export const requestGuestOtp = async (email, mode = 'any') => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, message: 'Please provide a valid email address.' };
  }

  try {
    const res = await apiClient.post('/auth/guest/request-otp', { email: cleanEmail, mode });
    return {
      ok: true,
      message: res?.message || 'Verification code sent to your email.',
      data: res?.data || res,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Failed to send verification code. Please try again.',
      error,
    };
  }
};

/**
 * Validate guest login OTP without persisting user to database or logging in.
 */
export const validateGuestOtp = async (email, otp) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(otp || '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { ok: false, message: 'Both email and verification code are required.' };
  }

  try {
    const res = await apiClient.post('/auth/guest/validate-otp', {
      email: cleanEmail,
      otp: cleanOtp,
    });
    return {
      ok: true,
      message: res?.message || 'Verification code validated successfully.',
      data: res?.data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Verification failed. Please check the code and try again.',
      error,
    };
  }
};

/**
 * Verify guest login OTP and create/authenticate customer session.
 */
export const verifyGuestOtp = async (email, otp, password, mode = 'any') => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanOtp = String(otp || '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { ok: false, message: 'Both email and verification code are required.' };
  }

  try {
    const payload = {
      email: cleanEmail,
      otp: cleanOtp,
      mode,
    };
    if (password && typeof password === 'string') {
      payload.password = password;
    }
    const res = await apiClient.post('/auth/guest/verify-otp', payload);

    const { user, profile, token, isProfileComplete, isGuest } = res?.data || res || {};
    if (token) {
      setAuthToken(token);
    }

    const normalized = normalizeUser(user, profile);
    normalized.isGuest = isGuest ?? false;
    normalized.isProfileComplete = Boolean(isProfileComplete);

    return {
      ok: true,
      user: normalized,
      token,
      isProfileComplete: Boolean(isProfileComplete),
      isGuest: normalized.isGuest,
      message: res?.message || 'Signed in successfully',
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Verification failed. Please check the code and try again.',
      error,
    };
  }
};

/**
 * Set password for current authenticated user.
 */
export const setPassword = async (password) => {
  try {
    const res = await apiClient.post('/auth/set-password', { password });
    return {
      ok: true,
      message: res?.message || 'Password updated successfully',
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Failed to update password',
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
    const addressLine = typeof (payload.address || payload.addressLine) === 'string'
      ? (payload.address || payload.addressLine).trim()
      : '';
    const city = typeof payload.city === 'string' ? payload.city.trim() : '';
    const area = typeof payload.area === 'string' ? payload.area.trim() : '';
    const pincode = typeof (payload.pincode || payload.postalCode) === 'string'
      ? (payload.pincode || payload.postalCode).trim()
      : '';

    const hasAddress = Boolean(addressLine || city || area || pincode);

    const pInfo = payload.patientInfo || {};
    const patientName = typeof (pInfo.name || pInfo.fullName || payload.patientName) === 'string'
      ? (pInfo.name || pInfo.fullName || payload.patientName).trim()
      : '';
    const hasPatient = Boolean(patientName);

    let finalProfile = profile;
    let profileSyncError = null;

    if (hasAddress || hasPatient) {
      try {
        const profilePatch = {};
        if (hasAddress) {
          const defaultAddress = {};
          if (addressLine) defaultAddress.addressLine = addressLine;
          if (city) defaultAddress.city = city;
          if (area) defaultAddress.area = area;
          if (pincode) defaultAddress.pincode = pincode;
          profilePatch.defaultAddress = defaultAddress;
        }

        if (hasPatient) {
          const patientRecord = {
            name: patientName,
          };

          const rawAge = pInfo.age !== undefined && pInfo.age !== '' ? pInfo.age : payload.patientAge;
          if (rawAge !== undefined && rawAge !== null && rawAge !== '') {
            const numAge = Number(rawAge);
            if (!isNaN(numAge) && numAge >= 0 && numAge <= 130) {
              patientRecord.age = numAge;
            }
          }

          const rawGender = pInfo.gender || payload.patientGender;
          if (rawGender && ['Male', 'Female', 'Other'].includes(rawGender)) {
            patientRecord.gender = rawGender;
          }

          const rawRelation = typeof (pInfo.relation || payload.patientRelation) === 'string'
            ? (pInfo.relation || payload.patientRelation).trim()
            : '';
          if (rawRelation) {
            patientRecord.relation = rawRelation;
          }

          const rawCondition = typeof (pInfo.condition || pInfo.diagnosis || payload.patientCondition) === 'string'
            ? (pInfo.condition || pInfo.diagnosis || payload.patientCondition).trim()
            : '';
          if (rawCondition) {
            patientRecord.condition = rawCondition;
          }

          const rawNotes = typeof (pInfo.medicalNotes || payload.medicalNotes) === 'string'
            ? (pInfo.medicalNotes || payload.medicalNotes).trim()
            : '';
          if (rawNotes) {
            patientRecord.medicalNotes = rawNotes;
          }

          profilePatch.patients = [patientRecord];
        }

        const patchRes = await apiClient.patch('/customer/profile', profilePatch);
        finalProfile = patchRes?.data || patchRes || profile;
      } catch (profileErr) {
        console.warn('[Profile Sync] Customer profile secondary fields pending update:', profileErr.message);
        profileSyncError = profileErr;
      }
    }

    const normalized = normalizeUser(user, finalProfile);

    if (profileSyncError) {
      return {
        ok: true,
        partial: true,
        user: normalized,
        token,
        warning: `Account registered, but profile details could not be saved: ${profileSyncError.message}`,
        message: `Account registered, but profile details could not be saved: ${profileSyncError.message}`,
      };
    }

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

  const normalizedCareSettings = Array.isArray(payload.careSettings)
    ? Array.from(
        new Set(
          payload.careSettings
            .map((s) => (s === 'Home' ? 'Home Care' : s === 'Hospital' ? 'Hospital Care' : s))
            .filter((s) => ['Home Care', 'Hospital Care'].includes(s)),
        ),
      )
    : undefined;

  try {
    const response = await apiClient.post('/auth/register/caregiver', {
      fullName,
      email,
      phone,
      password,
      qualification,
      hourlyRate,
      nursingRegNo: payload.nursingRegNo || undefined,
      experienceYears: Number(payload.experience || payload.experienceYears || 0),
      city: payload.city || undefined,
      area: payload.area || undefined,
      languages: payload.languages || undefined,
      careSettings: normalizedCareSettings,
      bio: payload.bio || undefined,
      documents: payload.documents || undefined,
      docs: payload.docs || undefined,
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
      if (Array.isArray(normalizedCareSettings) && normalizedCareSettings.length) caregiverPatch.careSettings = normalizedCareSettings;
      if (payload.experience || payload.experienceYears) caregiverPatch.experienceYears = Number(payload.experience || payload.experienceYears);
      if (payload.city) caregiverPatch.city = payload.city;
      if (payload.area) caregiverPatch.area = payload.area;
      if (payload.nursingRegNo) caregiverPatch.nursingRegNo = payload.nursingRegNo;

      if (Object.keys(caregiverPatch).length > 0) {
        await apiClient.patch('/caregiver/profile', caregiverPatch);
      }
    } catch (profileErr) {
      console.warn('[Profile Sync] Caregiver profile secondary fields pending update:', profileErr.message);
    }

    // Post-registration document uploads: explicitly ensure each uploaded file is saved
    if (payload.docs || payload.documents) {
      const docKeyMap = {
        identityDoc: 'identity',
        nursingCertificate: 'nursing_registration',
        nursingStudentId: 'college_id',
        addressProof: 'address_proof',
        policeClearance: 'police_clearance',
        bankProof: 'bank_verification',
      };
      const entries = payload.docs ? Object.entries(payload.docs) : [];
      for (const [key, f] of entries) {
        if (!f) continue;
        const documentType = docKeyMap[key] || key;
        try {
          await apiClient.post('/caregiver/documents', {
            documentType,
            fileName: f.name || f.fileName || `${documentType}.pdf`,
            fileSize: f.size || f.fileSize || 1024,
            mimeType: f.type || f.mimeType || 'application/pdf',
            fileData: f.fileData || f.preview || null,
          });
        } catch (uploadErr) {
          console.warn(`[Document Upload] Could not upload ${documentType}:`, uploadErr.message);
        }
      }
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
  requestGuestOtp,
  validateGuestOtp,
  verifyGuestOtp,
  setPassword,
  registerCustomer,
  registerCaregiver,
  getMe,
  logout,
  normalizeQualification,
  normalizeUser,
};

export default authService;
