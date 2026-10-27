import mongoose from 'mongoose';
import crypto from 'crypto';
import { User, CustomerProfile, CaregiverProfile, Document, Service, Blacklist, Ambulance } from '../models/index.js';
import { hashPassword, comparePassword, generateToken, sanitizeUser, formatAccountStatusMessage } from '../utils/auth.js';
import { generateNumericOtp } from '../utils/otpUtils.js';

/**
 * Register a new Customer.
 * Role is strictly locked to 'customer'.
 */
export const registerCustomer = async (data) => {
  const { fullName, email, phone, password, defaultAddress, emergencyContact, patientInfo } = data;

  // 1. Check for existing account by email or phone
  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const err = new Error('An account with this email address already exists');
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      const err = new Error('An account with this phone number already exists');
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  // 2. Hash password
  const passwordHash = await hashPassword(password);

  // 3. Create User record (role hardcoded to 'customer', ignores any body.role)
  const user = await User.create({
    fullName,
    email: email || null,
    phone: phone || null,
    passwordHash,
    role: 'customer',
    status: 'active',
  });

  // 4. Create associated CustomerProfile with safe rollback
  let profile = null;
  try {
    const patients = patientInfo ? [patientInfo] : [];
    profile = await CustomerProfile.create({
      user: user._id,
      emergencyContact: emergencyContact || {},
      defaultAddress: defaultAddress || {},
      patients,
    });
  } catch (profileErr) {
    // Rollback user creation to prevent orphaned records
    await User.findByIdAndDelete(user._id);
    throw profileErr;
  }

  // 5. Generate token
  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: sanitizeUser(user),
    profile,
    token,
  };
};

/**
 * Register a new Caregiver / Bystander / Nurse.
 * Role is strictly locked to 'caregiver' and verificationStatus to 'pending'.
 */
