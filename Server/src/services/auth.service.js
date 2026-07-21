import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

import ApiError from "../utils/apiError.js";
import User, { USER_ACCOUNT_STATUS } from "../models/User.model.js";
import DealerProfile from "../models/DealerProfile.model.js";
import Dispatcher from "../models/Dispatcher.model.js";
import PasswordResetToken, {
  PASSWORD_TOKEN_PURPOSE,
} from "../models/PasswordResetToken.model.js";

import { signAccessToken, signRefreshToken } from "../utils/tokens.js";
import { buildPublicAppUrl } from "../utils/publicUrl.js";
import { ROLES } from "../constants/roles.js";
import { DEALER_STATUS } from "../constants/statuses.js";
import { IS_PRODUCTION, JWT_REFRESH_SECRET } from "../config/env.js";

// ----------------------------
// Small helpers
// ----------------------------

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 7);
// Widened from 60s: the frontend now coordinates refreshes across tabs (see
// api/client.js) so simultaneous rotation races should be rare, but this
// window is the fallback safety net for when that coordination doesn't land
// (e.g. BroadcastChannel unavailable) - it only affects how long an
// already-superseded refresh token is still accepted, not how long a
// legitimate session lasts.
const REFRESH_ROTATION_GRACE_MS = 2 * 60 * 1000;

// Refresh tokens rotate on every use (single-use) within a given session,
// which is safe for that one session but races when the same session is
// open in two tabs: both may present the same still-current token within
// milliseconds of each other. Only one can win the atomic rotation below;
// the loser must not be treated as a stale/replayed token (that would
// silently and permanently invalidate one of the two tabs on its very next
// refresh, well before its refresh token was actually meant to expire).
// This short-lived, in-process cache lets the losing request converge on
// the exact same newly-issued refresh token the winner already received,
// instead of minting a competing one or being rejected outright. Keyed by
// the specific old token hash being presented (effectively unique per
// session), so it can't leak a rotation result across different sessions.
// Entries are swept lazily since they only ever live for
// REFRESH_ROTATION_GRACE_MS.
const recentRotations = new Map();

function cacheRotation(previousHash, refreshToken) {
  recentRotations.set(previousHash, {
    refreshToken,
    expiresAt: Date.now() + REFRESH_ROTATION_GRACE_MS,
  });
}

function getCachedRotation(previousHash) {
  const entry = recentRotations.get(previousHash);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    recentRotations.delete(previousHash);
    return null;
  }

  return entry.refreshToken;
}

// Sessions carry their own expiry and (during a rotation race) a short grace
// window for the just-superseded token - a session is worth keeping as long
// as either is still alive. Called on login/refresh so abandoned sessions
// don't accumulate forever on the user document.
function pruneExpiredSessions(sessions) {
  const now = Date.now();
  return (sessions || []).filter((session) => {
    const expiresAt = session.expiresAt?.getTime?.() || 0;
    const graceUntil = session.previousTokenValidUntil?.getTime?.() || 0;
    return expiresAt > now || graceUntil > now;
  });
}

// Caps how many concurrent sessions (tabs/devices/automated clients) a
// single account can accumulate - old logins are evicted first so a
// forgotten-open tab from weeks ago can't outlive this indefinitely.
const MAX_SESSIONS_PER_USER = 8;
const SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const NEUTRAL_AUTH_RESPONSE = {
  ok: true,
  message:
    "If an eligible account exists for this email, an email has been sent.",
};

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function verifyRefreshJwt(token) {
  const secret = JWT_REFRESH_SECRET;
  if (!secret) throw new ApiError(500, "Missing REFRESH_TOKEN_SECRET");
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    const code =
      error instanceof jwt.TokenExpiredError
        ? "REFRESH_TOKEN_EXPIRED"
        : "INVALID_REFRESH_TOKEN";
    throw new ApiError(401, "Invalid refresh token", { code });
  }
}

const normalizeRole = (role) => {
  const r = String(role || "")
    .trim()
    .toUpperCase();
  return r || null;
};

const toPublicUser = (u) => ({
  id: u._id,
  username: u.username,
  email: u.email,
  role: u.role,
  dealerId: u.dealerId || null,
  dispatcherId: u.dispatcherId || null,
  accountStatus: u.accountStatus || USER_ACCOUNT_STATUS.ACTIVE,
  passwordSetAt: u.passwordSetAt || null,
  avatarUrl: u.avatar?.url || null,
});

