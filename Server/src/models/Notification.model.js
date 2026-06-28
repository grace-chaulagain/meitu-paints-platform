import mongoose from "mongoose";
import { ROLES } from "../constants/roles.js";

export const NOTIFICATION_CATEGORY = Object.freeze({
  DEALER_REGISTRATION: "DEALER_REGISTRATION",
  DISPATCHER_REGISTRATION: "DISPATCHER_REGISTRATION",
  FACTORY_ORDER: "FACTORY_ORDER",
  ASSIGNED_DEALER_ORDER: "ASSIGNED_DEALER_ORDER",
});

const NotificationReadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: false },
);

const NotificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: [ROLES.ADMIN, ROLES.DISPATCHER, ROLES.FACTORY],
      required: true,
      index: true,
    },

    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    category: {
      type: String,
      enum: Object.values(NOTIFICATION_CATEGORY),
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },

    targetUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    dealerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerProfile",
      default: null,
      index: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    dispatcherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatcher",
      default: null,
      index: true,
    },

    dealerApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DealerApplication",
      default: null,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    readBy: {
      type: [NotificationReadSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

NotificationSchema.index({ recipientRole: 1, createdAt: -1 });
NotificationSchema.index({
  recipientRole: 1,
  recipientUserId: 1,
  category: 1,
  createdAt: -1,
});
NotificationSchema.index({ "readBy.userId": 1 });

NotificationSchema.pre("validate", function normalizeNotificationFields() {
  if (typeof this.recipientRole === "string") {
    this.recipientRole = this.recipientRole.trim().toUpperCase();
  }

  if (typeof this.category === "string") {
    this.category = this.category.trim().toUpperCase();
  }

  if (typeof this.title === "string") {
    this.title = this.title.replace(/\s+/g, " ").trim();
  }

  if (typeof this.description === "string") {
    this.description = this.description.replace(/\s+/g, " ").trim();
  }
});

export default mongoose.model("Notification", NotificationSchema);
