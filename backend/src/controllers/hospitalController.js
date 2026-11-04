import Hospital from '../models/Hospital.js';

// Initial authoritative Kerala partner hospitals seed
const INITIAL_KERALA_HOSPITALS = [
  {
    name: 'Baby Memorial Hospital',
    code: 'HS-101',
    city: 'Kozhikode',
    district: 'Kozhikode',
    state: 'Kerala',
    address: 'Indira Gandhi Road, Arayidathupalam, Kozhikode, Kerala 673004',
    contactPerson: 'Dr. K. Narayanan (Referral Desk)',
    phone: '+91 495 277 7777',
    email: 'referrals@babymhospital.org',
    bedPartners: 45,
    activeBookings: 6,
    icuSupport: true,
    contractStatus: 'Active',
    notes: 'Primary referral partner in North Malabar for post-operative bedside care.',
  },
  {
    name: 'Aster MIMS Hospital',
    code: 'HS-102',
    city: 'Govindapuram',
    district: 'Kozhikode',
    state: 'Kerala',
    address: 'Mini Bypass Road, Govindapuram, Kozhikode, Kerala 673016',
    contactPerson: 'Sister Reena Joseph',
    phone: '+91 495 248 8000',
    email: 'mims.coordinator@asterhospital.com',
    bedPartners: 38,
    activeBookings: 4,
    icuSupport: true,
    contractStatus: 'Active',
    notes: 'Active referral desk tie-up for emergency bystander dispatches and home care transitions.',
  },
  {
    name: 'Aster Medcity',
    code: 'HS-103',
    city: 'Cheranallur',
    district: 'Ernakulam',
    state: 'Kerala',
    address: 'Kuttisahib Road, South Chittoor, Cheranallur, Kochi, Kerala 682027',
    contactPerson: 'Mr. Vivek Menon',
    phone: '+91 484 669 9999',
    email: 'bystander.tieup@asterhospital.com',
    bedPartners: 50,
    activeBookings: 8,
    icuSupport: true,
    contractStatus: 'Active',
    notes: 'Flagship quaternary care partner covering Kochi metro, Aluva, and Ernakulam suburbs.',
  },
  {
    name: 'Amrita Institute of Medical Sciences',
    code: 'HS-104',
    city: 'Edappally',
    district: 'Ernakulam',
    state: 'Kerala',
    address: 'Ponekkara, AIMS P.O., Edappally, Kochi, Kerala 682041',
    contactPerson: 'Dr. Lakshmi Prabha',
    phone: '+91 484 285 1234',
    email: 'patientcare@aims.amrita.edu',
    bedPartners: 40,
    activeBookings: 5,
    icuSupport: true,
    contractStatus: 'Active',
    notes: 'Super-specialty clinical tie-up with nursing student bystander accompaniment protocol.',
  },
  {
    name: 'KIMSHEALTH Hospital',
    code: 'HS-105',
    city: 'Anayara',
    district: 'Thiruvananthapuram',
    state: 'Kerala',
    address: 'P.B. No. 1, Anayara P.O., Thiruvananthapuram, Kerala 695029',
    contactPerson: 'Mrs. Geetha Radhakrishnan',
    phone: '+91 471 294 1000',
    email: 'bystander@kimshealth.org',
    bedPartners: 32,
    activeBookings: 0,
    icuSupport: false,
    contractStatus: 'On Hold',
    notes: 'Bed partnership under renewal for Southern Kerala district operations.',
  },
];

/**
 * Ensures the database contains real Kerala hospitals if none exist.
 */
const ensureHospitalsSeeded = async () => {
  const count = await Hospital.countDocuments();
  if (count === 0) {
    await Hospital.insertMany(INITIAL_KERALA_HOSPITALS);
  }
};

/**
 * GET /api/admin/hospitals
 * Retrieves list of partner hospitals with filtering, stats, and search.
 */
