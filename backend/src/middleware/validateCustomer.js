import mongoose from 'mongoose';

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;
const ALLOWED_GENDERS = ['Male', 'Female', 'Other'];

export const PERMITTED_CUSTOMER_PROFILE_FIELDS = [
  'fullName',
  'emergencyContact',
  'defaultAddress',
  'careNotes',
  'patients',
];

/**
 * Validate customer profile update payload.
 * Strictly allowlists permitted customer fields and strips protected metadata.
 */
export const validateUpdateCustomerProfile = (req, res, next) => {
  const body = req.body || {};
  const errors = [];
  const sanitized = {};

  // 1. Full Name (updates User document)
  if (body.fullName !== undefined) {
    if (typeof body.fullName !== 'string' || body.fullName.trim().length < 2) {
      errors.push('fullName must be a string of at least 2 characters');
    } else if (body.fullName.trim().length > 100) {
      errors.push('fullName cannot exceed 100 characters');
    } else {
      sanitized.fullName = body.fullName.trim();
    }
  }

  // 2. Emergency Contact
  if (body.emergencyContact !== undefined) {
    if (!body.emergencyContact || typeof body.emergencyContact !== 'object' || Array.isArray(body.emergencyContact)) {
      errors.push('emergencyContact must be an object');
    } else {
      const ec = body.emergencyContact;
      const cleanEc = {};

      if (ec.name !== undefined) {
        if (typeof ec.name !== 'string') {
          errors.push('emergencyContact.name must be a string');
        } else {
          cleanEc.name = ec.name.trim().slice(0, 100);
        }
      }

      if (ec.phone !== undefined) {
        const cleanPhone = String(ec.phone).trim().replace(/[\s-]/g, '');
        if (cleanPhone && !PHONE_REGEX.test(cleanPhone)) {
          errors.push('emergencyContact.phone must be a valid phone number (e.g. +919876543210)');
        } else {
          cleanEc.phone = cleanPhone;
        }
      }

      if (ec.relation !== undefined) {
        if (typeof ec.relation !== 'string') {
          errors.push('emergencyContact.relation must be a string');
        } else {
          cleanEc.relation = ec.relation.trim().slice(0, 50);
        }
      }

      sanitized.emergencyContact = cleanEc;
    }
  }

  // 3. Default Address
  if (body.defaultAddress !== undefined) {
    if (!body.defaultAddress || typeof body.defaultAddress !== 'object' || Array.isArray(body.defaultAddress)) {
      errors.push('defaultAddress must be an object');
    } else {
      const da = body.defaultAddress;
      const cleanDa = {};

      if (da.addressLine !== undefined) {
        if (typeof da.addressLine !== 'string') {
          errors.push('defaultAddress.addressLine must be a string');
        } else {
          cleanDa.addressLine = da.addressLine.trim().slice(0, 200);
        }
      }

      if (da.city !== undefined) {
        if (typeof da.city !== 'string') {
          errors.push('defaultAddress.city must be a string');
        } else {
          cleanDa.city = da.city.trim().slice(0, 100);
        }
      }

      if (da.area !== undefined) {
        cleanDa.area = typeof da.area === 'string' ? da.area.trim().slice(0, 100) : '';
      }

      if (da.street !== undefined) {
        cleanDa.street = typeof da.street === 'string' ? da.street.trim().slice(0, 200) : '';
      }

      if (da.district !== undefined) {
        cleanDa.district = typeof da.district === 'string' ? da.district.trim().slice(0, 100) : '';
      }

      if (da.state !== undefined) {
        cleanDa.state = typeof da.state === 'string' ? da.state.trim().slice(0, 100) : '';
      }

      if (da.pincode !== undefined) {
        cleanDa.pincode = typeof da.pincode === 'string' ? da.pincode.trim().slice(0, 20) : '';
      }

      if (da.coordinates !== undefined) {
        if (da.coordinates && typeof da.coordinates === 'object') {
          const { lat, lng } = da.coordinates;
          if (lat !== undefined && (isNaN(lat) || Number(lat) < -90 || Number(lat) > 90)) {
            errors.push('defaultAddress.coordinates.lat must be a valid latitude between -90 and 90');
          }
          if (lng !== undefined && (isNaN(lng) || Number(lng) < -180 || Number(lng) > 180)) {
            errors.push('defaultAddress.coordinates.lng must be a valid longitude between -180 and 180');
          }
          if (!errors.some((e) => e.includes('coordinates'))) {
            cleanDa.coordinates = {
              lat: lat !== undefined && lat !== null ? Number(lat) : null,
              lng: lng !== undefined && lng !== null ? Number(lng) : null,
            };
          }
        }
      }

      sanitized.defaultAddress = cleanDa;
    }
  }

  // 4. Care Notes
  if (body.careNotes !== undefined) {
    if (typeof body.careNotes !== 'string') {
      errors.push('careNotes must be a string');
    } else {
      sanitized.careNotes = body.careNotes.trim().slice(0, 1000);
    }
  }

  // 5. Patients
  if (body.patients !== undefined) {
    if (!Array.isArray(body.patients)) {
      errors.push('patients must be an array of patient records');
    } else if (body.patients.length > 20) {
      errors.push('patients array cannot exceed 20 records');
    } else {
      const cleanPatients = [];
      for (let i = 0; i < body.patients.length; i++) {
        const p = body.patients[i];
        if (!p || typeof p !== 'object') {
          errors.push(`patients[${i}] must be an object`);
          continue;
        }

        if (!p.name || typeof p.name !== 'string' || p.name.trim().length < 1) {
          errors.push(`patients[${i}].name is required`);
        }

        if (p.age !== undefined && p.age !== null) {
          const ageNum = Number(p.age);
          if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
            errors.push(`patients[${i}].age must be a number between 0 and 130`);
          }
        }

        if (p.gender !== undefined && p.gender !== null && !ALLOWED_GENDERS.includes(p.gender)) {
          errors.push(`patients[${i}].gender must be one of: ${ALLOWED_GENDERS.join(', ')}`);
        }

        cleanPatients.push({
          ...(p._id && mongoose.Types.ObjectId.isValid(p._id) ? { _id: p._id } : {}),
          name: typeof p.name === 'string' ? p.name.trim().slice(0, 100) : '',
          age: p.age !== undefined && p.age !== null && !isNaN(Number(p.age)) ? Number(p.age) : null,
          gender: p.gender || 'Other',
          relation: typeof p.relation === 'string' ? p.relation.trim().slice(0, 50) : 'Self',
          condition: typeof p.condition === 'string' ? p.condition.trim().slice(0, 200) : '',
          medicalNotes: typeof p.medicalNotes === 'string' ? p.medicalNotes.trim().slice(0, 500) : '',
        });
      }
      sanitized.patients = cleanPatients;
    }
  }

  // Protected fields check: explicitly error or ignore if client tries to inject roles, IDs, totals
  const protectedInjections = ['role', 'user', 'totalBookings', 'totalSpent', 'status', 'verificationStatus', 'isEmailVerified'];
  for (const field of protectedInjections) {
    if (body[field] !== undefined) {
      delete body[field];
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: errors.join(', '),
      errors,
    });
  }

  req.sanitizedCustomerUpdates = sanitized;
  next();
};
