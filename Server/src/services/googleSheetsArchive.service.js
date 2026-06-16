import crypto from "crypto";
import Order from "../models/Order.model.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_SHEET_NAME = "Verified Orders";

const HEADERS = [
  "Verified At",
  "Order Number",
  "Order ID",
  "Reviewed By Role",
  "Reviewed By User",
  "Fulfillment Mode",
  "Dealer Company",
  "Dealer Contact",
  "Dealer Email",
  "Dealer Phone",
  "Dispatcher Company",
  "Dispatcher Name",
  "Payment Method",
  "Currency",
  "Subtotal",
  "Discount",
  "Tax",
  "Total",
  "Item Count",
  "Items Summary",
  "Dealer Note",
  "Internal Note",
  "Review Note",
  "Submitted At",
];

let accessTokenCache = null;
const ensuredHeaderKeys = new Set();

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(value = "") {
  return String(value || "")
    .replace(/^"|"$/g, "")
    .replace(/\\n/g, "\n")
    .trim();
}

function getServiceAccountConfig() {
  let parsed = null;

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    parsed = JSON.parse(
      Buffer.from(
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
        "base64",
      ).toString("utf8"),
    );
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  const clientEmail =
    parsed?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const privateKey =
    parsed?.private_key || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";

  return {
    clientEmail: String(clientEmail || "").trim(),
    privateKey: normalizePrivateKey(privateKey),
  };
}

function getArchiveConfig() {
  return {
    enabled: envBool("GOOGLE_SHEETS_ORDER_ARCHIVE_ENABLED", false),
    spreadsheetId: String(
      process.env.GOOGLE_SHEETS_ORDER_ARCHIVE_SPREADSHEET_ID || "",
    ).trim(),
    sheetName: String(
      process.env.GOOGLE_SHEETS_ORDER_ARCHIVE_SHEET_NAME ||
        DEFAULT_SHEET_NAME,
    ).trim(),
    serviceAccount: getServiceAccountConfig(),
  };
}

function isConfigured(config) {
  return Boolean(
    config.enabled &&
      config.spreadsheetId &&
      config.sheetName &&
      config.serviceAccount.clientEmail &&
      config.serviceAccount.privateKey,
  );
}

function createJwtAssertion({ clientEmail, privateKey }) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(payload),
  )}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(privateKey);

  return `${unsigned}.${base64Url(signature)}`;
}

async function getAccessToken(serviceAccount) {
  if (
    accessTokenCache?.token &&
    accessTokenCache.expiresAt - 60 * 1000 > Date.now()
  ) {
    return accessTokenCache.token;
  }

  const assertion = createJwtAssertion(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        `Google OAuth failed with status ${response.status}`,
    );
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };

  return accessTokenCache.token;
}

function quoteSheetName(sheetName = DEFAULT_SHEET_NAME) {
  return `'${String(sheetName || DEFAULT_SHEET_NAME).replace(/'/g, "''")}'`;
}

function sheetsValuesUrl(spreadsheetId, range, suffix = "") {
  return `${SHEETS_API_BASE}/${encodeURIComponent(
    spreadsheetId,
  )}/values/${encodeURIComponent(range)}${suffix}`;
}

async function sheetsRequest({ token, method = "GET", url, body = null }) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        data?.message ||
        `Google Sheets request failed with status ${response.status}`,
    );
  }

  return data;
}

async function ensureHeader({ token, spreadsheetId, sheetName }) {
  const key = `${spreadsheetId}:${sheetName}`;
  if (ensuredHeaderKeys.has(key)) return;

  const headerRange = `${quoteSheetName(sheetName)}!A1:X1`;
  const getUrl = sheetsValuesUrl(spreadsheetId, headerRange);
  const current = await sheetsRequest({ token, url: getUrl });

  const firstRow = current?.values?.[0] || [];
  if (!firstRow.length) {
    const putUrl = `${getUrl}?valueInputOption=USER_ENTERED`;
    await sheetsRequest({
      token,
      method: "PUT",
      url: putUrl,
      body: {
        range: headerRange,
        majorDimension: "ROWS",
        values: [HEADERS],
      },
    });
  }

  ensuredHeaderKeys.add(key);
}

function dateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function numberValue(value) {
  const next = Number(value || 0);
  return Number.isFinite(next) ? next : 0;
}

function buildItemsSummary(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = clean(item?.name || item?.sku || "Item");
      const pack = clean(item?.packLabel || item?.variantLabel || item?.unit);
      const qty = numberValue(item?.quantity);
      const total = numberValue(item?.lineTotal);
      return `${name}${pack ? ` (${pack})` : ""} x ${qty} = ${total}`;
    })
    .join("; ");
}

function buildOrderRow(order) {
  const review = order?.review || {};
  const dealer = order?.dealerSnapshot || {};
  const dispatcher = order?.dispatcherSnapshot || {};
  const totals = order?.totals || {};
  const payment = order?.payment || {};
  const fulfillmentMode =
    dealer?.fulfillmentMode ||
    (order?.dispatcherId || dispatcher?.name || dispatcher?.companyName
      ? "DISPATCHER"
      : "FACTORY");

  return [
    dateValue(review.reviewedAt || new Date()),
    clean(order?.orderNumber),
    clean(order?._id),
    clean(review.reviewedByRole),
    clean(review.reviewedByUserId || review.reviewedByDispatcherId),
    clean(fulfillmentMode),
    clean(dealer.companyName),
    clean(dealer.contactName),
    clean(dealer.email),
    clean(dealer.phone),
    clean(dispatcher.companyName),
    clean(dispatcher.name),
    clean(payment.method),
    clean(totals.currency || "NPR"),
    numberValue(totals.subtotal),
    numberValue(totals.discount),
    numberValue(totals.tax),
    numberValue(totals.total),
    Array.isArray(order?.items) ? order.items.length : 0,
    buildItemsSummary(order?.items),
    clean(order?.dealerNote),
    clean(order?.internalNote),
    clean(review.reviewNote),
    dateValue(order?.createdAt),
  ];
}

async function markArchiveFailure(orderId, error) {
  if (!orderId) return;
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        "externalArchives.googleSheets.lastAttemptedAt": new Date(),
        "externalArchives.googleSheets.lastError": clean(error?.message),
      },
    },
  ).catch(() => {});
}

export async function archiveVerifiedOrderToGoogleSheets(order) {
  const config = getArchiveConfig();
  const orderId = order?._id;

  if (!isConfigured(config)) {
    return { ok: true, skipped: true, reason: "GOOGLE_SHEETS_NOT_CONFIGURED" };
  }

  if (order?.externalArchives?.googleSheets?.appendedAt) {
    return { ok: true, skipped: true, reason: "ALREADY_APPENDED" };
  }

  try {
    const token = await getAccessToken(config.serviceAccount);
    await ensureHeader({
      token,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
    });

    const appendRange = `${quoteSheetName(config.sheetName)}!A:X`;
    const appendUrl = `${sheetsValuesUrl(
      config.spreadsheetId,
      appendRange,
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    await sheetsRequest({
      token,
      method: "POST",
      url: appendUrl,
      body: {
        range: appendRange,
        majorDimension: "ROWS",
        values: [buildOrderRow(order)],
      },
    });

    await Order.updateOne(
      { _id: orderId },
      {
        $set: {
          "externalArchives.googleSheets.appendedAt": new Date(),
          "externalArchives.googleSheets.spreadsheetId": config.spreadsheetId,
          "externalArchives.googleSheets.sheetName": config.sheetName,
          "externalArchives.googleSheets.lastError": "",
        },
      },
    );

    return { ok: true, appended: true };
  } catch (error) {
    await markArchiveFailure(orderId, error);
    throw error;
  }
}
