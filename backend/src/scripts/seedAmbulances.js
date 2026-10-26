import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, Ambulance } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SAMPLE_AMBULANCES = [
  {
    fullName: 'Rajesh Patil',
    phone: '+919820112233',
    email: 'rajesh.ambulance@bystander.org',
    vehicleNumber: 'MH 02 CZ 4421',
    ambulanceType: 'ICU on Wheels',
    baseHospital: 'Lilavati Hospital & Research Centre',
    city: 'Mumbai',
    area: 'Bandra West',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: true,
    stretcherAvailable: true,
    emergencyCallCount: 18,
    notes: 'Equipped with Hamilton-T1 transport ventilator & cardiac defibrillator.',
  },
  {
    fullName: 'Mohd. Imran Khan',
    phone: '+919820556677',
    email: 'imran.ambulance@bystander.org',
    vehicleNumber: 'MH 01 AB 8890',
    ambulanceType: 'Advanced Life Support (ALS)',
    baseHospital: 'KEM Hospital & Medical College',
    city: 'Mumbai',
    area: 'Parel',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 34,
    notes: '24x7 trauma ready with EMT paramedic onboard.',
  },
  {
    fullName: 'Gurpreet Singh',
    phone: '+919811223344',
    email: 'gurpreet.ambulance@bystander.org',
    vehicleNumber: 'DL 01 EA 3201',
    ambulanceType: 'ICU on Wheels',
    baseHospital: 'AIIMS Trauma Center',
    city: 'Delhi',
    area: 'Safdarjung Enclave',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: true,
    stretcherAvailable: true,
    emergencyCallCount: 42,
    notes: 'High-risk critical transport with dual oxygen cylinders.',
  },
  {
    fullName: 'Suresh Kumar',
    phone: '+919845112233',
    email: 'suresh.ambulance@bystander.org',
    vehicleNumber: 'KA 03 MB 9901',
    ambulanceType: 'Basic Life Support (BLS)',
    baseHospital: 'Manipal Hospital',
    city: 'Bangalore',
    area: 'Old Airport Road',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 15,
    notes: 'Rapid bedside oxygen support & patient transfer.',
  },
  {
    fullName: 'Venkatesh Rao',
    phone: '+919849223344',
    email: 'venkatesh.ambulance@bystander.org',
    vehicleNumber: 'TS 09 ER 1099',
    ambulanceType: 'Advanced Life Support (ALS)',
    baseHospital: 'Apollo Hospitals',
    city: 'Hyderabad',
    area: 'Jubilee Hills',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 22,
    notes: 'Equipped with syringe pumps, multi-para monitor & suction apparatus.',
  },
  {
    fullName: 'Karthik Raja',
    phone: '+919840334455',
    email: 'karthik.ambulance@bystander.org',
    vehicleNumber: 'TN 02 AX 7712',
    ambulanceType: 'Patient Transport',
    baseHospital: 'Fortis Malar Hospital',
    city: 'Chennai',
    area: 'Adyar',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 11,
    notes: 'Wheelchair ramp & folding stretcher for post-discharge non-critical transfers.',
  },
];

export async function seedAmbulances() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bystander';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }

  const defaultPassword = 'caremate123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  for (const item of SAMPLE_AMBULANCES) {
    let user = await User.findOne({ phone: item.phone });
    if (!user) {
      user = await User.create({
        fullName: item.fullName,
        email: item.email,
        phone: item.phone,
        passwordHash,
        role: 'ambulance',
        status: 'active',
      });
    }

    const existingAmbulance = await Ambulance.findOne({ vehicleNumber: item.vehicleNumber });
    if (!existingAmbulance) {
      await Ambulance.create({
        user: user._id,
        driverName: item.fullName,
        phone: item.phone,
        vehicleNumber: item.vehicleNumber,
        ambulanceType: item.ambulanceType,
        baseHospital: item.baseHospital,
        city: item.city,
        area: item.area,
        isAvailable: item.isAvailable,
        verificationStatus: 'verified',
        oxygenFitted: item.oxygenFitted,
        ventilatorFitted: item.ventilatorFitted,
        stretcherAvailable: item.stretcherAvailable,
        emergencyCallCount: item.emergencyCallCount,
        notes: item.notes,
      });
    }
  }

  console.log('✅ Seeded sample ambulance drivers successfully.');
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedAmbulances()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Failed to seed ambulances:', err);
      process.exit(1);
    });
}
