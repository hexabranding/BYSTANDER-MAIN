import { Router } from 'express';
import * as messageController from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import {
  validateSendMessage,
  validateGetMessages,
  validateMarkRead,
} from '../middleware/validateMessage.js';

const router = Router();

// All messaging endpoints require authentication
router.use(authenticate);

// 1. Unread counts for authenticated user (placed before parameterized routes)
router.get('/unread', messageController.getUnreadCounts);

// 2. Send a message associated with a booking
router.post('/', messageLimiter, validateSendMessage, messageController.sendMessage);
router.post('/booking/:bookingId', messageLimiter, validateSendMessage, messageController.sendMessage);
router.post('/:bookingId', messageLimiter, validateSendMessage, messageController.sendMessage);

// 3. Retrieve paginated message history for a booking
router.get('/booking/:bookingId', validateGetMessages, messageController.getMessages);
router.get('/:bookingId', validateGetMessages, messageController.getMessages);

// 4. Mark unread messages in a booking as read
router.patch('/booking/:bookingId/read', validateMarkRead, messageController.markMessagesAsRead);
router.patch('/:bookingId/read', validateMarkRead, messageController.markMessagesAsRead);

export default router;
