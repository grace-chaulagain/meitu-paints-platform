import { createSlice } from "@reduxjs/toolkit";

// Holds the most recently generated coupon batch (with the raw one-time
// redeemUrl per coupon) so it survives navigating away from the Coupons page
// and back, AND a full page reload - mirrored into sessionStorage rather
// than kept purely in memory. This is a deliberate, narrower trade-off than
// localStorage: sessionStorage is wiped the moment the browser tab/window
// closes, so a live, spendable redeem token never outlives the session it
// was generated in. It's still never persisted to any longer-lived storage
// (no localStorage, never sent back to the server) - only "survive a
// reload/refresh within this same tab" is being added here.
const STORAGE_KEY = "meitu.admin.coupons.lastGeneratedBatch";

function readStoredBatch() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredBatch(batch) {
  try {
    if (batch) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(batch));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sessionStorage can fail in private-browsing/storage-restricted
    // contexts - the batch still works for the rest of this page session
    // via Redux state, it just won't survive a reload in that case.
  }
}

const initialState = {
  lastBatch: readStoredBatch(),
};

const couponBatchSlice = createSlice({
  name: "couponBatch",
  initialState,
  reducers: {
    setLastGeneratedBatch(state, action) {
      state.lastBatch = action.payload;
      writeStoredBatch(action.payload);
    },
    clearLastGeneratedBatch(state) {
      state.lastBatch = null;
      writeStoredBatch(null);
    },
  },
});

export const { setLastGeneratedBatch, clearLastGeneratedBatch } = couponBatchSlice.actions;

export const selectLastGeneratedBatch = (state) => state.couponBatch?.lastBatch || null;

export default couponBatchSlice.reducer;
