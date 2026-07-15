import axios from "axios";

function resolveBaseURL() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (import.meta.env.DEV && typeof window !== "undefined") {
    const protocol = window.location?.protocol || "http:";
    const hostname = window.location?.hostname || "localhost";
    return `${protocol}//${hostname}:5002`;
  }

  return import.meta.env.DEV ? "http://localhost:5002" : "";
}

const baseURL = resolveBaseURL();

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

let currentAccessToken = null;
let refreshHandler = null;
let logoutHandler = null;
let refreshPromise = null;

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

// The refresh token lives in a browser-wide httpOnly cookie, and the access
// token is mirrored into localStorage so a new tab can restore a session -
// which means two tabs of the same admin session end up holding the exact
// same access token with the exact same expiry, so their independent
// proactive-refresh timers fire within milliseconds of each other. The
// server's refresh token is single-use and only tolerates that race for a
// short grace window (see REFRESH_ROTATION_GRACE_MS in auth.service.js), so
// three or more near-simultaneous refreshers (e.g. three open tabs) can
// permanently strand one of them with a REFRESH_TOKEN_REVOKED - a terminal
// failure that force-logs-out that tab. Coordinating refreshes across tabs
// (one tab actually calls the network, the rest just adopt the result)
// removes the race instead of merely tolerating it.
const REFRESH_LOCK_KEY = "meitu.refreshLock";
const REFRESH_LOCK_TTL_MS = 8000;
const authChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("meitu-auth") : null;
const externalTokenListeners = new Set();

export function onExternalAccessTokenUpdate(listener) {
  externalTokenListeners.add(listener);
  return () => externalTokenListeners.delete(listener);
}

function notifyExternalListeners(token) {
  externalTokenListeners.forEach((listener) => {
    try {
      listener(token);
    } catch {
      // A listener error shouldn't break the auth flow for this tab.
    }
  });
}

authChannel?.addEventListener("message", (event) => {
  const data = event?.data || {};
  if (data.type === "token" && data.token) {
    setAccessToken(data.token);
    notifyExternalListeners(data.token);
  } else if (data.type === "logout") {
    setAccessToken(null);
    notifyExternalListeners(null);
  }
});

function tryAcquireRefreshLock() {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    const now = Date.now();
    if (raw && now - (Number(raw) || 0) < REFRESH_LOCK_TTL_MS) {
      return false;
    }
    localStorage.setItem(REFRESH_LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function releaseRefreshLock() {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch {
    // ignore
  }
}

// Another tab already holds the refresh lock - wait briefly for it to
// broadcast the new token (handled by the BroadcastChannel listener above,
// which calls setAccessToken) instead of racing it with a second
// /api/auth/refresh call against the same single-use rotating cookie. Falls
// through to a normal refresh if nothing arrives in time (e.g. the other
// tab crashed mid-refresh, or BroadcastChannel isn't available).
function waitForExternalRefresh(tokenBeforeWait, timeoutMs = REFRESH_LOCK_TTL_MS + 2000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      if (currentAccessToken && currentAccessToken !== tokenBeforeWait) {
        resolve(currentAccessToken);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(poll, 200);
    };
    poll();
  });
}

const TERMINAL_AUTH_CODES = new Set([
  "ACCOUNT_DISABLED",
  "REFRESH_TOKEN_EXPIRED",
  "REFRESH_TOKEN_REVOKED",
  "REFRESH_TOKEN_MISSING",
  "INVALID_REFRESH_TOKEN",
]);

function getAuthErrorCode(error) {
  return String(error?.response?.data?.code || "").toUpperCase();
}

function decodeJwtPayload(token) {
  try {
    const [, payload] = String(token || "").split(".");
    if (!payload) return null;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );

    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
}

function getAccessTokenExpiresAt(token) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  return exp > 0 ? exp * 1000 : 0;
}

function shouldRefreshBeforeRequest(token) {
  const expiresAt = getAccessTokenExpiresAt(token);
  if (!expiresAt) return false;
  return expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS <= Date.now();
}

function isRefreshRequest(config = {}) {
  return (
    config?.url?.includes("/api/auth/refresh") ||
    config?.url?.includes("/auth/refresh") ||
    config?.__skipAuthRefresh === true
  );
}

function isRefreshableAuthFailure(error) {
  const status = Number(error?.response?.status || 0);
  if (status !== 401) return false;

  const code = getAuthErrorCode(error);
  return (
    !code ||
    code === "ACCESS_TOKEN_EXPIRED" ||
    code === "AUTH_REQUIRED" ||
    code === "INVALID_TOKEN"
  );
}

function isTerminalAuthFailure(error) {
  const status = Number(error?.response?.status || 0);
  if (![401, 403].includes(status)) return false;

  const code = getAuthErrorCode(error);
  return TERMINAL_AUTH_CODES.has(code) || isRefreshRequest(error?.config);
}

export function setAccessToken(token) {
  currentAccessToken = token || null;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("accessToken", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("accessToken");
  }
}

export function getAccessToken() {
  return currentAccessToken;
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function registerAuthHandlers({ onRefreshToken, onAuthFailure }) {
  refreshHandler = onRefreshToken || null;
  logoutHandler = onAuthFailure || null;
}

async function refreshAccessTokenOnce() {
  if (!refreshHandler) {
    throw new Error("No refresh handler registered");
  }

  if (!refreshPromise) {
    const tokenBeforeRefresh = currentAccessToken;

    refreshPromise = Promise.resolve()
      .then(async () => {
        if (!tryAcquireRefreshLock()) {
          const externalToken = await waitForExternalRefresh(tokenBeforeRefresh);
          if (externalToken) return externalToken;
          // Nothing arrived in time - fall through and refresh ourselves
          // rather than leaving this tab stuck.
        }

        try {
          const token = await refreshHandler();
          if (!token) {
            throw new Error("Unable to refresh access token");
          }

          setAccessToken(token);
          authChannel?.postMessage({ type: "token", token });
          return token;
        } finally {
          releaseRefreshLock();
        }
      })
      .catch(async (error) => {
        if (logoutHandler && isTerminalAuthFailure(error)) {
          await logoutHandler(error);
          authChannel?.postMessage({ type: "logout" });
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use(
  async (config) => {
    if (
      !isRefreshRequest(config) &&
      currentAccessToken &&
      refreshHandler &&
      shouldRefreshBeforeRequest(currentAccessToken)
    ) {
      const nextToken = await refreshAccessTokenOnce();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${nextToken}`;
      return config;
    }

    if (currentAccessToken) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${currentAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    const code = getAuthErrorCode(error);

    if (
      logoutHandler &&
      [401, 403].includes(Number(status)) &&
      TERMINAL_AUTH_CODES.has(code)
    ) {
      await logoutHandler(error);
      return Promise.reject(error);
    }

    if (!originalRequest || !isRefreshableAuthFailure(error)) {
      return Promise.reject(error);
    }

    if (isRefreshRequest(originalRequest)) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      return Promise.reject(error);
    }

    if (!refreshHandler) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessTokenOnce();

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(err, fallback = "Request failed") {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
}

const savedToken = localStorage.getItem("accessToken");
if (savedToken) {
  setAccessToken(savedToken);
}
