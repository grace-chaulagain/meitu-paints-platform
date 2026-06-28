import { Router } from "express";

import {
  getNotificationSummaryController,
  listNotificationsController,
  markNotificationReadController,
  markNotificationsReadController,
} from "../controllers/notification.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/requireRole.middleware.js";

const router = Router();

router.use(auth, requireRole("ADMIN", "DISPATCHER", "FACTORY"));

router.get("/summary", getNotificationSummaryController);
router.get("/", listNotificationsController);
router.patch("/read", markNotificationsReadController);
router.patch("/:notificationId/read", markNotificationReadController);

export default router;
