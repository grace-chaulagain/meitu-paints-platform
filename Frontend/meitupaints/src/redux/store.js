import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import { meituApi } from "./api/meituApi.js";

export const store = configureStore({
  reducer: {
    user: userReducer,
    [meituApi.reducerPath]: meituApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(meituApi.middleware),
});

export default store;
