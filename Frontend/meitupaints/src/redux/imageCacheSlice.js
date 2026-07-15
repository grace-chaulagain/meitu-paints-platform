import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loaded: {},
  failed: {},
};

const imageCacheSlice = createSlice({
  name: "imageCache",
  initialState,
  reducers: {
    markImageLoaded(state, action) {
      const src = action.payload;
      if (!src) return;
      state.loaded[src] = Date.now();
      delete state.failed[src];
    },
    markImageFailed(state, action) {
      const src = action.payload;
      if (!src) return;
      state.failed[src] = Date.now();
    },
    clearImageCacheState(state) {
      state.loaded = {};
      state.failed = {};
    },
  },
});

export const { markImageLoaded, markImageFailed, clearImageCacheState } =
  imageCacheSlice.actions;

export const selectImageLoadedMap = (state) => state.imageCache?.loaded || {};
export const selectImageFailedMap = (state) => state.imageCache?.failed || {};

export default imageCacheSlice.reducer;
