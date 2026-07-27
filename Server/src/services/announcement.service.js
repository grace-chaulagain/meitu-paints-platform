import sanitizeHtml from "sanitize-html";

import ApiError from "../utils/apiError.js";
import Announcement from "../models/Announcement.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher, { DISPATCHER_STATUS } from "../models/Dispatcher.model.js";
import User from "../models/User.model.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import { sendMail, renderEmailShell } from "../utils/email.js";

// Email clients only reliably honor inline styles, not classes/stylesheets,
// and the composer's rich-text output (Tiptap) carries no styling of its
// own - transformTags rewrites each allowed semantic tag to also carry the
// exact inline style the shared email shell uses elsewhere, so a bold/list/
// link written in the composer renders consistently regardless of what the
// editor emitted.
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

const SANITIZE_OPTIONS = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"],
  // `style` is only ever set by transformTags below, never accepted
  // directly from the composer's input - transformTags's own output is
  // still subject to this allowlist, so `style` has to be explicitly
  // permitted here for the injected styling to survive.
  allowedAttributes: {
    p: ["style"],
    ul: ["style"],
    ol: ["style"],
    li: ["style"],
    a: ["href", "style"],
    strong: ["style"],
    b: ["style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    p: sanitizeHtml.simpleTransform("p", {
      style: `margin:0 0 12px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;color:#474747;`,
    }),
    ul: sanitizeHtml.simpleTransform("ul", {
      style: `margin:0 0 12px;padding-left:20px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;color:#474747;`,
    }),
    ol: sanitizeHtml.simpleTransform("ol", {
      style: `margin:0 0 12px;padding-left:20px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.7;color:#474747;`,
    }),
    li: sanitizeHtml.simpleTransform("li", { style: "margin-bottom:4px;" }),
    a: sanitizeHtml.simpleTransform("a", { style: "color:#0071e3;text-decoration:none;" }),
    strong: sanitizeHtml.simpleTransform("strong", { style: "font-weight:700;color:#1d1d1f;" }),
    b: sanitizeHtml.simpleTransform("b", { style: "font-weight:700;color:#1d1d1f;" }),
  },
};

function sanitizeBodyHtml(html) {
  return sanitizeHtml(String(html || ""), SANITIZE_OPTIONS).trim();
}

function normalizeAudience(value) {
  const audience = String(value || "").trim().toUpperCase();
  if (!["DEALERS", "DISPATCHERS", "BOTH"].includes(audience)) {
    throw new ApiError(400, "audience must be DEALERS, DISPATCHERS, or BOTH");
  }
  return audience;
}

function normalizeRecipientMode(value) {
  const mode = String(value || "").trim().toUpperCase();
  if (!["ALL", "SELECTED"].includes(mode)) {
    throw new ApiError(400, "recipientMode must be ALL or SELECTED");
  }
  return mode;
}

async function resolveDealerRecipients({ recipientMode, dealerIds = [] }) {
  const query =
    recipientMode === "ALL"
      ? { status: DEALER_STATUS.VERIFIED }
      : { _id: { $in: dealerIds } };

  const dealers = await DealerProfile.find(query)
    .select("companyName contactName email")
    .lean();

  return dealers
    .filter((dealer) => dealer.email)
    .map((dealer) => ({
      role: "DEALER",
      refId: dealer._id,
      name: dealer.companyName || dealer.contactName || "Dealer",
      email: dealer.email,
    }));
}

async function resolveDispatcherRecipients({ recipientMode, dispatcherIds = [] }) {
  const query =
    recipientMode === "ALL"
      ? { status: DISPATCHER_STATUS.VERIFIED }
      : { _id: { $in: dispatcherIds } };

  const dispatchers = await Dispatcher.find(query)
    .select("name companyName email")
    .lean();

  return dispatchers
    .filter((dispatcher) => dispatcher.email)
    .map((dispatcher) => ({
      role: "DISPATCHER",
      refId: dispatcher._id,
      name: dispatcher.companyName || dispatcher.name || "Dispatcher",
      email: dispatcher.email,
    }));
}