const toPublicDealerProfile = (dealer) => {
  if (!dealer) return null;
  return {
    id: dealer._id,
    companyName: dealer.companyName || "",
    contactName: dealer.contactName || "",
    email: dealer.email || "",
    phone: dealer.phone || "",
    address: dealer.address || "",
    panVat: dealer.panVat || "",
    status: dealer.status || "",
    dispatcherId: dealer.dispatcherId || null,
    notes: dealer.notes || "",
  };
};

let _smtpTransport = null;

function smtpConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } =
    process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new ApiError(500, "SMTP is not configured (missing env vars)");
  }

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

async function sendMail({ to, subject, text, html }) {
  const { SMTP_USER, MAIL_FROM } = process.env;
  const transporter = getSmtpTransport();

  await transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

function buildPasswordSetupLink(token) {
  return buildPublicAppUrl(
    `/set-password?token=${encodeURIComponent(String(token))}`,
  );
}

function buildPasswordResetLink(token) {
  return buildPublicAppUrl(
    `/reset-password?token=${encodeURIComponent(String(token))}`,
  );
}

function passwordSetupEmailTemplate({
  token,
  accountType = ROLES.DEALER,
  displayName = "",
}) {
  const link = buildPasswordSetupLink(token);
  const normalizedAccountType = String(accountType || ROLES.DEALER)
    .trim()
    .toUpperCase();

  const isDispatcher = normalizedAccountType === ROLES.DISPATCHER;
  const accountLabel = isDispatcher ? "dispatcher" : "dealer";
  const accountLabelTitle = isDispatcher ? "Dispatcher" : "Dealer";
  const recipientName = displayName || `Meitu ${accountLabelTitle}`;
  const safeRecipientName = escapeHtml(recipientName);
  const safeLink = escapeHtml(link);

  const subject = `Set your Meitu Paints ${accountLabel} password`;

  const text = [
    `Hello ${recipientName},`,
    "",
    `Your Meitu Paints ${accountLabel} account has been approved.`,
    "Use the secure link below to set your password. The link is valid for 24 hours.",
    link,
    "",
    "Once your password is created, you can sign in and continue with your workflow.",
    "If you did not expect this email, you can safely ignore it.",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:0;background-color:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;margin:0;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding:0 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#b91c1c 0%,#dd5127 100%);padding:22px 28px;">
                        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.82);margin:0;">
                          Meitu Paints
                        </div>
                        <div style="font-family:Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;color:#ffffff;margin:10px 0 0 0;">
                          ${accountLabelTitle} Account Approved
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:28px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td>
                              <div style="display:inline-block;font-family:Arial,sans-serif;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#b42318;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:8px 12px;">
                                Secure Access Setup
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:18px;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#111827;">
                              Hello <strong>${safeRecipientName}</strong>,
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:14px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#4b5563;">
                              Your Meitu Paints ${accountLabel} account has been approved. To activate access, please set your password using the secure button below. This link will remain valid for <strong>24 hours</strong>.
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:26px;">
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                  <td align="center" bgcolor="#c40000" style="border-radius:12px;">
                                    <a href="${safeLink}" style="display:inline-block;padding:14px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;background:linear-gradient(135deg,#c40000 0%,#ff5b2e 100%);">
                                      Set Password
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:24px;">
                              <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">
                                Backup Link
                              </div>
                              <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#4b5563;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;word-break:break-all;">
                                <a href="${safeLink}" style="color:#b42318;text-decoration:none;">${safeLink}</a>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-top:20px;">
                              <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#4b5563;background:#f9fafb;border-left:4px solid #f97316;border-radius:10px;padding:14px 16px;">
                                After setting your password, you can sign in and continue with your assigned workflow. If you did not expect this email, you may safely ignore it.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#6b7280;">
                          This is an automated message from Meitu Paints. Please do not reply directly to this email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, text, html };
}

