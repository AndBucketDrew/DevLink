// __tests__/integration/members.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRequest, createAuthenticatedUser, createTestUser } from '../test-utils';
import { Member, Password, Resettoken } from '../../models/members.js';
import { getHash } from '../../common/index.js';
import jwt from 'jsonwebtoken';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-id' }),
    }),
  },
}));

describe('Members Integration Tests', () => {
  let testUser: any;
  let validToken: string;

  beforeEach(async () => {
    const { user, token } = await createAuthenticatedUser();
    testUser = user;
    validToken = token;
  });

  // ==================== POST /members/signup ====================

  describe('POST /members/signup', () => {
    it('should successfully create a new user', async () => {
      const newUser = {
        firstName: 'Alice',
        lastName: 'Wonderland',
        username: `alice_${Date.now()}`,
        email: `alice${Date.now()}@example.com`,
        password: 'strongpass123',
        confirmPassword: 'strongpass123',
      };

      const res = await getRequest().post('/members/signup').send(newUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.username).toBe(newUser.username);
      expect(res.body.email).toBe(newUser.email.toLowerCase());
    });

    it('should create a corresponding Password document on signup', async () => {
      const newUser = {
        firstName: 'Alice',
        lastName: 'Wonderland',
        username: `alice_${Date.now()}`,
        email: `alice${Date.now()}@example.com`,
        password: 'strongpass123',
        confirmPassword: 'strongpass123',
      };

      const res = await getRequest().post('/members/signup').send(newUser);
      expect(res.status).toBe(201);

      const passwordDoc = await Password.findOne({ member: res.body._id });
      expect(passwordDoc).not.toBeNull();
      expect(passwordDoc!.password).not.toBe('strongpass123'); // should be hashed
    });

    it('should return 409 on duplicate username', async () => {
      const duplicateUser = {
        firstName: 'Bob',
        lastName: 'Builder',
        username: testUser.username,
        email: `unique_${Date.now()}@example.com`,
        password: 'password123',
        confirmPassword: 'password123',
      };

      const res = await getRequest().post('/members/signup').send(duplicateUser);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already taken/i);
    });

    it('should return 409 on duplicate email', async () => {
      const duplicateUser = {
        firstName: 'Bob',
        lastName: 'Builder',
        username: `unique_${Date.now()}`,
        email: testUser.email,
        password: 'password123',
        confirmPassword: 'password123',
      };

      const res = await getRequest().post('/members/signup').send(duplicateUser);

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it('should return 422 if firstName is too short', async () => {
      const res = await getRequest()
        .post('/members/signup')
        .send({
          firstName: 'A',
          lastName: 'Valid',
          username: `user_${Date.now()}`,
          email: `test${Date.now()}@example.com`,
          password: 'password123',
          confirmPassword: 'password123',
        });
      expect(res.status).toBe(422);
    });

    it('should return 422 if username is too short', async () => {
      const res = await getRequest()
        .post('/members/signup')
        .send({
          firstName: 'Valid',
          lastName: 'User',
          username: 'ab',
          email: `test${Date.now()}@example.com`,
          password: 'password123',
          confirmPassword: 'password123',
        });
      expect(res.status).toBe(422);
    });

    it('should return 422 if email is invalid', async () => {
      const res = await getRequest()
        .post('/members/signup')
        .send({
          firstName: 'Valid',
          lastName: 'User',
          username: `user_${Date.now()}`,
          email: 'not-an-email',
          password: 'password123',
          confirmPassword: 'password123',
        });
      expect(res.status).toBe(422);
    });

    it('should return 422 if password is too short', async () => {
      const res = await getRequest()
        .post('/members/signup')
        .send({
          firstName: 'Valid',
          lastName: 'User',
          username: `user_${Date.now()}`,
          email: `test${Date.now()}@example.com`,
          password: '123',
          confirmPassword: '123',
        });
      expect(res.status).toBe(422);
    });

    it('should store email in lowercase', async () => {
      const email = `UPPERCASE_${Date.now()}@EXAMPLE.COM`;
      const res = await getRequest()
        .post('/members/signup')
        .send({
          firstName: 'Valid',
          lastName: 'User',
          username: `user_${Date.now()}`,
          email,
          password: 'password123',
          confirmPassword: 'password123',
        });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email.toLowerCase());
    });
  });

  // ==================== POST /members/login ====================

  describe('POST /members/login', () => {
    it('should login successfully and return JWT token', async () => {
      const res = await getRequest().post('/members/login').send({
        username: testUser.username,
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(typeof res.text).toBe('string');
      expect(res.text.length).toBeGreaterThan(30);
    });

    it('should login with email instead of username', async () => {
      const res = await getRequest().post('/members/login').send({
        username: testUser.email, // controller checks email OR username
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.text.length).toBeGreaterThan(30);
    });

    it('should return 401 with wrong password', async () => {
      const res = await getRequest().post('/members/login').send({
        username: testUser.username,
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
    });

    it('should return 401 with non-existent username', async () => {
      const res = await getRequest().post('/members/login').send({
        username: 'nonexistentuser999',
        password: 'password123',
      });
      expect(res.status).toBe(401);
    });

    it('should return 422 if username is missing', async () => {
      const res = await getRequest().post('/members/login').send({
        password: 'password123',
      });
      expect(res.status).toBe(422);
    });

    it('should return 422 if password is missing', async () => {
      const res = await getRequest().post('/members/login').send({
        username: testUser.username,
      });
      expect(res.status).toBe(422);
    });

    it('returned token should be a valid JWT', async () => {
      const res = await getRequest().post('/members/login').send({
        username: testUser.username,
        password: 'password123',
      });

      expect(res.status).toBe(200);
      const decoded = jwt.verify(res.text, process.env.JWT_KEY!) as any;
      expect(decoded).toHaveProperty('id');
    });
  });

  // ==================== GET /members/:id ====================

  describe('GET /members/:id (Protected)', () => {
    it('should return member details with valid token', async () => {
      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(testUser._id.toString());
      expect(res.body.username).toBe(testUser.username);
    });

    it('should not expose password field', async () => {
      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent member id', async () => {
      const fakeId = '000000000000000000000001';
      const res = await getRequest()
        .get(`/members/${fakeId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 401 without Authorization header', async () => {
      const res = await getRequest().get(`/members/${testUser._id}`);
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });

  // ==================== GET /members/username/:username ====================

  describe('GET /members/username/:username (Public)', () => {
    it('should return user by username', async () => {
      const res = await getRequest().get(`/members/username/${testUser.username}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe(testUser.username);
      expect(res.body.firstName).toBe(testUser.firstName);
    });

    it('should not expose password in public route', async () => {
      const res = await getRequest().get(`/members/username/${testUser.username}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 404 for non-existent username', async () => {
      const res = await getRequest().get('/members/username/nonexistentuser999');
      expect(res.status).toBe(404);
    });

    it('should be accessible without authentication', async () => {
      const res = await getRequest().get(`/members/username/${testUser.username}`);
      expect(res.status).toBe(200);
    });
  });

  // ==================== PATCH /members/:id ====================

  describe('PATCH /members/:id (Update Profile)', () => {
    it('should allow authenticated user to update their firstName', async () => {
      const res = await getRequest()
        .patch(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'UpdatedName', lastName: 'UpdatedLast' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('UpdatedName');
      expect(res.body.lastName).toBe('UpdatedLast');
    });

    it('should persist the update in the database', async () => {
      await getRequest()
        .patch(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'Persisted', lastName: 'Name' });

      const member = await Member.findById(testUser._id);
      expect(member!.firstName).toBe('Persisted');
    });

    it('should return 403 if user tries to update another user', async () => {
      const otherUser = await createTestUser({ username: `other_${Date.now()}` });

      const res = await getRequest()
        .patch(`/members/${otherUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should return 422 if firstName is too short', async () => {
      const res = await getRequest()
        .patch(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'A', lastName: 'Valid' });

      expect(res.status).toBe(422);
    });

    it('should not expose password in update response', async () => {
      const res = await getRequest()
        .patch(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ firstName: 'Alice', lastName: 'Smith' });

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  // ==================== DELETE /members/:id ====================

  describe('DELETE /members/:id', () => {
    it('should allow user to delete their own account', async () => {
      const { user, token } = await createAuthenticatedUser();

      const res = await getRequest()
        .delete(`/members/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const deleted = await Member.findById(user._id);
      expect(deleted).toBeNull();
    });

    it('should also delete the Password document on member deletion', async () => {
      const { user, token } = await createAuthenticatedUser();

      await getRequest().delete(`/members/${user._id}`).set('Authorization', `Bearer ${token}`);

      const passwordDoc = await Password.findOne({ member: user._id });
      expect(passwordDoc).toBeNull();
    });

    it('should return 403 if user tries to delete another user', async () => {
      const otherUser = await createTestUser({ username: `other_${Date.now()}` });

      const res = await getRequest()
        .delete(`/members/${otherUser._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().delete(`/members/${testUser._id}`);
      expect(res.status).toBe(401);
    });
  });

  // ==================== POST /members/reset-password ====================

  describe('POST /members/reset-password', () => {
    it('should send reset password email', async () => {
      const res = await getRequest()
        .post('/members/reset-password')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.text).toContain('Mail was sent successfully');
    });

    it('should create a Resettoken document', async () => {
      await getRequest().post('/members/reset-password').send({ email: testUser.email });

      const tokenDoc = await Resettoken.findOne({ member: testUser._id });
      expect(tokenDoc).not.toBeNull();
    });

    it('should replace existing Resettoken on second request', async () => {
      await getRequest().post('/members/reset-password').send({ email: testUser.email });

      await getRequest().post('/members/reset-password').send({ email: testUser.email });

      const tokens = await Resettoken.find({ member: testUser._id });
      expect(tokens).toHaveLength(1);
    });

    it('should return 404 for non-existent email', async () => {
      const res = await getRequest()
        .post('/members/reset-password')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(404);
    });
  });

  // ==================== GET /members (All Members) ====================

  describe('GET /members (Get All Members)', () => {
    it('should return all members', async () => {
      await createTestUser({ username: `extra1_${Date.now()}` });
      await createTestUser({ username: `extra2_${Date.now()}` });

      const res = await getRequest().get('/members').set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ==================== GET /members/search ====================

  describe('GET /members/search (Filter Members)', () => {
    it('should return members matching username query', async () => {
      const uniqueName = `searchable_${Date.now()}`;
      await createTestUser({ username: uniqueName });

      const res = await getRequest()
        .get(`/members/search?q=${uniqueName}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((m: any) => m.username === uniqueName)).toBe(true);
    });

    it('should return members matching firstName query', async () => {
      const uniqueFirst = `Zephyr_${Date.now()}`;
      await createTestUser({
        username: `user_${Date.now()}`,
        firstName: uniqueFirst,
      });

      const res = await getRequest()
        .get(`/members/search?q=${uniqueFirst}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((m: any) => m.firstName === uniqueFirst)).toBe(true);
    });

    it('should return empty array when no match', async () => {
      const res = await getRequest()
        .get('/members/search?q=zzznomatchzzz')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return empty array when q is missing', async () => {
      const res = await getRequest()
        .get('/members/search')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should not include the searching user in results', async () => {
      const res = await getRequest()
        .get(`/members/search?q=${testUser.username}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.some((m: any) => m._id === testUser._id.toString())).toBe(false);
    });

    it('should respect the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestUser({ username: `limittest_${Date.now()}_${i}` });
      }

      const res = await getRequest()
        .get('/members/search?q=limittest&limit=2')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(2);
    });

    it('should return 401 if not authenticated', async () => {
      const res = await getRequest().get('/members/search?q=test');
      expect(res.status).toBe(401);
    });
  });

  // ==================== Authentication Edge Cases ====================

  describe('Authentication Edge Cases', () => {
    it('should reject expired token', async () => {
      const expiredToken = jwt.sign({ id: testUser._id }, process.env.JWT_KEY!, {
        expiresIn: '0s',
      });

      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject malformed token', async () => {
      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', 'Bearer malformed.token');

      expect(res.status).toBe(401);
    });

    it('should reject token signed with wrong secret', async () => {
      const wrongToken = jwt.sign({ id: testUser._id }, 'wrong-secret');

      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${wrongToken}`);

      expect(res.status).toBe(401);
    });

    it('should reject token for deleted user', async () => {
      const { user, token } = await createAuthenticatedUser();
      await Member.findByIdAndDelete(user._id);

      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
    });

    it('should reject request with no Bearer prefix', async () => {
      const res = await getRequest()
        .get(`/members/${testUser._id}`)
        .set('Authorization', validToken); // missing "Bearer "

      expect(res.status).toBe(401);
    });
  });
});
