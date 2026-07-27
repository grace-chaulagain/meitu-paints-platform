import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { requireRoleWithReadOnlyAdmin } from "../middlewares/requireRole.middleware.js";
import {
  sendAnnouncement,
  listAnnouncements,
  previewAnnouncement,
} from "../controllers/announcement.controller.js";

const router = Router();

router.use(auth, requireRoleWithReadOnlyAdmin("ADMIN"));

router.get("/", listAnnouncements);
router.post("/send", sendAnnouncement);
router.post("/preview", previewAnnouncement);

export default router;
