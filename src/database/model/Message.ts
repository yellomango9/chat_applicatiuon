import { Schema, Types, model } from "mongoose";
import { getCurrentTimestamp, validateAndFixTimestamp } from "../../utils/timeUtils";

export const DOCUMENT_NAME = "Message";

export enum MessageStatus {
  PENDING = 'pending',
  SENDING = 'sending', 
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed'
}

export default interface Message {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  content?: string;
  attachments?: {
    fileMetadataId: Types.ObjectId; // Reference to FileMetadata (required)
    url?: string; // (optional, for quick access)
    originalName?: string; // Original file name
    type?: string; // File type/mime type
    size?: number; // File size in bytes
    localPath?: string; // Local file path
  }[];
  chat: Types.ObjectId;
  status: MessageStatus;
  readBy: Types.ObjectId[]; // Array of users who have read the message
  deliveredTo: Types.ObjectId[]; // Array of users who have received the message
  sentAt?: Date; // When message was sent to server
  deliveredAt?: Date; // When message was delivered to recipient(s)
  readAt?: Date; // When message was first read
  retryCount: number; // Number of retry attempts
  failureReason?: string; // Reason for failure if status is failed
  createdAt: Date;
  updatedAt: Date;
}



const schema = new Schema<Message>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  content: {
    type: Schema.Types.String,
    trim: false,
    maxlength: 100000,
  },

  attachments: {
    type: [
      {
        url: {
          type: Schema.Types.String,
          trim: true,
        },
        localPath: {
          type: Schema.Types.String,
          trim: true,
        },
        originalName: {
          type: Schema.Types.String,
          trim: true,
        },
        type: {
          type: Schema.Types.String,
          trim: true,
        },
        size: {
          type: Schema.Types.Number,
        },
        fileMetadataId: {
          type: Schema.Types.ObjectId,
          ref: "FileMetadata",
        },
      },
    ],
    default: [],
    // maxlength: 30, // max length to send a limited attachment
  },

  chat: {
    type: Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
  },

  status: {
    type: Schema.Types.String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.PENDING,
    required: true,
  },
  
  readBy: {
    type: [Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },

  deliveredTo: {
    type: [Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },

  sentAt: {
    type: Schema.Types.Date,
  },

  deliveredAt: {
    type: Schema.Types.Date,
  },

  readAt: {
    type: Schema.Types.Date,
  },

  retryCount: {
    type: Schema.Types.Number,
    default: 0,
    min: 0,
  },

  failureReason: {
    type: Schema.Types.String,
    trim: true,
  },
  
  createdAt: {
    type: Schema.Types.Date,
    default: getCurrentTimestamp,
    set: (value: any) => validateAndFixTimestamp(value),
  },
  updatedAt: {
    type: Schema.Types.Date,
    default: getCurrentTimestamp,
    set: (value: any) => validateAndFixTimestamp(value),
  },
});

// Add pre-save middleware to update the updatedAt field
schema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = getCurrentTimestamp();
  }
  // Always validate timestamps on save
  if (this.createdAt) {
    this.createdAt = validateAndFixTimestamp(this.createdAt);
  }
  if (this.updatedAt) {
    this.updatedAt = validateAndFixTimestamp(this.updatedAt);
  }
  next();
});

// Add pre-update middleware to update the updatedAt field
schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function() {
  this.set({ updatedAt: getCurrentTimestamp() });
});

// Add indexes for efficient queries
schema.index({ chat: 1, createdAt: -1 });
schema.index({ sender: 1, createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
schema.index({ chat: 1, status: 1 });
schema.index({ readBy: 1 });
schema.index({ deliveredTo: 1 });

export const MessageModel = model<Message>(DOCUMENT_NAME, schema);