import { Schema, Types, model } from "mongoose";

export const DOCUMENT_NAME = "Chat";

export default interface Chat {
  _id: Types.ObjectId;
  name: string;
  isGroupChat: boolean;
  isDefault?: boolean; // New field for default groups
  lastMessage?: Types.ObjectId;
  lastMessageText?: string;
  lastMessageTimestamp?: Date;
  lastMessageSender?: Types.ObjectId;
  lastMessageType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'other';
  participants: Types.ObjectId[];
  admin: Types.ObjectId;
  unreadCount?: Map<string, number>; // userId -> unread count
  createdAt?: Date;
  updatedAt?: Date;
}

// make the the chat interface partial so we  can update selective fields
export type UpdateChatFields = Partial<Chat>;

// define the schema for corresponding document interface
const schema = new Schema<Chat>({
  name: {
    type: Schema.Types.String,
    required: true,
    trim: true,
    maxlength: 200,
  },

  isGroupChat: {
    type: Schema.Types.Boolean,
    default: false,
    required: true,
  },

  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: "Message",
  },

  lastMessageText: {
    type: Schema.Types.String,
    maxlength: 500,
  },

  lastMessageTimestamp: {
    type: Schema.Types.Date,
  },

  lastMessageSender: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  lastMessageType: {
    type: Schema.Types.String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'other'],
    default: 'text',
  },

  participants: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    required: true,
  },

  unreadCount: {
    type: Map,
    of: Schema.Types.Number,
    default: new Map(),
  },

  admin: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  isDefault: {
    type: Schema.Types.Boolean,
    default: false,
  },

  createdAt: {
    type: Schema.Types.Date,
    default: Date.now,
  },

  updatedAt: {
    type: Schema.Types.Date,
    default: Date.now,
  },
});

// Index for efficient sorting by last message timestamp
schema.index({ lastMessageTimestamp: -1 });
schema.index({ participants: 1, lastMessageTimestamp: -1 });

// Pre-save middleware to update timestamps
schema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    // Only update updatedAt if lastMessageTimestamp is not being updated
    // This prevents timestamp conflicts during conversation updates
    if (!this.isModified('lastMessageTimestamp')) {
      this.updatedAt = new Date();
    }
  }
  next();
});
export const ChatModel = model<Chat>(DOCUMENT_NAME, schema);