function passwordResetEmailTemplate({ token, displayName = "Meitu User" }) {
  const link = buildPasswordResetLink(token);
  const safeDisplayName = escapeHtml(displayName || "Meitu User");
  const safeLink = escapeHtml(link);
  const subject = "Reset your Meitu Paints password";

  const text = [
    `Hello ${displayName || "Meitu User"},`,
    "",
    "We received a request to reset your Meitu Paints password.",
    "Use the secure link below to create a new password. The link is single-use and expires in 30 minutes.",
    link,
    "",
    "If you did not request this reset, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:0;background-color:#f3f4f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f3f4f6;margin:0;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding:0 16px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#b91c1c 0%,#dd5127 100%);padding:22px 28px;">
                        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.2;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.82);margin:0;">
                          Meitu Paints
                        </div>
                        <div style="font-family:Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;color:#ffffff;margin:10px 0 0 0;">
                          Password Reset
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:28px;">
                        <div style="display:inline-block;font-family:Arial,sans-serif;font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#b42318;background:#fef2f2;border:1px solid #fecaca;border-radius:999px;padding:8px 12px;">
                          Secure Recovery
                        </div>
                        <div style="padding-top:18px;font-family:Arial,sans-serif;font-size:16px;line-height:1.7;color:#111827;">
                          Hello <strong>${safeDisplayName}</strong>,
                        </div>
                        <div style="padding-top:14px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#4b5563;">
                          Use the button below to reset your password. This link is single-use and expires in <strong>30 minutes</strong>.
                        </div>
                        <div style="padding-top:26px;">
                          <a href="${safeLink}" style="display:inline-block;padding:14px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:12px;background:linear-gradient(135deg,#c40000 0%,#ff5b2e 100%);">
                            Reset Password
                          </a>
                        </div>
                        <div style="padding-top:24px;">
                          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">
                            Backup Link
                          </div>
                          <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#4b5563;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;word-break:break-all;">
                            <a href="${safeLink}" style="color:#b42318;text-decoration:none;">${safeLink}</a>
                          </div>
                        </div>
                        <div style="margin-top:20px;font-family:Arial,sans-serif;font-size:13px;line-height:1.7;color:#4b5563;background:#f9fafb;border-left:4px solid #f97316;border-radius:10px;padding:14px 16px;">
                          If you did not request this reset, you can safely ignore this email.
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                        <div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#6b7280;">
                          This is an automated message from Meitu Paints. Please do not reply directly to this email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { subject, text, html };
}

async function resolveAccountSetupContext({
  userId,
  accountType = null,
  displayName = "",
}) {
  if (!userId) throw new ApiError(400, "Missing userId");

  const user = await User.findById(userId).select(
    "email role dealerId dispatcherId isActive accountStatus invitationLastSentAt invitationExpiresAt +passwordHash",
  );

  if (!user) throw new ApiError(404, "User not found");
  if (!user.isActive) throw new ApiError(400, "User is not active");
  if (user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED) {
    throw new ApiError(400, "User is suspended");
  }

  const inferredRole = normalizeRole(accountType) || user.role;

  let resolvedDisplayName = String(displayName || "").trim();

  if (!resolvedDisplayName) {
    if (inferredRole === ROLES.DEALER && user.dealerId) {
      const dealer = await DealerProfile.findById(user.dealerId).select(
        "companyName contactName",
      );
      resolvedDisplayName =
        dealer?.companyName || dealer?.contactName || resolvedDisplayName;
    }

    if (inferredRole === ROLES.DISPATCHER && user.dispatcherId) {
      const dispatcher = await Dispatcher.findById(user.dispatcherId).select(
        "name companyName",
      );
      resolvedDisplayName =
        dispatcher?.name || dispatcher?.companyName || resolvedDisplayName;
    }
  }

  return {
    user,
    accountType: inferredRole,
    displayName: resolvedDisplayName,
  };
}

