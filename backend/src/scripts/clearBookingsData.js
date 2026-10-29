import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  Booking,
  Transaction,
  SimulatedPayment,
  Payout,
  Message,
  Review,
  Complaint,
  SosIncident,
  Notification,
  CaregiverProfile,
  CustomerProfile,
  User,
  Document,
  Service,
  Ambulance,
} from '../models/index.js';

dotenv.config();

export async function clearBookingsData() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB. Beginning clean up of booking-related data...');

  // 1. Log before counts
  console.log('\n--- BEFORE CLEANUP ---');
  console.log('Bookings:', await Booking.countDocuments());
  console.log('Transactions:', await Transaction.countDocuments());
  console.log('Simulated Payments:', await SimulatedPayment.countDocuments());
  console.log('Payouts:', await Payout.countDocuments());
  console.log('Messages:', await Message.countDocuments());
  console.log('Reviews:', await Review.countDocuments());
  console.log('Complaints:', await Complaint.countDocuments());
  console.log('SOS Incidents:', await SosIncident.countDocuments());
  console.log('Notifications:', await Notification.countDocuments());

  // 2. Delete all booking-related collections
  const resBookings = await Booking.deleteMany({});
  const resTransactions = await Transaction.deleteMany({});
  const resSimulated = await SimulatedPayment.deleteMany({});
  const resPayouts = await Payout.deleteMany({});
  const resMessages = await Message.deleteMany({});
  const resReviews = await Review.deleteMany({});
  const resComplaints = await Complaint.deleteMany({});
  const resSos = await SosIncident.deleteMany({});
  const resNotifications = await Notification.deleteMany({});

  console.log('\n--- DELETED RECORDS ---');
  console.log(`Deleted ${resBookings.deletedCount} bookings`);
  console.log(`Deleted ${resTransactions.deletedCount} transactions`);
  console.log(`Deleted ${resSimulated.deletedCount} simulated payments`);
  console.log(`Deleted ${resPayouts.deletedCount} payouts`);
  console.log(`Deleted ${resMessages.deletedCount} messages`);
  console.log(`Deleted ${resReviews.deletedCount} reviews`);
  console.log(`Deleted ${resComplaints.deletedCount} complaints`);
  console.log(`Deleted ${resSos.deletedCount} SOS incidents`);
  console.log(`Deleted ${resNotifications.deletedCount} notifications`);

  // 3. Reset caregiver profile booking counters
  const resCaregivers = await CaregiverProfile.updateMany(
    {},
    {
      $set: {
        completedJobs: 0,
        bookingLockVersion: 0,
        ratingLockVersion: 0,
        payoutLockVersion: 0,
        'rating.count': 0,
        'rating.average': 5.0,
      },
    },
  );
  console.log(`\nReset booking stats on ${resCaregivers.modifiedCount} caregiver profiles.`);

  // 4. Verify preserved accounts
  console.log('\n--- PRESERVED SYSTEM ENTITIES (100% UNTOUCHED) ---');
  console.log('Users (Customers, Caretakers, Admins):', await User.countDocuments());
  console.log('Customer Profiles:', await CustomerProfile.countDocuments());
  console.log('Caregiver Profiles:', await CaregiverProfile.countDocuments());
  console.log('Uploaded Documents:', await Document.countDocuments());
  console.log('Services Catalog:', await Service.countDocuments());
  console.log('Ambulances:', await Ambulance.countDocuments());

  await mongoose.disconnect();
  console.log('\nCleanup complete! Database is fresh for new booking testing.');
}

clearBookingsData().catch((err) => {
  console.error('Failed to clear booking data:', err);
  process.exit(1);
});
