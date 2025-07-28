import { Request, Response } from "express";
import asyncHandler from "../helpers/asyncHandler";
import userRepo from "../database/repositories/userRepo";
import { AuthFailureError, BadRequestError, NotFoundError } from "../core/ApiError";
import { RoleCode } from "../database/model/Role";
import User from "../database/model/User";
import bcrypt from "bcrypt";
import { createTokens } from "./auth/authUtils";
import { filterUserData } from "../helpers/utils";
import { SuccessResponse } from "../core/ApiResponse";
import { cookieValidity, environment, tokenInfo } from "../config";
import { getFileUrl } from "../helpers/multer";
import fs from "fs";
import path from "path";
import { ProtectedRequest } from "../types/app-request";
import JWT from "../core/JWT";
import DefaultGroupService from "../services/defaultGroupService";
import { emitSocketEvent, emitToUser } from "../socket";
import { ChatEventEnum } from "../constants";

const signUp = asyncHandler(async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  const existingUserEmail = await userRepo.findByEmail(email);
  if (existingUserEmail) {
    throw new BadRequestError("email already exists");
  }

  const existingUserUsername = await userRepo.findByUsername(username);
  if (existingUserUsername) {
    throw new BadRequestError("username already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // create a new user
  const user = await userRepo.create(
    {
      username,
      email,
      password: hashedPassword,
      avatarUrl: `https://s3bucket.bytenode.xyz/staticbucketstorage/public/images/avatar${
        // random number between 0 and 40
        Math.floor(Math.random() * (40 - 1 + 1)) + 1
      }.avif`,
    } as User,
    RoleCode.USER
  );

  const tokens = await createTokens(user);
  const userData = await filterUserData(user);

  // Add user to default group
  await DefaultGroupService.addUserToDefaultGroup(user._id);

  const options = {
    httpOnly: true,
    secure: environment === "production",
    sameSite: environment === "production" ? "strict" as const : "lax" as const,
    maxAge: Number(cookieValidity),
  };

  res
    .cookie("accessToken", tokens.accessToken, options)
    .cookie("refreshToken", tokens.refreshToken, options);

  new SuccessResponse("signup successful", {
    user: userData,
    tokens,
  }).send(res);
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const { userId, email, password } = req.body;

  if (!password) throw new BadRequestError("Password is required");
  if (!userId && !email) throw new BadRequestError("User ID or email is required");

  const user = await userRepo.findByEmailOrUsername(userId || email);
  if (!user) throw new BadRequestError("Invalid email/username");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AuthFailureError("Invalid credentials");

  const { password: pass, status, ...filteredUser } = user;

  const tokens = await createTokens(user);

  // Add user to default group (in case they weren't added during registration)
  await DefaultGroupService.addUserToDefaultGroup(user._id);

  const options = {
    httpOnly: true,
    secure: environment === "production",
    sameSite: environment === "production" ? "strict" as const : "lax" as const,
    maxAge: Number(cookieValidity),
  };

  res
    .cookie("accessToken", tokens.accessToken, options)
    .cookie("refreshToken", tokens.refreshToken, options);

  new SuccessResponse("login successful", {
    user: filteredUser,
    tokens,
  }).send(res);
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  const options = {
    httpOnly: true,
    secure: environment === "production",
    sameSite: environment === "production" ? "strict" as const : "lax" as const,
  };

  res.clearCookie("accessToken", options).clearCookie("refreshToken", options);

  new SuccessResponse("logout successful", {}).send(res, {});
});

const updateProfile = asyncHandler(async (req: ProtectedRequest, res: Response) => {
  const userId = req.user._id;

  const { username, bio, statusMessage } = req.body;
  const updateData: Partial<User> = {};

  // Only update fields that are provided
  if (username) updateData.username = username;
  if (bio !== undefined) updateData.bio = bio;
  if (statusMessage !== undefined) updateData.statusMessage = statusMessage;
  
  // Update lastSeen timestamp
  updateData.lastSeen = new Date();

  // Check if username already exists (if changing username)
  if (username) {
    const existingUser = await userRepo.findByUsername(username);
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      throw new BadRequestError('Username already taken');
    }
  }

  // Update user
  const updatedUser = await userRepo.findByIdAndUpdate(userId, updateData);
  if (!updatedUser) throw new NotFoundError('User not found');

  // Return updated user data
  const userData = await filterUserData(updatedUser);
  
  // Add the status message to the response
  if (statusMessage !== undefined) {
    userData.statusMessage = statusMessage;
  }
  
  new SuccessResponse('Profile updated successfully', { user: userData }).send(res);
});

