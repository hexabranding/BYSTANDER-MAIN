import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import adminServiceRoutes from './routes/adminServiceRoutes.js';
import adminVerificationRoutes from './routes/adminVerificationRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import adminModerationRoutes from './routes/adminModerationRoutes.js';
import adminComplaintRoutes from './routes/adminComplaintRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import adminAnalyticsRoutes from './routes/adminAnalyticsRoutes.js';
import adminFinanceRoutes from './routes/adminFinanceRoutes.js';
import adminBlacklistRoutes from './routes/adminBlacklistRoutes.js';
import adminSettingsRoutes from './routes/adminSettingsRoutes.js';
import caregiverSelfRoutes from './routes/caregiverSelfRoutes.js';
import caregiverPublicRoutes from './routes/caregiverPublicRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import sosRoutes from './routes/sosRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import ambulanceRoutes from './routes/ambulanceRoutes.js';
import testPaymentRoutes from './routes/testPaymentRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { assertValidJwtSecret } from './utils/auth.js';
import { assertValidOtpSecret } from './utils/otpUtils.js';

// Resolve directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load environment variables from backend/.env (including Razorpay Test API keys)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// 1. Reverse-Proxy Configuration: Only trust proxy hops when explicitly configured or in production
const trustProxyConfig = process.env.TRUST_PROXY;
if (trustProxyConfig !== undefined) {
  if (trustProxyConfig === 'true') {
    app.set('trust proxy', true);
  } else if (trustProxyConfig === 'false') {
    app.set('trust proxy', false);
  } else if (!isNaN(Number(trustProxyConfig))) {
    app.set('trust proxy', Number(trustProxyConfig));
  } else {
    app.set('trust proxy', trustProxyConfig);
  }
} else if (process.env.NODE_ENV === 'production') {
  // Safe production default: trust single immediate reverse proxy (e.g., Nginx, AWS ALB, Cloudflare)
  app.set('trust proxy', 1);
}

// 2. Request Parsing & Cookie Middleware (supports document uploads up to 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 3. CORS Configuration for Local Vite Frontend
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

// 4. HTTP Request & Status Code Terminal Logger
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;

      // Color code by HTTP status family: 2xx green, 3xx cyan, 4xx yellow, 5xx red
      let statusColor = '\x1b[32m'; // Green (2xx)
      if (status >= 500) statusColor = '\x1b[31m'; // Red (5xx)
      else if (status >= 400) statusColor = '\x1b[33m'; // Yellow (4xx)
      else if (status >= 300) statusColor = '\x1b[36m'; // Cyan (3xx)

      const bold = '\x1b[1m';
      const reset = '\x1b[0m';
      const dim = '\x1b[2m';

      console.log(
        `[HTTP] ${bold}${req.method}${reset} ${req.originalUrl || req.url} ${statusColor}${status}${reset} ${dim}(${duration}ms)${reset}`,
      );
    });
    next();
  });
}

// 5. Health Check Endpoint
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

// 5. Application Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/admin/verifications', adminVerificationRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/admin/messages', adminModerationRoutes);
app.use('/api/admin/complaints', adminComplaintRoutes);
app.use('/api/admin/blacklist', adminBlacklistRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/customers', (req, res, next) => {
  req.url = '/customers' + (req.url === '/' ? '' : req.url);
  adminUserRoutes(req, res, next);
});
app.use('/api/admin/caregivers', (req, res, next) => {
  req.url = '/caregivers' + (req.url === '/' ? '' : req.url);
  adminUserRoutes(req, res, next);
});
app.use('/api/customer', customerRoutes);
app.use('/api/caregiver', caregiverSelfRoutes);
app.use('/api/caregivers', caregiverPublicRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin', adminFinanceRoutes);
app.use('/api/admin/financials', adminFinanceRoutes);

// Test-only simulated payment routes (strictly blocked in production)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test/payments', testPaymentRoutes);
}

// 6. JSON 404 Handler for Unknown Routes
app.use(notFoundHandler);

// 7. Centralized Error-Handling Middleware
app.use(errorHandler);

// 8. Server Initialization: Connects to MongoDB before listening for requests
export const startServer = async () => {
  try {
    // 1. Fail application startup if required production secrets are missing or invalid
    assertValidJwtSecret();
    assertValidOtpSecret();

    // 2. Connect to MongoDB Atlas
    await connectDB();

    // 3. Sample dev seeds (strictly disabled in production)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { seedAmbulances } = await import('./scripts/seedAmbulances.js');
        seedAmbulances().catch((e) => console.log('[Ambulance Seed]', e.message));
      } catch (_) {}
    }

    const httpServer = http.createServer(app);
    initSocket(httpServer, CLIENT_URL);

    const server = httpServer.listen(PORT, () => {
      console.log(`[Server] Bystander Express server listening on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
      console.log(`[Server] CORS origin allowed: ${CLIENT_URL}`);
      console.log(`[Server] Socket.IO real-time service active`);
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

    // Nodemon graceful restart signal
    process.once('SIGUSR2', () => {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    });

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
