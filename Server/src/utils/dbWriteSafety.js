const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const PRODUCTION_ENV_NAMES = new Set(["production", "prod", "live"]);

function boolEnv(name) {
  return TRUE_VALUES.has(String(process.env[name] || "").trim().toLowerCase());
}

function normalizeEnv(value = "") {
  return String(value || "").trim().toLowerCase();
}

function mongoTarget(mongoUri = "") {
  try {
    const parsed = new URL(mongoUri);
    const dbName = decodeURIComponent(parsed.pathname || "")
      .replace(/^\/+/, "")
      .split("?")[0];
    return { host: parsed.host || "unknown-host", dbName: dbName || "unknown-db" };
  } catch {
    return { host: "unknown-host", dbName: "unknown-db" };
  }
}

function hasProductionToken(value = "") {
  const tokens = String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return tokens.some((token) => PRODUCTION_ENV_NAMES.has(token));
}

export function isProductionDatabaseTarget(mongoUri = "") {
  const declaredEnv = normalizeEnv(
    process.env.DB_ENV ||
      process.env.DATABASE_ENV ||
      process.env.APP_ENV ||
      process.env.NODE_ENV,
  );
  const target = mongoTarget(mongoUri);

  return (
    PRODUCTION_ENV_NAMES.has(declaredEnv) ||
    hasProductionToken(target.dbName) ||
    hasProductionToken(target.host)
  );
}

export function describeDatabaseTarget(mongoUri = "") {
  const target = mongoTarget(mongoUri);
  const declaredEnv =
    process.env.DB_ENV ||
    process.env.DATABASE_ENV ||
    process.env.APP_ENV ||
    process.env.NODE_ENV ||
    "development";

  return `env=${declaredEnv} host=${target.host} db=${target.dbName}`;
}

export function assertSafeDatabaseWrite({
  mongoUri,
  operation = "database write",
  destructive = false,
} = {}) {
  if (!mongoUri) {
    throw new Error(`Cannot run ${operation}: MONGO_URI is missing.`);
  }

  const productionTarget = isProductionDatabaseTarget(mongoUri);
  if (!productionTarget) return;

  if (!boolEnv("ALLOW_PRODUCTION_DB_WRITE")) {
    throw new Error(
      [
        `Refusing to run ${operation} against a production-like database target.`,
        `Target: ${describeDatabaseTarget(mongoUri)}.`,
        "Use a staging database for feature testing.",
        "If this is an intentional production write after a backup, set ALLOW_PRODUCTION_DB_WRITE=true.",
      ].join(" "),
    );
  }

  if (destructive && !boolEnv("ALLOW_DESTRUCTIVE_SEED")) {
    throw new Error(
      [
        `Refusing destructive ${operation} against a production-like database target.`,
        "Full rewrite seed scripts require ALLOW_DESTRUCTIVE_SEED=true in addition to ALLOW_PRODUCTION_DB_WRITE=true.",
      ].join(" "),
    );
  }
}
