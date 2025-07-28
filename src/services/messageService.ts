import { Types } from "mongoose";
import messageRepo from "../database/repositories/messageRepo";
import chatRepo from "../database/repositories/chatRepo";
import { ChatEventEnum } from "../constants";
import { Request } from "express";
import { emitSocketEvent } from "../socket";
import { createValidatedTimestamp, logTimeInfo } from "../helpers/timeUtils";

/**
 * Enhanced message service to handle read receipts and timestamps properly
 */
class MessageService {
  /**
   * Mark a message as read and emit socket events
   */
  async markMessageAsRead(messageId: Types.ObjectId, userId: Types.ObjectId, req: Request) {
    try {
      logTimeInfo('markMessageAsRead');
      
      // Update the message
      const updatedMessage = await messageRepo.markMessageAsRead(messageId, userId);
      
      if (!updatedMessage) {
        throw new Error('Failed to mark message as read');
      }

      // Get the chat to notify other participants
      const chat = await chatRepo.getChatByChatId(updatedMessage.chat);
      
      if (chat) {
        // Notify all participants except the one who read the message
        chat.participants.forEach((participantId: Types.ObjectId) => {
          if (participantId.toString() !== userId.toString()) {
            emitSocketEvent(
              req,
              participantId.toString(),
              ChatEventEnum.MESSAGE_READ_EVENT,
              {
                messageId: messageId,
                chatId: chat._id,
                readBy: userId,
                timestamp: createValidatedTimestamp(),
                readByUser: {
                  _id: userId,
                  // You might want to populate user info here
                }
              }
            );
          }
        });
      }

      return updatedMessage;
    } catch (error) {
      console.error('Error in markMessageAsRead:', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a chat as read
   */
  async markAllMessagesAsRead(chatId: Types.ObjectId, userId: Types.ObjectId, req: Request) {
    try {
      logTimeInfo('markAllMessagesAsRead');
      
      // Update all unread messages
      const result = await messageRepo.markAllMessagesAsRead(chatId, userId);
      
      // Get the chat to notify other participants
      const chat = await chatRepo.getChatByChatId(chatId);
      
      if (chat && result.modifiedCount > 0) {
        // Notify all participants except the one who read the messages
        chat.participants.forEach((participantId: Types.ObjectId) => {
          if (participantId.toString() !== userId.toString()) {
            emitSocketEvent(
              req,
              participantId.toString(),
              ChatEventEnum.MESSAGE_READ_EVENT,
              {
                chatId: chatId,
                readBy: userId,
                allMessages: true,
                timestamp: createValidatedTimestamp(),
                modifiedCount: result.modifiedCount
              }
            );
          }
        });
      }

      return result;
    } catch (error) {
      console.error('Error in markAllMessagesAsRead:', error);
      throw error;
    }
  }

  /**
   * Get unread message count with proper error handling
   */
  async getUnreadMessagesCount(chatId: Types.ObjectId, userId: Types.ObjectId) {
    try {
      return await messageRepo.getUnreadMessagesCount(chatId, userId);
    } catch (error) {
      console.error('Error in getUnreadMessagesCount:', error);
      return 0;
    }
  }

  /**
   * Create message with proper timestamp handling
   */
  async createMessage(
    userId: Types.ObjectId,
    chatId: Types.ObjectId,
    content: string,
    attachmentFiles: { fileMetadataId: Types.ObjectId; url?: string; originalName?: string; type?: string; size?: number; localPath?: string }[]
  ) {
    try {
      logTimeInfo('createMessage');
      
      // Create message using repository
      const message = await messageRepo.createMessage(userId, chatId, content, attachmentFiles);
      
      return message;
    } catch (error) {
      console.error('Error in createMessage:', error);
      throw error;
    }
  }
}

export default new MessageService();