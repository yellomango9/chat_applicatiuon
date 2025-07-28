import { ProtectedRequest } from "../types/app-request";
import {
  AuthFailureError,
  BadRequestError,
  InternalError,
  NotFoundError,
} from "../core/ApiError";
import { SuccessMsgResponse, SuccessResponse } from "../core/ApiResponse";
import { Request, Response } from "express";
import { Types } from "mongoose";
import chatRepo from "../database/repositories/chatRepo";
import messageRepo from "../database/repositories/messageRepo";
import asyncHandler from "../helpers/asyncHandler";
import {
  getLocalFilePath,
  getStaticFilePath,
  removeLocalFile,
} from "../helpers/utils";
import { emitSocketEvent, emitToUser } from "../socket";
import { ChatEventEnum } from "../constants";
import userRepo from "../database/repositories/userRepo";
import Chat from "../database/model/Chat";
import messageService from "../services/messageService";
import { logTimeInfo } from "../helpers/timeUtils";
import MessageStatusService from "../services/messageStatusService";
import { MessageStatus } from "../database/model/Message";
import ConversationService from "../services/conversationService";
import { FileMetadataService } from "../services/FileMetadataService";

export const getAllMessages = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { chatId } = req.params;
    const currentUser = req.user;

    // retrieve the chat of corresponding chatId
    const selectedChat = await chatRepo.getChatByChatId(
      new Types.ObjectId(chatId)
    );

    // if not chat found throw an error
    if (!selectedChat) {
      throw new NotFoundError("no chat found to retrieve messages");
    }

    // check for existance of current user in the chats
    const isParticipant = selectedChat.participants?.some(
      (participantId) => participantId.toString() === currentUser?._id.toString()
    );
    
    if (!isParticipant) {
      console.log(`❌ Chat ownership check failed:`);
      console.log(`Chat ID: ${chatId}`);
      console.log(`Current User ID: ${currentUser?._id}`);
      console.log(`Participants: ${selectedChat.participants?.map(p => p.toString())}`);
      throw new AuthFailureError("you don't own the chat !");
    }
    
    console.log(`✅ Chat ownership verified for user ${currentUser?._id} in chat ${chatId}`);

    // get all the messages in aggreated form
    const messages = await messageRepo.getAllMessagesAggregated(
      new Types.ObjectId(chatId)
    );

    if (!messages) {
      throw new InternalError("error while retrieving messages");
    }

    return new SuccessResponse(
      "messages retrieved successfully",
      messages
    ).send(res);
  }
);

