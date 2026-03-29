import { Router } from 'express';
import { body, check } from 'express-validator';
import {
  addFriend,
  deleteFriend,
  getAllFriends,
  getPendingFriendRequests,
  getRelationshipStatus,
  manageFriendRequest,
} from '../controllers/friends.js';
import { getFriendsPosts } from '../controllers/posts.js';
import { checkToken } from '../common/middlewares.js';

const router = Router();

router.post('/add-friend/:id', checkToken, addFriend);

router.get(
  '/pending',
  checkToken,
  body('recipient').escape().isLength({ min: 20, max: 30 }),
  getPendingFriendRequests,
);

router.get('/all-friends', checkToken, getAllFriends);
router.get('/friendsPosts', checkToken, getFriendsPosts);
router.get('/status/:userId', checkToken, getRelationshipStatus);

router.put(
  '/:senderId',
  checkToken,
  check('senderId').isMongoId(),
  check('action').isIn(['accept', 'decline']),
  manageFriendRequest,
);

router.delete('/deleteFriend/:friendId', checkToken, deleteFriend);

export default router;
