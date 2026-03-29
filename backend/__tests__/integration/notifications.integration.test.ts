// __tests__/integration/notifications.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRequest, createAuthenticatedUser } from '../test-utils';
import { Notification } from '../../models/notifications.js';

vi.mock('../../common/socket.js', () => ({
  getRecieverSocketId: vi.fn().mockReturnValue(null),
  io: { to: vi.fn().mockReturnValue({ emit: vi.fn() }) },
}));

// ==================== Helpers ====================

const getNotifications = (token: string) =>
  getRequest().get('/notifications').set('Authorization', `Bearer ${token}`);

const getUnread = (token: string) =>
  getRequest().get('/notifications/unread').set('Authorization', `Bearer ${token}`);

const getUnreadCount = (token: string) =>
  getRequest().get('/notifications/unread/count').set('Authorization', `Bearer ${token}`);

const markRead = (token: string, id: string) =>
  getRequest().patch(`/notifications/read/${id}`).set('Authorization', `Bearer ${token}`);

const seedNotification = (targetUser: any, fromUser: any, overrides = {}) =>
  Notification.create({
    targetUser: targetUser._id,
    fromUser: fromUser._id,
    type: 'like',
    message: 'Someone liked your post',
    isRead: false,
    ...overrides,
  });

describe('Notifications Integration Tests', () => {
  let userA: any;
  let tokenA: string;
  let userB: any;
  let tokenB: string;

  beforeEach(async () => {
    const authA = await createAuthenticatedUser();
    const authB = await createAuthenticatedUser();
    userA = authA.user;
    tokenA = authA.token;
    userB = authB.user;
    tokenB = authB.token;
  });

  // ==================== GET /notifications ====================

  describe('GET /notifications (Get All Notifications)', () => {
    it('should return all notifications for the authenticated user', async () => {
      await seedNotification(userA, userB);
      await seedNotification(userA, userB, { type: 'comment', message: 'Someone commented' });

      const res = await getNotifications(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    it('should not return notifications belonging to other users', async () => {
      await seedNotification(userA, userB);
      await seedNotification(userB, userA); // belongs to userB

      const res = await getNotifications(tokenA);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].targetUser.toString()).toBe(userA._id.toString());
    });

    it('should return notifications sorted latest first', async () => {
      await seedNotification(userA, userB, { message: 'First' });
      await seedNotification(userA, userB, { message: 'Second' });

      const res = await getNotifications(tokenA);

      expect(res.status).toBe(200);
      expect(res.body[0].message).toBe('Second');
      expect(res.body[1].message).toBe('First');
    });

    it('should return empty array if user has no notifications', async () => {
      const res = await getNotifications(tokenA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return both read and unread notifications', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userA, userB, { isRead: true });

      const res = await getNotifications(tokenA);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /notifications/unread ====================

  describe('GET /notifications/unread (Get Unread Notifications)', () => {
    it('should return only unread notifications', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userA, userB, { isRead: true });

      const res = await getUnread(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].isRead).toBe(false);
    });

    it('should not return unread notifications of other users', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userB, userA, { isRead: false }); // belongs to userB

      const res = await getUnread(tokenA);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('should return empty array if all notifications are read', async () => {
      await seedNotification(userA, userB, { isRead: true });

      const res = await getUnread(tokenA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/notifications/unread');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /notifications/unread/count ====================

  describe('GET /notifications/unread/count (Get Unread Count)', () => {
    it('should return correct unread count', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userA, userB, { isRead: true });

      const res = await getUnreadCount(tokenA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('unreadCount', 2);
    });

    it('should return 0 if no unread notifications', async () => {
      await seedNotification(userA, userB, { isRead: true });

      const res = await getUnreadCount(tokenA);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(0);
    });

    it('should not count unread notifications belonging to other users', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userB, userA, { isRead: false }); // belongs to userB

      const res = await getUnreadCount(tokenA);

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(1);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/notifications/unread/count');
      expect(res.status).toBe(401);
    });
  });

  // ==================== PATCH /notifications/read/:id ====================

  describe('PATCH /notifications/read/:id (Mark Read)', () => {
    it('should mark a single notification as read', async () => {
      const notif = await seedNotification(userA, userB);

      const res = await markRead(tokenA, notif._id.toString());

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Notification marked as read');
      expect(res.body.notif.isRead).toBe(true);
    });

    it('should persist the read state in the database', async () => {
      const notif = await seedNotification(userA, userB);

      await markRead(tokenA, notif._id.toString());

      const updated = await Notification.findById(notif._id);
      expect(updated!.isRead).toBe(true);
    });

    it('should mark all notifications as read when id is "all"', async () => {
      await seedNotification(userA, userB, { isRead: false });
      await seedNotification(userA, userB, { isRead: false });

      const res = await markRead(tokenA, 'all');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/2 updated/);

      const remaining = await Notification.find({ targetUser: userA._id, isRead: false });
      expect(remaining).toHaveLength(0);
    });

    it('should not mark notifications belonging to another user as read', async () => {
      const notif = await seedNotification(userA, userB); // belongs to userA

      // userB tries to mark userA's notification
      const res = await markRead(tokenB, notif._id.toString());

      expect(res.status).toBe(404);

      const unchanged = await Notification.findById(notif._id);
      expect(unchanged!.isRead).toBe(false);
    });

    it('should return 404 for a non-existent notification id', async () => {
      const fakeId = '000000000000000000000001';

      const res = await markRead(tokenA, fakeId);

      expect(res.status).toBe(404);
    });

    it('should return 401 if not authenticated', async () => {
      const notif = await seedNotification(userA, userB);

      const res = await getRequest().patch(`/notifications/read/${notif._id}`);
      expect(res.status).toBe(401);
    });
  });
});