async function resolveRecipients({ audience, recipientMode, dealerIds, dispatcherIds }) {
  const groups = [];

  if (audience === "DEALERS" || audience === "BOTH") {
    groups.push(resolveDealerRecipients({ recipientMode, dealerIds }));
  }
  if (audience === "DISPATCHERS" || audience === "BOTH") {
    groups.push(resolveDispatcherRecipients({ recipientMode, dispatcherIds }));
  }

  const resolved = await Promise.all(groups);
  return resolved.flat();
}

function buildAnnouncementEmailHtml({ subject, bodyHtml, recipientName }) {
  return renderEmailShell({
    preheader: subject,
    eyebrow: "Announcement",
    title: subject,
    intro: `Hello ${recipientName || "there"},`,
    bodyHtml: `<div style="margin-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.7;color:#474747;">${bodyHtml}</div>`,
    footerNote:
      "This announcement was sent by the Meitu Paints team to dealers and dispatchers in the Meitu Paints network.",
  });
}

// Renders the announcement email HTML without sending - used by the
// composer's live preview so it stays byte-identical to the real send.
export function previewAnnouncementEmail({ subject, bodyHtml, recipientName = "there" }) {
  if (!subject) throw new ApiError(400, "Subject is required");

  return {
    html: buildAnnouncementEmailHtml({
      subject,
      bodyHtml: sanitizeBodyHtml(bodyHtml),
      recipientName,
    }),
  };
}

export async function sendAdminAnnouncement({
  subject,
  bodyHtml,
  audience,
  recipientMode,
  dealerIds = [],
  dispatcherIds = [],
  adminUser,
}) {
  const normalizedSubject = String(subject || "").trim();
  if (!normalizedSubject) throw new ApiError(400, "Subject is required");

  const cleanBodyHtml = sanitizeBodyHtml(bodyHtml);
  if (!cleanBodyHtml) throw new ApiError(400, "Message body is required");

  const normalizedAudience = normalizeAudience(audience);
  const normalizedMode = normalizeRecipientMode(recipientMode);

  const recipients = await resolveRecipients({
    audience: normalizedAudience,
    recipientMode: normalizedMode,
    dealerIds,
    dispatcherIds,
  });

  if (!recipients.length) {
    throw new ApiError(400, "No recipients matched this audience selection");
  }

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendMail({
        to: recipient.email,
        subject: normalizedSubject,
        text: normalizedSubject,
        html: buildAnnouncementEmailHtml({
          subject: normalizedSubject,
          bodyHtml: cleanBodyHtml,
          recipientName: recipient.name,
        }),
      }),
    ),
  );

  const recipientRecords = recipients.map((recipient, index) => {
    const result = results[index];
    const ok = result.status === "fulfilled" && result.value !== false;
    return {
      role: recipient.role,
      refId: recipient.refId,
      name: recipient.name,
      email: recipient.email,
      status: ok ? "SENT" : "FAILED",
      error: ok ? "" : result.reason?.message || "Send failed",
    };
  });

  const sentByUserId = adminUser?.id || adminUser?._id || null;
  // req.user (set by auth.middleware.js) never carries email, only id/role/
  // dealerId/dispatcherId - look it up so the audit trail is meaningful.
  const sentByUser = sentByUserId
    ? await User.findById(sentByUserId).select("email").lean()
    : null;

  const announcement = await Announcement.create({
    subject: normalizedSubject,
    bodyHtml: cleanBodyHtml,
    audience: normalizedAudience,
    recipientMode: normalizedMode,
    recipients: recipientRecords,
    sentByUserId,
    sentByLabel: sentByUser?.email || "",
  });

  return {
    announcement,
    totalRecipients: recipientRecords.length,
    successCount: recipientRecords.filter((r) => r.status === "SENT").length,
    failureCount: recipientRecords.filter((r) => r.status === "FAILED").length,
  };
}

export async function listAdminAnnouncements({ limit = 20, cursor } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const query = cursor ? { _id: { $lt: cursor } } : {};

  const items = await Announcement.find(query)
    .sort({ _id: -1 })
    .limit(boundedLimit)
    .lean();

  return {
    items,
    nextCursor: items.length === boundedLimit ? items[items.length - 1]._id : null,
  };
}
