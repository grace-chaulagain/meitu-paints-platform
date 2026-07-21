import { Router } from "express";

import {
  getVapidPublicKeyController,
  subscribePushController,
  unsubscribePushController,
} from "../controllers/push.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";

const router = Router();

// Public key is not secret by design - the browser needs it to create a
// push subscription, but it doesn't need to be an admin to read it.
router.get("/vapid-public-key", getVapidPublicKeyController);

router.use(auth, requireRole("ADMIN"));

router.post("/subscribe", subscribePushController);
router.post("/unsubscribe", unsubscribePushController);

export default router;
