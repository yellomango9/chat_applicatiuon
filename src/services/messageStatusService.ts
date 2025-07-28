import { Types } from "mongoose";
import { MessageModel, MessageStatus } from "../database/model/Message";
import { ChatEventEnum } from "../constants";
import { emitSocketEvent, emitToUser } from "../socket";
import { Request } from "express";
import colorsUtils from "../helpers/colorsUtils";

export class MessageStatusService {
  /**
   * Update message status and emit real-time events
   */
  static async updateMessageStatus(
    req: Request,
    messageId: string,
    newStatus: MessageStatus,
    userId?: string,
    failureReason?: string
  ): Promise<void> {
    try {
      const message = await MessageModel.findById(messageId);
      if (!message) {
        colorsUtils.log("error", `Message not found: ${messageId}`);
        return;
      }

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      // Set specific timestamps based on status
      switch (newStatus) {
        case MessageStatus.SENT:
          updateData.sentAt = new Date();
          break;
        case MessageStatus.DELIVERED:
          updateData.deliveredAt = new Date();
          if (userId) {
            // Add user to deliveredTo array if not already present
            await MessageModel.findByIdAndUpdate(
              messageId,
              { $addToSet: { deliveredTo: new Types.ObjectId(userId) } }
            );
          }
          break;
        case MessageStatus.READ:
          updateData.readAt = updateData.readAt || new Date();
          if (userId) {
            // Add user to readBy array if not already present
            await MessageModel.findByIdAndUpdate(
              messageId,
              { $addToSet: { readBy: new Types.ObjectId(userId) } }
            );
          }
          break;
        case MessageStatus.FAILED:
          updateData.failureReason = failureReason;
          updateData.retryCount = (message.retryCount || 0) + 1;
          break;
      }

      // Update the message
      const updatedMessage = await MessageModel.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true }
      ).populate('sender', 'username email avatar')
       .populate('readBy', 'username')
       .populate('deliveredTo', 'username');

      if (!updatedMessage) {
        colorsUtils.log("error", `Failed to update message: ${messageId}`);
        return;
      }

      colorsUtils.log("info", `📊 Message status updated: ${messageId} -> ${newStatus}`);

