import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares";
import {
  addNewUserToGroup,
  createGroupChat,
  createOrGetExistingChat,
  deleteChat,
  getCurrentUserChats,
  getGroupChatDetails,
  searchAvailableusers,
  getConversations,
  markConversationAsRead,
} from "../controllers/chat.controller";
import { mongoIdPathValidator } from "../validators/mongoId.validator";
import { validate } from "..//validators/validate";
import {
  createGroupChatValidator,
  updateGroupChatValidator,
} from "../validators/groupChat.validator";
const router = Router();

// authentication middleware for routes
router.use(verifyJWT);

// route to get searched users
router.route("/users").get(searchAvailableusers);

// route to create chat
router
  .route("/c/:receiverId")
  .post(mongoIdPathValidator("receiverId"), validate, createOrGetExistingChat);

// route to create new group chat
router
  .route("/group")
  .post(createGroupChatValidator(), validate, createGroupChat);

// route to fetch a group chat details
router
  .route("/group/:chatId")
  .get(mongoIdPathValidator("chatId"), validate, getGroupChatDetails)
  // add new user to group chat
  .put(updateGroupChatValidator(), validate, addNewUserToGroup);

// route to get existingUserChats
router.route("/").get(getCurrentUserChats);

// route to get conversations (WhatsApp-like sorted list)
router.route("/conversations").get(getConversations);

// route to mark conversation as read
router
  .route("/:chatId/read")
  .post(mongoIdPathValidator("chatId"), validate, markConversationAsRead);

router
  .route("/:chatId")
  .delete(mongoIdPathValidator("chatId"), validate, deleteChat);

export default router;
