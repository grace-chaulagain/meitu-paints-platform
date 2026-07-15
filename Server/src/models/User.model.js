import mongoose from "mongoose";
import { ROLES } from "../constants/roles.js";

export const USER_ACCOUNT_STATUS = Object.freeze({
  PENDING_PASSWORD_SETUP: "PENDING_PASSWORD_SETUP",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
});

// One entry per concurrently-active login (tab, device, or automated
// client) - replaces a single scalar refresh-token slot on the user so
// that logging in from a second place doesn't invalidate every other
// active session. Each session rotates independently on refresh.
const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    previousTokenHash: { type: String, default: null },
    previousTokenValidUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true },
);

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: {
      type: String,
      default: null,
      select: false,
    },

    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },

    // Linked entities (only one is used depending on role)
    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
    },

    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
    },

    // Account state
    isActive: {
      type: Boolean,
      default: true,
    },

    accountStatus: {
      type: String,
      enum: Object.values(USER_ACCOUNT_STATUS),
      default: USER_ACCOUNT_STATUS.ACTIVE,
      index: true,
    },

    passwordSetAt: {
      type: Date,
      default: null,
    },

    invitationLastSentAt: {
      type: Date,
      default: null,
    },

    invitationExpiresAt: {
      type: Date,
      default: null,
    },

    sessions: {
      type: [SessionSchema],
      default: [],
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // Profile picture, uploaded to Cloudinary. publicId is kept alongside
    // url so a replacement upload can delete the previous image instead of
    // leaking orphaned assets.
    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  },
);

// Helpful indexes
UserSchema.index({ role: 1 });
UserSchema.index({ role: 1, accountStatus: 1 });
UserSchema.index({ dealerId: 1 });
UserSchema.index({ dispatcherId: 1 });

export default mongoose.model("User", UserSchema);
