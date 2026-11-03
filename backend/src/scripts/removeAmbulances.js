import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, Ambulance } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const uri = process.env.MONGODB_URI;

export async function removeAllAmbulances() {
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  console.log('Connecting to database...');
  await mongoose.connect(uri);

  // 1. Find all ambulances
  const ambulances = await Ambulance.find({});
  console.log(`Found ${ambulances.length} ambulance records to delete.`);

  // 2. Find all ambulance user accounts
  const ambulanceUsers = await User.find({ role: 'ambulance' });
  console.log(`Found ${ambulanceUsers.length} ambulance user accounts to delete.`);

  // 3. Delete ambulances
  const deleteAmbulanceRes = await Ambulance.deleteMany({});
  console.log(`Deleted ${deleteAmbulanceRes.deletedCount} ambulance records.`);

  // 4. Delete ambulance users
  const deleteUserRes = await User.deleteMany({ role: 'ambulance' });
  console.log(`Deleted ${deleteUserRes.deletedCount} ambulance user accounts.`);

  await mongoose.disconnect();
  console.log('✅ Successfully removed all drivers and ambulance records from database.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  removeAllAmbulances()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Failed to remove ambulances:', err);
      process.exit(1);
    });
}

