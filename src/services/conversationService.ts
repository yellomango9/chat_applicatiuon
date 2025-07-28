import { Types } from "mongoose";
import { ChatModel } from "../database/model/Chat";
import { MessageModel } from "../database/model/Message";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../constants";
import { ProtectedRequest } from "../types/app-request";

export class ConversationService {
  /**
   * Update conversation metadata when a new message is sent
   */
  static async updateConversationOnNewMessage(
    req: ProtectedRequest,
    chatId: Types.ObjectId,
    messageId: Types.ObjectId,
    messageText: string,
    senderId: Types.ObjectId,
    attachments: any[] = []
  ): Promise<void> {
    try {
      // Get the actual message to use its timestamp
      const message = await MessageModel.findById(messageId);
      if (!message) {
        console.error('Message not found for conversation update:', messageId);
        return;
      }

      // Determine message type
      const messageType = ConversationService.getMessageType(messageText, attachments);
      
      // Get the preview text
      const previewText = ConversationService.getPreviewText(messageText, attachments, messageType);

      // Update the conversation with last message info using the actual message timestamp
      // Use the same timestamp for both lastMessageTimestamp and updatedAt to ensure consistency
      const updateTimestamp = message.createdAt;
      await ChatModel.findByIdAndUpdate(
        chatId,
        {
          lastMessage: messageId,
          lastMessageText: previewText,
          lastMessageTimestamp: updateTimestamp, // Use actual message timestamp
          lastMessageSender: senderId,
          lastMessageType: messageType,
          updatedAt: updateTimestamp, // Use same timestamp for consistency
        },
        { new: true }
      );

      // Increment unread count for other participants
      const chat = await ChatModel.findById(chatId);
      if (chat) {
        const unreadCount = chat.unreadCount || new Map();
        
        // Reset sender's unread count and increment for others
        chat.participants.forEach((participantId) => {
          const participantIdStr = participantId.toString();
          if (participantIdStr === senderId.toString()) {
            unreadCount.set(participantIdStr, 0);
          } else {
            const currentCount = unreadCount.get(participantIdStr) || 0;
            unreadCount.set(participantIdStr, currentCount + 1);
          }
        });

        await ChatModel.findByIdAndUpdate(chatId, { unreadCount });

        // Emit conversation update event to all participants (excluding sender)
        chat.participants.forEach((participantId) => {
          // Skip the message sender to avoid unnecessary updates
          if (participantId.toString() === senderId.toString()) {
            return;
          }
          
          emitSocketEvent(
            req,
            participantId.toString(),
            ChatEventEnum.CONVERSATION_UPDATED,
            {
              chatId: chatId.toString(),
              lastMessage: {
                id: messageId.toString(),
                text: previewText,
                timestamp: updateTimestamp, // Use consistent timestamp
                sender: senderId.toString(),
                type: messageType,
              },
              unreadCount: unreadCount.get(participantId.toString()) || 0,
            }
          );
        });
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  }

  /**
   * Mark conversation as read for a specific user
   */
  static async markConversationAsRead(
    req: ProtectedRequest,
    chatId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<void> {
    try {
      const chat = await ChatModel.findById(chatId);
      if (!chat) return;

      const unreadCount = chat.unreadCount || new Map();
      const userIdStr = userId.toString();
      
      if (unreadCount.get(userIdStr) > 0) {
        unreadCount.set(userIdStr, 0);
        await ChatModel.findByIdAndUpdate(chatId, { unreadCount });

        // Emit read status to all participants
        chat.participants.forEach((participantId) => {
          emitSocketEvent(
            req,
            participantId.toString(),
            ChatEventEnum.CONVERSATION_READ,
            {
              chatId: chatId.toString(),
              userId: userIdStr,
            }
          );
        });
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
    }
  }

  /**
   * Get all conversations for a user, sorted by last message timestamp
   */
  static async getUserConversations(userId: Types.ObjectId): Promise<any[]> {
    try {
      const conversations = await ChatModel.aggregate([
        {
          $match: {
            participants: { $elemMatch: { $eq: userId } },
          },
        },
        {
          $lookup: {
            from: "users",
            foreignField: "_id",
            localField: "participants",
            as: "participants",
            pipeline: [
              {
                $project: {
                  password: 0,
                  createdAt: 0,
                  updatedAt: 0,
                  roles: 0,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            foreignField: "_id",
            localField: "lastMessageSender",
            as: "lastMessageSender",
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
          $addFields: {
            lastMessageSender: { $first: "$lastMessageSender" },
            // Add user-specific unread count using $objectToArray and $filter
            unreadCount: {
              $let: {
                vars: {
                  userIdStr: { $toString: userId },
                  unreadArray: { $objectToArray: { $ifNull: ["$unreadCount", {}] } }
                },
                in: {
                  $ifNull: [
                    {
                      $arrayElemAt: [
                        {
                          $map: {
                            input: {
                              $filter: {
                                input: "$$unreadArray",
                                cond: { $eq: ["$$this.k", "$$userIdStr"] }
                              }
                            },
                            as: "item",
                            in: "$$item.v"
                          }
                        },
                        0
                      ]
                    },
                    0
                  ]
                }
              }
            },
          },
        },
        {
          $sort: {
            lastMessageTimestamp: -1, // Sort by last message timestamp only
            _id: -1, // Use ObjectId as tiebreaker for consistent ordering
          },
        },
      ]);

      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  /**
   * Determine message type based on content and attachments
   */
  private static getMessageType(messageText: string, attachments: any[]): string {
    if (attachments && attachments.length > 0) {
      const attachment = attachments[0];
      if (attachment.type) {
        const mainType = attachment.type.split('/')[0];
        switch (mainType) {
          case 'image':
            return 'image';
          case 'video':
            return 'video';
          case 'audio':
            return 'audio';
          case 'application':
            return 'document';
          default:
            return 'other';
        }
      }
    }
    return 'text';
  }

  /**
   * Get preview text for the conversation list
   */
  private static getPreviewText(messageText: string, attachments: any[], messageType: string): string {
    if (messageText && messageText.trim()) {
      // Truncate long messages
      return messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText;
    }

    // Generate preview for attachment types
    switch (messageType) {
      case 'image':
        return '📷 Image';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'document':
        return '📄 Document';
      default:
        return '📎 Attachment';
    }
  }
}

export default ConversationService;