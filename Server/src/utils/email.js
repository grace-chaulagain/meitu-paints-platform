// Single source of truth for outbound email in this app - the SMTP
// transport/sendMail/escapeHtml trio used to be copy-pasted independently
// into auth.service.js, dealer.service.js, adminNotification.service.js,
// order.service.js, and factory.service.js. Every one of those now imports
// from here instead.
//
// This also owns the shared visual shell every transactional/announcement
// email renders through - a DESIGN.md-driven replacement for the old
// per-file red-gradient-banner HTML (see renderEmailShell below).
import nodemailer from "nodemailer";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

// DESIGN.md tokens, translated to what email clients actually render
// (no CSS variables, no gradients - Outlook/Gmail support for both is
// unreliable, and DESIGN.md itself asks for "soft blended gradients" only
// on public marketing surfaces, not utility communication like this).
const COLOR = {
  fog: "#f5f5f7",
  snow: "#ffffff",
  ink: "#1d1d1f",
  slate: "#474747",
  graphite: "#707070",
  silverMist: "#e8e8ed",
  azure: "#0071e3",
  caution: "#b64400",
  meituRed: "#c1121f",
};

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let _smtpTransport = null;

export function smtpConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

export function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  _smtpTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE) === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  return _smtpTransport;
}

// Non-throwing by design (matches the pattern already used by 4 of the 5
// former call sites): callers that need a hard SMTP requirement check
// smtpConfigured() themselves before calling this, same as
// auth.service.js's password-setup flow already does.
export async function sendMail({ to, subject, text, html, attachments = [] }) {
  if (!smtpConfigured()) {
    console.warn("[email] SMTP is not configured; email skipped.");
    return false;
  }

  const { SMTP_USER, MAIL_FROM } = process.env;
  const transporter = getSmtpTransport();

  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });

  return true;
}

// ----------------------------
// Shared visual shell
// ----------------------------

