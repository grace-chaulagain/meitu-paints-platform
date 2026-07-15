import mongoose from "mongoose";

// Minimal atomic sequence generator. One document per counter key
// (e.g. "invoice"), incremented via findOneAndUpdate's atomic $inc -
// safe under concurrent callers without a separate lock.
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model("Counter", CounterSchema);
