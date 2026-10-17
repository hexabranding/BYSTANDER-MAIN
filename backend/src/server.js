import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import adminServiceRoutes from './routes/adminServiceRoutes.js';
import caregiverSelfRoutes from './routes/caregiverSelfRoutes.js';
import caregiverPublicRoutes from './routes/caregiverPublicRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import testPaymentRoutes from './routes/testPaymentRoutes.js';
import { assertValidOtpSecret } from './utils/otpUtils.js';

// Resolve directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Request Parsing & Cookie Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 2. CORS Configuration for Local Vite Frontend
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

// 3. Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbStatus = dbStates[mongoose.connection.readyState] || 'unknown';

  res.status(200).json({
    status: 'ok',
    message: 'Bystander API is operational',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: Number(process.uptime().toFixed(2)),
  });
});

// 4. Application Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/caregiver', caregiverSelfRoutes);
app.use('/api/caregivers', caregiverPublicRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Test-only simulated payment routes (strictly blocked in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test/payments', testPaymentRoutes);
}

// 5. JSON 404 Handler for Unknown Routes
app.use(notFoundHandler);

// 5. Centralized Error-Handling Middleware
app.use(errorHandler);

// 6. Server Initialization: Connects to MongoDB before listening for requests
export const startServer = async () => {
  try {
    // 1. Fail application startup if required production secrets are missing or invalid
    assertValidOtpSecret();

    // 2. Connect to MongoDB Atlas
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`[Server] Bystander Express server listening on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
      console.log(`[Server] CORS origin allowed: ${CLIENT_URL}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server Error] Port ${PORT} is already in use.`);
        if (PORT === 5000) {
          console.error('[Server Tip] On macOS, port 5000 is often reserved by AirPlay Receiver.');
          console.error('[Server Tip] Set PORT=5001 in backend/.env or disable AirPlay Receiver in macOS System Settings.');
        }
      } else {
        console.error(`[Server Error] ${err.message}`);
      }
      process.exit(1);
    });

    // Graceful process termination
    const handleShutdown = () => {
      console.log('\n[Server] Graceful shutdown initiated. Closing HTTP server and database...');
      server.close(async () => {
        try {
          await mongoose.connection.close();
          console.log('[Database] Mongoose connection closed.');
        } catch (closeErr) {
          console.error('[Database Error] Error during connection close:', closeErr.message);
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);

    return server;
  } catch (error) {
    console.error(`[Startup Error] Server halted: ${error.message}`);
    process.exit(1);
  }
};

// Start the server process only when executed directly as entrypoint
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startServer();
}

export default app;
