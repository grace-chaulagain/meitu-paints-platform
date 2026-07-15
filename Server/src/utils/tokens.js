import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../config/env.js";

// jwt.sign's `iat` only has 1-second resolution, and these payloads are
// otherwise identical for a given user (just sub/role) - two tokens signed
// for the same user within the same wall-clock second would otherwise be
// byte-for-byte identical. That's harmless for access tokens (never hashed
// or compared for uniqueness), but refresh tokens are hashed and stored per
// session; an accidental collision there would mean two different sessions
// (e.g. two tabs logging in back to back) share one tokenHash, so an action
// on one (like logout) matches and removes both. A random jti guarantees
// every signed refresh token is unique regardless of timing.
export const signAccessToken = (payload) =>
  jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });

export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

export const verifyAccessToken = (token) =>
  jwt.verify(token, JWT_ACCESS_SECRET);

export const verifyRefreshJwt = (refreshToken) =>
  jwt.verify(refreshToken, JWT_REFRESH_SECRET);
