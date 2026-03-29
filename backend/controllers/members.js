import * as dotenv from 'dotenv';
import { validationResult, matchedData } from 'express-validator';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import { uploadImage, deleteFileInImageKit } from '../utils/imageKit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Member, Password, Resettoken } from '../models/members.js';
import { Friend } from '../models/friends.js';
import geoip from 'geoip-lite';

import HttpError from '../models/http-error.js';

import { handleValidationErrors } from '../common/index.js';

import { getHash, checkHash, getToken } from '../common/index.js';

///////////////////////////////////////////////////////////////////////////////////////

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.join(__dirname, '..', 'utils', 'email_templates');

dotenv.config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  auth: {
    user: process.env.USER,
    pass: process.env.PASS,
  },
});

//  5 Min
const RESETTOKEN_EXPIRATION_TIME = 1000 * 60 * 5;

const getLocationFromIP = (req) => {
  // try to get IP
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.ip;

  const cleanIP = ip.replace('::ffff:', '');

  // DEVELOPMENT: Hardcode Belgrade for localhost
  if (cleanIP === '127.0.0.1' || cleanIP === '::1' || !cleanIP) {
    return {
      city: 'Belgrade',
      country: 'Serbia',
      countryCode: 'RS',
      coordinates: {
        type: 'Point',
        coordinates: [20.4489, 44.7866],
      },
    };
  }

  const geo = geoip.lookup(cleanIP);

  if (geo) {
    return {
      city: geo.city || 'Unknown',
      country: geo.country || 'Unknown',
      countryCode: geo.country || 'XX',
      coordinates: {
        type: 'Point',
        coordinates: [geo.ll[1], geo.ll[0]], // [longitude, latitude]
      },
    };
  }

  // fallback if IP lookup fails
  return {
    city: 'Unknown',
    country: 'Unknown',
    countryCode: 'XX',
    coordinates: {
      type: 'Point',
      coordinates: [0, 0],
    },
  };
};

const signup = async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (result.errors.length > 0) {
      throw new HttpError(JSON.stringify(result.errors), 422);
    }

    const data = matchedData(req);

    const password = getHash(data.password);

    const location = getLocationFromIP(req);

    let newMember;

    const createdMember = new Member({
      ...data,
      location,
      photo: req.file
        ? {
            fileId: (await uploadImage(req.file.buffer, req.file.originalname)).fileId,
            url: (await uploadImage(req.file.buffer, req.file.originalname)).url,
          }
        : {},
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    newMember = await createdMember.save({ session });

    const createdPassword = new Password({
      password,
      member: newMember._id,
    });

    await createdPassword.save({ session });

    await session.commitTransaction();
    session.endSession();

    if (process.env.NODE_ENV !== 'test') {
      const link = process.env.FRONTEND_URL;

      const signupHtmlTemplate = path.join(templatesDir, 'signup.html');
      const signupTextTemplate = path.join(templatesDir, 'signup.txt');

      let signupHtml = fs.readFileSync(signupHtmlTemplate, 'utf-8');
      let signupText = fs.readFileSync(signupTextTemplate, 'utf-8');

      signupHtml = signupHtml.replace(
        '[FIRST_NAME] [LAST_NAME]',
        `${req.body.firstName} ${req.body.lastName}`,
      );
      signupText = signupText
        .replace('[FIRST_NAME]', req.body.lastName)
        .replace('[LAST_NAME]', req.body.firstName)
        .replace('[LINK]', link);

      await transporter.sendMail({
        from: 'noreply.env <noreply.envv@gmail.com>',
        to: `${req.body.email}`,
        subject: `Welcome, ${req.body.firstName}!`,
        text: signupText,
        html: signupHtml,
      });
    }

    res.status(201).json(newMember);
  } catch (error) {
    if (error.code === 11000) {
      const value = Object.keys(error.keyValue)[0];
      let message = '';
      if (value === 'username') {
        message = 'This username is already taken.';
      } else if (value === 'email') {
        message = 'This email is already registered.';
      }
      return next(new HttpError(message, 409));
    }

    return next(new HttpError(error.message || error, 422));
  }
};

