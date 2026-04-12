import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { scheduleNews } from './common/middlewares.js';

import HttpError from './models/http-error.js';

import router from './routes/router.js';

import { errorHandler } from './common/index.js';
import { app, server } from './common/socket.js';

const PORT = process.env.PORT || 8000;
const CONNECTION_STRING = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@lh-remake.johjfoh.mongodb.net/`;

const corsOptions = {
  // Allow your local machine AND your production frontend
  origin: ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
};

app.use(cors(corsOptions));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
    },
  }),
);

app.use(express.json());
scheduleNews();

app.use(express.urlencoded({ extended: true }));

app.use(express.static('www'));
app.use('/axios', express.static('node_modules/axios/dist'));

app.use('/', router);

app.use((req) => {
  throw new HttpError('Could not found route: ' + req.originalUrl, 404);
});

app.use(errorHandler);

app.use((error, req, res, next) => {
  if (res.headerSent) {
    return next(error);
  }
  const { errorCode, message } = error;
  res.status(errorCode).json({ message });
});

mongoose
  .connect(CONNECTION_STRING)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.log('MongoDB connection not possible', error);
  });
