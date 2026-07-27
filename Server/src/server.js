import app from "./app.js";
import { connectDB } from "./config/db.js";
import {
  HOST,
  NODE_ENV,
  PORT,
  READ_ONLY_DB_INSPECTION,
  SERVE_CLIENT,
} from "./config/env.js";
import { purgeExpiredAccountDeletions } from "./services/admin.service.js";

const ACCOUNT_DELETION_SWEEP_MS = 60 * 60 * 1000;

async function start() {
  await connectDB();
  if (READ_ONLY_DB_INSPECTION) {
    console.warn("[server] read-only DB inspection mode enabled; startup deletion sweep skipped.");
  } else {
    await purgeExpiredAccountDeletions().catch((error) => {
      console.warn("[deletion-sweep] startup sweep failed:", error.message);
    });

    setInterval(() => {
      purgeExpiredAccountDeletions().catch((error) => {
        console.warn("[deletion-sweep] scheduled sweep failed:", error.message);
      });
    }, ACCOUNT_DELETION_SWEEP_MS).unref();
  }

  const listener = () => {
    const hostLabel = HOST || "platform-default";
    console.log(
      `[server] listening on ${hostLabel}:${PORT} env=${NODE_ENV} serveClient=${SERVE_CLIENT}`,
    );
  };

  if (HOST) {
    app.listen(PORT, HOST, listener);
  } else {
    app.listen(PORT, listener);
  }
}

start().catch((error) => {
  console.error("[server] startup failed:", error?.message || error);
  process.exit(1);
});
