import mongoose from "mongoose";

// One record per admin-composed broadcast to the dealer/dispatcher network.
// `recipients[]` is the full audit snapshot for that specific send - total/
// success/failure counts are derived from its length/status on read, not
// stored redundantly.
const AnnouncementRecipientSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["DEALER", "DISPATCHER"], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    status: { type: String, enum: ["SENT", "FAILED"], required: true },
    error: { type: String, default: "" },
  },
  { _id: false },
);

const AnnouncementSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, trim: true },

    // Sanitized rich-text HTML (server-side allowlist via sanitize-html) -
    // this is the exact content rendered into the shared email shell.
    bodyHtml: { type: String, required: true },

    audience: {
      type: String,
      enum: ["DEALERS", "DISPATCHERS", "BOTH"],
      required: true,
    },

    recipientMode: {
      type: String,
      enum: ["ALL", "SELECTED"],
      required: true,
    },

    recipients: { type: [AnnouncementRecipientSchema], default: [] },

    sentByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Email snapshot - survives the admin user account later being deleted.
    sentByLabel: { type: String, default: "" },
  },
  { timestamps: true },
);

AnnouncementSchema.index({ createdAt: -1 });

export default mongoose.model("Announcement", AnnouncementSchema);
