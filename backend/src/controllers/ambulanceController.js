import * as ambulanceService from '../services/ambulanceService.js';
import { generateToken, getCookieOptions } from '../utils/auth.js';

const COOKIE_NAME = process.env.COOKIE_NAME || 'token';

export async function register(req, res, next) {
  try {
    const result = await ambulanceService.registerAmbulance(req.body);
    const token = generateToken({
      id: result.user.id || result.user._id,
      role: result.user.role,
      email: result.user.email,
    });

    // Set auth cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Ambulance driver registered successfully. Awaiting administrative approval.',
      data: {
        token,
        user: result.user,
        ambulance: result.ambulance,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listPublic(req, res, next) {
  try {
    const ambulances = await ambulanceService.getPublicAmbulances(req.query);
    return res.status(200).json({
      success: true,
      data: {
        ambulances,
        count: ambulances.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function recordCall(req, res, next) {
  try {
    const ambulance = await ambulanceService.recordEmergencyCall(req.params.id);
    return res.status(200).json({
      success: true,
      message: 'Emergency call logged.',
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const ambulance = await ambulanceService.getAmbulanceProfileByUserId(req.user._id);
    return res.status(200).json({
      success: true,
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req, res, next) {
  try {
    const ambulance = await ambulanceService.updateAmbulanceProfile(req.user._id, req.body);
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleAvailability(req, res, next) {
  try {
    const ambulance = await ambulanceService.toggleAmbulanceAvailability(
      req.user._id,
      req.body.isAvailable
    );
    return res.status(200).json({
      success: true,
      message: `Status updated to ${ambulance.isAvailable ? 'Available' : 'Off-duty'}.`,
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const { latitude, longitude } = req.body;
    const ambulance = await ambulanceService.updateAmbulanceLocation(
      req.user._id,
      latitude,
      longitude
    );
    return res.status(200).json({
      success: true,
      message: 'Ambulance GPS location updated.',
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminList(req, res, next) {
  try {
    const result = await ambulanceService.getAllAmbulancesForAdmin(req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function adminVerify(req, res, next) {
  try {
    const ambulance = await ambulanceService.updateAmbulanceVerification(
      req.params.id,
      req.body.status,
      req.body.notes
    );
    return res.status(200).json({
      success: true,
      message: `Ambulance status updated to ${req.body.status}.`,
      data: { ambulance },
    });
  } catch (err) {
    next(err);
  }
}
