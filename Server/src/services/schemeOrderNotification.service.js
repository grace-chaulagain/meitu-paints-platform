import { buildFactoryOrderUrl } from "../utils/orderLinks.js";
import {
  smtpConfigured,
  sendMail,
  renderEmailShell,
  renderDetailRows,
  renderItemsTable,
  renderCallout,
} from "../utils/email.js";
import { createFactoryNotification, NOTIFICATION_CATEGORY } from "./notification.service.js";
import { buildOrderSummaryPdfAttachment } from "./orderPdf.service.js";
import { buildFactoryRecipients } from "./order.service.js";

// A scheme is created already VERIFIED (the admin creating it IS the
// approval), so it never passes through the verification step that sends a
// normal order's factory bill email and factory in-app notification. This is
// that pair for the moment a scheme is created: the factory is told what to
// ship, with a deep link into its own portal.
//
// The recipient (dealer or dispatcher) is deliberately NOT emailed here - a
// grant announced before it exists in their hands is noise. They hear about it
// when it is dispatched and again when it is completed, through the ordinary
// status emails (sendDealerStatusEmail in factory.service.js), which are
// scheme-aware and link straight to that order in their portal.
//
// Everything here is best-effort and never throws to the caller: a mail
// hiccup must not undo (or even slow down) a scheme that already reserved
// factory stock.

const RECIPIENT_KIND_LABEL = Object.freeze({
  DEALER: "Dealer (factory-routed)",
  DEALER_VIA_DISPATCHER: "Dealer (dispatcher-served - ships direct from factory)",
  DISPATCHER: "Dispatcher",
});

function clean(value) {
  return String(value ?? "").trim();
}

function toPlain(order) {
  return typeof order?.toObject === "function" ? order.toObject() : order;
}

function totalUnits(order) {
  return (order?.items || []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0);
}

function recipientName(order) {
  const snap = order?.dealerSnapshot || {};
  return clean(snap.companyName) || clean(snap.contactName) || "Recipient";
}

function schemeName(order) {
  return clean(order?.scheme?.label);
}

function schemeNote(order) {
  return clean(order?.dealerNote) || clean(order?.scheme?.note);
}

export async function sendSchemeFactoryEmail(rawOrder, { recipientKind = "DEALER" } = {}) {
  const order = toPlain(rawOrder);
  if (!smtpConfigured()) {
    console.warn("[scheme-email] SMTP is not configured; skipped factory email.");
    return false;
  }

  const recipients = await buildFactoryRecipients();
  const orderNumber = clean(order.orderNumber);
  const label = schemeName(order);
  const note = schemeNote(order);
  const snap = order.dealerSnapshot || {};
  const factoryUrl = buildFactoryOrderUrl(order);

  const text = [
    `Scheme order ${orderNumber}${label ? ` - ${label}` : ""} is approved and waiting in the factory queue.`,
    "FREE OF COST - not a commercial sale.",
    "",
    `Recipient: ${recipientName(order)} (${RECIPIENT_KIND_LABEL[recipientKind] || recipientKind})`,
    `Contact: ${clean(snap.contactName)}`,
    `Phone: ${clean(snap.phone)}`,
    `Address: ${clean(snap.address)}`,
    "",
    "Items:",
    ...(order.items || []).map(
      (item, index) =>
        `${index + 1}. ${item.name} | ${item.packLabel || item.variantLabel || "-"} | Qty: ${item.quantity}`,
    ),
    `Total units: ${totalUnits(order)}`,
    note ? `\nNote: ${note}` : "",
    "",
    "PDF Attachment: The scheme order summary is attached.",
    `Open in the factory dashboard: ${factoryUrl}`,
  ].join("\n");

  const html = renderEmailShell({
    preheader: `Scheme order ${orderNumber} (free of cost) is waiting in the factory queue.`,
    eyebrow: "Scheme Order · Factory Processing",
    title: "New Scheme Order for Factory",
    intro:
      "An admin has approved a free-of-cost scheme grant. Please prepare and dispatch it like any other order - it carries no invoice value.",
    bodyHtml:
      renderDetailRows([
        { label: "Order Number", value: orderNumber },
        { label: "Scheme", value: label || "Free-of-cost grant" },
        { label: "Recipient", value: recipientName(order) },
        { label: "Recipient Type", value: RECIPIENT_KIND_LABEL[recipientKind] || recipientKind },
        { label: "Contact", value: snap.contactName },
        { label: "Phone", value: snap.phone },
        { label: "Address", value: snap.address },
      ]) + renderItemsTable({ items: order.items || [] }),
    calloutHtml: renderCallout(note, { label: "Note" }),
    ctaLabel: "Open in Factory Dashboard",
    ctaUrl: factoryUrl,
  });

  // The PDF is a courtesy copy - if it can't be rendered the factory still
  // needs to know what to ship, so send the email without it.
  let attachments = [];
  try {
    attachments = [await buildOrderSummaryPdfAttachment(order)];
  } catch (error) {
    console.warn("[scheme-email] summary PDF attachment failed, sending without it:", error?.message);
  }

  await sendMail({
    to: recipients,
    subject: `Scheme Order · ${orderNumber}${label ? ` · ${label}` : ""}`.trim(),
    text,
    html,
    attachments,
  });

  return true;
}

export async function createSchemeFactoryNotification(rawOrder) {
  const order = toPlain(rawOrder);
  const label = schemeName(order);

  return createFactoryNotification({
    category: NOTIFICATION_CATEGORY.FACTORY_ORDER,
    title: `Scheme order ${order.orderNumber || ""} sent to Factory`.trim(),
    description: `${recipientName(order)} - ${totalUnits(order)} units, free of cost${label ? ` (${label})` : ""}.`,
    targetUrl: `/factory/dashboard/orders?orderId=${encodeURIComponent(String(order._id))}`,
    dealerId: order.dealerId || null,
    orderId: order._id,
    metadata: {
      orderNumber: order.orderNumber || "",
      companyName: recipientName(order),
      total: 0,
      currency: order.totals?.currency || "NPR",
      scheme: label,
    },
  });
}

// Fans out the three notifications independently - one failing (say, the
// factory mailbox rejecting) never suppresses the others. Always resolves.
export async function notifySchemeOrderCreated(order, { recipientKind = "DEALER" } = {}) {
  const jobs = [
    ["factory notification", createSchemeFactoryNotification(order)],
    ["factory email", sendSchemeFactoryEmail(order, { recipientKind })],
  ];

  const results = await Promise.allSettled(jobs.map(([, promise]) => promise));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`[scheme-notify] ${jobs[index][0]} failed:`, result.reason?.message || result.reason);
    }
  });
  const summary = results.map((result, index) => ({ job: jobs[index][0], ok: result.status === "fulfilled" && result.value !== false }));
  console.log(
    `[scheme-notify] ${clean(order?.orderNumber)}: ` +
      summary.map((entry) => `${entry.job} ${entry.ok ? "sent" : "NOT sent"}`).join(", "),
  );
  return summary;
}
