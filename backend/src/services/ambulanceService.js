import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Ambulance } from '../models/Ambulance.js';
import { calculateDistanceKm, resolveCoordinates, CITY_COORDINATES } from '../utils/geoUtils.js';

/**
 * Register a new Ambulance Driver.
 */
export async function registerAmbulance(data) {
  const {
    fullName,
    email,
    phone,
    password,
    vehicleNumber,
    ambulanceType = 'Basic Life Support (BLS)',
    city,
    area = '',
    baseHospital = 'General Hospital & Trauma Network',
    alternatePhone = '',
    oxygenFitted = true,
    ventilatorFitted = false,
  } = data;

  if (!fullName || !phone || !password || !vehicleNumber || !city) {
    const error = new Error('Full name, phone, password, vehicle number, and city are required.');
    error.statusCode = 400;
    throw error;
  }

  // Check phone uniqueness
  const cleanPhone = phone.trim();
  const existingUser = await User.findOne({
    $or: [{ phone: cleanPhone }, ...(email ? [{ email: email.toLowerCase().trim() }] : [])],
  });

  if (existingUser) {
    const error = new Error('An account with this phone number or email already exists.');
    error.statusCode = 409;
    throw error;
  }

  // Check vehicle plate uniqueness
  const cleanPlate = vehicleNumber.trim().toUpperCase();
  const existingAmbulance = await Ambulance.findOne({ vehicleNumber: cleanPlate });
  if (existingAmbulance) {
    const error = new Error(`An ambulance with vehicle number ${cleanPlate} is already registered.`);
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Create User
  const user = await User.create({
    fullName: fullName.trim(),
    email: email ? email.toLowerCase().trim() : null,
    phone: cleanPhone,
    passwordHash,
    role: 'ambulance',
    status: 'pending_verification',
  });

  // Create Ambulance record (pending admin verification by default)
  const ambulance = await Ambulance.create({
    user: user._id,
    driverName: fullName.trim(),
    phone: cleanPhone,
    alternatePhone: alternatePhone ? alternatePhone.trim() : '',
    vehicleNumber: cleanPlate,
    ambulanceType,
    city: city.trim(),
    area: area ? area.trim() : '',
    baseHospital: baseHospital ? baseHospital.trim() : 'City Trauma Network',
    isAvailable: false,
    verificationStatus: 'pending',
    oxygenFitted: Boolean(oxygenFitted),
    ventilatorFitted: Boolean(ventilatorFitted),
  });

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
    },
    ambulance,
  };
}

/**
 * Fetch public/active verified ambulances for customer & caregiver emergency lookup.
 * Supports location-based 20km radius filtering, Haversine distance, and estimated response ETA.
 */