export const getHospitals = async (req, res, next) => {
  try {
    await ensureHospitalsSeeded();

    const { search, contractStatus, district, city } = req.query;

    const filter = {};

    if (contractStatus && contractStatus !== 'All' && contractStatus.trim().length > 0) {
      filter.contractStatus = contractStatus.trim();
    }

    if (district && district !== 'All' && district.trim().length > 0) {
      filter.district = new RegExp(`^${district.trim()}$`, 'i');
    }

    if (city && city !== 'All' && city.trim().length > 0) {
      filter.city = new RegExp(city.trim(), 'i');
    }

    if (search && search.trim().length > 0) {
      const qRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: qRegex },
        { city: qRegex },
        { district: qRegex },
        { contactPerson: qRegex },
        { phone: qRegex },
        { code: qRegex },
      ];
    }

    const hospitals = await Hospital.find(filter).sort({ createdAt: -1 });

    // Platform-wide partner stats across all hospitals
    const allHospitals = await Hospital.find();
    const stats = {
      total: allHospitals.length,
      active: allHospitals.filter((h) => h.contractStatus === 'Active').length,
      onHold: allHospitals.filter((h) => h.contractStatus === 'On Hold').length,
      beds: allHospitals.reduce((sum, h) => sum + (h.bedPartners || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: hospitals,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/hospitals/:id
 * Retrieve single hospital details.
 */
export const getHospitalById = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      const err = new Error('Hospital not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      success: true,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/hospitals
 * Create new partner hospital.
 */
export const createHospital = async (req, res, next) => {
  try {
    const {
      name,
      city,
      district,
      state,
      address,
      contactPerson,
      phone,
      email,
      bedPartners,
      icuSupport,
      contractStatus,
      notes,
    } = req.body;

    if (!name || name.trim().length < 2) {
      const err = new Error('Hospital name must be at least 2 characters');
      err.statusCode = 400;
      throw err;
    }

    if (!city || city.trim().length < 2) {
      const err = new Error('City is required');
      err.statusCode = 400;
      throw err;
    }

    if (!phone || phone.trim().length < 7) {
      const err = new Error('A valid contact phone number is required');
      err.statusCode = 400;
      throw err;
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      city: city.trim(),
      district: (district || 'Kozhikode').trim(),
      state: (state || 'Kerala').trim(),
      address: (address || '').trim(),
      contactPerson: (contactPerson || '').trim(),
      phone: phone.trim(),
      email: (email || '').trim().toLowerCase(),
      bedPartners: Math.max(0, parseInt(bedPartners, 10) || 0),
      icuSupport: Boolean(icuSupport),
      contractStatus: contractStatus === 'On Hold' ? 'On Hold' : 'Active',
      notes: (notes || '').trim(),
    });

    res.status(201).json({
      success: true,
      message: `${hospital.name} added successfully as a partner hospital`,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/hospitals/:id/contract-status
 * Toggle or update hospital contract status.
 */
export const toggleHospitalContract = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      const err = new Error('Hospital not found');
      err.statusCode = 404;
      throw err;
    }

    const { status } = req.body;
    let nextStatus = status;

    if (!nextStatus) {
      nextStatus = hospital.contractStatus === 'Active' ? 'On Hold' : 'Active';
    }

    hospital.contractStatus = nextStatus;
    await hospital.save();

    res.status(200).json({
      success: true,
      message: `Contract with ${hospital.name} updated to ${nextStatus}`,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/hospitals/:id
 * Update hospital details.
 */
export const updateHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      const err = new Error('Hospital not found');
      err.statusCode = 404;
      throw err;
    }

    const allowed = [
      'name',
      'city',
      'district',
      'state',
      'address',
      'contactPerson',
      'phone',
      'email',
      'bedPartners',
      'icuSupport',
      'contractStatus',
      'notes',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        hospital[key] = req.body[key];
      }
    }

    await hospital.save();

    res.status(200).json({
      success: true,
      message: `Hospital ${hospital.name} updated successfully`,
      data: hospital,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/hospitals/:id
 * Remove a hospital.
 */
export const deleteHospital = async (req, res, next) => {
  try {
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) {
      const err = new Error('Hospital not found');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      success: true,
      message: `Hospital ${hospital.name} deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getHospitals,
  getHospitalById,
  createHospital,
  toggleHospitalContract,
  updateHospital,
  deleteHospital,
};