async function invalidateUnusedTokens({ userId, purpose }) {
  await PasswordResetToken.updateMany(
    { userId, purpose, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
}

async function createPasswordToken({ user, purpose, ttlMs }) {
  await invalidateUnusedTokens({ userId: user._id, purpose });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  await PasswordResetToken.create({
    userId: user._id,
    email: user.email,
    role: user.role,
    purpose,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  return { rawToken, expiresAt };
}

async function findValidPasswordToken({ token, purpose }) {
  if (!token) throw new ApiError(400, "Missing token");

  const record = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    purpose,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    throw new ApiError(400, "Invalid or expired token");
  }

  return record;
}

async function getPasswordTokenRecord({ token, purpose }) {
  if (!token) return null;

  return PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    purpose,
  }).lean();
}

function getDisplayNameForUser(user) {
  return user?.username || user?.email || "Meitu User";
}

async function resolvePasswordEmailDisplayName(user) {
  if (!user) return "Meitu User";

  if (user.role === ROLES.DEALER && user.dealerId) {
    const dealer = await DealerProfile.findById(user.dealerId).select(
      "companyName contactName",
    );
    return dealer?.companyName || dealer?.contactName || getDisplayNameForUser(user);
  }

  if (user.role === ROLES.DISPATCHER && user.dispatcherId) {
    const dispatcher = await Dispatcher.findById(user.dispatcherId).select(
      "name companyName",
    );
    return dispatcher?.name || dispatcher?.companyName || getDisplayNameForUser(user);
  }

  return getDisplayNameForUser(user);
}

async function assertDealerCanLogin(user) {
  if (user.role !== ROLES.DEALER) return;
  if (!user.dealerId) throw new ApiError(403, "Dealer account is not linked");

  const dealer = await DealerProfile.findById(user.dealerId).select("status");
  if (!dealer) throw new ApiError(403, "Dealer profile not found");
  if (dealer.status === DEALER_STATUS.SUSPENDED) {
    throw new ApiError(403, "Dealer account is suspended");
  }
}

// ----------------------------
// Auth service
// ----------------------------

async function loginCore({
  email,
  password,
  role = null,
  ip = "",
  userAgent = "",
}) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+passwordHash +sessions",
  );

  if (
    !user ||
    !user.isActive ||
    user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new ApiError(401, "Invalid credentials");
  }

  const wantedRole = normalizeRole(role);
  if (wantedRole) {
    const allowed = [ROLES.ADMIN, ROLES.DEALER, ROLES.DISPATCHER, ROLES.FACTORY];
    if (!allowed.includes(wantedRole)) {
      throw new ApiError(400, "Invalid role");
    }
    if (user.role !== wantedRole) {
      throw new ApiError(401, "Invalid credentials");
    }
  }

  if (!user.passwordHash) {
    throw new ApiError(
      403,
      "Account approved. Please set your password first.",
    );
  }

  const ok = await bcrypt.compare(String(password || ""), user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  await assertDealerCanLogin(user);

  let dealerProfile = null;
  if (user.role === ROLES.DEALER && user.dealerId) {
    const dealer = await DealerProfile.findById(user.dealerId).select(
      "companyName contactName email phone address panVat status dispatcherId notes",
    );
    dealerProfile = toPublicDealerProfile(dealer);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    dealerId: user.dealerId || null,
    dispatcherId: user.dispatcherId || null,
  });

  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    role: user.role,
  });

  // A new login adds its own session rather than replacing whatever the
  // account's other tabs/devices/automated clients are already using - see
  // the SessionSchema comment in User.model.js for why.
  const sessions = pruneExpiredSessions(user.sessions);
  sessions.push({
    tokenHash: hashToken(refreshToken),
    previousTokenHash: null,
    previousTokenValidUntil: null,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    ip: ip || "",
    userAgent: userAgent || "",
    lastUsedAt: new Date(),
  });
  while (sessions.length > MAX_SESSIONS_PER_USER) {
    sessions.shift();
  }
  user.sessions = sessions;
  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: toPublicUser(user),
    dealerProfile,
    accessToken,
    refreshToken,
  };
}

export async function login({
  email,
  password,
  role = null,
  ip = "",
  userAgent = "",
}) {
  return loginCore({ email, password, role, ip, userAgent });
}

