// backend/__tests__/test-utils.ts
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { getApp } from './setup.js';
import { getHash } from '../common/index.js';

import { Member, Password } from '../models/members.js';

export const getRequest = () => supertest(getApp()); // ← lazy getter

export const generateTestToken = (userId: string): string => {
  const secret = process.env.JWT_KEY;
  if (!secret) {
    throw new Error('JWT_KEY is not defined in .env file. Please add it.');
  }
  return jwt.sign({ id: userId }, secret, { expiresIn: '1h' });
};

export const createTestUser = async (overrides: any = {}) => {
  const defaultData = {
    username: `testuser_${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };

  const user = new Member(defaultData);
  await user.save();

  // Create the associated Password document
  const passwordDoc = new Password({
    password: getHash('password123'),
    member: user._id,
  });
  await passwordDoc.save();

  return user;
};

export const createAuthenticatedUser = async () => {
  const user = await createTestUser();
  const token = generateTestToken(user._id.toString());
  return { user, token };
};
