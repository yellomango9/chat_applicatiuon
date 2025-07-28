import express from "express";
import { login, signUp, logout, refreshToken } from "../controllers/user.controller";
import {
  userLoginValidator,
  userRegisterValidator,
} from "../validators/user.validators";
import { validate } from "../validators/validate";

const router = express.Router();

// Auth routes (matching client expectations)
router.post("/register", userRegisterValidator(), validate, signUp);
router.post("/login", userLoginValidator(), validate, login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

export default router;