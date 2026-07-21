import mongoose from "mongoose";

// One document per (user, browser) - the same admin logged in on two
// machines gets two subscriptions, both targeted on send. `endpoint` is
// unique per browser/device by the push service's own design, so it
// doubles as the natural dedupe key for re-subscribing (e.g. after
// clearing site data).
const PushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("PushSubscription", PushSubscriptionSchema);
