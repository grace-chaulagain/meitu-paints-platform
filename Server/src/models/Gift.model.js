import mongoose from "mongoose";

// One rung of the painter points ladder: a gift a painter earns by reaching a
// points total in the fiscal year. Purely a target to aim at - nothing here is
// ever deducted from a painter's points, and reaching a gift writes nothing.
// Handing the gift over happens off the system, as it does today.
//
// Both names are stored because the painter portal is bilingual; nameNepali is
// optional, and the portal falls back to `name` when it is empty rather than
// showing a blank rung.
const GiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameNepali: { type: String, trim: true, default: "" },
    pointsRequired: { type: Number, required: true, min: 1 },

    // Same {url, publicId} shape the product catalog uses, so the Cloudinary
    // asset can be deleted along with the gift.
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // Hidden from the portal without losing the record - a gift withdrawn
    // mid-year should stop being advertised, not vanish from history.
    isActive: { type: Boolean, default: true, index: true },

    // Manual ordering for gifts that share a points total; the ladder is
    // otherwise ordered by pointsRequired, which is the order a painter
    // climbs it.
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

GiftSchema.index({ pointsRequired: 1, sortOrder: 1 });

export default mongoose.model("Gift", GiftSchema);
