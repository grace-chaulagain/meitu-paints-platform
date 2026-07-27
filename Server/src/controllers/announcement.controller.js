import {
  sendAdminAnnouncement,
  listAdminAnnouncements,
  previewAnnouncementEmail,
} from "../services/announcement.service.js";

function handleError(res, error, fallback = "Request failed") {
  return res.status(400).json({
    ok: false,
    message: error.message || fallback,
  });
}

export async function sendAnnouncement(req, res) {
  try {
    const { subject, bodyHtml, audience, recipientMode, dealerIds, dispatcherIds } = req.body || {};
    const item = await sendAdminAnnouncement({
      subject,
      bodyHtml,
      audience,
      recipientMode,
      dealerIds,
      dispatcherIds,
      adminUser: req.user,
    });
    return res.json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to send announcement");
  }
}

export async function listAnnouncements(req, res) {
  try {
    const { limit, cursor } = req.query || {};
    const item = await listAdminAnnouncements({ limit, cursor });
    return res.json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to fetch announcements");
  }
}

export async function previewAnnouncement(req, res) {
  try {
    const { subject, bodyHtml, recipientName } = req.body || {};
    const item = previewAnnouncementEmail({ subject, bodyHtml, recipientName });
    return res.json({ ok: true, item });
  } catch (error) {
    return handleError(res, error, "Failed to render preview");
  }
}
