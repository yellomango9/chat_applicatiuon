import cookie from "cookie";
import User from "../database/model/User";
import { Namespace, Socket } from "socket.io";
import { ChatEventEnum } from "../constants";
import { Server } from "http";
import { Application, Request } from "express";
import { BadTokenError } from "../core/ApiError";
import JWT from "../core/JWT";
import userRepo from "../database/repositories/userRepo";
import chatRepo from "../database/repositories/chatRepo";
import colorsUtils from "../helpers/colorsUtils";
import { Types } from "mongoose";
import MessageStatusService from "../services/messageStatusService";
import DefaultGroupService from "../services/defaultGroupService";
import { ImprovedMessageStatusService } from "../services/improvedMessageStatusService";
import { AutoDeliveryService } from "../services/autoDeliveryService";

declare module "socket.io" {
  interface Socket {
    user?: User;
  }
}

// handles the join chat event ie; when a user join a room
const mountJoinChatEvent = (socket: Socket, io: any): void => {
  socket.on(ChatEventEnum.JOIN_CHAT_EVENT, async (chatId: string) => {
    try {
      colorsUtils.log("info", `👥 User ${socket.user?._id} manually joining chat room: ${chatId}`);
      socket.join(chatId); // join the user to a chat between or group chat
      
      // Auto-mark messages as delivered when joining a chat
      if (socket.user?._id) {
        try {
          const req = { app: { get: () => io } } as any;
          await AutoDeliveryService.markChatMessagesAsDelivered(
            req,
            socket.user._id.toString(),
            chatId
          );
        } catch (error) {
          colorsUtils.log("error", `Error in chat auto-delivery: ${error}`);
        }
      }
      
      colorsUtils.log("info", `✅ User ${socket.user?._id} successfully joined chat room: ${chatId}`);
      
      // Send confirmation to the user
      socket.emit('chatJoined', {
        chatId,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      colorsUtils.log("error", `Error joining chat: ${error}`);
      socket.emit('chatJoinError', {
        chatId,
        error: 'Failed to join chat',
        timestamp: new Date().toISOString()
      });
    }
  });
};

// handles the join user groups event - joins user to all their groups including default
const mountJoinUserGroupsEvent = (socket: Socket): void => {
  socket.on(ChatEventEnum.JOIN_USER_GROUPS_EVENT, async (userId: string) => {
    try {
      if (!socket.user || socket.user._id.toString() !== userId) {
        colorsUtils.log("warning", `⚠️ Unauthorized join_user_groups attempt for user: ${userId}`);
        return;
      }

      colorsUtils.log("info", `🔗 User ${userId} requesting to join all their groups`);
      
      // Get all user chats including the default group
      const userChats = await chatRepo.getCurrentUserAllChats(new Types.ObjectId(userId));
      
      if (userChats && userChats.length > 0) {
        userChats.forEach((chat: any) => {
          const chatId = chat._id.toString();
          socket.join(chatId);
          
          if (DefaultGroupService.isDefaultGroup(chatId)) {
            colorsUtils.log("info", `🏠 User ${userId} joined DEFAULT group room: ${chatId} (${chat.name})`);
          } else {
            colorsUtils.log("info", `📍 User ${userId} joined chat room: ${chatId} (${chat.name || 'Unnamed chat'})`);
          }
        });
        
        colorsUtils.log("success", `✅ User ${userId} successfully joined ${userChats.length} chat rooms`);
        
        // Send confirmation back to client
        socket.emit('user_groups_joined', {
          success: true,
          groupCount: userChats.length,
          groups: userChats.map((chat: any) => ({
            id: chat._id.toString(),
            name: chat.name,
            isDefault: chat.isDefault || false
          }))
        });
      } else {
        colorsUtils.log("info", `📭 User ${userId} has no groups to join`);
        socket.emit('user_groups_joined', {
          success: true,
          groupCount: 0,
          groups: []
        });
      }
    } catch (error) {
      colorsUtils.log("error", `❌ Error joining user groups: ${error}`);
      socket.emit('user_groups_joined', {
        success: false,
        error: 'Failed to join user groups'
      });
    }
  });
};

// handle the start Typing event
const mountStartTypingEvent = (socket: Socket): void => {
  socket.on(ChatEventEnum.START_TYPING_EVENT, (chatId: string) => {
    socket.in(chatId).emit(ChatEventEnum.START_TYPING_EVENT, chatId);
  });
};

// handle the stop Typing event
const mountStopTypingEvent = (socket: Socket): void => {
  socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId: string) => {
    socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
  });
};

