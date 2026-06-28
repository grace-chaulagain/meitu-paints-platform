import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import fs from "fs";
import path from "path";

import routes from "./routes/index.js";
import { corsOptions } from "./config/cors.js";
import {
  CLIENT_DIST_DIR,
  IS_PRODUCTION,
  NODE_ENV,
  SERVE_CLIENT,
  TRUST_PROXY,
} from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { publicReadRateLimit } from "./middlewares/rateLimit.middleware.js";
import "./models/FactorySettings.model.js";
import "./models/AdminNotificationSettings.model.js";
import "./models/Notification.model.js";
import "./models/StockAdjustmentLog.model.js";

const app = express();
const clientIndexPath = path.join(CLIENT_DIST_DIR, "index.html");
const clientBuildExists = fs.existsSync(clientIndexPath);
const shouldServeClient = IS_PRODUCTION && SERVE_CLIENT && clientBuildExists;

if (TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// Security + logging
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        fontSrc: ["'self'", "data:"],
        connectSrc: [
          "'self'",
          "https://script.google.com",
          "https://script.googleusercontent.com",
        ],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);
app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));

// CORS + parsers
app.use(cors(corsOptions()));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Routes
app.get("/api/health", publicReadRateLimit, (req, res) => {
  res.status(200).json({
    ok: true,
    service: "meitu-api",
    env: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

app.use("/api", routes);

if (IS_PRODUCTION && SERVE_CLIENT && !clientBuildExists) {
  console.error(
    `[server] SERVE_CLIENT is enabled but frontend build was not found at ${CLIENT_DIST_DIR}. API routes will still start; run the frontend build before serving the website.`,
  );
}

if (shouldServeClient) {
  app.use(
    express.static(CLIENT_DIST_DIR, {
      index: false,
      maxAge: IS_PRODUCTION ? "1y" : 0,
      immutable: IS_PRODUCTION,
    }),
  );

  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== "GET") return next();
    if (!req.accepts("html")) return next();
    if (path.extname(req.path)) return next();
    return res.sendFile(clientIndexPath);
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({
      ok: true,
      service: "meitu-api",
      env: NODE_ENV,
      client:
        IS_PRODUCTION && SERVE_CLIENT
          ? "missing-build-output"
          : "not-served-by-backend",
    });
  });
}

// Error handler (must be last)
app.use(errorMiddleware);

export default app;