export async function refresh({ refreshToken }) {
  if (!refreshToken) {
    throw new ApiError(401, "Missing refresh token", {
      code: "REFRESH_TOKEN_MISSING",
    });
  }

  const decoded = verifyRefreshJwt(refreshToken);
  const userId = decoded?.sub;
  if (!userId) throw new ApiError(401, "Invalid refresh token");

  const user = await User.findById(userId).select("+sessions");
  if (
    !user ||
    !user.isActive ||
    user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new ApiError(401, "Account disabled", {
      code: "ACCOUNT_DISABLED",
    });
  }

  await assertDealerCanLogin(user);

  let dealerProfile = null;
  if (user.role === ROLES.DEALER && user.dealerId) {
    const dealer = await DealerProfile.findById(user.dealerId).select(
      "companyName contactName email phone address panVat status dispatcherId notes",
    );
    dealerProfile = toPublicDealerProfile(dealer);
  }

  const incomingHash = hashToken(refreshToken);
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    dealerId: user.dealerId || null,
    dispatcherId: user.dispatcherId || null,
  });

  const session = (user.sessions || []).find(
    (s) => s.tokenHash === incomingHash,
  );

  // Fast path: this request believes it holds this session's current token.
  // Rotate it atomically - the filter re-checks that session's tokenHash at
  // write time, so if a second request (e.g. a second tab sharing this same
  // session) is racing on the exact same token, only one of the two
  // `findOneAndUpdate` calls can actually match and win. The loser falls
  // through instead of treating the race as a revoked/replayed token. Other
  // sessions on this account (other logins/devices) are untouched either way.
  if (session) {
    if (session.expiresAt.getTime() < Date.now()) {
      throw new ApiError(401, "Refresh token expired", {
        code: "REFRESH_TOKEN_EXPIRED",
      });
    }

    const candidateRefreshToken = signRefreshToken({
      sub: user._id.toString(),
      role: user.role,
    });

    const rotated = await User.findOneAndUpdate(
      { _id: user._id, "sessions.tokenHash": incomingHash },
      {
        $set: {
          "sessions.$.previousTokenHash": incomingHash,
          "sessions.$.previousTokenValidUntil": new Date(
            Date.now() + REFRESH_ROTATION_GRACE_MS,
          ),
          "sessions.$.tokenHash": hashToken(candidateRefreshToken),
          "sessions.$.expiresAt": new Date(
            Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
          ),
          "sessions.$.lastUsedAt": new Date(),
        },
      },
    );

    if (rotated) {
      cacheRotation(incomingHash, candidateRefreshToken);

      return {
        user: toPublicUser(user),
        dealerProfile,
        accessToken,
        refreshToken: candidateRefreshToken,
      };
    }
    // Lost the race - another request already rotated this session between
    // our read above and this write. Re-read fresh state and fall through to
    // the grace-window check below rather than failing this request outright.
  }

  const fresh = session ? await User.findById(user._id).select("+sessions") : user;

  const supersededSession = (fresh?.sessions || []).find(
    (s) =>
      s.previousTokenHash === incomingHash &&
      s.previousTokenValidUntil?.getTime?.() > Date.now(),
  );

  if (!supersededSession) {
    throw new ApiError(401, "Refresh token not found", {
      code: "REFRESH_TOKEN_REVOKED",
    });
  }

  // This request's token was already the superseded one for its session
  // (either it always was, or it just lost the rotation race above). Hand
  // back the exact same new refresh token the winning request already
  // received, if it's still cached, so both tabs converge on one valid
  // cookie instead of one of them being silently doomed to fail its next
  // refresh.
  return {
    user: toPublicUser(user),
    dealerProfile,
    accessToken,
    refreshToken: getCachedRotation(incomingHash),
  };
}

export async function logout({ refreshToken }) {
  if (!refreshToken) return { ok: true };

  // Removes only the one session this cookie belongs to - logging out in one
  // tab/device must not affect any other active session on the account.
  const refreshTokenHash = hashToken(refreshToken);
  await User.updateOne(
    {
      $or: [
        { "sessions.tokenHash": refreshTokenHash },
        { "sessions.previousTokenHash": refreshTokenHash },
      ],
    },
    {
      $pull: {
        sessions: {
          $or: [
            { tokenHash: refreshTokenHash },
            { previousTokenHash: refreshTokenHash },
          ],
        },
      },
    },
  );

  return { ok: true };
}