      // Emit status update to all chat participants
      const chatId = message.chat.toString();
      emitSocketEvent(req, chatId, ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: newStatus,
        chatId,
        sentAt: updatedMessage.sentAt,
        deliveredAt: updatedMessage.deliveredAt,
        readAt: updatedMessage.readAt,
        readBy: updatedMessage.readBy,
        deliveredTo: updatedMessage.deliveredTo,
        retryCount: updatedMessage.retryCount,
        failureReason: updatedMessage.failureReason,
        timestamp: new Date().toISOString(),
      });

      // Also emit to the sender specifically for immediate UI update
      if (message.sender) {
        emitToUser(req, message.sender.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
          messageId,
          status: newStatus,
          chatId,
          sentAt: updatedMessage.sentAt,
          deliveredAt: updatedMessage.deliveredAt,
          readAt: updatedMessage.readAt,
          readBy: updatedMessage.readBy,
          deliveredTo: updatedMessage.deliveredTo,
          retryCount: updatedMessage.retryCount,
          failureReason: updatedMessage.failureReason,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error) {
      colorsUtils.log("error", `Error updating message status: ${error}`);
    }
  }

  /**
   * Mark message as delivered to a specific user
   */
  static async markAsDelivered(
    req: Request,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const message = await MessageModel.findById(messageId).populate('chat');
      if (!message) {
        colorsUtils.log("error", `Message not found for markAsDelivered: ${messageId}`);
        return;
      }

      // Don't mark your own messages as delivered
      if (message.sender.toString() === userId) {
        colorsUtils.log("info", `Skipping self-delivery for message: ${messageId}`);
        return;
      }

      // Check if user is already in deliveredTo array
      const isAlreadyDelivered = message.deliveredTo.some(id => id.toString() === userId);
      if (isAlreadyDelivered) {
        colorsUtils.log("info", `Message already delivered to user: ${messageId} -> ${userId}`);
        return;
      }

      colorsUtils.log("info", `📦 Marking message as delivered: ${messageId} to user: ${userId}`);

      // Add user to deliveredTo array and update status if needed
      const updateData: any = {
        $addToSet: { deliveredTo: new Types.ObjectId(userId) },
        $set: { 
          deliveredAt: new Date(),
          updatedAt: new Date()
        }
      };

      // If message is still pending/sending, update to delivered
      if (message.status === MessageStatus.PENDING || message.status === MessageStatus.SENDING) {
        updateData.$set.status = MessageStatus.DELIVERED;
      }

      const updated = await MessageModel.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true }
      ).populate('deliveredTo', 'username')
       .populate('sender', 'username');

      if (!updated) {
        colorsUtils.log("error", `Failed to update message delivery: ${messageId}`);
        return;
      }

      // Emit delivery confirmation to chat room
      const deliveryData = {
        messageId,
        deliveredTo: userId,
        deliveredAt: updated.deliveredAt,
        allDeliveredTo: updated.deliveredTo.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        status: updated.status,
        timestamp: new Date().toISOString(),
      };

      // Emit to chat room
      emitSocketEvent(req, message.chat.toString(), ChatEventEnum.MESSAGE_DELIVERED_EVENT, deliveryData);

      // Emit status update to sender specifically
      emitToUser(req, message.sender.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: updated.status,
        chatId: message.chat.toString(),
        deliveredAt: updated.deliveredAt,
        deliveredTo: updated.deliveredTo.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        timestamp: new Date().toISOString(),
      });

      colorsUtils.log("info", `✅ Message delivery events emitted for: ${messageId}`);

    } catch (error) {
      colorsUtils.log("error", `Error marking message as delivered: ${error}`);
    }
  }

  /**
   * Mark message as read by a specific user
   */
  static async markAsRead(
    req: Request,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const message = await MessageModel.findById(messageId);
      if (!message) {
        colorsUtils.log("error", `Message not found for markAsRead: ${messageId}`);
        return;
      }

      // Don't mark your own messages as read
      if (message.sender.toString() === userId) {
        colorsUtils.log("info", `Skipping self-read for message: ${messageId}`);
        return;
      }

      colorsUtils.log("info", `📖 Marking message as read: ${messageId} by user: ${userId}`);

      // Add user to readBy array if not already present
      const updated = await MessageModel.findByIdAndUpdate(
        messageId,
        { 
          $addToSet: { readBy: new Types.ObjectId(userId) },
          $set: { 
            readAt: new Date(),
            updatedAt: new Date(),
            status: MessageStatus.READ  // Always update status to READ when someone reads it
          }
        },
        { new: true }
      ).populate('readBy', 'username');

      if (!updated) {
        colorsUtils.log("error", `Failed to update message: ${messageId}`);
        return;
      }

      colorsUtils.log("info", `✅ Message marked as read successfully: ${messageId}`);

      // Emit read confirmation to the chat room
      emitSocketEvent(req, message.chat.toString(), ChatEventEnum.MESSAGE_READ_EVENT, {
        messageId,
        readBy: userId,
        readAt: updated.readAt,
        allReadBy: updated.readBy,
        timestamp: new Date().toISOString(),
      });

      // Also emit status update to ensure UI updates in chat room
      emitSocketEvent(req, message.chat.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: MessageStatus.READ,
        chatId: message.chat.toString(),
        readAt: updated.readAt,
        readBy: updated.readBy,
        timestamp: new Date().toISOString(),
      });

      // FIXED: Emit directly to message sender for immediate update using emitToUser
      emitToUser(req, message.sender.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: MessageStatus.READ,
        chatId: message.chat.toString(),
        readAt: updated.readAt,
        readBy: updated.readBy,
        timestamp: new Date().toISOString(),
      });

      colorsUtils.log("info", `✅ Read status events emitted for message: ${messageId}`);

    } catch (error) {
      colorsUtils.log("error", `Error marking message as read: ${error}`);
    }
  }

  /**
   * Retry failed message
   */
  static async retryMessage(
    req: Request,
    messageId: string
  ): Promise<boolean> {
    try {
      const message = await MessageModel.findById(messageId);
      if (!message || message.status !== MessageStatus.FAILED) {
        return false;
      }

      // Reset message status to pending for retry
      await this.updateMessageStatus(req, messageId, MessageStatus.PENDING);
      
      colorsUtils.log("info", `🔄 Message retry initiated: ${messageId}`);
      return true;

    } catch (error) {
      colorsUtils.log("error", `Error retrying message: ${error}`);
      return false;
    }
  }

  /**
   * Get message status statistics for a chat
   */
  static async getChatMessageStats(chatId: string): Promise<any> {
    try {
      const stats = await MessageModel.aggregate([
        { $match: { chat: new Types.ObjectId(chatId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      return stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});

    } catch (error) {
      colorsUtils.log("error", `Error getting chat message stats: ${error}`);
      return {};
    }
  }

  /**
   * Helper method to determine if message should be marked as delivered
   */
  private static shouldUpdateToDelivered(message: any, chat: any): boolean {
    // This is a simplified logic - you might want to implement more complex logic
    // based on your chat participant structure
    return message.deliveredTo && message.deliveredTo.length > 0;
  }

  /**
   * Helper method to determine if message should be marked as read
   */
  private static shouldUpdateToRead(message: any, chat: any): boolean {
    // This is a simplified logic - you might want to implement more complex logic
    // based on your chat participant structure
    return message.readBy && message.readBy.length > 0;
  }
}

export default MessageStatusService;