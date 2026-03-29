import { validationResult, matchedData } from 'express-validator';
import mongoose from 'mongoose';
import HttpError from '../models/http-error.js';
import { Member } from '../models/members.js';
import { Friend } from '../models/friends.js';
import { Notification } from '../models/notifications.js';
import { createNotification } from './notifications.js';

const addFriend = async (req, res, next) => {
  try {
    const result = validationResult(req);

    if (result.errors.length > 0) {
      throw new HttpError(JSON.stringify(result.errors), 422);
    }

    const data = matchedData(req);
    // const { sender, recipient } = data; // as IDs
    const sender = req.verifiedMember._id;
    const { id: recipient } = req.params;

    const senderMember = await Member.findById(sender);
    if (!sender) throw new HttpError('Sender is unknown', 404);
    const recipientMember = await Member.findById(recipient);
    if (!senderMember || !recipientMember) {
      throw new HttpError('Cannot find member by id', 404);
    }

    let recipientFriend = await Friend.findOne({ member: recipient });
    if (!recipientFriend) {
      recipientFriend = new Friend({ member: recipient });
      await recipientFriend.save();
    } else {
    }

    if (recipientFriend.pendingFriendRequests.some((id) => id.toString() === sender.toString())) {
      throw new HttpError('Friend request already sent', 409);
    }

    recipientFriend.pendingFriendRequests.push(sender);
    await recipientFriend.save();

    await createNotification({
      fromUser: sender,
      targetUser: recipient,
      message: `${senderMember.username} sent you a friend request`,
      type: 'friend_request',
    });

    res.json(recipientFriend);
  } catch (error) {
    console.error('addFriend error:', error);
    if (error instanceof HttpError) return next(error); // ← preserve original error
    return next(new HttpError(error.message || 'Server error', 500));
  }
};

const deleteFriend = async (req, res, next) => {
  try {
    const loggedInUser = req.verifiedMember._id;
    const { friendId } = req.params;

    if (loggedInUser === friendId) {
      throw new HttpError('You cannot remove yourself as a friend.', 400);
    }

    const updatedUserDocument = await Friend.findOneAndUpdate(
      { member: loggedInUser },
      { $pull: { friends: friendId } },
      { new: true, runValidators: true },
    );

    if (!updatedUserDocument) {
      throw new HttpError('Could not find friend list for the logged-in user.', 404);
    }

    const updatedFriendDocument = await Friend.findOneAndUpdate(
      { member: friendId },
      { $pull: { friends: loggedInUser } },
      { new: true, runValidators: true },
    );

    if (!updatedFriendDocument) {
      console.warn(`Friend list not found for user ${friendId}. Data may be inconsistent.`);
    }

    res.json({
      message: 'Friend removed successfully.',
      updatedUserDocument,
    });
  } catch (error) {
    console.error('Error in removeFriend controller:', error.message);
    return next(new HttpError(error.message || 'Failed to remove friend.', error.code || 500));
  }
};

const getPendingFriendRequests = async (req, res, next) => {
  try {
    if (!req.verifiedMember) throw new HttpError('Unauthorized', 401);

    const foundMember = await Member.findById(req.verifiedMember._id);
    if (!foundMember) {
      throw new HttpError('logged in member not found', 404);
    }

    const friendDoc = await Friend.findOne({
      member: req.verifiedMember._id,
    }).populate('pendingFriendRequests', 'username firstName');
    if (!friendDoc) {
      return res.json([]);
    }

    res.json(friendDoc.pendingFriendRequests);
  } catch (error) {
    return next(new HttpError(error, error.errorCode || 500));
  }
};

const getAllFriends = async (req, res, next) => {
  try {
    if (!req.verifiedMember) throw new HttpError('Unauthorized', 401);

    const loggedInMemberId = req.verifiedMember._id;

    const friendsWithLastMessage = await Friend.aggregate([
      // Stage 1: Match the current user's Friend document
      {
        $match: {
          member: loggedInMemberId,
        },
      },

      // Stage 2: Deconstruct the 'friends' array to process each friend individually
      {
        $unwind: '$friends',
      },

      // Stage 3: Look up the full Member details for each friend ID
      {
        $lookup: {
          from: 'members', // Name of the collection (usually plural: 'members')
          localField: 'friends',
          foreignField: '_id',
          as: 'friendDetails', // Output will be an array of 1 member object
        },
      },

      // Stage 4: Deconstruct the 'friendDetails' array to get a single object
      {
        $unwind: '$friendDetails',
      },

      // Stage 5: Look up the LAST message between the logged-in user and the current friend
      {
        $lookup: {
          from: 'messages',
          let: { friendId: '$friends' }, // Define a variable 'friendId'
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Sent by friend to me
                    {
                      $and: [
                        { $eq: ['$senderId', '$$friendId'] },
                        { $eq: ['$recipientId', loggedInMemberId] },
                      ],
                    },
                    // Sent by me to friend
                    {
                      $and: [
                        { $eq: ['$recipientId', '$$friendId'] },
                        { $eq: ['$senderId', loggedInMemberId] },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } }, // Newest message first
            { $limit: 1 }, // Take only the most recent one
            { $project: { text: 1, createdAt: 1, senderId: 1, _id: 0 } }, // Keep essential message fields
          ],
          as: 'lastMessageArray', // Output is an array of 0 or 1 message
        },
      },

      // Stage 6: Final Projection - format the output for the frontend
      {
        $project: {
          _id: '$friendDetails._id', // Rename fields for clean output
          username: '$friendDetails.username',
          firstName: '$friendDetails.firstName',
          lastName: '$friendDetails.lastName',
          photo: '$friendDetails.photo',
          // Extract the single message object from the array (will be null if empty)
          lastMessage: { $arrayElemAt: ['$lastMessageArray', 0] },
        },
      },
    ]);

    // Handle the case where the Friend document exists but the friends array is empty
    if (!friendsWithLastMessage.length) {
      const friendDoc = await Friend.findOne({ member: loggedInMemberId });
      if (friendDoc && friendDoc.friends.length === 0) {
        return res.json([]);
      }
    }

    // The final result is the array of enriched friend objects
    res.json(friendsWithLastMessage);
  } catch (error) {
    console.error('Error in getAllFriends aggregation:', error.message);
    return next(new HttpError(error.message, error.errorCode || 500));
  }
};

const getRelationshipStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.verifiedMember._id;

    // Find the current user's Friend document
    const currentUserFriendDoc = await Friend.findOne({
      member: currentUserId,
    });
    const targetUserFriendDoc = await Friend.findOne({ member: userId });

    // Check if the target user has sent a friend request to the current user
    const isPendingReceived = currentUserFriendDoc?.pendingFriendRequests.includes(userId);
    // Check if the current user has sent a friend request to the target user
    const isPendingSent = targetUserFriendDoc?.pendingFriendRequests.includes(currentUserId);
    // Check if they are friends
    const isFriend = currentUserFriendDoc?.friends.includes(userId);

    if (isFriend) {
      return res.json({ status: 'accepted', isSender: false });
    } else if (isPendingSent) {
      return res.json({ status: 'pending', isSender: true });
    } else if (isPendingReceived) {
      return res.json({ status: 'pending', isSender: false });
    } else {
      return res.json({ status: 'none', isSender: false });
    }
  } catch (error) {
    next(error);
  }
};

const manageFriendRequest = async (req, res, next) => {
  let session;
  try {
    const { senderId } = req.params;
    if (!req.verifiedMember) throw new HttpError('Unauthorized', 401);
    const result = validationResult(req);

    if (result.errors.length > 0) {
      throw new HttpError(JSON.stringify(result.errors), 422);
    }

    const data = matchedData(req);
    const { action } = data;

    const recipientMember = await Member.findById(req.verifiedMember._id);
    const senderMember = await Member.findById(senderId);

    if (!senderMember || !recipientMember) {
      throw new HttpError('Cannot find member by id', 404);
    }

    let recipientFriend = await Friend.findOne({
      member: req.verifiedMember._id,
    });
    if (!recipientFriend) {
      recipientFriend = new Friend({ member: req.verifiedMember._id });
      await recipientFriend.save();
    } else {
    }

    if (
      !recipientFriend.pendingFriendRequests.some((id) => id.toString() === senderId.toString())
    ) {
      throw new HttpError('Friend request not found!', 404);
    }

    // Check if already friends to prevent multiple accepts
    if (
      action === 'accept' &&
      recipientFriend.friends.some((id) => id.toString() === senderId.toString())
    ) {
      throw new HttpError('Already friends!', 409);
    }

    session = await mongoose.startSession();
    session.startTransaction();

    if (action === 'decline') {
      recipientFriend.pendingFriendRequests.pull(senderId);
      await recipientFriend.save({ session });
      await session.commitTransaction();
    } else if (action === 'accept') {
      recipientFriend.pendingFriendRequests.pull(senderId);
      recipientFriend.friends.push(senderId);
      await recipientFriend.save({ session });

      // Update sender's Friend document with recipientId
      let senderFriend = await Friend.findOne({ member: senderId }).session(session);
      if (!senderFriend) {
        senderFriend = new Friend({ member: senderId });
        await senderFriend.save({ session });
      }
      if (!senderFriend.friends.some((id) => id.toString() === req.verifiedMember._id.toString())) {
        senderFriend.friends.push(req.verifiedMember._id);
        await senderFriend.save({ session });
      }

      await session.commitTransaction();

      await createNotification({
        fromUser: req.verifiedMember._id,
        targetUser: senderId,
        message: `${recipientMember.username} accepted your friend request`,
        type: 'friend_accept',
      });
    } else {
      throw new HttpError('You must accept or decline', 422);
    }

    res.json({
      message: action === 'decline' ? 'Friend request declined' : 'Friend request accepted!',
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      await session.endSession();
    }
    next(new HttpError(error, error.errorCode || 500));
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export {
  addFriend,
  getPendingFriendRequests,
  manageFriendRequest,
  getAllFriends,
  deleteFriend,
  getRelationshipStatus,
};
