import { Router } from 'express';
import { body } from 'express-validator';
import {
  signup,
  login,
  getAllMembers,
  getOneMember,
  changePassword,
  deleteMember,
  updateMember,
  resetPassword,
  setNewPassword,
  getMemberByUsername,
  filterMember,
} from '../controllers/members.js';
import { upload, checkToken } from '../common/middlewares.js';
import { news } from '../controllers/news.js';

const router = Router();
router.get('/search', checkToken, filterMember);
router.get('/news', news);

// Public routes
router.post(
  '/signup',
  upload.none(),
  body('firstName').trim().isLength({ min: 2, max: 50 }),
  body('lastName').trim().isLength({ min: 2, max: 50 }),
  body('username').trim().isLength({ min: 4, max: 50 }),
  body('email').isEmail().toLowerCase().normalizeEmail({ gmail_remove_dots: false }),
  body('password').isLength({ min: 6, max: 50 }),
  body('confirmPassword').isLength({ min: 6, max: 50 }),
  signup,
);

router.post(
  '/login',
  body('username').escape().notEmpty().withMessage('Username or email is required'),
  body('password').escape().notEmpty().withMessage('Password is required'),
  login,
);

router.post('/reset-password', resetPassword);

router.post(
  '/set-new-password',
  body('password').escape().isLength({ min: 6, max: 50 }),
  setNewPassword,
);

router.get('/', getAllMembers);
router.get('/username/:username', getMemberByUsername);
router.get('/:id', checkToken, getOneMember);

// Protected routes

router.patch(
  '/change-password',
  checkToken,
  body('oldPassword').escape().isLength({ min: 6, max: 50 }),
  body('newPassword').escape().isLength({ min: 6, max: 50 }),
  body('confirmPassword').escape().isLength({ min: 6, max: 50 }),
  changePassword,
);

router.patch(
  '/:id',
  checkToken,
  upload.single('photo'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).optional(),
  body('lastName').trim().isLength({ min: 2, max: 50 }).optional(),
  body('username').trim().isLength({ min: 2, max: 50 }).optional(),
  body('email').trim().isLength({ min: 2, max: 50 }).optional(),
  updateMember,
);

router.delete('/:id', checkToken, deleteMember);

export default router;
