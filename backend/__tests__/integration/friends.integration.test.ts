// __tests__/integration/friends.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRequest, createAuthenticatedUser, createTestUser } from '../test-utils';
import { Friend } from '../../models/friends.js';

vi.mock('../../controllers/notifications.js', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

describe('Friends Integration Tests', () => {
  let userA: any;
  let tokenA: string;
  let userB: any;
  let tokenB: string;
  let userC: any;
  let tokenC: string;

  beforeEach(async () => {
    const authA = await createAuthenticatedUser();
    const authB = await createAuthenticatedUser();
    const authC = await createAuthenticatedUser();
    userA = authA.user;
    tokenA = authA.token;
    userB = authB.user;
    tokenB = authB.token;
    userC = authC.user;
    tokenC = authC.token;
  });

  // ==================== POST /friends/add-friend/:id ====================

  describe('POST /friends/add-friend/:id', () => {
    it('should send a friend request successfully', async () => {
      const res = await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      const friendDoc = await Friend.findOne({ member: userB._id });
      expect(friendDoc).not.toBeNull();
      expect(friendDoc!.pendingFriendRequests.map((id: any) => id.toString())).toContain(
        userA._id.toString(),
      );
    });

    it('should return 409 if friend request already sent', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const res = await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(409);
    });

    it('should return 404 if recipient does not exist', async () => {
      const fakeId = '000000000000000000000001';

      const res = await getRequest()
        .post(`/friends/add-friend/${fakeId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().post(`/friends/add-friend/${userB._id}`);
      expect(res.status).toBe(401);
    });
  });

  // ==================== PUT /friends/:senderId (Manage Friend Request) ====================

  describe('PUT /friends/:senderId (Manage Friend Request)', () => {
    beforeEach(async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
    });

    it('should accept a friend request successfully', async () => {
      const res = await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/accepted/i);

      const userBFriendDoc = await Friend.findOne({ member: userB._id });
      const userAFriendDoc = await Friend.findOne({ member: userA._id });

      expect(userBFriendDoc!.friends.map((id: any) => id.toString())).toContain(
        userA._id.toString(),
      );
      expect(userAFriendDoc!.friends.map((id: any) => id.toString())).toContain(
        userB._id.toString(),
      );

      expect(userBFriendDoc!.pendingFriendRequests.map((id: any) => id.toString())).not.toContain(
        userA._id.toString(),
      );
    });

    it('should decline a friend request successfully', async () => {
      const res = await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'decline' });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/declined/i);

      const friendDoc = await Friend.findOne({ member: userB._id });
      expect(friendDoc!.pendingFriendRequests.map((id: any) => id.toString())).not.toContain(
        userA._id.toString(),
      );
      expect(friendDoc!.friends.map((id: any) => id.toString())).not.toContain(
        userA._id.toString(),
      );
    });

    it('should return 404 if no pending request exists', async () => {
      const res = await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(404);
    });

    it('should return 409 if already friends', async () => {
      // Accept first
      await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });

      // Send another request from A to B
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Try to accept again
      const res = await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });

      expect(res.status).toBe(409);
    });

    it('should return 422 if action is invalid', async () => {
      const res = await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'invalidaction' });

      expect(res.status).toBe(422);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().put(`/friends/${userA._id}`).send({ action: 'accept' });

      expect(res.status).toBe(401);
    });
  });

  // ==================== DELETE /friends/deleteFriend/:friendId ====================

  describe('DELETE /friends/deleteFriend/:friendId', () => {
    beforeEach(async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });
    });

    it('should remove a friend successfully', async () => {
      const res = await getRequest()
        .delete(`/friends/deleteFriend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);

      const userAFriendDoc = await Friend.findOne({ member: userA._id });
      const userBFriendDoc = await Friend.findOne({ member: userB._id });

      expect(userAFriendDoc!.friends.map((id: any) => id.toString())).not.toContain(
        userB._id.toString(),
      );
      expect(userBFriendDoc!.friends.map((id: any) => id.toString())).not.toContain(
        userA._id.toString(),
      );
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().delete(`/friends/deleteFriend/${userB._id}`);
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /friends/pending ====================

  describe('GET /friends/pending', () => {
    it('should return empty array if no pending requests', async () => {
      const res = await getRequest()
        .get('/friends/pending')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('should return pending requests after one is sent', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const res = await getRequest()
        .get('/friends/pending')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].username).toBe(userA.username);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/friends/pending');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /friends/all-friends ====================

  describe('GET /friends/all-friends', () => {
    it('should return empty array if user has no friends', async () => {
      const res = await getRequest()
        .get('/friends/all-friends')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return friends list after accepting a request', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });

      const res = await getRequest()
        .get('/friends/all-friends')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].username).toBe(userB.username);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/friends/all-friends');
      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /friends/status/:userId ====================

  describe('GET /friends/status/:userId', () => {
    it('should return status "none" for strangers', async () => {
      const res = await getRequest()
        .get(`/friends/status/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('none');
    });

    it('should return status "pending" with isSender true after sending request', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const res = await getRequest()
        .get(`/friends/status/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.isSender).toBe(true);
    });

    it('should return status "pending" with isSender false for recipient', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const res = await getRequest()
        .get(`/friends/status/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('pending');
      expect(res.body.isSender).toBe(false);
    });

    it('should return status "accepted" after becoming friends', async () => {
      await getRequest()
        .post(`/friends/add-friend/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      await getRequest()
        .put(`/friends/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'accept' });

      const res = await getRequest()
        .get(`/friends/status/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get(`/friends/status/${userB._id}`);
      expect(res.status).toBe(401);
    });
  });
});
