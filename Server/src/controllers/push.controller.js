import { asyncHandler } from "../utils/asyncHandler.js";
import * as pushService from "../services/pushNotification.service.js";

export const getVapidPublicKeyController = asyncHandler(async (_req, res) => {
  const publicKey = pushService.getVapidPublicKey();
  res.status(200).json({ ok: true, publicKey });
});

export const subscribePushController = asyncHandler(async (req, res) => {
  const { subscription } = req.body || {};
  const item = await pushService.saveSubscription({
    userId: req.user?.id || req.user?.sub,
    subscription,
    userAgent: req.headers["user-agent"],
  });

  res.status(200).json({ ok: true, item });
});

export const unsubscribePushController = asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  const out = await pushService.removeSubscription({ endpoint });

  res.status(200).json({ ok: true, ...out });
});
