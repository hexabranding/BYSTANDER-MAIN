import { User, CustomerProfile, CaregiverProfile, Document, Service } from '../models/index.js';
import { hashPassword, comparePassword, generateToken, sanitizeUser } from '../utils/auth.js';

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

  // Check account status
  if (user.status === 'blocked') {
    const err = new Error('Your account has been blocked. Please contact platform support.');
    err.statusCode = 403;
    err.name = 'ForbiddenError';
    throw err;
  }

  if (user.status === 'suspended') {
    const err = new Error('Your account has been temporarily suspended. Please contact platform support.');
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
  }

  return {
    user: sanitizeUser(user),
    profile,
  };
};