const updateAvatar = asyncHandler(async (req: ProtectedRequest, res: Response) => {
  const userId = req.user._id;

  console.log("Update avatar request received", { userId, file: req.file });

  // Check if file was uploaded
  if (!req.file) {
    throw new BadRequestError('No image file provided');
  }

  // Get the file path and create a URL
  const avatarUrl = getFileUrl(req.file.filename, 'avatar');
  console.log("Generated avatar URL:", avatarUrl);

  // Get the current user to check if they have an existing avatar
  const currentUser = await userRepo.findById(userId);
  if (!currentUser) throw new NotFoundError('User not found');

  // If user has an existing avatar that's not the default, delete it
  if (currentUser.avatarUrl && !currentUser.avatarUrl.includes('s3bucket.bytenode.xyz')) {
    try {
      // Extract filename from URL
      const urlParts = currentUser.avatarUrl.split('/');
      const oldFilename = urlParts[urlParts.length - 1];
      
      // Remove any query parameters
      const cleanFilename = oldFilename.split('?')[0];
      
      const oldFilePath = path.join(__dirname, '../../public/uploads/avatars', cleanFilename);
      console.log("Attempting to delete old avatar:", oldFilePath);
      
      // Check if file exists before attempting to delete
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
        console.log("Old avatar deleted successfully");
      } else {
        console.log("Old avatar file not found, skipping deletion");
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
      // Continue even if deletion fails
    }
  }

  // Update user with new avatar URL
  console.log("Updating user with new avatar URL:", avatarUrl);
  const updatedUser = await userRepo.findByIdAndUpdate(userId, { avatarUrl });
  if (!updatedUser) throw new NotFoundError('User not found');

  // Return updated user data with the new avatar URL
  const userData = await filterUserData(updatedUser);
  
  // Add the avatar URL directly to the response
  userData.avatarUrl = avatarUrl;
  
  console.log("Avatar updated successfully for user:", userId);
  new SuccessResponse('Avatar updated successfully', { 
    user: userData,
    avatarUrl 
  }).send(res);
});

// Refresh token endpoint
const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  // Get refresh token from request body or cookies
  let refreshTokenValue = req.body.refreshToken || req.cookies.refreshToken;
  
  if (!refreshTokenValue) {
    throw new AuthFailureError("No token provided");
  }

  try {
    // Verify the refresh token
    const payload = await JWT.validateToken(refreshTokenValue);
    
    // Find the user
    const user = await userRepo.findById(new (require("mongoose").Types.ObjectId)(payload.sub));
    if (!user) {
      throw new AuthFailureError("Invalid token");
    }

    // Create new tokens
    const tokens = await createTokens(user);
    const userData = await filterUserData(user);

    const options = {
      httpOnly: true,
      secure: environment === "production",
      sameSite: environment === "production" ? "strict" as const : "lax" as const,
      maxAge: Number(cookieValidity),
    };

    res
      .cookie("accessToken", tokens.accessToken, options)
      .cookie("refreshToken", tokens.refreshToken, options);

    new SuccessResponse("Token refreshed successfully", {
      user: userData,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    }).send(res);
  } catch (error) {
    throw new AuthFailureError("Invalid or expired refresh token");
  }
});

const changePassword = asyncHandler(async (req: ProtectedRequest, res: Response) => {
  const userId = req.user._id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new BadRequestError("Both current and new passwords are required");
  }

  if (newPassword.length < 6) {
    throw new BadRequestError("New password must be at least 6 characters long");
  }

  // Get current user with password
  const user = await userRepo.findByIdWithPassword(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Debug: Check if password exists
  console.log("User password exists:", !!user.password);
  console.log("User password type:", typeof user.password);
  
  if (!user.password) {
    throw new BadRequestError("User password not set. Please contact support.");
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new BadRequestError("Current password is incorrect");
  }

  // Hash new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  await userRepo.findByIdAndUpdate(userId, { password: hashedNewPassword });

  new SuccessResponse("Password changed successfully", {}).send(res);
});

const getCurrentUser = asyncHandler(async (req: ProtectedRequest, res: Response) => {
  const userId = req.user._id;
  
  const user = await userRepo.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  const userData = await filterUserData(user);
  new SuccessResponse("User profile retrieved successfully", userData).send(res);
});

const updateUserStatus = asyncHandler(async (req: ProtectedRequest, res: Response) => {
  const userId = req.user._id;
  const { status, statusMessage } = req.body;

  // Validate status
  if (typeof status !== 'boolean') {
    throw new BadRequestError('Status must be a boolean value');
  }

  const updateData: Partial<User> = {
    status,
    lastSeen: new Date(),
  };

  // Update status message if provided
  if (statusMessage !== undefined) {
    updateData.statusMessage = statusMessage;
  }

  // Update user status
  const updatedUser = await userRepo.findByIdAndUpdate(userId, updateData);
  if (!updatedUser) {
    throw new NotFoundError('User not found');
  }

  // Prepare status update data
  const statusUpdateData = {
    userId: userId.toString(),
    username: updatedUser.username,
    status: status,
    statusMessage: statusMessage || updatedUser.statusMessage,
    lastSeen: updateData.lastSeen,
    timestamp: new Date().toISOString(),
  };

  // Emit status update event
  const eventType = status ? ChatEventEnum.USER_ONLINE : ChatEventEnum.USER_OFFLINE;
  
  // Get socket.io instance and broadcast more efficiently
  const io = req.app.get("io") as any;
  if (io && io.sockets) {
    // Broadcast to all connected sockets except the user themselves
    io.sockets.emit(ChatEventEnum.USER_STATUS_UPDATE, statusUpdateData);
    io.sockets.emit(eventType, statusUpdateData);
    
    // Also emit to user's personal room for confirmation
    emitSocketEvent(req, userId.toString(), ChatEventEnum.USER_STATUS_UPDATE, {
      ...statusUpdateData,
      self: true // Mark as self-update
    });
    
    console.log(`📡 Broadcasted ${eventType} for user: ${updatedUser.username}`);
  }

  const userData = await filterUserData(updatedUser);
  new SuccessResponse('User status updated successfully', { 
    user: userData,
    status: status,
    statusMessage: statusMessage || updatedUser.statusMessage
  }).send(res);
});

export { signUp, login, logout, refreshToken, updateProfile, updateAvatar, changePassword, getCurrentUser, updateUserStatus };
