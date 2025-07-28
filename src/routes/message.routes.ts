import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares";
import { mongoIdPathValidator } from "../validators/mongoId.validator";
import { validate } from "../validators/validate";
import {
  deleteMessage,
  getAllMessages,
  sendMessage,
  markMessageAsRead,
  markAllMessagesAsRead,
  getUnreadMessagesCount,
  getAllUnreadMessages
} from "../controllers/message.controller";
import { messagesValidator } from "../validators/messages.validator";
import { upload } from "../middlewares/multer.middlwares";

const router = Router();

// verify the jwt token with the verifyJWT middleware for all comming request at this route
router.use(verifyJWT);

// Get all unread messages across all chats
router.route("/unread").get(getAllUnreadMessages);

router
  .route("/:chatId")
  .get(mongoIdPathValidator("chatId"), validate, getAllMessages)
  .post(
    mongoIdPathValidator("chatId"),
    messagesValidator(),
    validate,
    upload.fields([{ name: "attachments", maxCount: 5 }]),
    sendMessage
  );

// Mark all messages in a chat as read
router
  .route("/:chatId/read")
  .post(mongoIdPathValidator("chatId"), validate, markAllMessagesAsRead);

// Get unread messages count for a specific chat
router
  .route("/:chatId/unread")
  .get(mongoIdPathValidator("chatId"), validate, getUnreadMessagesCount);

// Delete a message
router
  .route("/:messageId")
  .delete(mongoIdPathValidator("messageId"), validate, deleteMessage);

// Mark a specific message as read
router
  .route("/:messageId/read")
  .post(mongoIdPathValidator("messageId"), validate, markMessageAsRead);

export default router;
