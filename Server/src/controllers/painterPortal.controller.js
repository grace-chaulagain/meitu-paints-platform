import { asyncHandler } from "../utils/asyncHandler.js";
import * as painterPortalService from "../services/painterPortal.service.js";

/* -----------------------------
   Admin: gifts
----------------------------- */

export const listGiftsController = asyncHandler(async (req, res) => {
  const activeOnly = String(req.query?.activeOnly || "") === "true";
  const out = await painterPortalService.listGifts({ activeOnly });
  res.status(200).json({ ok: true, ...out });
});

export const createGiftController = asyncHandler(async (req, res) => {
  const item = await painterPortalService.createGift(req.body || {});
  res.status(201).json({ ok: true, item });
});

export const updateGiftController = asyncHandler(async (req, res) => {
  const item = await painterPortalService.updateGift({ giftId: req.params?.giftId, patch: req.body || {} });
  res.status(200).json({ ok: true, item });
});

export const deleteGiftController = asyncHandler(async (req, res) => {
  const out = await painterPortalService.deleteGift({ giftId: req.params?.giftId });
  res.status(200).json({ ok: true, ...out });
});

export const uploadGiftImageController = asyncHandler(async (req, res) => {
  const item = await painterPortalService.uploadGiftImage({ giftId: req.params?.giftId, file: req.file });
  res.status(200).json({ ok: true, item });
});

/* -----------------------------
   Admin: portal settings
----------------------------- */

export const getPortalSettingsController = asyncHandler(async (_req, res) => {
  const item = await painterPortalService.getPortalSettings();
  res.status(200).json({ ok: true, item });
});

export const updatePortalSettingsController = asyncHandler(async (req, res) => {
  const item = await painterPortalService.updatePortalSettings(req.body || {});
  res.status(200).json({ ok: true, item });
});

/* -----------------------------
   Public: the painter portal itself
----------------------------- */

export const painterLookupController = asyncHandler(async (req, res) => {
  const out = await painterPortalService.lookupPainterForPortal({ query: req.query?.q });
  res.status(200).json({ ok: true, ...out });
});
