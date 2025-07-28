import { Aggregate, PipelineStage, Types } from "mongoose";
import Message, { MessageModel, MessageStatus } from "../model/Message";
import { createValidatedTimestamp, logTimeInfo } from "../../helpers/timeUtils";

// Aggregator for common chat message lookups
const chatMessageCommonAggregator = (): PipelineStage[] => [
  {
    $lookup: {
      from: "users",
      foreignField: "_id",
      localField: "sender",
      as: "sender",
      pipeline: [
        {
          $project: {
            username: 1,
            avatarUrl: 1,
            email: 1,
          },
        },
      ],
    },
  },
  {
    $lookup: {
      from: "users",
      foreignField: "_id",
      localField: "readBy",
      as: "readByUsers",
      pipeline: [
        {
          $project: {
            username: 1,
            avatarUrl: 1,
            email: 1,
          },
        },
      ],
    },
  },
  // Lookup file metadata for attachments
  {
    $lookup: {
      from: "filemetadatas",
      localField: "attachments.fileMetadataId",
      foreignField: "_id",
      as: "attachmentMetadata",
      pipeline: [
        {
          $project: {
            originalName: 1,
            fileName: 1,
            fileUrl: 1,
            mimeType: 1,
            fileSize: 1,
            fileExtension: 1,
            thumbnailUrl: 1,
            duration: 1,
            dimensions: 1,
            metadata: 1,
          },
        },
      ],
    },
  },
  {
    $addFields: {
      sender: { $first: "$sender" },
      isRead: { $gt: [{ $size: "$readBy" }, 0] },
      readCount: { $size: "$readBy" },
      // Enhanced attachments with file metadata
      attachments: {
        $map: {
          input: "$attachments",
          as: "attachment",
          in: {
            $let: {
              vars: {
                fileMetadata: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$attachmentMetadata",
                        cond: { $eq: ["$$this._id", "$$attachment.fileMetadataId"] }
                      }
                    },
                    0
                  ]
                }
              },
              in: {
                $mergeObjects: [
                  "$$attachment",
                  {
                    $cond: {
                      if: { $ne: ["$$fileMetadata", null] },
                      then: {
                        id: "$$fileMetadata._id",
                        originalName: "$$fileMetadata.originalName",
                        fileName: "$$fileMetadata.fileName",
                        mimeType: "$$fileMetadata.mimeType",
                        size: "$$fileMetadata.fileSize",
                        fileExtension: "$$fileMetadata.fileExtension",
                        thumbnailUrl: "$$fileMetadata.thumbnailUrl",
                        duration: "$$fileMetadata.duration",
                        dimensions: "$$fileMetadata.dimensions",
                        metadata: "$$fileMetadata.metadata",
                        type: "$$fileMetadata.mimeType"
                      },
                      else: {
                        // Fallback to attachment data if file metadata not found
                        id: "$$attachment.fileMetadataId",
                        originalName: "$$attachment.originalName",
                        fileName: "$$attachment.originalName",
                        mimeType: "$$attachment.type",
                        size: "$$attachment.size",
                        type: "$$attachment.type"
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    },
  },
];

// Find message by Id
function getMessageById(id: Types.ObjectId) {
  return MessageModel.findById(id);
}

// Get all messages of a particular chat
function getMessagesOfChatId(chatId: Types.ObjectId) {
  return MessageModel.find({ chat: chatId });
}

function deleteMessageById(id: Types.ObjectId) {
  return MessageModel.findByIdAndDelete(id);
}

function deleteAllMessagesOfChatId(chatId: Types.ObjectId) {
  return MessageModel.deleteMany({ chat: chatId });
}

// Get all messages aggregated
function getAllMessagesAggregated(chatId: Types.ObjectId): Aggregate<any> {
  return MessageModel.aggregate([
    { $match: { chat: chatId } },
    { $sort: { createdAt: 1 } },
    ...chatMessageCommonAggregator(),
  ]);
}

function getLastMessage(chatId: Types.ObjectId) {
  return MessageModel.findOne({ chat: chatId }).sort({ createdAt: -1 }).exec();
}

// Create a new message (attachments reference FileMetadata)
function createMessage(
  userId: Types.ObjectId,
  chatId: Types.ObjectId,
  content: string,
  attachments: { fileMetadataId: Types.ObjectId; url?: string; originalName?: string; type?: string; size?: number; localPath?: string }[]
) {
  logTimeInfo('createMessage');
  const timestamp = createValidatedTimestamp();
  const messageData: any = {
    sender: userId,
    content: content,
    chat: chatId,
    attachments: attachments, // Only fileMetadataId and url
    status: MessageStatus.PENDING,
    readBy: [],
    deliveredTo: [],
    retryCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return MessageModel.create(messageData);
}

// Structure the messages
function getStructuredMessages(messageId: Types.ObjectId) {
  return MessageModel.aggregate([
    { $match: { _id: messageId } },
    ...chatMessageCommonAggregator(),
  ]);
}

// Mark a message as read by a user
function markMessageAsRead(messageId: Types.ObjectId, userId: Types.ObjectId) {
  return MessageModel.findByIdAndUpdate(
    messageId,
    {
      $addToSet: { readBy: userId },
      $set: {
        readAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { new: true }
  );
}

// Mark a message as delivered to a user
function markMessageAsDelivered(messageId: Types.ObjectId, userId: Types.ObjectId) {
  return MessageModel.findByIdAndUpdate(
    messageId,
    {
      $addToSet: { deliveredTo: userId },
      $set: {
        deliveredAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { new: true }
  );
}

// Update message status
function updateMessageStatus(
  messageId: Types.ObjectId,
  updateData: Partial<Message>
) {
  return MessageModel.findByIdAndUpdate(
    messageId,
    { $set: updateData },
    { new: true }
  );
}

// Get messages by status
function getMessagesByStatus(chatId: Types.ObjectId, status: MessageStatus) {
  return MessageModel.find({ chat: chatId, status }).sort({ createdAt: -1 });
}

// Get failed messages for retry
function getFailedMessages(userId: Types.ObjectId) {
  return MessageModel.find({
    sender: userId,
    status: MessageStatus.FAILED,
  }).sort({ createdAt: -1 });
}

// Increment retry count
function incrementRetryCount(messageId: Types.ObjectId) {
  return MessageModel.findByIdAndUpdate(
    messageId,
    {
      $inc: { retryCount: 1 },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  );
}

// Mark all messages in a chat as read by a user
function markAllMessagesAsRead(chatId: Types.ObjectId, userId: Types.ObjectId) {
  return MessageModel.updateMany(
    {
      chat: chatId,
      sender: { $ne: userId },
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    }
  );
}

// Get unread messages count for a user in a specific chat
async function getUnreadMessagesCount(chatId: Types.ObjectId, userId: Types.ObjectId): Promise<number> {
  const count = await MessageModel.countDocuments({
    chat: chatId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });
  return count;
}

// Get all unread messages for a user across all chats
function getAllUnreadMessages(userId: Types.ObjectId): Aggregate<any> {
  return MessageModel.aggregate([
    {
      $match: {
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
    },
    {
      $lookup: {
        from: "chats",
        localField: "chat",
        foreignField: "_id",
        as: "chatInfo",
      },
    },
    {
      $match: {
        "chatInfo.participants": userId,
      },
    },
    ...chatMessageCommonAggregator(),
    {
      $group: {
        _id: "$chat",
        unreadCount: { $sum: 1 },
        lastMessage: { $last: "$$ROOT" },
      },
    },
  ]);
}

const messageRepo = {
  getAllMessagesAggregated,
  createMessage,
  getStructuredMessages,
  getMessageById,
  getMessagesOfChatId,
  deleteMessageById,
  deleteAllMessagesOfChatId,
  getLastMessage,
  markMessageAsRead,
  markMessageAsDelivered,
  updateMessageStatus,
  getMessagesByStatus,
  getFailedMessages,
  incrementRetryCount,
  markAllMessagesAsRead,
  getUnreadMessagesCount,
  getAllUnreadMessages,
};

export default messageRepo;