// send a message
export const sendMessage = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { content } = req.body;
    const { chatId } = req.params;

    const currentUserId = req.user?._id;
    const files = (req.files as { attachments?: Express.Multer.File[] }) || {
      attachments: [],
    };

    if (!chatId) {
      throw new BadRequestError("no chat id provided");
    }

    if (!content && !files.attachments?.length) {
      throw new BadRequestError("no content provided");
    }

    const selectedChat = await chatRepo.getChatByChatId(
      new Types.ObjectId(chatId)
    );

    if (!selectedChat) {
      throw new NotFoundError("No chat found");
    }

    // hold the files sent by user and creating url to access to it
    // Use the type expected by messageRepo.createMessage
    const attachmentFiles: { fileMetadataId: Types.ObjectId; url?: string; originalName?: string; type?: string; size?: number; localPath?: string }[] = [];

    // Process file attachments and save metadata
    for (let index = 0; index < (files.attachments?.length || 0); index++) {
      const attachment = files.attachments![index];
      const fileType = getFileTypeFromMimetype(attachment.mimetype);
      const filePath = `${fileType}/${attachment.filename}`;
      let fileMetadataId: Types.ObjectId | undefined = undefined;
      let url: string | undefined = undefined;
      try {
        const fileMetadata = await FileMetadataService.createFileMetadata({
          originalName: attachment.originalname,
          fileName: attachment.filename,
          filePath: filePath,
          mimeType: attachment.mimetype,
          fileSize: attachment.size || 0,
          uploadedBy: currentUserId.toString(),
          chatId: chatId,
          metadata: {
            category: fileType.replace('s', ''),
            isEncrypted: false,
          }
        });
        // Ensure fileMetadataId is a Types.ObjectId
        fileMetadataId = typeof fileMetadata._id === 'string' ? new Types.ObjectId(fileMetadata._id) : fileMetadata._id;
        url = getStaticFilePath(filePath);
      } catch (error) {
        console.error(`❌ Error saving file metadata for ${attachment.filename}:`, error);
        url = getStaticFilePath(filePath);
      }
      if (fileMetadataId) {
        attachmentFiles.push({ 
          fileMetadataId, 
          url,
          originalName: attachment.originalname,
          type: attachment.mimetype,
          size: attachment.size || 0,
          localPath: getLocalFilePath(filePath)
        });
      }
    }
    
    // Helper function to determine file type based on mimetype
    function getFileTypeFromMimetype(mimetype: string): string {
      if (mimetype.startsWith('image/')) return 'images';
      if (mimetype.startsWith('video/')) return 'videos';
      if (mimetype.startsWith('audio/')) return 'audio';
      if (mimetype.includes('pdf') || mimetype.includes('document') || 
          mimetype.includes('word') || mimetype.includes('excel') || 
          mimetype.includes('powerpoint') || mimetype.includes('text') ||
          mimetype.includes('spreadsheet') || mimetype.includes('presentation')) {
        return 'documents';
      }
      return 'other';
    }

    // Prepare the message content
    const messageContent = content || "";
    
    // Log the attachment files for debugging
    console.log("Attachment files:", attachmentFiles);
    
    let message: any;
    try {
      // create a new message with attachmentsFiles (starts as PENDING)
      message = await messageRepo.createMessage(
        new Types.ObjectId(currentUserId),
        new Types.ObjectId(chatId),
        messageContent,
        attachmentFiles
      );

      // Update message status to SENT since it was successfully created
      await MessageStatusService.updateMessageStatus(
        req,
        message._id.toString(),
        MessageStatus.SENT
      );

      // Update file metadata with messageId
      console.log(`🔄 Updating file metadata with messageId: ${message._id.toString()}`);
      for (const attachment of attachmentFiles) {
        if ((attachment as any).fileMetadataId) {
          try {
            await FileMetadataService.updateFileMetadata((attachment as any).fileMetadataId, {
              messageId: message._id.toString()
            });
            console.log(`✅ Updated file metadata ${(attachment as any).fileMetadataId} with messageId`);
          } catch (error) {
            console.error(`❌ Error updating file metadata with messageId:`, error);
          }
        }
      }

      // updating the last message of the chat
      const updatedChat = await chatRepo.updateChatFields(
        new Types.ObjectId(chatId),
        { lastMessage: message._id }
      );

      // Update conversation metadata for WhatsApp-like sorting
      await ConversationService.updateConversationOnNewMessage(
        req,
        new Types.ObjectId(chatId),
        message._id,
        messageContent,
        new Types.ObjectId(currentUserId),
        attachmentFiles
      );

      // structure the message
      const structuredMessage = await messageRepo.getStructuredMessages(
        message._id
      );

      if (!structuredMessage.length) {
        throw new InternalError("error creating message: " + message._id);
      }

      // emit socket event to chat room to receive current message (excluding sender)
      console.log(`📡 Broadcasting message to chat room: ${chatId} (excluding sender)`);
      const io = req.app.get("io") as any;
      if (io) {
        // Safe check for adapter and rooms
        let room = null;
        if (io.adapter && io.adapter.rooms) {
          room = io.adapter.rooms.get(chatId);
        }
        
        if (room) {
          room.forEach((socketId: string) => {
            const socket = io.sockets.sockets.get(socketId);
            // Only emit to sockets that don't belong to the message sender
            if (socket && socket.user && socket.user._id.toString() !== currentUserId.toString()) {
              socket.emit(ChatEventEnum.MESSAGE_RECEIVED_EVENT, structuredMessage[0]);
              console.log(`📡 Sent message to socket ${socketId} (user: ${socket.user._id})`);
            }
          });
        } else {
          // FIXED: Instead of broadcasting to all users, only send to chat participants
          console.log(`⚠️ Room ${chatId} not found, sending to chat participants only`);
          updatedChat.participants.forEach((participantId: Types.ObjectId) => {
            const participantIdStr = participantId.toString();
            
            // Skip the message sender
            if (participantIdStr === currentUserId.toString()) {
              return;
            }
            
            // Send message directly to each participant
            emitToUser(
              req,
              participantIdStr,
              ChatEventEnum.MESSAGE_RECEIVED_EVENT,
              structuredMessage[0]
            );
            console.log(`📡 Sent message directly to participant: ${participantIdStr}`);
          });
        }
      }
      
      // Fallback: Send to participants not in chat room (excluding sender)
      console.log("📡 Checking for participants not in chat room");
      if (io) {
        // Safe check for adapter and rooms
        let room = null;
        let clientsInRoom: string[] = [];
        
        if (io.adapter && io.adapter.rooms) {
          room = io.adapter.rooms.get(chatId);
          clientsInRoom = room ? Array.from(room) : [];
        }
        
        updatedChat.participants.forEach((participantId: Types.ObjectId) => {
          const participantIdStr = participantId.toString();
          
          // Skip the message sender
          if (participantIdStr === currentUserId.toString()) {
            return;
          }
          
          // Check if participant has any socket connected to the chat room
          let participantInRoom = false;
          if (io.sockets && io.sockets.sockets) {
            for (const [socketId, socket] of io.sockets.sockets) {
              if (socket.user && socket.user._id.toString() === participantIdStr && 
                  clientsInRoom.includes(socketId)) {
                participantInRoom = true;
                break;
              }
            }
          }
          
          // Only send direct message if participant is not in the chat room
          if (!participantInRoom) {
            console.log(`📡 Sending direct message to offline participant: ${participantIdStr}`);
            emitToUser(
              req,
              participantIdStr,
              ChatEventEnum.MESSAGE_RECEIVED_EVENT,
              structuredMessage[0]
            );
          }
        });
      }

      // Emit SENT status confirmation to sender
      emitToUser(
        req,
        currentUserId.toString(),
        ChatEventEnum.MESSAGE_SENT_EVENT,
        {
          messageId: message._id.toString(),
          status: MessageStatus.SENT,
          sentAt: new Date().toISOString(),
        }
      );

      return new SuccessResponse(
        "message sent successfully",
        structuredMessage[0]
      ).send(res);

    } catch (error) {
      console.error("Error sending message:", error);
      
      // If message was created but failed to send, mark as FAILED
      if (message && message._id) {
        await MessageStatusService.updateMessageStatus(
          req,
          message._id.toString(),
          MessageStatus.FAILED,
          undefined,
          (error instanceof Error ? error.message : String(error))
        );
      }
      
      throw new InternalError("Failed to send message");
    }
  }
);

