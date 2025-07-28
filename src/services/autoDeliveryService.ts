import { Types } from "mongoose";
import { MessageModel, MessageStatus } from "../database/model/Message";
import chatRepo from "../database/repositories/chatRepo";
import colorsUtils from "../helpers/colorsUtils";
import ImprovedMessageStatusService from "./improvedMessageStatusService";
import { Request } from "express";

class AutoDeliveryService {
  /**
   * Auto-mark messages as delivered when user comes online
   */
  static async markPendingMessagesAsDelivered(
    req: Request,
    userId: string
  ): Promise<void> {
    try {
      colorsUtils.log("info", `🔄 Auto-marking pending messages as delivered for user: ${userId}`);

      // Get all chats the user is part of
      const userChats = await chatRepo.getCurrentUserAllChats(new Types.ObjectId(userId));
      
      if (!userChats || userChats.length === 0) {
        colorsUtils.log("info", `No chats found for user: ${userId}`);
        return;
      }

      const chatIds = userChats.map((chat: any) => chat._id);

      // Find messages that should be marked as delivered
      const pendingMessages = await MessageModel.find({
        chat: { $in: chatIds },
        sender: { $ne: new Types.ObjectId(userId) }, // Not sent by this user
        deliveredTo: { $ne: new Types.ObjectId(userId) }, // Not already delivered to this user
        status: { $in: [MessageStatus.SENT, MessageStatus.PENDING] }, // Only sent/pending messages
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Only messages from last 24 hours
      }).limit(50); // Limit to prevent overwhelming

      colorsUtils.log("info", `Found ${pendingMessages.length} messages to mark as delivered for user: ${userId}`);

      // Mark each message as delivered
      for (const message of pendingMessages) {
        try {
          await ImprovedMessageStatusService.markAsDelivered(
            req,
            message._id.toString(),
            userId
          );
        } catch (error) {
          colorsUtils.log("error", `Failed to mark message ${message._id} as delivered: ${error}`);
        }
      }

      colorsUtils.log("info", `✅ Auto-delivery process completed for user: ${userId}`);

    } catch (error) {
      colorsUtils.log("error", `Error in auto-delivery service: ${error}`);
    }
  }

  /**
   * Auto-mark messages as delivered for a specific chat when user joins
   */
  static async markChatMessagesAsDelivered(
    req: Request,
    userId: string,
    chatId: string
  ): Promise<void> {
    try {
      colorsUtils.log("info", `🔄 Auto-marking chat messages as delivered for user: ${userId} in chat: ${chatId}`);

      // Find undelivered messages in this chat
      const undeliveredMessages = await MessageModel.find({
        chat: new Types.ObjectId(chatId),
        sender: { $ne: new Types.ObjectId(userId) }, // Not sent by this user
        deliveredTo: { $ne: new Types.ObjectId(userId) }, // Not already delivered to this user
        status: { $in: [MessageStatus.SENT, MessageStatus.PENDING] }, // Only sent/pending messages
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Only messages from last 7 days
      }).limit(20); // Limit to prevent overwhelming

      colorsUtils.log("info", `Found ${undeliveredMessages.length} undelivered messages in chat: ${chatId}`);

      // Mark each message as delivered
      for (const message of undeliveredMessages) {
        try {
          await ImprovedMessageStatusService.markAsDelivered(
            req,
            message._id.toString(),
            userId
          );
        } catch (error) {
          colorsUtils.log("error", `Failed to mark message ${message._id} as delivered: ${error}`);
        }
      }

      colorsUtils.log("info", `✅ Auto-delivery process completed for chat: ${chatId}`);

    } catch (error) {
      colorsUtils.log("error", `Error in chat auto-delivery service: ${error}`);
    }
  }
}

export { AutoDeliveryService };
export default AutoDeliveryService;