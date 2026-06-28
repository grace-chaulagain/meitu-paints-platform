import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.resolve(__dirname, "../../.env");
const explicitEnvPath = process.env.DOTENV_CONFIG_PATH
  ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
  : "";

if (explicitEnvPath) {
  dotenv.config({ path: explicitEnvPath, override: false });
}
dotenv.config();
dotenv.config({ path: serverEnvPath, override: false });

function normalizeNodeEnv(value = "") {
  const env = String(value || "development")
    .trim()
    .toLowerCase();
  if (env === "prod") return "production";
  if (env === "dev") return "development";
  if (env === "test") return "test";
  return env || "development";
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function trimEnv(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function normalizeOrigin(value = "") {
  const raw = String(value || "").trim().replace(/^"|"$/g, "");
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
}

function splitOrigins(value = "") {
  return String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isLocalUrl(value = "") {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
    String(value || ""),
  );
}

function requireEnv(keys = []) {
  const missing = keys.filter((key) => !trimEnv(key));
  if (missing.length) {
    throw new Error(
      `[env] Missing required production environment variables: ${missing.join(
        ", ",
      )}`,
    );
  }
}

function warnMissingEnv(keys = []) {
  const missing = keys.filter((key) => !trimEnv(key));
  if (missing.length) {
    console.warn(
      `[env] Optional production integrations are not fully configured: ${missing.join(
        ", ",
      )}. Related features may be unavailable until these are set.`,
    );
  }
}

export const NODE_ENV = normalizeNodeEnv(process.env.NODE_ENV);
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = Number(process.env.PORT || 5002);
export const HOST =
  IS_PRODUCTION && !boolEnv("ALLOW_CUSTOM_HOST_BIND", false)
    ? ""
    : trimEnv("HOST", IS_PRODUCTION ? "" : "127.0.0.1");
export const MONGO_URI = trimEnv("MONGO_URI") || trimEnv("MONGODB_URI");

export const JWT_ACCESS_SECRET = trimEnv("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = trimEnv("JWT_REFRESH_SECRET");

export const ACCESS_TOKEN_EXPIRES_IN =
  trimEnv("ACCESS_TOKEN_EXPIRES_IN") || "10m";
export const REFRESH_TOKEN_EXPIRES_IN =
  trimEnv("REFRESH_TOKEN_EXPIRES_IN") || "7d";

export const APP_URL = normalizeOrigin(
  trimEnv("APP_URL", IS_PRODUCTION ? "" : "http://localhost:5173"),
);
export const API_URL = normalizeOrigin(trimEnv("API_URL"));
export const CORS_ORIGINS = splitOrigins(process.env.CORS_ORIGIN);

export const COOKIE_DOMAIN = trimEnv("COOKIE_DOMAIN");
export const COOKIE_SAME_SITE = (
  trimEnv("COOKIE_SAME_SITE", "lax") || "lax"
).toLowerCase();
export const COOKIE_SECURE = boolEnv("COOKIE_SECURE", IS_PRODUCTION);
export const TRUST_PROXY = boolEnv("TRUST_PROXY", IS_PRODUCTION);

export const SERVE_CLIENT = boolEnv("SERVE_CLIENT", IS_PRODUCTION);
export const CLIENT_DIST_DIR =
  trimEnv("CLIENT_DIST_DIR") ||
  path.resolve(__dirname, "../../../Frontend/meitupaints/dist");

export const CLOUD_NAME = trimEnv("CLOUD_NAME");
export const API_KEY = trimEnv("API_KEY");
export const API_SECRET = trimEnv("API_SECRET");

export const SMTP_HOST = trimEnv("SMTP_HOST");
export const SMTP_PORT = trimEnv("SMTP_PORT");
export const SMTP_SECURE = trimEnv("SMTP_SECURE");
export const SMTP_USER = trimEnv("SMTP_USER");
export const SMTP_PASS = trimEnv("SMTP_PASS");
export const MAIL_FROM = trimEnv("MAIL_FROM");
export const ADMIN_NOTIFICATION_EMAIL = trimEnv("ADMIN_NOTIFICATION_EMAIL");

const requiredProductionEnv = [
  "MONGO_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "APP_URL",
];

const optionalProductionIntegrationEnv = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM",
  "CLOUD_NAME",
  "API_KEY",
  "API_SECRET",
];

if (IS_PRODUCTION) {
  if (process.env.MONGODB_URI && !process.env.MONGO_URI) {
    requiredProductionEnv[0] = "MONGODB_URI";
  }

  requireEnv(requiredProductionEnv);
  warnMissingEnv(optionalProductionIntegrationEnv);

  if (isLocalUrl(APP_URL) && !boolEnv("ALLOW_LOCAL_PRODUCTION_URLS", false)) {
    throw new Error(
      "[env] APP_URL must be the public Hostinger domain in production",
    );
  }

  if (!SERVE_CLIENT && CORS_ORIGINS.length === 0) {
    throw new Error(
      "[env] CORS_ORIGIN is required in production when SERVE_CLIENT=false",
    );
  }
}
