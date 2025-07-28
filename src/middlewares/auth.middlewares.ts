import asyncHandler from "../helpers/asyncHandler";
import {
  AccessTokenError,
  AuthFailureError,
  BadTokenError,
  TokenExpiredError,
} from "../core/ApiError";
import JWT from "../core/JWT";
import userRepo from "../database/repositories/userRepo";
import { Types } from "mongoose";
import { ProtectedRequest } from "../types/app-request";
import { Response, NextFunction } from "express";

export const verifyJWT = asyncHandler(
  async (req: ProtectedRequest, res: Response, next: NextFunction) => {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new BadTokenError("No token provided");
    }

    try {
      // Use validateToken instead of decodeToken to check expiration
      const decodedToken = await JWT.validateToken(token);
      const userData = await userRepo.findById(
        new Types.ObjectId(decodedToken.sub)
      );

      if (!userData) {
        throw new AuthFailureError("User not found");
      }

      req.user = userData;
      console.log(`✅ Auth middleware: User ${userData.username} (${userData._id}) authenticated successfully`);

      next();
    } catch (error) {
      console.log(`❌ Auth middleware error: ${error}`);
      if (error instanceof TokenExpiredError) {
        throw new AccessTokenError("Access token expired");
      }
      if (error instanceof BadTokenError) {
        throw new AccessTokenError("Invalid access token");
      }
      throw new AuthFailureError("Authentication failed");
    }
  }
);
