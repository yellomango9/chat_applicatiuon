import { Types } from "mongoose";
import { MessageModel, MessageStatus } from "../database/model/Message";
import { ChatEventEnum } from "../constants";
import { emitSocketEvent, emitToUser } from "../socket";
import { Request } from "express";
import colorsUtils from "../helpers/colorsUtils";

class ImprovedMessageStatusService {
  /**
   * Mark message as delivered to a specific user with improved logic
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
   * Mark message as read by a specific user with improved logic
   */
  static async markAsRead(
    req: Request,
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const message = await MessageModel.findById(messageId).populate('chat');
      if (!message) {
        colorsUtils.log("error", `Message not found for markAsRead: ${messageId}`);
        return;
      }

      // Don't mark your own messages as read
      if (message.sender.toString() === userId) {
        colorsUtils.log("info", `Skipping self-read for message: ${messageId}`);
        return;
      }

      // Check if user has already read this message
      const isAlreadyRead = message.readBy.some(id => id.toString() === userId);
      if (isAlreadyRead) {
        colorsUtils.log("info", `Message already read by user: ${messageId} -> ${userId}`);
        return;
      }

      colorsUtils.log("info", `📖 Marking message as read: ${messageId} by user: ${userId}`);

      // Add user to readBy array and ensure they're also in deliveredTo
      const updateData: any = {
        $addToSet: { 
          readBy: new Types.ObjectId(userId),
          deliveredTo: new Types.ObjectId(userId) // Ensure delivery is also marked
        },
        $set: { 
          readAt: new Date(),
          updatedAt: new Date(),
          status: MessageStatus.READ,
          deliveredAt: new Date() // Update delivered time if not set
        }
      };

      const updated = await MessageModel.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true }
      ).populate('readBy', 'username')
       .populate('deliveredTo', 'username')
       .populate('sender', 'username');

      if (!updated) {
        colorsUtils.log("error", `Failed to update message: ${messageId}`);
        return;
      }

      colorsUtils.log("info", `✅ Message marked as read successfully: ${messageId}`);

      // Prepare read status data
      const readData = {
        messageId,
        readBy: userId,
        readAt: updated.readAt,
        allReadBy: updated.readBy.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        status: updated.status,
        timestamp: new Date().toISOString(),
      };

      // Emit read confirmation to the chat room
      emitSocketEvent(req, message.chat.toString(), ChatEventEnum.MESSAGE_READ_EVENT, readData);

      // Emit status update to chat room
      emitSocketEvent(req, message.chat.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: MessageStatus.READ,
        chatId: message.chat.toString(),
        readAt: updated.readAt,
        readBy: updated.readBy.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        deliveredTo: updated.deliveredTo.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        timestamp: new Date().toISOString(),
      });

      // CRITICAL: Emit directly to message sender for immediate UI update
      emitToUser(req, message.sender.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, {
        messageId,
        status: MessageStatus.READ,
        chatId: message.chat.toString(),
        readAt: updated.readAt,
        readBy: updated.readBy.map((user: any) => ({
          _id: user._id,
          username: user.username
        })),
        timestamp: new Date().toISOString(),
      });

      colorsUtils.log("info", `✅ Read status events emitted for message: ${messageId}`);

    } catch (error) {
      colorsUtils.log("error", `Error marking message as read: ${error}`);
    }
  }

  /**
   * Update message status with better error handling and event emission
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
            await MessageModel.findByIdAndUpdate(
              messageId,
              { $addToSet: { deliveredTo: new Types.ObjectId(userId) } }
            );
          }
          break;
        case MessageStatus.READ:
          updateData.readAt = updateData.readAt || new Date();
          if (userId) {
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
      const statusUpdateData = {
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
      };

      emitSocketEvent(req, chatId, ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, statusUpdateData);

      // Also emit to the sender specifically for immediate UI update
      if (message.sender) {
        emitToUser(req, message.sender.toString(), ChatEventEnum.MESSAGE_STATUS_UPDATE_EVENT, statusUpdateData);
      }

    } catch (error) {
      colorsUtils.log("error", `Error updating message status: ${error}`);
    }
  }
}

export { ImprovedMessageStatusService };
export default ImprovedMessageStatusService;