// handle the message read event
const mountMessageReadEvent = (socket: Socket, io: any): void => {
  socket.on(ChatEventEnum.MESSAGE_READ_EVENT, async (data: any) => {
    try {
      // Validate data exists and is not undefined
      if (!data) {
        colorsUtils.log("warning", "Message read event received with undefined data");
        return;
      }

      // Ensure data is an object - safe parsing
      let messageData;
      if (typeof data === 'string') {
        try {
          messageData = JSON.parse(data);
        } catch (parseError) {
          colorsUtils.log("error", `Failed to parse message data: ${parseError}`);
          return;
        }
      } else if (typeof data === 'object') {
        messageData = data;
      } else {
        colorsUtils.log("warning", `Invalid message data type: ${typeof data}`);
        return;
      }
      
      colorsUtils.log("info", `📖 Message read event. Data: ${JSON.stringify(messageData)}`);
      
      if (messageData && messageData.messageId && socket.user?._id) {
        // Use the improved message status service
        const req = { app: { get: () => io } } as any;
        await ImprovedMessageStatusService.markAsRead(
          req,
          messageData.messageId,
          socket.user._id.toString()
        );
      } else {
        colorsUtils.log("warning", "Message read event missing required data");
      }
    } catch (error) {
      console.error('Error processing message read event:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "Failed to process message read event");
    }
  });
};

// handle the message delivered event
const mountMessageDeliveredEvent = (socket: Socket, io: any): void => {
  socket.on(ChatEventEnum.MESSAGE_DELIVERED_EVENT, async (data: any) => {
    try {
      if (!data || !data.messageId || !socket.user?._id) {
        colorsUtils.log("warning", "Message delivered event missing required data");
        return;
      }

      colorsUtils.log("info", `📬 Message delivered event: ${data.messageId}`);
      
      const req = { app: { get: () => io } } as any;
      await ImprovedMessageStatusService.markAsDelivered(
        req,
        data.messageId,
        socket.user._id.toString()
      );
    } catch (error) {
      console.error('Error processing message delivered event:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "Failed to process message delivered event");
    }
  });
};

// handle message retry event
const mountMessageRetryEvent = (socket: Socket, io: any): void => {
  socket.on('messageRetry', async (data: any) => {
    try {
      if (!data || !data.messageId) {
        colorsUtils.log("warning", "Message retry event missing messageId");
        return;
      }

      colorsUtils.log("info", `🔄 Message retry event: ${data.messageId}`);
      
      const req = { app: { get: () => io } } as any;
      const success = await MessageStatusService.retryMessage(req, data.messageId);
      
      if (success) {
        socket.emit('messageRetrySuccess', { messageId: data.messageId });
      } else {
        socket.emit('messageRetryFailed', { messageId: data.messageId });
      }
    } catch (error) {
      console.error('Error processing message retry event:', error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "Failed to process message retry event");
    }
  });
};

// Auto-join user to all their chats
const autoJoinUserChats = async (socket: Socket, userId: Types.ObjectId): Promise<void> => {
  try {
    const userChats = await chatRepo.getCurrentUserAllChats(userId);
    colorsUtils.log("info", `🔗 Auto-joining user ${userId} to ${userChats.length} chats`);
    
    if (userChats && userChats.length > 0) {
      userChats.forEach((chat: any) => {
        const chatId = chat._id.toString();
        socket.join(chatId);
        colorsUtils.log("info", `📍 User ${userId} joined chat room: ${chatId} (${chat.name || 'Unnamed chat'})`);
      });
    } else {
      colorsUtils.log("info", `📭 User ${userId} has no existing chats to join`);
    }
  } catch (error) {
    colorsUtils.log("error", `❌ Error auto-joining user chats: ${error}`);
  }
};

// function to initialize the socket io
const initSocketIo = (io: any): void => {
  colorsUtils.log("info", "🔌 Socket.IO server initialized and waiting for connections...");
  
  io.on("connection", async (socket: Socket) => {
    colorsUtils.log("info", `🔌 New socket connection attempt: ${socket.id}`);
    try {
      // get the token from the cookies, handshake auth, or authorization header
      const cookieHeader = socket.handshake.headers?.cookie;
      const cookies = cookieHeader ? cookie.parse(cookieHeader) : {};
      let token = cookies?.accessToken || 
                  socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        colorsUtils.log("error", "❌ Socket connection failed: Token not found");
        throw new BadTokenError("Token not found");
      }

      colorsUtils.log("info", "🔐 Socket auth token found, validating...");

      const decodedToken = await JWT.validateToken(token);
      const userId = new Types.ObjectId(decodedToken.sub);
      const user = await userRepo.findById(userId);

      if (!user) {
        colorsUtils.log("error", `❌ Invalid token - user not found: ${userId}`);
        throw new BadTokenError("Invalid token");
      }

      socket.user = user;
      socket.join(user._id.toString());
      colorsUtils.log("info", `👤 User ${user.username} (${user._id}) joined personal room`);
      
      // Update user status to online and broadcast
      await userRepo.findByIdAndUpdate(userId, { 
        status: true, 
        lastSeen: new Date() 
      });
      
      // Auto-join user to all their chats FIRST
      await autoJoinUserChats(socket, userId);
      
      // Auto-mark pending messages as delivered
      try {
        const req = { app: { get: () => io } } as any;
        await AutoDeliveryService.markPendingMessagesAsDelivered(req, userId.toString());
      } catch (error) {
        colorsUtils.log("error", `Error in auto-delivery: ${error}`);
      }
      
      // Broadcast user online status to all connected users
      const onlineStatusData = {
        userId: user._id.toString(),
        username: user.username,
        status: true,
        lastSeen: new Date(),
        timestamp: new Date().toISOString(),
      };
      
      socket.broadcast.emit(ChatEventEnum.USER_ONLINE, onlineStatusData);
      socket.broadcast.emit(ChatEventEnum.USER_STATUS_UPDATE, onlineStatusData);
      
      // Send connection confirmation with user data
      socket.emit(ChatEventEnum.CONNECTED_EVENT, {
        userId: user._id.toString(),
        username: user.username,
        status: true,
        message: "Connected successfully",
        timestamp: new Date().toISOString()
      });
      
      colorsUtils.log("info", `🤝 User connected successfully: ${user.username} (${user._id.toString()})`);

      // Mount event handlers
      mountJoinChatEvent(socket, io);
      mountJoinUserGroupsEvent(socket);
      mountStartTypingEvent(socket);
      mountStopTypingEvent(socket);
      mountMessageReadEvent(socket, io);
      mountMessageDeliveredEvent(socket, io);
      mountMessageRetryEvent(socket, io);

      // Message events with error handling
      socket.on(ChatEventEnum.MESSAGE_RECEIVED_EVENT, (message: any) => {
        try {
          console.log("Message received event:", message);
          socket.to(message.chat).emit(ChatEventEnum.MESSAGE_RECEIVED_EVENT, message);
        } catch (error) {
          console.error('Error in message received event:', error);
          socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "Failed to process received message");
        }
      });

      // Handle disconnection
      socket.on("disconnect", async (reason) => {
        colorsUtils.log("info", `User disconnected: ${socket.user?._id} (reason: ${reason})`);
        if (socket.user?._id) {
          // Update user status to offline and broadcast
          await userRepo.findByIdAndUpdate(socket.user._id, { 
            status: false, 
            lastSeen: new Date() 
          });
          
          // Prepare offline status data
          const offlineStatusData = {
            userId: socket.user._id.toString(),
            username: socket.user.username,
            status: false,
            lastSeen: new Date(),
            timestamp: new Date().toISOString(),
          };
          
          // Broadcast user offline status
          socket.broadcast.emit(ChatEventEnum.USER_OFFLINE, offlineStatusData);
          socket.broadcast.emit(ChatEventEnum.USER_STATUS_UPDATE, offlineStatusData);
          
          // Leave personal room
          socket.leave(socket.user._id.toString());
          colorsUtils.log("info", `📡 Broadcasted offline status for user: ${socket.user.username}`);
        }
      });

      // Error handling
      socket.on("error", (error: any) => {
        console.error("Socket error:", error);
        socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "An error occurred");
      });

    } catch (error) {
      console.error("Socket connection error:", error);
      socket.emit(ChatEventEnum.SOCKET_ERROR_EVENT, "Failed to establish socket connection");
      socket.disconnect(true);
    }
  });
};

