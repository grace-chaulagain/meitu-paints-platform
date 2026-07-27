import ApiError from "../utils/apiError.js";
import AdminNotificationSettings from "../models/AdminNotificationSettings.model.js";
import FactorySettings from "../models/FactorySettings.model.js";
import {
  createDealerRegistrationNotification,
  createDispatcherRegistrationNotification,
  createFactoryOrderNotification,
  createDispatcherNotification,
  resolveDispatcherRecipient,
  NOTIFICATION_CATEGORY,
} from "./notification.service.js";
import { buildPublicAppUrl } from "../utils/publicUrl.js";
import {
  smtpConfigured,
  sendMail,
  renderEmailShell,
  renderDetailRows,
} from "../utils/email.js";
import { NODE_ENV } from "../config/env.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function assertValidEmail(email, label) {
  if (!email) return;
  if (!EMAIL_RE.test(email)) {
    throw new ApiError(400, `${label} must be a valid email address`);
  }
}

function buildAppLink(path = "/") {
  return buildPublicAppUrl(normalizeText(path) || "/");
}

async function getSettingsDoc() {
  let settings = await AdminNotificationSettings.findOne({});

  if (!settings) {
    settings = await AdminNotificationSettings.create({
      adminEmail: normalizeEmail(process.env.ADMIN_NOTIFICATION_EMAIL || ""),
    });
  }

  return settings;
}

export async function getAdminNotificationSettings() {
  const [settings, factorySettings] = await Promise.all([
    getSettingsDoc(),
    FactorySettings.findOne({}).lean(),
  ]);

  return {
    adminEmail: settings.adminEmail || "",
    factoryEmail: factorySettings?.primaryEmail || "",
    notificationsEnabled: settings.notificationsEnabled !== false,
    dealerApplicationNotificationsEnabled:
      settings.dealerApplicationNotificationsEnabled !== false,
    dispatcherApplicationNotificationsEnabled:
      settings.dispatcherApplicationNotificationsEnabled !== false,
    factoryOrderNotificationsEnabled:
      settings.factoryOrderNotificationsEnabled !== false,
  };
}

export async function updateAdminNotificationSettings(payload = {}) {
  const settings = await getSettingsDoc();

  if (payload.adminEmail !== undefined) {
    const adminEmail = normalizeEmail(payload.adminEmail);
    assertValidEmail(adminEmail, "Admin notification email");
    settings.adminEmail = adminEmail;
  }

  if (payload.notificationsEnabled !== undefined) {
    settings.notificationsEnabled = Boolean(payload.notificationsEnabled);
  }

  if (payload.dealerApplicationNotificationsEnabled !== undefined) {
    settings.dealerApplicationNotificationsEnabled = Boolean(
      payload.dealerApplicationNotificationsEnabled,
    );
  }

  if (payload.dispatcherApplicationNotificationsEnabled !== undefined) {
    settings.dispatcherApplicationNotificationsEnabled = Boolean(
      payload.dispatcherApplicationNotificationsEnabled,
    );
  }

  if (payload.factoryOrderNotificationsEnabled !== undefined) {
    settings.factoryOrderNotificationsEnabled = Boolean(
      payload.factoryOrderNotificationsEnabled,
    );
  }

  await settings.save();

  if (payload.factoryEmail !== undefined) {
    const factoryEmail = normalizeEmail(payload.factoryEmail);
    assertValidEmail(factoryEmail, "Factory email");

    if (factoryEmail) {
      await FactorySettings.findOneAndUpdate(
        {},
        {
          $set: {
            primaryEmail: factoryEmail,
          },
          $setOnInsert: {
            name: "Meitu Factory",
            ccEmails: [],
            notificationsEnabled: true,
          },
        },
        { upsert: true, new: true },
      );
    }
  }

  return getAdminNotificationSettings();
}

