import { Router } from "express";
import { ProtectedRequest } from "../types/app-request";
import { Response } from "express";
import { SuccessResponse } from "../core/ApiResponse";
import asyncHandler from "../helpers/asyncHandler";
import { verifyJWT } from "../middlewares/auth.middlewares";
import chatRepo from "../database/repositories/chatRepo";
import { emitSocketEvent } from "../socket";
import { ChatEventEnum } from "../constants";
import { Types } from "mongoose";
import DefaultGroupService from "../services/defaultGroupService";

const testRouter = Router();

// Test endpoint to check socket connectivity
testRouter.post(
  "/socket-test",
  verifyJWT,
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    const currentUserId = req.user?._id;
    const io = req.app.get("io") as any;
    
    // Get connected socket info
    let socketInfo = {
      totalConnectedSockets: 0,
      userSocketFound: false,
      userRooms: [],
      allRooms: []
    };
    
    if (io) {
      socketInfo.totalConnectedSockets = io.sockets.sockets.size;
      
      // Check if user has active socket connection
      for (const [socketId, socket] of io.sockets.sockets) {
        if (socket.user && socket.user._id.toString() === currentUserId.toString()) {
          socketInfo.userSocketFound = true;
          socketInfo.userRooms = Array.from(socket.rooms);
          break;
        }
      }
      
      // Get all rooms for debugging
      socketInfo.allRooms = Array.from(io.adapter.rooms.keys());
    }
    
    // Get user's chats to test auto-join
    const userChats = await chatRepo.getCurrentUserAllChats(currentUserId);
    
    // Test emitting to user's personal room
    emitSocketEvent(
      req,
      currentUserId.toString(),
      ChatEventEnum.NOTIFICATION_EVENT,
      {
        message: "Socket test notification to personal room",
        timestamp: new Date().toISOString(),
        type: "personal_test"
      }
    );
    
    // Test emitting to each chat room
    const chatRoomTests = userChats.map((chat: any) => {
      emitSocketEvent(
        req,
        chat._id.toString(),
        ChatEventEnum.NOTIFICATION_EVENT,
        {
          message: `Test message to chat: ${chat.name || 'Unnamed chat'}`,
          chatId: chat._id.toString(),
          timestamp: new Date().toISOString(),
          type: "chat_test"
        }
      );
      
      return {
        chatId: chat._id.toString(),
        chatName: chat.name || 'Unnamed chat',
        participantCount: chat.participants?.length || 0
      };
    });
    
    return new SuccessResponse("Socket test completed", {
      userId: currentUserId.toString(),
      userChats: userChats.length,
      socketInfo,
      chatRoomTests,
      timestamp: new Date().toISOString()
    }).send(res);
  })
);

// Test endpoint to get user's chat rooms info
testRouter.get(
  "/my-chats",
  verifyJWT,
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    const currentUserId = req.user?._id;
    const userChats = await chatRepo.getCurrentUserAllChats(currentUserId);
    
    const chatInfo = userChats.map((chat: any) => ({
      id: chat._id.toString(),
      name: chat.name,
      isGroupChat: chat.isGroupChat,
      isDefault: chat.isDefault || false,
      participantCount: chat.participants?.length || 0,
      participants: chat.participants?.map((p: any) => ({
        id: p._id?.toString(),
        username: p.username,
        email: p.email
      })) || []
    }));
    
    return new SuccessResponse("User chats retrieved", {
      userId: currentUserId.toString(),
      totalChats: userChats.length,
      chats: chatInfo
    }).send(res);
  })
);

// Debug endpoint for default group
testRouter.get(
  "/default-group",
  verifyJWT,
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    const currentUserId = req.user?._id;
    
    // Get default group info
    const defaultGroup = await DefaultGroupService.getDefaultGroup();
    
    // Check if current user is in default group
    const isUserInDefaultGroup = await chatRepo.isUserInDefaultGroup(currentUserId);
    
    // Try to add user to default group
    const addResult = await DefaultGroupService.addUserToDefaultGroup(currentUserId);
    
    // Get updated default group info
    const updatedDefaultGroup = await DefaultGroupService.getDefaultGroup();
    
    return new SuccessResponse("Default group debug info", {
      userId: currentUserId.toString(),
      defaultGroupExists: !!defaultGroup,
      defaultGroupInfo: defaultGroup ? {
        id: defaultGroup._id.toString(),
        name: defaultGroup.name,
        isDefault: defaultGroup.isDefault,
        isGroupChat: defaultGroup.isGroupChat,
        participantCount: defaultGroup.participants?.length || 0,
        participants: defaultGroup.participants?.map((p: any) => p.toString()) || []
      } : null,
      wasUserInDefaultGroup: !!isUserInDefaultGroup,
      userAddedToDefaultGroup: addResult,
      updatedDefaultGroupInfo: updatedDefaultGroup ? {
        id: updatedDefaultGroup._id.toString(),
        name: updatedDefaultGroup.name,
        participantCount: updatedDefaultGroup.participants?.length || 0,
        userIsNowInGroup: updatedDefaultGroup.participants?.some((p: any) => p.toString() === currentUserId.toString()) || false
      } : null,
      defaultGroupId: DefaultGroupService.getDefaultGroupId(),
      defaultGroupName: DefaultGroupService.getDefaultGroupName()
    }).send(res);
  })
);

// Force create default group endpoint
testRouter.post(
  "/create-default-group",
  verifyJWT,
  asyncHandler(async (req: ProtectedRequest, res: Response) => {
    try {
      await DefaultGroupService.initializeDefaultGroup();
      const defaultGroup = await DefaultGroupService.getDefaultGroup();
      
      return new SuccessResponse("Default group creation attempted", {
        success: !!defaultGroup,
        defaultGroup: defaultGroup ? {
          id: defaultGroup._id.toString(),
          name: defaultGroup.name,
          isDefault: defaultGroup.isDefault,
          isGroupChat: defaultGroup.isGroupChat,
          participantCount: defaultGroup.participants?.length || 0
        } : null
      }).send(res);
    } catch (error) {
      return new SuccessResponse("Default group creation failed", {
        success: false,
        error: typeof error === "object" && error !== null && "message" in error ? (error as any).message : String(error)
      }).send(res);
    }
  })
);

export default testRouter;