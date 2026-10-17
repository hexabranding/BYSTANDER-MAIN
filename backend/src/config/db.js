import mongoose from 'mongoose';

/**
 * Reusable Mongoose connection function.
 * Connects to MongoDB Atlas using process.env.MONGODB_URI.
 * Monitors connection events and ensures credentials are never leaked in logs.
 */

// Connection event listeners
mongoose.connection.on('error', (err) => {
  const sanitized = err.message.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.error(`[Database Error] Mongoose runtime error: ${sanitized}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database Warning] Mongoose disconnected from MongoDB Atlas.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database] Mongoose reconnected to MongoDB Atlas.');
});

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    throw new Error('MONGODB_URI environment variable is missing or empty. Please configure it in backend/.env');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast if cluster is unreachable
    });

    console.log(`[Database] MongoDB Atlas connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // Sanitize any URI credentials from the error message
    const sanitizedError = error.message.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.error(`[Database Error] Initial connection failed: ${sanitizedError}`);
    throw new Error(`Database connection failed: ${sanitizedError}`);
  }
};

export default connectDB;
