import { io } from 'socket.io-client';
import { getAuthToken } from './apiClient.js';

let socket = null;

/**
 * Returns the backend Socket server URL.
 */
const getSocketUrl = () => {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    // Strip trailing /api if present to get server origin
    return envUrl.trim().replace(/\/api\/?$/, '');
  }
  return 'http://localhost:5001';
};

/**
 * Initializes or returns the singleton Socket.IO connection.
 * @param {string} [tokenOverride]
 * @returns {import('socket.io-client').Socket}
 */
export const initSocketConnection = (tokenOverride) => {
  const token = tokenOverride || getAuthToken();

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: {
      token: token || undefined,
    },
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect_error', () => {
    // Silently handle fallback to polling or reconnection
  });

  return socket;
};

/**
 * Retrieves the current socket instance.
 */
export const getSocket = () => socket;

/**
 * Disconnects the socket.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Joins a specific booking's real-time messaging room.
 * @param {string} bookingId
 */
export const joinBookingRoom = (bookingId) => {
  if (!bookingId) return;
  const s = socket || initSocketConnection();
  if (s) {
    s.emit('join_booking', { bookingId });
  }
};

/**
 * Leaves a specific booking's real-time messaging room.
 * @param {string} bookingId
 */
export const leaveBookingRoom = (bookingId) => {
  if (!bookingId || !socket) return;
  socket.emit('leave_booking', { bookingId });
};

/**
 * Emits typing status to the booking room.
 * @param {string} bookingId
 * @param {boolean} isTyping
 */
export const emitTyping = (bookingId, isTyping) => {
  if (!bookingId || !socket) return;
  socket.emit('typing', { bookingId, isTyping: Boolean(isTyping) });
};

/**
 * Subscribes to incoming real-time messages.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onNewMessage = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('new_message', callback);
  return () => {
    s.off('new_message', callback);
  };
};

/**
 * Subscribes to real-time typing events.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onTyping = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('typing', callback);
  return () => {
    s.off('typing', callback);
  };
};

/**
 * Subscribes to real-time read receipt updates.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onMessagesRead = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('messages_read', callback);
  return () => {
    s.off('messages_read', callback);
  };
};

/**
 * Listen for newly broadcasted jobs across the platform.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onBookingBroadcast = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('booking:broadcast', callback);
  return () => {
    s.off('booking:broadcast', callback);
  };
};

/**
 * Listen for claimed broadcast jobs so they can be immediately removed from open feeds.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onBookingClaimed = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('booking:claimed', callback);
  return () => {
    s.off('booking:claimed', callback);
  };
};

/**
 * Subscribes to real-time notification alerts.
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
export const onNewNotification = (callback) => {
  const s = socket || initSocketConnection();
  if (!s || typeof callback !== 'function') return () => {};

  s.on('new_notification', callback);
  return () => {
    s.off('new_notification', callback);
  };
};

export default {
  initSocketConnection,
  getSocket,
  disconnectSocket,
  joinBookingRoom,
  leaveBookingRoom,
  emitTyping,
  onNewMessage,
  onTyping,
  onMessagesRead,
  onBookingBroadcast,
  onBookingClaimed,
  onNewNotification,
};
