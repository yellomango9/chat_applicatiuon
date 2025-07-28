import express, { Request, Response, NextFunction } from "express";
import { login, logout, signUp, refreshToken, updateProfile, updateAvatar, changePassword, getCurrentUser, updateUserStatus } from "../controllers/user.controller";
import {
  userLoginValidator,
  userRegisterValidator,
  userProfileUpdateValidator,
  changePasswordValidator,
  userStatusUpdateValidator,
} from "../validators/user.validators";
import { validate } from "../validators/validate";
import { verifyJWT } from "../middlewares/auth.middlewares";
import { upload } from "../helpers/multer";

const router = express.Router();

router.post("/register", userRegisterValidator(), validate, signUp);
router.post("/login", userLoginValidator(), validate, login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

// Protected routes (require authentication)
router.use(verifyJWT);
router.get("/profile", getCurrentUser);
router.put("/profile", userProfileUpdateValidator(), validate, updateProfile);
router.post("/avatar", upload.single("avatar"), updateAvatar);
router.post("/change-password", changePasswordValidator(), validate, changePassword);
router.put("/status", userStatusUpdateValidator(), validate, updateUserStatus);

export default router;
