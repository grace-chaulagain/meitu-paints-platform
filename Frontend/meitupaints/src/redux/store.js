import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import userReducer from "./userSlice";
import imageCacheReducer from "./imageCacheSlice.js";
import colorsCacheReducer from "./colorsCacheSlice.js";
import couponBatchReducer from "./couponBatchSlice.js";
import { meituApi } from "./api/meituApi.js";

export const store = configureStore({
  reducer: {
    user: userReducer,
    imageCache: imageCacheReducer,
    colorsCache: colorsCacheReducer,
    couponBatch: couponBatchReducer,
    [meituApi.reducerPath]: meituApi.reducer,
  },
  // Default thresholds (32ms) are tuned for typical app state - a generated
  // coupon batch can legitimately hold up to 5000 plain-serializable coupon
  // records, which trips the dev-only serializable/immutable check timers
  // even though nothing is actually wrong. Raising warnAfter (rather than
  // disabling the checks) keeps the safety net for genuine mistakes
  // elsewhere while not spamming the console for this one known-large,
  // known-serializable payload. Neither check runs in production builds.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { warnAfter: 256 },
      immutableCheck: { warnAfter: 256 },
    }).concat(meituApi.middleware),
});

// Enables refetchOnFocus/refetchOnReconnect below - without this, those
// options are silently inert (RTK Query needs the window focus/online
// listeners wired up explicitly, it doesn't do it on import).
setupListeners(store.dispatch);

export default store;
