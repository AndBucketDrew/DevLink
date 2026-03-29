// __tests__/integration/recommendations.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRequest, createAuthenticatedUser } from '../test-utils';
import { Member } from '../../models/members.js';
import { Friend } from '../../models/friends.js';

vi.mock('../../controllers/notifications.js', () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../common/socket.js', () => ({
  getRecieverSocketId: vi.fn().mockReturnValue(null),
}));

// ==================== Helpers ====================

const getRecommended = (token: string) =>
  getRequest().get('/location/recommended').set('Authorization', `Bearer ${token}`);

const updateLocation = (token: string, body: object) =>
  getRequest().patch('/location/update').set('Authorization', `Bearer ${token}`).send(body);

const makeLocation = (lat: number, lng: number, city = 'TestCity', country = 'TestCountry') => ({
  latitude: lat,
  longitude: lng,
  city,
  country,
  countryCode: 'TC',
});

describe('Recommendations Integration Tests', () => {
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

  // ==================== PATCH /location/update ====================

  describe('PATCH /location/update (Update Location)', () => {
    it('should update location successfully', async () => {
      const res = await updateLocation(tokenA, makeLocation(48.8566, 2.3522, 'Paris', 'France'));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Location updated successfully');
      expect(res.body.location).toHaveProperty('city', 'Paris');
      expect(res.body.location).toHaveProperty('country', 'France');
      expect(res.body.location.coordinates.coordinates).toEqual([2.3522, 48.8566]);
    });

    it('should persist location in database', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522, 'Paris', 'France'));

      const member = await Member.findById(userA._id);
      expect(member!.location!.city).toBe('Paris');
      expect(member!.location!.coordinates.coordinates).toEqual([2.3522, 48.8566]);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().patch('/location/update').send(makeLocation(48.8566, 2.3522));

      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /location/recommended ====================

  describe('GET /location/recommended (Get Recommendations)', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/location/recommended');
      expect(res.status).toBe(401);
    });

    it('should return an array', async () => {
      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should not include the current user in recommendations', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((u: any) => u._id.toString());
      expect(ids).not.toContain(userA._id.toString());
    });

    it('should not include existing friends in recommendations', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      await Friend.create({
        member: userA._id,
        friends: [userB._id],
        pendingFriendRequests: [],
      });

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((u: any) => u._id.toString());
      expect(ids).not.toContain(userB._id.toString());
    });

    it('should not include users with pending received requests in recommendations', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      // userB sent a request to userA
      await Friend.create({
        member: userA._id,
        friends: [],
        pendingFriendRequests: [userB._id],
      });

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((u: any) => u._id.toString());
      expect(ids).not.toContain(userB._id.toString());
    });

    it('should not include users with pending sent requests in recommendations', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      // userA sent a request to userB
      await Friend.create({
        member: userB._id,
        friends: [],
        pendingFriendRequests: [userA._id],
      });

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((u: any) => u._id.toString());
      expect(ids).not.toContain(userB._id.toString());
    });

    it('should return max 20 users', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));

      // Create users sequentially to avoid duplicate key collisions on username
      for (let i = 0; i < 25; i++) {
        const { token } = await createAuthenticatedUser();
        await updateLocation(token, makeLocation(48.856 + i * 0.001, 2.352 + i * 0.001));
      }

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(20);
    });

    it('should return correctly shaped user objects', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522));
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const user = res.body[0];
        expect(user).toHaveProperty('_id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('location');
        expect(user.location).toHaveProperty('city');
        expect(user.location).toHaveProperty('country');
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('email');
      }
    });

    it('should return nearby users when current user has location', async () => {
      await updateLocation(tokenA, makeLocation(48.8566, 2.3522, 'Paris', 'France'));
      await updateLocation(tokenB, makeLocation(48.86, 2.355, 'Paris', 'France'));

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = res.body.map((u: any) => u._id.toString());
      expect(ids).toContain(userB._id.toString());
    });

    it('should still return users when current user has no location set', async () => {
      // userA has no location, userB does
      await updateLocation(tokenB, makeLocation(48.86, 2.355));

      const res = await getRecommended(tokenA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