const emitSocketEvent = (
  req: Request,
  roomId: string,
  event: ChatEventEnum,
  payload: any
): void => {
  try {
    const io = req.app.get("io") as any;
    if (!io) {
      colorsUtils.log("error", "❌ Socket.io instance not found in app");
      return;
    }

    // Safe check for adapter and rooms
    let clientCount = 0;
    let room = null;
    
    if (io.adapter && io.adapter.rooms) {
      room = io.adapter.rooms.get(roomId);
      clientCount = room ? room.size : 0;
    }
    
    colorsUtils.log("info", `📡 Emitting '${event}' to room '${roomId}' (${clientCount} clients)`);
    console.log(`📦 Event payload:`, {
      event,
      roomId,
      payloadKeys: Object.keys(payload || {}),
      clientsInRoom: clientCount
    });
    
    // Debug: List all rooms and their clients
    if (io.adapter && io.adapter.rooms) {
      console.log(`🔍 Debug - All rooms:`, Array.from(io.adapter.rooms.keys()));
      console.log(`🔍 Debug - Connected sockets:`, io.sockets.sockets.size);
    }
    
    if (clientCount === 0) {
      // If no clients in room, try to find user's socket and emit directly
      colorsUtils.log("warning", `⚠️ No clients in room '${roomId}', searching for user socket...`);
      
      let foundSocket = false;
      if (io.sockets && io.sockets.sockets) {
        for (const [socketId, socket] of io.sockets.sockets) {
          if (socket.user && socket.user._id.toString() === roomId) {
            colorsUtils.log("info", `🎯 Found user socket ${socketId}, emitting directly`);
            socket.emit(event, payload);
            foundSocket = true;
          }
        }
      }
      
      if (!foundSocket) {
        colorsUtils.log("error", `❌ User ${roomId} not found in connected sockets`);
      }
    } else {
      io.in(roomId).emit(event, payload);
    }
  } catch (error) {
    colorsUtils.log("error", `❌ Error emitting socket event: ${error}`);
  }
};

// Helper function to emit to specific user by ID
const emitToUser = (
  req: Request,
  userId: string,
  event: ChatEventEnum,
  payload: any
): void => {
  try {
    const io = req.app.get("io") as any;
    if (!io) {
      colorsUtils.log("error", "❌ Socket.io instance not found in app");
      return;
    }

    let userFound = false;
    
    // Find all sockets for this user and emit to each
    if (io.sockets && io.sockets.sockets) {
      for (const [socketId, socket] of io.sockets.sockets) {
        if (socket.user && socket.user._id.toString() === userId) {
          colorsUtils.log("info", `🎯 Emitting '${event}' directly to user ${userId} socket ${socketId}`);
          socket.emit(event, payload);
          userFound = true;
        }
      }
    }
    
    if (!userFound) {
      colorsUtils.log("warning", `⚠️ User ${userId} not found in connected sockets for event '${event}'`);
    }
  } catch (error) {
    colorsUtils.log("error", `❌ Error emitting to user: ${error}`);
  }
};

export { initSocketIo, emitSocketEvent, emitToUser };