export async function hashPassword(plainPassword) {
  const p = String(plainPassword || "");
  if (p.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  return bcrypt.hash(p, 10);
}

// ----------------------------
// Password recovery and account setup
// ----------------------------

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) return NEUTRAL_AUTH_RESPONSE;

  const user = await User.findOne({
    email: normalizedEmail,
    isActive: true,
    role: { $in: [ROLES.ADMIN, ROLES.DEALER, ROLES.DISPATCHER, ROLES.FACTORY] },
    accountStatus: { $ne: USER_ACCOUNT_STATUS.SUSPENDED },
  }).select(
    "username email role dealerId dispatcherId isActive accountStatus +passwordHash",
  );

  if (!user || !user.passwordHash) return NEUTRAL_AUTH_RESPONSE;

  try {
    const { rawToken } = await createPasswordToken({
      user,
      purpose: PASSWORD_TOKEN_PURPOSE.RESET_PASSWORD,
      ttlMs: RESET_TOKEN_TTL_MS,
    });

    if (smtpConfigured()) {
      const displayName = await resolvePasswordEmailDisplayName(user);
      const { subject, text, html } = passwordResetEmailTemplate({
        token: rawToken,
        displayName,
      });

      await sendMail({
        to: user.email,
        subject,
        text,
        html,
      });
    } else if (IS_PRODUCTION) {
      console.error(
        `[auth] Password reset email requested for ${user._id}, but SMTP is not configured.`,
      );
    }

    return {
      ...NEUTRAL_AUTH_RESPONSE,
      token: IS_PRODUCTION ? undefined : rawToken,
    };
  } catch (error) {
    console.error("[auth] Failed to issue password reset token", {
      userId: String(user._id),
      message: error?.message,
    });
    return NEUTRAL_AUTH_RESPONSE;
  }
}