export async function sendAdminNotificationTest() {
  const settings = await getSettingsDoc();

  if (!settings.adminEmail) {
    throw new ApiError(400, "Admin notification email is not configured");
  }

  if (!smtpConfigured()) {
    throw new ApiError(500, "SMTP is not configured");
  }

  const sentAt = new Date();
  const rows = [
    { label: "Recipient", value: settings.adminEmail },
    { label: "Environment", value: NODE_ENV },
    { label: "Sent At", value: sentAt.toLocaleString() },
  ];

  await sendMail({
    to: settings.adminEmail,
    subject: "Meitu Paints Admin Notification Test",
    text: rows.map((row) => `${row.label}: ${row.value || "-"}`).join("\n"),
    html: buildHtmlShell({
      eyebrow: "Notification Test",
      title: "Admin Notification Email Verified",
      body: "This confirms the admin notification recipient and SMTP configuration are working.",
      rows,
    }),
  });

  return {
    ok: true,
    to: settings.adminEmail,
    sentAt,
  };
}

// Thin adapter over the shared shell (utils/email.js) preserving this
// file's existing call-site shape ({eyebrow, title, body, rows, ctaUrl,
// ctaLabel}) across all 6 templates below, instead of rewriting each call
// site's params individually. `audience` (used to say "Meitu Paints
// Dispatcher" vs "...Admin" in the old gradient header) has no equivalent
// in the new shell - its fixed header is just the Meitu brand mark now, and
// each template's title/body already makes the audience obvious.
function buildHtmlShell({
  eyebrow,
  title,
  rows = [],
  body = "",
  footer = "This is an automated operational notification. It is separate from admin login credentials.",
  ctaUrl = "",
  ctaLabel = "",
}) {
  return renderEmailShell({
    eyebrow,
    title,
    intro: body,
    bodyHtml: renderDetailRows(rows),
    ctaUrl,
    ctaLabel,
    footerNote: footer,
  });
}

