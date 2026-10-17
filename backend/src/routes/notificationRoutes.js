import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateGetNotifications,
  validateNotificationId,
} from '../middleware/validateNotification.js';

const router = Router();

// All notification endpoints require authentication
router.use(authenticate);

// 1. Unread count (must precede parameterized routes)
router.get('/unread', notificationController.getUnreadCount);

// 2. Mark all notifications as read in bulk
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/read', notificationController.markAllAsRead);

// 3. List paginated notifications for authenticated user
router.get('/', validateGetNotifications, notificationController.getNotifications);

// 4. Mark single notification as read
router.patch('/:id/read', validateNotificationId, notificationController.markOneAsRead);

export default router;
