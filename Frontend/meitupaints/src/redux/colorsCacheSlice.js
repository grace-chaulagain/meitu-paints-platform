import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  initialized: false,
  items: [],
  lastPreparedAt: null,
};

const colorsCacheSlice = createSlice({
  name: "colorsCache",
  initialState,
  reducers: {
    setPreparedColors(state, action) {
      state.items = Array.isArray(action.payload) ? action.payload : [];
      state.initialized = true;
      state.lastPreparedAt = Date.now();
    },
    clearColorsCache(state) {
      state.items = [];
      state.initialized = false;
      state.lastPreparedAt = null;
    },
  },
});

export const { setPreparedColors, clearColorsCache } = colorsCacheSlice.actions;

export const selectPreparedColors = (state) => state.colorsCache?.items || [];
export const selectColorsCacheInitialized = (state) =>
  Boolean(state.colorsCache?.initialized);

export default colorsCacheSlice.reducer;