// delete message
export const deleteMessage = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { messageId } = req.params;
    const currentUserId = req.user?._id;

    if (!messageId) {
      throw new BadRequestError("no message id provided");
    }

    const existingMessage = await messageRepo.getMessageById(
      new Types.ObjectId(messageId)
    );

    if (!existingMessage)
      throw new BadRequestError("invalid message id, message not found");

    // fetch the existing chat
    const existingChat = await chatRepo.getChatByChatId(existingMessage?.chat);

    if (!existingChat)
      throw new InternalError("Internal Error: chat not found");

    // if the existing chat participants includes the current userId
    if (
      !existingChat?.participants?.some(
        (participantId) => participantId.toString() === currentUserId.toString()
      )
    ) {
      throw new AuthFailureError("you don't own the message");
    }

    // check if for currentUserId presence in the message sender
    if (!(existingMessage.sender.toString() === currentUserId.toString()))
      throw new AuthFailureError("you don't own the message ");

    // delete the attachments of the message from the local folder
    // (localPath is not available in the new attachment type, so skip file removal here)

    // delete the message from database
    const deletedMsg = await messageRepo.deleteMessageById(existingMessage._id);

    if (!deletedMsg)
      throw new InternalError("Internal Error: Couldn't delete message");

    // update the last message of the chat
    let lastMessage: any;
    if (
      existingChat?.lastMessage?.toString() === existingMessage._id.toString()
    ) {
      lastMessage = await messageRepo.getLastMessage(existingChat._id);

      await chatRepo.updateChatFields(existingChat._id, {
        $set: {
          lastMessage: lastMessage?._id,
        },
      });
    }

    // emit delete message event to chat room
    emitSocketEvent(
      req,
      existingChat._id.toString(), // Send to the chat room instead of individual users
      ChatEventEnum.MESSAGE_DELETE_EVENT,
      {
        messageId: existingMessage._id,
        chatId: existingChat._id.toString(),
        // chatLastMessage: lastMessage.content || "attachment",
      }
    );

    return new SuccessMsgResponse("message deleted successfully").send(res);
  }
);