export const registerCaregiver = async (data) => {
  const {
    fullName,
    email,
    phone,
    password,
    qualification,
    nursingRegNo,
    experienceYears,
    bio,
    languages,
    city,
    area,
    hourlyRate,
    services,
    careSettings,
  } = data;

  // 1. Check for duplicate account
  if (email) {
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      const err = new Error('An account with this email address already exists');
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  if (phone) {
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      const err = new Error('An account with this phone number already exists');
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  if (nursingRegNo) {
    const existingReg = await CaregiverProfile.findOne({ nursingRegNo });
    if (existingReg) {
      const err = new Error('This nursing registration number is already registered');
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }
  }

  // 2. Hash password
  const passwordHash = await hashPassword(password);

  // 3. Create User record (role hardcoded to 'caregiver')
  const user = await User.create({
    fullName,
    email: email || null,
    phone: phone || null,
    passwordHash,
    role: 'caregiver',
    status: 'pending_verification',
  });

  // 4. Create CaregiverProfile with safe rollback
  let profile = null;
  try {
    let initialServicesOffered = [];
    let initialServices = services && Array.isArray(services) ? services : [];
    if (initialServices.length === 0) {
      const activeCatalog = await Service.find({ isActive: true }).select('_id name');
      initialServicesOffered = activeCatalog.map((s) => s._id);
      initialServices = activeCatalog.map((s) => s.name);
    }

    profile = await CaregiverProfile.create({
      user: user._id,
      qualification,
      nursingRegNo: nursingRegNo || null,
      experienceYears: experienceYears || 0,
      bio: bio || '',
      languages: languages && Array.isArray(languages) ? languages : ['English'],
      city: city || 'Mumbai, MH',
      area: area || '',
      hourlyRate: hourlyRate !== undefined ? hourlyRate : 499,
      servicesOffered: initialServicesOffered,
      services: initialServices,
      careSettings:
        careSettings && Array.isArray(careSettings) && careSettings.length
          ? Array.from(
              new Set(
                careSettings
                  .map((s) => (s === 'Home' ? 'Home Care' : s === 'Hospital' ? 'Hospital Care' : s))
                  .filter((s) => ['Home Care', 'Hospital Care'].includes(s)),
              ),
            )
          : ['Home Care'],
      // Strict security defaults: never allow client to declare itself verified
      verificationStatus: 'pending',
      trustScore: 50,
      completedJobs: 0,
      rating: { average: 5.0, count: 0 },
      badges: [],
    });

    // 5. Create Document records if documents were uploaded during application
    const submittedDocs = data.documents || data.docs;

    if (submittedDocs) {
      const docKeyMap = {
        nursingCertificate: 'nursing_registration',
        nursingStudentId: 'college_id',
        identityDoc: 'identity',
        addressProof: 'address_proof',
        policeClearance: 'police_clearance',
        bankProof: 'bank_verification',
      };

      const docItems = Array.isArray(submittedDocs)
        ? submittedDocs
        : Object.entries(submittedDocs).map(([key, val]) => ({
            docId: key,
            type: docKeyMap[key] || key,
            file: val,
          }));

      let createdAny = false;
      for (const item of docItems) {
        if (!item || !item.file) continue;
        const docType = docKeyMap[item.docId] || docKeyMap[item.type] || item.type;
        const validTypes = [
          'identity',
          'address_proof',
          'nursing_registration',
          'college_id',
          'police_clearance',
          'bank_verification',
          'other',
        ];
        if (validTypes.includes(docType)) {
          const fObj = item.file || {};
          const fileName = fObj.name || fObj.fileName || (typeof fObj === 'string' ? fObj : `${docType}.pdf`);
          const fileData = fObj.fileData || item.fileData || null;
          const fileKey = fileData && typeof fileData === 'string' && fileData.startsWith('data:')
            ? fileData
            : `docs/${user._id}/${docType}_${Date.now()}`;

          await Document.create({
            user: user._id,
            caregiverProfile: profile._id,
            documentType: docType,
            fileName,
            fileSize: Number(fObj.size || fObj.fileSize) || 1024,
            mimeType: fObj.type || fObj.mimeType || 'application/pdf',
            fileKey,
            verificationStatus: 'under_review',
          });
          createdAny = true;
        }

      }

      if (createdAny) {
        profile.verificationStatus = 'under_review';
        await profile.save();
      }
    }
  } catch (profileErr) {
    // Rollback user creation
    await User.findByIdAndDelete(user._id);
    throw profileErr;
  }


  // 5. Generate token
  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: sanitizeUser(user),
    profile,
    token,
  };
};

/**
 * Authenticate user by email or phone and password.
 */
export const login = async (identifier, password) => {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes('@');

  // Query by email (lowercase) or phone with passwordHash included
  const query = isEmail ? { email: trimmed.toLowerCase() } : { phone: trimmed };
  const user = await User.findOne(query).select('+passwordHash');

  // Generic credential error to prevent account enumeration
  if (!user) {
    const err = new Error('Invalid email/phone or password');
    err.statusCode = 401;
    err.name = 'AuthenticationError';
    throw err;
  }

  // Verify password
  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    const err = new Error('Invalid email/phone or password');
    err.statusCode = 401;
    err.name = 'AuthenticationError';
    throw err;
  }

  // Check account status and blacklist registry
  let activeBlacklist = null;
  if (mongoose.connection?.readyState === 1) {
    try {
      if (user.status === 'blocked' || user.status === 'suspended' || !user.status) {
        if (!user.statusReviewAfter) {
          activeBlacklist = await Blacklist.findOne({
            $or: [
              { user: user._id },
              ...(user.phone ? [{ phone: user.phone }] : []),
              ...(user.email ? [{ email: user.email.toLowerCase() }] : []),
            ],
            status: 'active',
          });
        }
      } else {
        // Check if user was blacklisted in Blacklist ledger
        activeBlacklist = await Blacklist.findOne({
          $or: [
            { user: user._id },
            ...(user.phone ? [{ phone: user.phone }] : []),
            ...(user.email ? [{ email: user.email.toLowerCase() }] : []),
          ],
          status: 'active',
        });
        if (activeBlacklist) {
          user.status = 'blocked';
          user.statusReason = activeBlacklist.reason;
          user.statusReviewAfter = activeBlacklist.reviewAfter;
          await user.save();
        }
      }
    } catch {
      activeBlacklist = null;
    }
  }

  if (user.status === 'blocked' || user.status === 'suspended' || activeBlacklist) {
    const message = formatAccountStatusMessage(user, activeBlacklist);
    const err = new Error(message);
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Load associated profile
  let profile = null;
  if (user.role === 'customer') {
    profile = await CustomerProfile.findOne({ user: user._id });
  } else if (user.role === 'caregiver') {
    profile = await CaregiverProfile.findOne({ user: user._id });
  } else if (user.role === 'ambulance') {
    profile = await Ambulance.findOne({ user: user._id });
  }

  // Generate token
  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: sanitizeUser(user),
    profile,
    token,
  };
};

/**
 * Retrieve current user and profile.
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }

  let profile = null;
  if (user.role === 'customer') {
    profile = await CustomerProfile.findOne({ user: user._id });
  } else if (user.role === 'caregiver') {
    profile = await CaregiverProfile.findOne({ user: user._id });
  } else if (user.role === 'ambulance') {
    profile = await Ambulance.findOne({ user: user._id });
  }

  return {
    user: sanitizeUser(user),
    profile,
  };
};

const GUEST_OTP_CACHE = new Map();

/**
 * Request an instant guest login OTP for urgent customer booking.
 */
