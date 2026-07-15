import mongoose from "mongoose";

// Singleton document, same pattern as AdminNotificationSettings.model.js.
// One global cash-per-point weight factor: cashAmount = points * weightFactor.
const CouponRewardSettingsSchema = new mongoose.Schema(
  {
    weightFactor: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("CouponRewardSettings", CouponRewardSettingsSchema);