// Mark a message as read
export const markMessageAsRead = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { messageId } = req.params;
    const currentUserId = req.user?._id;

    if (!messageId) {
      throw new BadRequestError("No message id provided");
    }

    logTimeInfo('markMessageAsRead');

    const existingMessage = await messageRepo.getMessageById(
      new Types.ObjectId(messageId)
    );

    if (!existingMessage) {
      throw new NotFoundError("Message not found");
    }

    // Check if user is part of the chat
    const existingChat = await chatRepo.getChatByChatId(existingMessage.chat);
    
    if (!existingChat) {
      throw new NotFoundError("Chat not found");
    }

    if (
      !existingChat.participants.some(
        (participantId) => participantId.toString() === currentUserId.toString()
      )
    ) {
      throw new AuthFailureError("You are not a participant of this chat");
    }

    // Don't mark your own messages as read
    if (existingMessage.sender.toString() === currentUserId.toString()) {
      return new SuccessResponse("No need to mark your own message as read", {
        messageId,
        alreadyRead: true
      }).send(res);
    }

    // Check if already read
    if (existingMessage.readBy.some(id => id.toString() === currentUserId.toString())) {
      return new SuccessResponse("Message already marked as read", {
        messageId,
        alreadyRead: true
      }).send(res);
    }

    // Use message service to mark as read and emit events
    const updatedMessage = await messageService.markMessageAsRead(
      existingMessage._id,
      currentUserId,
      req
    );

    return new SuccessResponse("Message marked as read", {
      messageId,
      readBy: updatedMessage.readBy,
      readCount: updatedMessage.readBy.length
    }).send(res);
  }
);

// Mark all messages in a chat as read
export const markAllMessagesAsRead = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { chatId } = req.params;
    const currentUserId = req.user?._id;

    if (!chatId) {
      throw new BadRequestError("No chat id provided");
    }

    logTimeInfo('markAllMessagesAsRead');

    const existingChat = await chatRepo.getChatByChatId(
      new Types.ObjectId(chatId)
    );

    if (!existingChat) {
      throw new NotFoundError("Chat not found");
    }

    if (
      !existingChat.participants.some(
        (participantId) => participantId.toString() === currentUserId.toString()
      )
    ) {
      throw new AuthFailureError("You are not a participant of this chat");
    }

    // Use message service to mark all messages as read and emit events
    const result = await messageService.markAllMessagesAsRead(
      existingChat._id,
      currentUserId,
      req
    );

    return new SuccessResponse("All messages marked as read", {
      chatId,
      modifiedCount: result.modifiedCount
    }).send(res);
  }
);

// Get unread messages count for a user
export const getUnreadMessagesCount = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const { chatId } = req.params;
    const currentUserId = req.user?._id;

    if (!chatId) {
      throw new BadRequestError("No chat id provided");
    }

    const existingChat = await chatRepo.getChatByChatId(
      new Types.ObjectId(chatId)
    );

    if (!existingChat) {
      throw new NotFoundError("Chat not found");
    }

    if (
      !existingChat.participants.some(
        (participantId) => participantId.toString() === currentUserId.toString()
      )
    ) {
      throw new AuthFailureError("You are not a participant of this chat");
    }

    const count = await messageRepo.getUnreadMessagesCount(
      existingChat._id,
      currentUserId
    );

    return new SuccessResponse("Unread messages count retrieved", {
      chatId,
      unreadCount: count
    }).send(res);
  }
);

// Get all unread messages for a user across all chats
export const getAllUnreadMessages = asyncHandler(
  async (req: ProtectedRequest, res: Response) => {
    const currentUserId = req.user?._id;

    const unreadMessages = await messageRepo.getAllUnreadMessages(currentUserId);

    return new SuccessResponse("All unread messages retrieved", unreadMessages).send(res);
  }
);