const login = async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (result.errors.length > 0) {
      throw new HttpError(JSON.stringify(result.errors), 422);
    }

    const data = matchedData(req);

    const foundMember = await Member.findOne({
      $or: [{ username: data.username }, { email: data.username }],
    });

    if (!foundMember) {
      throw new HttpError('Cannot find member', 401);
    }

    const foundPassword = await Password.findOne({
      member: foundMember._id,
    });

    if (!foundPassword) {
      throw new HttpError('User data incomplete - contact support', 500);
    }

    if (!checkHash(data.password, foundPassword.password)) {
      throw new HttpError('Invalid Credentials', 401);
    }

    const token = getToken(foundMember._id);

    res.send(token);
  } catch (error) {
    if (error instanceof HttpError) {
      return next(error);
    }
    return next(new HttpError(error.message || 'Internal server error', error.errorCode || 500));
  }
};

const changePassword = async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (result.errors.length > 0) {
      throw new HttpError(JSON.stringify(result.errors), 422);
    }

    const data = matchedData(req);

    const foundMember = await Member.findById(req.verifiedMember._id);

    if (!foundMember) {
      throw new HttpError('Cannot change password', 401);
    }

    const foundPassword = await Password.findOne({
      member: foundMember._id,
    });

    if (!checkHash(data.oldPassword, foundPassword.password)) {
      throw new HttpError('Cannot change password', 401);
    }

    foundPassword.password = getHash(data.newPassword);
    await foundPassword.save();

    res.send('Password changed successfully');
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const deleteMember = async (req, res, next) => {
  try {
    if (!req.verifiedMember.isAdmin) {
      if (req.verifiedMember._id.toString() !== req.params.id) {
        throw new HttpError('Cant delete member', 403);
      }
    }

    const deletedMember = await Member.findOneAndDelete({ _id: req.params.id });

    if (!deletedMember) {
      throw new HttpError('Member was not found', 404);
    }

    res.send('Member was deleted successfully');
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const getAllMembers = async (req, res, next) => {
  try {
    const membersList = await Member.find({});

    res.json(membersList);
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const getOneMember = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member) {
      throw new HttpError('Cannot find member', 404);
    }

    res.json(member);
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const getMemberByUsername = async (req, res, next) => {
  try {
    const username = req.params.username;
    const member = await Member.findOne({ username });

    if (!member) {
      throw new HttpError('Cannot find member', 404);
    }

    res.json(member);
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};
const filterMember = async (req, res, next) => {
  const { q, type = 'all', limit } = req.query;
  const memberId = req.verifiedMember._id;

  try {
    if (!q) return res.json([]);

    const maxLimit = Math.min(parseInt(limit) || 10, 50);

    let matchQuery = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
      ],
      _id: { $ne: memberId }, // exclude self
    };

    if (type === 'friends') {
      const friendDoc = await Friend.findOne({ member: memberId }).lean();

      if (!friendDoc || !friendDoc.friends?.length) {
        return res.json([]);
      }

      matchQuery._id = { $in: friendDoc.friends };
    }

    const users = await Member.find(matchQuery)
      .select('username firstName lastName photo')
      .limit(maxLimit)
      .lean();

    res.json(users);
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const updateMember = async (req, res, next) => {
  try {
    if (!req.verifiedMember) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (req.verifiedMember._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { id } = req.params;

    const result = validationResult(req);
    if (!result.isEmpty()) {
      const errors = result.array();
      console.warn('Validation failed for updateMember:', errors);
      return res.status(422).json({ message: 'Validation failed', errors });
    }

    const data = matchedData(req, { locations: ['body'] });

    const foundMember = await Member.findById(id);
    if (!foundMember) {
      return res.status(404).json({ message: 'Member not found' });
    }

    Object.assign(foundMember, data);

    if (req.file) {
      try {
        let fileBuffer = null;
        let originalName = req.file.originalname || `upload-${Date.now()}`;

        if (req.file.buffer) {
          fileBuffer = req.file.buffer;
        } else if (req.file.path) {
          const filePath = req.file.path;
          fileBuffer = await fs.readFile(filePath);
        } else {
          throw new Error('Uploaded file missing buffer and path');
        }

        const uploadResponse = await uploadImage(fileBuffer, originalName);

        if (!uploadResponse || !uploadResponse.fileId || !uploadResponse.url) {
          throw new Error('Image upload returned unexpected response');
        }

        if (foundMember.photo && foundMember.photo.fileId) {
          try {
            await deleteFileInImageKit(foundMember.photo.fileId);
          } catch (delErr) {
            console.warn('Failed to delete old image in ImageKit', delErr);
          }
        }

        const photo = {
          fileId: uploadResponse.fileId,
          url: uploadResponse.url,
        };

        foundMember.photo = photo;
      } catch (fileErr) {
        console.error('File handling/upload error in updateMember:', fileErr);
        return res
          .status(500)
          .json({ message: 'Failed to process uploaded image', error: fileErr.message });
      }
    }

    const updatedMember = await foundMember.save();

    const safeMember = updatedMember.toObject();
    delete safeMember.password; // just in case
    res.json(safeMember);
  } catch (err) {
    console.error('Unexpected error in updateMember:', err);
    return res.status(err.statusCode || 500).json({ message: err.message || 'Server error' });
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const foundMember = await Member.findOne({ email });
    if (!foundMember) {
      throw new HttpError('Cannot find member', 404);
    }

    await Resettoken.deleteMany({ member: foundMember._id });

    const token = uuidv4();

    const newResettoken = new Resettoken({ token, member: foundMember._id });
    await newResettoken.save();

    const link = `${process.env.FRONTEND_URL}/set-new-password?t=${token}`;

    const ResetPasswordHtmlTemplate = path.join(templatesDir, 'reset-password.html');
    const ResetPasswordTextTemplate = path.join(templatesDir, 'reset-password.txt');

    let ResetPasswordHtml = fs.readFileSync(ResetPasswordHtmlTemplate, 'utf-8');
    let ResetPasswordText = fs.readFileSync(ResetPasswordTextTemplate, 'utf-8');

    ResetPasswordHtml = ResetPasswordHtml.replace(
      '[FIRST_NAME] [LAST_NAME]',
      `${foundMember.firstName} ${foundMember.lastName}`,
    ).replace('[LINK]', link);
    ResetPasswordText = ResetPasswordText.replace('[FIRST_NAME]', foundMember.lastName)
      .replace('[LAST_NAME]', foundMember.firstName)
      .replace('[LINK]', link);

    await transporter.sendMail({
      from: 'DevLink <noreply.envv@gmail.com>', // sender address
      to: `${foundMember.email}`, // list of receivers
      subject: 'Password Reset', // Subject line
      text: ResetPasswordText, // plain text body
      html: ResetPasswordHtml, // html body
    });

    res.send('Mail was sent successfully');
  } catch (error) {
    const status = error.errorCode || error.statusCode || 500;
    return res.status(status).json({ message: error.message || 'Internal Server Error' });
  }
};

const setNewPassword = async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (result.errors.length > 0) {
      const errors = result.array();
      throw handleValidationErrors(errors);
    }

    const { password } = matchedData(req);

    const token = req.query.t;

    if (!token || typeof token !== 'string' || token.length !== 36) {
      throw new HttpError('Invalid or missing reset token', 400);
    }
    const foundResettoken = await Resettoken.findOne({ token });

    if (!foundResettoken) {
      throw new HttpError('Cannot find reset information', 404);
    }

    const createdAt = new Date(foundResettoken.createdAt);
    const now = new Date();
    const diff = now - createdAt;

    if (diff > RESETTOKEN_EXPIRATION_TIME) {
      throw new HttpError('Expiration time has expired', 409);
    }

    const foundMember = await Member.findById(foundResettoken.member);

    if (!foundMember) {
      throw new HttpError('Cannot find member', 404);
    }

    const newPassword = getHash(password);

    await Password.findOneAndUpdate({ member: foundResettoken.member }, { password: newPassword });

    await Resettoken.deleteMany({ member: foundResettoken.member });

    res.send('New Password was set successfully');
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500, error.messageArray));
  }
};

export {
  signup,
  login,
  getAllMembers,
  getOneMember,
  getMemberByUsername,
  changePassword,
  deleteMember,
  updateMember,
  resetPassword,
  setNewPassword,
  filterMember,
};