export async function resetPassword(token, newPassword) {
  const record = await findValidPasswordToken({
    token,
    purpose: PASSWORD_TOKEN_PURPOSE.RESET_PASSWORD,
  });

  const user = await User.findById(record.userId);
  if (
    !user ||
    !user.isActive ||
    user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new ApiError(400, "Account not available");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordSetAt = new Date();
  if (user.accountStatus !== USER_ACCOUNT_STATUS.ACTIVE) {
    user.accountStatus = USER_ACCOUNT_STATUS.ACTIVE;
  }
  // A password reset invalidates every active session everywhere, not just
  // the one making this request.
  user.sessions = [];
  await user.save();

  record.usedAt = new Date();
  await record.save();

  await invalidateUnusedTokens({
    userId: user._id,
    purpose: PASSWORD_TOKEN_PURPOSE.RESET_PASSWORD,
  });

  return { ok: true };
}

export async function createPasswordSetupTokenForUser({
  userId,
  accountType = null,
  displayName = "",
}) {
  const context = await resolveAccountSetupContext({
    userId,
    accountType,
    displayName,
  });

  if (![ROLES.DEALER, ROLES.DISPATCHER].includes(context.accountType)) {
    throw new ApiError(400, "User is not eligible for setup email");
  }

  const { rawToken, expiresAt } = await createPasswordToken({
    user: context.user,
    purpose: PASSWORD_TOKEN_PURPOSE.SETUP_PASSWORD,
    ttlMs: SETUP_TOKEN_TTL_MS,
  });

  context.user.accountStatus = USER_ACCOUNT_STATUS.PENDING_PASSWORD_SETUP;
  context.user.invitationLastSentAt = new Date();
  context.user.invitationExpiresAt = expiresAt;
  await context.user.save();

  if (IS_PRODUCTION && !smtpConfigured()) {
    throw new ApiError(500, "SMTP is not configured");
  }

  if (smtpConfigured()) {
    const { subject, text, html } = passwordSetupEmailTemplate({
      token: rawToken,
      accountType: context.accountType,
      displayName: context.displayName,
    });

    await sendMail({
      to: context.user.email,
      subject,
      text,
      html,
    });
  }

  return {
    ok: true,
    expiresAt,
    token: IS_PRODUCTION ? undefined : rawToken,
  };
}

export async function resendPasswordSetupEmailForUser({
  userId,
  accountType = null,
  displayName = "",
}) {
  const context = await resolveAccountSetupContext({
    userId,
    accountType,
    displayName,
  });

  if (![ROLES.DEALER, ROLES.DISPATCHER].includes(context.accountType)) {
    throw new ApiError(400, "User is not eligible for setup email");
  }

  if (context.user.passwordHash) {
    return { ok: true, alreadySet: true };
  }

  const out = await createPasswordSetupTokenForUser({
    userId: context.user._id,
    accountType: context.accountType,
    displayName: context.displayName,
  });

  return { ok: true, expiresAt: out.expiresAt, token: out.token };
}

export async function requestSetupLinkByEmail({ email }) {
  const normalizedEmail = String(email || "")
    .toLowerCase()
    .trim();

  if (!normalizedEmail) return NEUTRAL_AUTH_RESPONSE;

  const user = await User.findOne({ email: normalizedEmail }).select(
    "role isActive dealerId dispatcherId accountStatus +passwordHash",
  );

  if (!user || !user.isActive) return NEUTRAL_AUTH_RESPONSE;
  if (![ROLES.DEALER, ROLES.DISPATCHER].includes(user.role)) {
    return NEUTRAL_AUTH_RESPONSE;
  }
  if (user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED) {
    return NEUTRAL_AUTH_RESPONSE;
  }
  if (user.passwordHash) {
    return {
      ...NEUTRAL_AUTH_RESPONSE,
      alreadySet: IS_PRODUCTION ? undefined : true,
    };
  }

  try {
    const out = await createPasswordSetupTokenForUser({
      userId: user._id,
      accountType: user.role,
      displayName: await resolvePasswordEmailDisplayName(user),
    });

    return {
      ...NEUTRAL_AUTH_RESPONSE,
      token: IS_PRODUCTION ? undefined : out.token,
    };
  } catch (error) {
    console.error("[auth] Failed to issue setup link", {
      userId: String(user._id),
      message: error?.message,
    });
    return NEUTRAL_AUTH_RESPONSE;
  }
}

export async function resendDealerSetupEmailByEmail({ email }) {
  return requestSetupLinkByEmail({ email });
}

export async function setPasswordFromSetupToken(token, newPassword) {
  const record = await findValidPasswordToken({
    token,
    purpose: PASSWORD_TOKEN_PURPOSE.SETUP_PASSWORD,
  });

  const user = await User.findById(record.userId);
  if (
    !user ||
    !user.isActive ||
    user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED
  ) {
    throw new ApiError(400, "Account not available");
  }

  if (![ROLES.DEALER, ROLES.DISPATCHER].includes(user.role)) {
    throw new ApiError(400, "Account is not eligible for setup");
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordSetAt = new Date();
  user.accountStatus = USER_ACCOUNT_STATUS.ACTIVE;
  user.invitationExpiresAt = null;
  // A fresh password setup invalidates any stray sessions (there shouldn't
  // normally be any yet, but this keeps the invariant simple).
  user.sessions = [];
  await user.save();

  record.usedAt = new Date();
  await record.save();

  await invalidateUnusedTokens({
    userId: user._id,
    purpose: PASSWORD_TOKEN_PURPOSE.SETUP_PASSWORD,
  });

  return { ok: true };
}

export async function getPasswordTokenStatus({
  token,
  purpose = PASSWORD_TOKEN_PURPOSE.RESET_PASSWORD,
}) {
  const normalizedPurpose = String(purpose || "")
    .trim()
    .toUpperCase();

  if (!Object.values(PASSWORD_TOKEN_PURPOSE).includes(normalizedPurpose)) {
    throw new ApiError(400, "Invalid token purpose");
  }

  const record = await getPasswordTokenRecord({
    token,
    purpose: normalizedPurpose,
  });

  if (!record) {
    return { valid: false, reason: "INVALID" };
  }

  if (record.usedAt) {
    return { valid: false, reason: "USED" };
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return { valid: false, reason: "EXPIRED" };
  }

  const user = await User.findById(record.userId).select(
    "isActive accountStatus",
  );

  if (
    !user ||
    !user.isActive ||
    user.accountStatus === USER_ACCOUNT_STATUS.SUSPENDED
  ) {
    return { valid: false, reason: "ACCOUNT_UNAVAILABLE" };
  }

  return {
    valid: true,
    purpose: normalizedPurpose,
    expiresAt: record.expiresAt,
  };
}

export async function smtpTest({ to }) {
  if (IS_PRODUCTION) {
    throw new ApiError(404, "Not found");
  }

  const recipient = String(to || process.env.SMTP_USER || "").trim();
  if (!recipient) throw new ApiError(400, "to is required");

  const transporter = getSmtpTransport();
  await transporter.verify();

  await sendMail({
    to: recipient,
    subject: "SMTP Test - Meitu Backend",
    text: "If you received this, your SMTP (Nodemailer) setup is working ✅",
    html: "<p>If you received this, your SMTP (Nodemailer) setup is working ✅</p>",
  });

  return { ok: true };
}