export function renderCtaButton(label, url) {
  if (!url) return "";
  const safeUrl = escapeHtml(url);

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:26px;">
      <tr>
        <td align="center" bgcolor="${COLOR.azure}" style="border-radius:999px;">
          <a href="${safeUrl}" style="display:inline-block;padding:13px 26px;font-family:${FONT_STACK};font-size:14.5px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">
            ${escapeHtml(label || "Continue")}
          </a>
        </td>
      </tr>
    </table>
    <div style="margin-top:18px;">
      <div style="font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${COLOR.graphite};margin-bottom:8px;">
        Backup link
      </div>
      <div style="font-family:${FONT_STACK};font-size:12.5px;line-height:1.6;color:${COLOR.slate};background:${COLOR.fog};border-radius:12px;padding:12px 14px;word-break:break-all;">
        <a href="${safeUrl}" style="color:${COLOR.azure};text-decoration:none;">${safeUrl}</a>
      </div>
    </div>
  `;
}

export function renderParagraph(text) {
  if (!text) return "";
  return `<div style="margin-top:14px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.65;color:${COLOR.slate};">${escapeHtml(text)}</div>`;
}

export function renderCallout(text, { label = "Note" } = {}) {
  if (!text) return "";

  return `
    <div style="margin-top:22px;padding:14px 16px;border-radius:14px;background:${COLOR.fog};border-left:3px solid ${COLOR.caution};">
      <div style="font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${COLOR.graphite};margin-bottom:6px;">
        ${escapeHtml(label)}
      </div>
      <div style="font-family:${FONT_STACK};font-size:13.5px;line-height:1.65;color:${COLOR.slate};white-space:pre-wrap;">
        ${escapeHtml(text)}
      </div>
    </div>
  `;
}

// Stripe-receipt-style key/value rows - quiet dividers, no boxed table
// shell, label left / value right.
export function renderDetailRows(rows = []) {
  const filtered = (rows || []).filter((row) => row && row.label);
  if (!filtered.length) return "";

  const rowsHtml = filtered
    .map(
      (row) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${COLOR.graphite};vertical-align:top;width:38%;">
            ${escapeHtml(row.label)}
          </td>
          <td style="padding:11px 0;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13.5px;font-weight:600;color:${COLOR.ink};text-align:right;vertical-align:top;">
            ${escapeHtml(row.value || "-")}
          </td>
        </tr>
      `,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;">
      ${rowsHtml}
    </table>
  `;
}

// The factory order-bill's itemized line-item table, restyled onto the new
// tokens but structurally preserved (same columns, same totals block).
export function renderLineItemsTable({ items = [], totals = {} } = {}) {
  const itemsHtml = (items || [])
    .map(
      (item, index) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.slate};">${index + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.ink};font-weight:600;">${escapeHtml(item.name || "")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.slate};">${escapeHtml(item.packLabel || item.variantLabel || item.unit || "-")}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.slate};text-align:right;">${Number(item.quantity || 0).toLocaleString()}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.slate};text-align:right;">${Number(item.unitPrice || 0).toLocaleString()}</td>
          <td style="padding:10px 12px;border-bottom:1px solid ${COLOR.silverMist};font-family:${FONT_STACK};font-size:13px;color:${COLOR.ink};font-weight:700;text-align:right;">${Number(item.lineTotal || 0).toLocaleString()}</td>
        </tr>
      `,
    )
    .join("");

  const th = (label, align = "left") =>
    `<th style="padding:11px 12px;text-align:${align};font-family:${FONT_STACK};font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:${COLOR.graphite};">${escapeHtml(label)}</th>`;

  const currency = totals.currency || "NPR";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;border:1px solid ${COLOR.silverMist};border-radius:14px;overflow:hidden;">
      <thead>
        <tr style="background:${COLOR.fog};">
          ${th("#")}${th("Item")}${th("Pack / Variant")}${th("Qty", "right")}${th("Rate", "right")}${th("Amount", "right")}
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
      <tr>
        <td style="font-family:${FONT_STACK};font-size:13px;line-height:1.9;color:${COLOR.slate};text-align:right;">
          Subtotal: <strong style="color:${COLOR.ink};">${Number(totals.subtotal || 0).toLocaleString()}</strong><br/>
          Discount: <strong style="color:${COLOR.ink};">${Number(totals.discount || 0).toLocaleString()}</strong><br/>
          Tax: <strong style="color:${COLOR.ink};">${Number(totals.tax || 0).toLocaleString()}</strong><br/>
          <span style="font-size:14.5px;">Total: <strong style="color:${COLOR.ink};">${escapeHtml(currency)} ${Number(totals.total || 0).toLocaleString()}</strong></span>
        </td>
      </tr>
    </table>
  `;
}

// The shared shell every email in the app renders through: a restrained
// white card on a fog canvas, small logo mark instead of a red gradient
// banner, Apple-blue CTA pill. `bodyHtml`/`calloutHtml` accept pre-built
// trusted HTML (from the helpers above, or an already-sanitized rich-text
// announcement body) - this function itself only escapes eyebrow/title/intro.
export function renderEmailShell({
  preheader = "",
  eyebrow = "",
  title = "",
  intro = "",
  bodyHtml = "",
  calloutHtml = "",
  ctaLabel = "",
  ctaUrl = "",
  footerNote = "This is an automated message from Meitu Paints. Please do not reply directly to this email.",
} = {}) {
  return `
    <div style="margin:0;padding:0;background-color:${COLOR.fog};">
      ${
        preheader
          ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>`
          : ""
      }
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.fog};margin:0;padding:40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
              <tr>
                <td style="padding:0 20px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLOR.snow};border-radius:20px;overflow:hidden;border:1px solid rgba(232,232,237,.9);">
                    <tr>
                      <td style="padding:28px 32px 18px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td width="26" style="width:26px;height:26px;border-radius:999px;background:${COLOR.meituRed};text-align:center;">
                              <span style="display:inline-block;width:26px;height:26px;line-height:26px;font-family:${FONT_STACK};font-size:13px;font-weight:800;color:#ffffff;">M</span>
                            </td>
                            <td style="padding-left:9px;font-family:${FONT_STACK};font-size:13px;font-weight:700;letter-spacing:-.01em;color:${COLOR.ink};">
                              Meitu Paints
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 32px 32px;">
                        ${
                          eyebrow
                            ? `<div style="font-family:${FONT_STACK};font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COLOR.graphite};">${escapeHtml(eyebrow)}</div>`
                            : ""
                        }
                        <div style="margin-top:8px;font-family:${FONT_STACK};font-size:23px;line-height:1.25;font-weight:800;letter-spacing:-.02em;color:${COLOR.ink};">
                          ${escapeHtml(title)}
                        </div>
                        ${
                          intro
                            ? `<div style="margin-top:14px;font-family:${FONT_STACK};font-size:14.5px;line-height:1.65;color:${COLOR.slate};">${escapeHtml(intro)}</div>`
                            : ""
                        }
                        ${bodyHtml || ""}
                        ${calloutHtml || ""}
                        ${renderCtaButton(ctaLabel, ctaUrl)}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid ${COLOR.silverMist};">
                        <div style="font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLOR.graphite};">
                          ${escapeHtml(footerNote)}
                        </div>
                      </td>
                    </tr>
                  </table>
                  <div style="padding:18px 12px 0;text-align:center;font-family:${FONT_STACK};font-size:11.5px;color:#a1a1aa;">
                    Meitu Paints Nepal
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