async function sendAdminNotification({ type, subject, text, html }) {
  try {
    const settings = await getSettingsDoc();

    if (settings.notificationsEnabled === false) return false;
    if (!settings.adminEmail) return false;

    if (
      type === "DEALER_APPLICATION" &&
      settings.dealerApplicationNotificationsEnabled === false
    ) {
      return false;
    }

    if (
      type === "DISPATCHER_APPLICATION" &&
      settings.dispatcherApplicationNotificationsEnabled === false
    ) {
      return false;
    }

    if (
      type === "FACTORY_ORDER" &&
      settings.factoryOrderNotificationsEnabled === false
    ) {
      return false;
    }

    return sendMail({
      to: settings.adminEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.warn("[admin-notification] email skipped:", error.message);
    return false;
  }
}

export function notifyDealerApplicationSubmitted(application) {
  createDealerRegistrationNotification(application).catch((error) => {
    console.warn("[notification] dealer application:", error.message);
  });

  const rows = [
    { label: "Company", value: application.companyName },
    { label: "Contact", value: application.contactName },
    { label: "Email", value: application.email },
    { label: "Phone", value: application.phone },
    { label: "PAN / VAT", value: application.panVat },
    { label: "Address", value: application.address },
    { label: "Notes", value: application.notes },
  ];
  const reviewUrl = buildAppLink("/admin/dashboard/applications/dealers");

  return sendAdminNotification({
    type: "DEALER_APPLICATION",
    subject: `New Dealer Application · ${application.companyName || "Meitu"}`,
    text: [
      ...rows.map((row) => `${row.label}: ${row.value || "-"}`),
      "",
      `Review: ${reviewUrl}`,
    ].join("\n"),
    html: buildHtmlShell({
      eyebrow: "Dealer Application",
      title: "New Dealer Application Submitted",
      body: "A new dealership request has been submitted and is ready for admin review.",
      rows,
      ctaUrl: reviewUrl,
      ctaLabel: "Open Dealer Review",
    }),
  });
}

export function notifyDispatcherApplicationSubmitted(dispatcher) {
  createDispatcherRegistrationNotification(dispatcher).catch((error) => {
    console.warn("[notification] dispatcher application:", error.message);
  });

  const rows = [
    { label: "Name", value: dispatcher.name },
    { label: "Company", value: dispatcher.companyName },
    { label: "Email", value: dispatcher.email },
    { label: "Phone", value: dispatcher.phone },
    { label: "Address", value: dispatcher.address },
    { label: "Notes", value: dispatcher.notes },
  ];
  const reviewUrl = buildAppLink("/admin/dashboard/applications/dispatchers");

  return sendAdminNotification({
    type: "DISPATCHER_APPLICATION",
    subject: `New Dispatcher Application · ${dispatcher.name || "Meitu"}`,
    text: [
      ...rows.map((row) => `${row.label}: ${row.value || "-"}`),
      "",
      `Review: ${reviewUrl}`,
    ].join("\n"),
    html: buildHtmlShell({
      eyebrow: "Dispatcher Application",
      title: "New Dispatcher Application Submitted",
      body: "A new dispatcher application has been submitted and is ready for admin review.",
      rows,
      ctaUrl: reviewUrl,
      ctaLabel: "Open Dispatcher Review",
    }),
  });
}

export function notifyFactoryOrderSubmitted(order) {
  if ((order?.dealerSnapshot?.fulfillmentMode || "FACTORY") !== "FACTORY") {
    return Promise.resolve(false);
  }

  createFactoryOrderNotification(order).catch((error) => {
    console.warn("[notification] factory order:", error.message);
  });

  const rows = [
    { label: "Order Number", value: order.orderNumber },
    { label: "Dealer", value: order.dealerSnapshot?.companyName },
    { label: "Contact", value: order.dealerSnapshot?.contactName },
    { label: "Email", value: order.dealerSnapshot?.email },
    { label: "Phone", value: order.dealerSnapshot?.phone },
    { label: "Payment", value: order.payment?.method },
    {
      label: "Total",
      value: `${order.totals?.currency || "NPR"} ${Number(
        order.totals?.total || 0,
      ).toLocaleString()}`,
    },
  ];
  const reviewUrl = buildAppLink(
    `/admin/dashboard/orders/${encodeURIComponent(String(order._id))}`,
  );

  return sendAdminNotification({
    type: "FACTORY_ORDER",
    subject: `New Factory-Routed Order · ${order.orderNumber || "Meitu"}`,
    text: [
      ...rows.map((row) => `${row.label}: ${row.value || "-"}`),
      "",
      `Review: ${reviewUrl}`,
    ].join("\n"),
    html: buildHtmlShell({
      eyebrow: "Factory Routed Order",
      title: "New Factory-Routed Dealer Order",
      body: "A factory-routed dealer has placed a new order. Dispatcher-routed orders are intentionally excluded from this admin email.",
      rows,
      ctaUrl: reviewUrl,
      ctaLabel: "Open Factory Order",
    }),
  });
}

export async function notifyAssignedDealerOrderSubmitted(order) {
  try {
    if ((order?.dealerSnapshot?.fulfillmentMode || "FACTORY") !== "DISPATCHER") {
      return false;
    }

    const recipient = await resolveDispatcherRecipient(order.dispatcherId);
    if (!recipient?.user?._id) {
      console.warn(
        `[dispatcher-notification] skipped order ${order?.orderNumber || ""}: assigned dispatcher recipient is missing or inactive`,
      );
      return false;
    }

    await createDispatcherNotification({
      recipientUserId: recipient.user._id,
      category: NOTIFICATION_CATEGORY.ASSIGNED_DEALER_ORDER,
      title: `New dealer order ${order.orderNumber || ""}`.trim(),
      description: `${order.dealerSnapshot?.companyName || "An assigned dealer"} placed a new order for dispatcher review.`,
      targetUrl: `/dispatcher/dashboard/orders/${encodeURIComponent(String(order._id))}`,
      dealerId: order.dealerId,
      orderId: order._id,
      dispatcherId: order.dispatcherId,
      metadata: {
        orderNumber: order.orderNumber || "",
        companyName: order.dealerSnapshot?.companyName || "",
        contactName: order.dealerSnapshot?.contactName || "",
        paymentMethod: order.payment?.method || "",
        total: order.totals?.total || 0,
        currency: order.totals?.currency || "NPR",
      },
    });

    const to = normalizeEmail(recipient.dispatcher.email || recipient.user.email);
    if (!to) {
      console.warn(
        `[dispatcher-notification] email skipped for ${order.orderNumber || ""}: dispatcher email is missing`,
      );
      return false;
    }

    const reviewUrl = buildAppLink(
      `/dispatcher/dashboard/orders/${encodeURIComponent(String(order._id))}`,
    );
    const placedAt = order.createdAt
      ? new Date(order.createdAt).toLocaleString()
      : new Date().toLocaleString();

    const rows = [
      { label: "Dealer", value: order.dealerSnapshot?.contactName },
      { label: "Company", value: order.dealerSnapshot?.companyName },
      { label: "Order Number", value: order.orderNumber },
      {
        label: "Order Total",
        value: `${order.totals?.currency || "NPR"} ${Number(
          order.totals?.total || 0,
        ).toLocaleString()}`,
      },
      { label: "Payment Method", value: order.payment?.method },
      { label: "Time Placed", value: placedAt },
    ];

    const text = [
      "A new order has been placed by one of your assigned dealers.",
      "",
      ...rows.map((row) => `${row.label}: ${row.value || "-"}`),
      "",
      `Review: ${reviewUrl}`,
    ].join("\n");

    return sendMail({
      to,
      subject: `New Assigned Dealer Order · ${order.orderNumber || "Meitu"}`,
      text,
      html: buildHtmlShell({
        eyebrow: "Assigned Dealer Order",
        title: "New Order Ready for Dispatcher Review",
        body: "A dealer assigned to your dispatcher account has placed a new order. Please log in to review the order details and continue the dispatcher workflow.",
        rows,
        footer:
          "This is an automated dispatcher notification for assigned dealer orders.",
        ctaUrl: reviewUrl,
        ctaLabel: "Open Assigned Order",
      }),
    });
  } catch (error) {
    console.warn("[dispatcher-notification] email skipped:", error.message);
    return false;
  }
}

// Dispatcher-only - a dealer routed to a dispatcher must never be told
// dispatchers exist at all (they only ever see "Meitu" as the counterpart),
// so this notifies the dispatcher and nobody else. Same shape as
// notifyAssignedDealerOrderSubmitted above: resolve the dispatcher
// recipient, create an in-app notification, then a best-effort email.
export async function notifyDispatcherDealerAssigned(dealer, dispatcherId) {
  try {
    const recipient = await resolveDispatcherRecipient(dispatcherId);
    if (!recipient?.user?._id) {
      console.warn(
        `[dispatcher-notification] skipped dealer-assigned notice for dealer ${dealer?._id || ""}: dispatcher recipient is missing or inactive`,
      );
      return false;
    }

    await createDispatcherNotification({
      recipientUserId: recipient.user._id,
      category: NOTIFICATION_CATEGORY.DEALER_ASSIGNED,
      title: `New dealer assigned: ${dealer?.companyName || "Dealer"}`.trim(),
      description: `${dealer?.companyName || "A dealer"} has been routed to you for order fulfillment.`,
      targetUrl: `/dispatcher/dashboard/dealers/${encodeURIComponent(String(dealer?._id || ""))}`,
      dealerId: dealer?._id || null,
      dispatcherId,
      metadata: {
        companyName: dealer?.companyName || "",
        contactName: dealer?.contactName || "",
        email: dealer?.email || "",
        phone: dealer?.phone || "",
      },
    });

    const to = normalizeEmail(recipient.dispatcher.email || recipient.user.email);
    if (!to) {
      console.warn(
        `[dispatcher-notification] email skipped for dealer ${dealer?._id || ""}: dispatcher email is missing`,
      );
      return false;
    }

    const dealerUrl = buildAppLink(
      `/dispatcher/dashboard/dealers/${encodeURIComponent(String(dealer?._id || ""))}`,
    );

    const rows = [
      { label: "Dealer", value: dealer?.contactName },
      { label: "Company", value: dealer?.companyName },
      { label: "Email", value: dealer?.email },
      { label: "Phone", value: dealer?.phone },
    ];

    const text = [
      "A new dealer has been assigned to your route.",
      "",
      ...rows.map((row) => `${row.label}: ${row.value || "-"}`),
      "",
      `View dealer: ${dealerUrl}`,
    ].join("\n");

    return sendMail({
      to,
      subject: `New Dealer Assigned · ${dealer?.companyName || "Meitu"}`,
      text,
      html: buildHtmlShell({
        eyebrow: "Dealer Routing",
        title: "A New Dealer Was Added To Your Route",
        body: "This dealer's orders will now come to you for review and fulfillment.",
        rows,
        footer: "This is an automated dispatcher notification for dealer routing changes.",
        ctaUrl: dealerUrl,
        ctaLabel: "View Dealer",
      }),
    });
  } catch (error) {
    console.warn("[dispatcher-notification] dealer-assigned email skipped:", error.message);
    return false;
  }
}
