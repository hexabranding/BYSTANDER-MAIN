import { Server } from 'socket.io';
import { verifyToken } from './utils/auth.js';
import { User } from './models/index.js';

let io = null;

/**
 * Initializes the Socket.IO server on top of the Node HTTP server.
 * Provides real-time messaging, room-scoped delivery for bookings,
 * and user-scoped unread message alerts.
 *
 * @param {import('http').Server} httpServer
 * @param {string} [clientUrl='http://localhost:5173']
 * @returns {Server}
 */
export const initSocket = (httpServer, clientUrl = 'http://localhost:5173') => {
  io = new Server(httpServer, {
    cors: {
      origin: clientUrl,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware: inspect auth token or cookie
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization?.startsWith('Bearer ')) {
        token = socket.handshake.headers.authorization.split(' ')[1];
      }

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, c) => {
          const [k, v] = c.trim().split('=');
          if (k && v) acc[k] = decodeURIComponent(v);
          return acc;
        }, {});
        token = cookies.token;
      }

      if (token) {
        try {
          const decoded = verifyToken(token);
          const user = await User.findById(decoded.id).select('_id name role email status');
          if (user && user.status !== 'blocked') {
            socket.user = user;
          }
        } catch {
          // Token invalid or expired - socket still connects as unauthenticated guest
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString();
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Join booking conversation room
    socket.on('join_booking', ({ bookingId }) => {
      if (!bookingId) return;
      socket.join(`booking:${bookingId}`);
    });

    // Leave booking conversation room
    socket.on('leave_booking', ({ bookingId }) => {
      if (!bookingId) return;
      socket.leave(`booking:${bookingId}`);
    });

    // Live typing status
    socket.on('typing', ({ bookingId, isTyping }) => {
      if (!bookingId) return;
      socket.to(`booking:${bookingId}`).emit('typing', {
        bookingId,
        userId: socket.user?._id,
        userName: socket.user?.name || 'Someone',
        isTyping: Boolean(isTyping),
      });
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
};

/**
 * Returns the initialized Socket.IO instance.
 * @returns {Server|null}
 */
export const getIO = () => io;

export default { initSocket, getIO };
