import { model, Schema, Types } from "mongoose";
import Role from "./Role";

export const DOCUMENT_NAME = "User";

export default interface User {
  _id: Types.ObjectId;
  username: string;
  email: string;
  password: string;
  avatarUrl?: string;
  bio?: string;
  status?: boolean;
  statusMessage?: string;
  lastSeen?: Date;
  roles: Role[];
  // E2EE Fields
  publicKey?: string; // RSA public key for E2EE
  keyGeneratedAt?: Date; // When the key was generated
  keyVersion?: number; // Version of the key for rotation
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<User>({
  username: {
    type: Schema.Types.String,
    unique: true,
    required: true,
    trim: true,
    maxlength: 200,
  },

  email: {
    type: Schema.Types.String,
    unique: true,
    required: true,
    trim: true,
    maxlength: 200,
  },

  password: {
    type: Schema.Types.String,
    required: true,
    trim: true,
    select: false,
    maxlength: 200,
  },

  avatarUrl: {
    type: Schema.Types.String,
    trim: true,
  },

  bio: {
    type: Schema.Types.String,
    trim: true,
    maxlength: 200,
  },

  status: {
    type: Schema.Types.Boolean,
    default: true,
  },

  statusMessage: {
    type: Schema.Types.String,
    trim: true,
    maxlength: 100,
    default: "Available"
  },

  lastSeen: {
    type: Schema.Types.Date,
    default: Date.now,
  },

  roles: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Role",
      },
    ],
    required: true,
    select: false,
  },

  // E2EE Fields
  publicKey: {
    type: Schema.Types.String,
    trim: true,
    maxlength: 2048, // RSA public key in PEM format
  },

  keyGeneratedAt: {
    type: Schema.Types.Date,
  },

  keyVersion: {
    type: Schema.Types.Number,
    default: 1,
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

// Add index for efficient public key lookups
schema.index({ _id: 1, publicKey: 1 });

export const UserModel = model<User>(DOCUMENT_NAME, schema);