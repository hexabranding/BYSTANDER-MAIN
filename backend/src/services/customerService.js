import { CustomerProfile, User } from '../models/index.js';

/**
 * Retrieve authenticated customer's profile.
 * Scoped strictly to the calling user's account.
 */
export const getMyCustomerProfile = async (userId) => {
  let profile = await CustomerProfile.findOne({ user: userId }).populate(
    'user',
    'fullName email phone avatar status isEmailVerified isPhoneVerified createdAt',
  );

  // If customer registered without an initial profile document, create an empty one
  if (!profile) {
    profile = await CustomerProfile.create({
      user: userId,
      emergencyContact: {},
      defaultAddress: {},
      patients: [],
    });
    profile = await profile.populate(
      'user',
      'fullName email phone avatar status isEmailVerified isPhoneVerified createdAt',
    );
  }

  return profile;
};

/**
 * Update authenticated customer's profile details.
 * Strictly applies allowlisted fields, updates linked User fullName if provided,
 * and shields all financial / status / role / system fields.
 */
export const updateMyCustomerProfile = async (userId, sanitizedUpdates) => {
  let profile = await CustomerProfile.findOne({ user: userId });

  if (!profile) {
    profile = new CustomerProfile({ user: userId });
  }

  // 1. Update user fullName if included in sanitized updates
  if (sanitizedUpdates.fullName) {
    await User.findByIdAndUpdate(
      userId,
      { fullName: sanitizedUpdates.fullName },
      { runValidators: true },
    );
  }

  // 2. Apply emergency contact
  if (sanitizedUpdates.emergencyContact !== undefined) {
    profile.emergencyContact = {
      ...profile.emergencyContact?.toObject?.() || {},
      ...sanitizedUpdates.emergencyContact,
    };
  }

  // 3. Apply default address
  if (sanitizedUpdates.defaultAddress !== undefined) {
    profile.defaultAddress = {
      ...profile.defaultAddress?.toObject?.() || {},
      ...sanitizedUpdates.defaultAddress,
    };
  }

  // 4. Apply care notes
  if (sanitizedUpdates.careNotes !== undefined) {
    profile.careNotes = sanitizedUpdates.careNotes;
  }

  // 5. Apply patients list
  if (sanitizedUpdates.patients !== undefined) {
    profile.patients = sanitizedUpdates.patients;
  }

  await profile.save();

  return profile.populate(
    'user',
    'fullName email phone avatar status isEmailVerified isPhoneVerified createdAt',
  );
};
