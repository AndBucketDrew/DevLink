import { vi } from 'vitest';
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test' }),
    }),
  },
}));
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import router from '../routes/router.js';
import { errorHandler } from '../common/index.js';

dotenv.config({ path: '.env' });

let testApp: express.Application | undefined;
let mongoServer: MongoMemoryReplSet;

beforeAll(async () => {
  if (!process.env.JWT_KEY) throw new Error('JWT_KEY missing from .env');
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 }, // single-node replica set
  });
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri);
  console.log('Connected to in-memory MongoDB for tests');

  // Create fresh Express app for testing
  testApp = express();

  testApp = express();
  testApp.use(express.json());
  testApp.use(express.urlencoded({ extended: true }));
  testApp.use('/', router);
  testApp.use(errorHandler);

  console.log('Test Express app initialized with routes');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('Test environment cleaned up');
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

export const getApp = () => {
  if (!testApp) throw new Error('App not initialized — did beforeAll run?');
  return testApp;
};

// Export the test app
export { testApp as app };