export async function getPublicAmbulances(filters = {}) {
  const { city, ambulanceType, search, availableOnly, lat, lng, latitude, longitude, radius, radiusOnly } = filters;

  const query = {
    verificationStatus: 'verified',
  };

  if (availableOnly === 'true' || availableOnly === true) {
    query.isAvailable = true;
  }

  if (city && city !== 'All') {
    const cleanCity = city.replace(/,\s*[A-Z]{2}$/i, '').trim();
    query.city = { $regex: cleanCity, $options: 'i' };
  }

  if (ambulanceType && ambulanceType !== 'All') {
    query.ambulanceType = ambulanceType;
  }

  if (search && search.trim()) {
    const term = search.trim();
    query.$or = [
      { driverName: { $regex: term, $options: 'i' } },
      { vehicleNumber: { $regex: term, $options: 'i' } },
      { baseHospital: { $regex: term, $options: 'i' } },
      { area: { $regex: term, $options: 'i' } },
      { city: { $regex: term, $options: 'i' } },
    ];
  }

  const list = await Ambulance.find(query)
    .sort({ isAvailable: -1, emergencyCallCount: -1, createdAt: -1 })
    .lean();

  const userLat = parseFloat(lat ?? latitude);
  const userLng = parseFloat(lng ?? longitude);
  const hasUserCoords = !isNaN(userLat) && !isNaN(userLng);
  const targetRadius = parseFloat(radius) || 30; // default 30 km radius

  // Map and calculate Haversine distance and estimated response arrival time
  const enriched = list.map((amb) => {
    let ambLat = amb.location?.latitude;
    let ambLng = amb.location?.longitude;

    // Fallback to city/district coordinates if driver hasn't pinged GPS yet
    if (!ambLat || !ambLng) {
      const resolved = resolveCoordinates({ city: amb.city, area: amb.area });
      if (resolved) {
        ambLat = resolved.latitude;
        ambLng = resolved.longitude;
      }
    }

    let distanceKm = null;
    let etaMinutes = null;
    if (hasUserCoords && ambLat && ambLng) {
      distanceKm = calculateDistanceKm(userLat, userLng, ambLat, ambLng);
      if (distanceKm !== null) {
        // Average urban emergency speed: ~35 km/h
        etaMinutes = Math.max(3, Math.round((distanceKm / 35) * 60));
      }
    }

    const isLiveGps = Boolean(
      amb.location?.lastPingAt &&
      Date.now() - new Date(amb.location.lastPingAt).getTime() < 10 * 60 * 1000
    );

    return {
      ...amb,
      latitude: ambLat,
      longitude: ambLng,
      distanceKm,
      etaMinutes,
      isWithinRadius: distanceKm !== null ? distanceKm <= targetRadius : true,
      isLiveGps,
    };
  });

  // If user coordinates provided, sort by nearest distance first
  if (hasUserCoords) {
    enriched.sort((a, b) => {
      // Prioritize available drivers
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    if (radiusOnly === 'true' || radiusOnly === true) {
      return enriched.filter((a) => a.isWithinRadius);
    }
  }

  return enriched;
}

/**
 * Update authenticated driver's real-time GPS location coordinates.
 */
export async function updateAmbulanceLocation(userId, latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    const error = new Error('Invalid latitude or longitude coordinates.');
    error.statusCode = 400;
    throw error;
  }

  const ambulance = await Ambulance.findOneAndUpdate(
    { user: userId },
    {
      'location.type': 'Point',
      'location.coordinates': [lng, lat],
      'location.latitude': lat,
      'location.longitude': lng,
      'location.lastPingAt': new Date(),
    },
    { new: true }
  );

  if (!ambulance) {
    const error = new Error('Ambulance driver profile not found.');
    error.statusCode = 404;
    throw error;
  }

  return ambulance;
}

/**
 * Record an emergency call initiated towards an ambulance driver.
 */
export async function recordEmergencyCall(ambulanceId) {
  const ambulance = await Ambulance.findByIdAndUpdate(
    ambulanceId,
    { $inc: { emergencyCallCount: 1 } },
    { new: true }
  );
  return ambulance;
}

/**
 * Get profile for authenticated ambulance driver.
 */
export async function getAmbulanceProfileByUserId(userId) {
  const ambulance = await Ambulance.findOne({ user: userId }).populate('user', 'fullName phone email role status');
  if (!ambulance) {
    const error = new Error('Ambulance driver profile not found.');
    error.statusCode = 404;
    throw error;
  }
  return ambulance;
}

/**
 * Update authenticated driver's profile & vehicle details.
 */
export async function updateAmbulanceProfile(userId, updateData) {
  const allowed = [
    'driverName',
    'phone',
    'alternatePhone',
    'vehicleNumber',
    'ambulanceType',
    'baseHospital',
    'city',
    'area',
    'oxygenFitted',
    'ventilatorFitted',
    'stretcherAvailable',
    'notes',
  ];

  const patch = {};
  for (const key of allowed) {
    if (updateData[key] !== undefined) {
      if (typeof updateData[key] === 'string') {
        patch[key] = updateData[key].trim();
      } else {
        patch[key] = updateData[key];
      }
    }
  }

  if (patch.vehicleNumber) {
    patch.vehicleNumber = patch.vehicleNumber.toUpperCase();
  }

  const ambulance = await Ambulance.findOneAndUpdate({ user: userId }, patch, {
    new: true,
    runValidators: true,
  });

  if (!ambulance) {
    const error = new Error('Ambulance driver profile not found.');
    error.statusCode = 404;
    throw error;
  }

  // Also update user's fullName / phone if changed
  if (patch.driverName || patch.phone) {
    await User.findByIdAndUpdate(userId, {
      ...(patch.driverName ? { fullName: patch.driverName } : {}),
      ...(patch.phone ? { phone: patch.phone } : {}),
    });
  }

  return ambulance;
}

/**
 * Toggle driver's live on-call availability.
 */
export async function toggleAmbulanceAvailability(userId, isAvailable) {
  const existing = await Ambulance.findOne({ user: userId });
  if (!existing) {
    const error = new Error('Ambulance driver profile not found.');
    error.statusCode = 404;
    throw error;
  }

  if (existing.verificationStatus !== 'verified') {
    const error = new Error('Your ambulance profile is pending admin approval. You cannot go on-call until verified.');
    error.statusCode = 403;
    throw error;
  }

  existing.isAvailable = Boolean(isAvailable);
  await existing.save();
  return existing;
}

/**
 * Admin: List all ambulances with filters & pagination.
 */
export async function getAllAmbulancesForAdmin(query = {}) {
  const { city, status, isAvailable, search, page = 1, limit = 20 } = query;

  const filter = {};

  if (city && city !== 'All') {
    filter.city = { $regex: new RegExp(`^${city.trim()}$`, 'i') };
  }

  if (status && status !== 'All') {
    filter.verificationStatus = status;
  }

  if (isAvailable !== undefined && isAvailable !== '') {
    filter.isAvailable = isAvailable === 'true' || isAvailable === true;
  }

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { driverName: { $regex: term, $options: 'i' } },
      { vehicleNumber: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { baseHospital: { $regex: term, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [ambulances, total] = await Promise.all([
    Ambulance.find(filter)
      .populate('user', 'fullName phone email status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Ambulance.countDocuments(filter),
  ]);

  return {
    ambulances,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

/**
 * Admin: Update verification status (verified, rejected, suspended).
 */
export async function updateAmbulanceVerification(ambulanceId, verificationStatus, notes = '') {
  const allowed = ['pending', 'verified', 'rejected', 'suspended'];
  if (!allowed.includes(verificationStatus)) {
    const error = new Error(`Status must be one of: ${allowed.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const updateFields = {
    verificationStatus,
    ...(notes ? { notes } : {}),
  };

  // If suspended or rejected, automatically take off-duty
  if (verificationStatus !== 'verified') {
    updateFields.isAvailable = false;
  }

  const ambulance = await Ambulance.findByIdAndUpdate(
    ambulanceId,
    updateFields,
    { new: true }
  );

  if (!ambulance) {
    const error = new Error('Ambulance not found.');
    error.statusCode = 404;
    throw error;
  }

  // Synchronize associated user account status
  if (ambulance.user) {
    const userStatus =
      verificationStatus === 'verified'
        ? 'active'
        : verificationStatus === 'suspended'
        ? 'suspended'
        : 'pending_verification';
    await User.findByIdAndUpdate(ambulance.user, { status: userStatus });
  }

  return ambulance;
}