export const requestGuestOtp = async (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    const err = new Error('Please provide a valid email address for guest login.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const cleanEmail = email.toLowerCase().trim();

  // If user exists and is NOT a customer, reject to protect roles
  const existingUser = await User.findOne({ email: cleanEmail });
  if (existingUser && existingUser.role !== 'customer') {
    const err = new Error(
      `An account with this email already exists with the ${existingUser.role} role. Please use standard login.`
    );
    err.statusCode = 409;
    err.name = 'ConflictError';
    throw err;
  }

  const otp = generateNumericOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  GUEST_OTP_CACHE.set(cleanEmail, {
    otp,
    expiresAt,
    attempts: 0,
  });

  console.log(`[Guest OTP Dispatch] Code for ${cleanEmail}: ${otp}`);

  return {
    email: cleanEmail,
    message: `Verification code sent to ${cleanEmail}`,
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  };
};

/**
 * Verify guest login OTP and create or authenticate customer session.
 */
export const verifyGuestOtp = async (email, otp, password) => {
  if (!email || !otp) {
    const err = new Error('Email address and 6-digit OTP code are required.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp).trim();

  const record = GUEST_OTP_CACHE.get(cleanEmail);
  const isDevMasterOtp = process.env.NODE_ENV !== 'production' && cleanOtp === '123456';

  if (!record && !isDevMasterOtp) {
    const err = new Error(
      'No active verification code found for this email, or the code has expired. Please request a new code.'
    );
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }

  if (record) {
    if (Date.now() > record.expiresAt) {
      GUEST_OTP_CACHE.delete(cleanEmail);
      const err = new Error('Verification code has expired. Please request a new code.');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    if (record.attempts >= 5) {
      GUEST_OTP_CACHE.delete(cleanEmail);
      const err = new Error('Too many failed verification attempts. Please request a new code.');
      err.statusCode = 429;
      err.name = 'RateLimitError';
      throw err;
    }

    if (record.otp !== cleanOtp && !isDevMasterOtp) {
      record.attempts += 1;
      const err = new Error('Incorrect verification code. Please check your email and try again.');
      err.statusCode = 400;
      err.name = 'ValidationError';
      throw err;
    }

    GUEST_OTP_CACHE.delete(cleanEmail);
  }

  let user = await User.findOne({ email: cleanEmail });
  let profile = null;

  if (user) {
    if (user.role !== 'customer') {
      const err = new Error(`This email belongs to a ${user.role} account. Please use standard login.`);
      err.statusCode = 409;
      err.name = 'ConflictError';
      throw err;
    }

    if (user.status === 'blocked' || user.status === 'suspended') {
      const err = new Error(formatAccountStatusMessage(user));
      err.statusCode = 403;
      err.name = 'ForbiddenError';
      throw err;
    }

    if (user.fullName && user.fullName.includes(' (Guest)')) {
      user.fullName = user.fullName.replace(' (Guest)', '');
    }
    if (password && typeof password === 'string' && password.length >= 6) {
      user.passwordHash = await hashPassword(password);
    }
    user.lastLoginAt = new Date();
    await user.save();
    profile = await CustomerProfile.findOne({ user: user._id });
  } else {
    // Create new customer account via OTP
    const rawPass = password && typeof password === 'string' && password.length >= 6
      ? password
      : crypto.randomUUID();
    const passwordHash = await hashPassword(rawPass);
    const prefix = cleanEmail.split('@')[0];
    const formattedName = prefix.charAt(0).toUpperCase() + prefix.slice(1);

    user = await User.create({
      fullName: formattedName,
      email: cleanEmail,
      passwordHash,
      role: 'customer',
      status: 'active',
      isGuest: false,
      isEmailVerified: true,
      lastLoginAt: new Date(),
    });

    profile = await CustomerProfile.create({
      user: user._id,
      defaultAddress: {
        addressLine: '',
        area: '',
        city: 'Mumbai, MH',
        pincode: '',
      },
      patients: [],
    });
  }

  const token = generateToken({ id: user._id, role: 'customer' });
  const isProfileComplete = Boolean(
    profile &&
    profile.defaultAddress?.addressLine &&
    profile.defaultAddress?.city &&
    profile.patients?.length > 0
  );

  return {
    user: sanitizeUser(user),
    profile,
    token,
    isGuest: true,
    isProfileComplete,
  };
};

/**
 * Set or update password for authenticated user.
 */
export const setPassword = async (userId, newPassword) => {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    const err = new Error('Password must be at least 6 characters long.');
    err.statusCode = 400;
    err.name = 'ValidationError';
    throw err;
  }
  const passwordHash = await hashPassword(newPassword);
  const user = await User.findByIdAndUpdate(userId, { passwordHash }, { new: true });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.name = 'NotFoundError';
    throw err;
  }
  return { message: 'Password updated successfully' };
};
