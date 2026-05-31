import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";
import { PaymentService } from "../services/payment.service";
import { TelegramAccessService } from "../services/telegram-access.service";
import { createPaymeRouter }      from "../payments/payme.router";
import { createClickRouter }      from "../payments/click.router";
import { createAuthRouter }       from "./routes/auth";
import { createMeRouter }         from "./routes/me";
import { createChannelsRouter }   from "./routes/channels";
import { createPlansRouter }      from "./routes/plans";
import { createSubscribersRouter } from "./routes/subscribers";
import { createSettingsRouter }   from "./routes/settings";
import { createStatsRouter }      from "./routes/stats";
import { createAdminRouter }      from "./routes/admin";

export interface AppServices {
  paymentService:  PaymentService;
  telegramAccess:  TelegramAccessService;
  db:              PrismaClient;
}

export function createServer(services: AppServices) {
  const { paymentService, telegramAccess, db } = services;
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  // ── Rate limiting (S-06) ─────────────────────────────────────────────────
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts, please try again later" },
  });
  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);

  // ── Health ───────────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Payment webhooks (no auth) ───────────────────────────────────────────
  app.use("/payments/payme/:creatorId", createPaymeRouter(paymentService));
  app.use("/payments/click/:creatorId", createClickRouter(paymentService));

  // ── REST API (/api/*) ────────────────────────────────────────────────────
  app.use("/api/auth",        createAuthRouter(db));
  app.use("/api/me",          createMeRouter(db));
  app.use("/api/channels",    createChannelsRouter(db));
  app.use("/api/plans",       createPlansRouter(db));
  app.use("/api/subscribers", createSubscribersRouter(db, telegramAccess));
  app.use("/api/settings",    createSettingsRouter(db));
  app.use("/api/stats",       createStatsRouter(db));
  app.use("/api/admin",       createAdminRouter(db));

  // ── Dashboard static (production) ────────────────────────────────────────
  const dashDist = path.resolve(__dirname, "../../dashboard/dist");
  app.use(express.static(dashDist));
  app.get(/^\/(?!api|payments|health|bot).*/, (_req, res) => {
    res.sendFile(path.join(dashDist, "index.html"));
  });

  // ── 404 (API only) ───────────────────────────────────────────────────────
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Error handler ────────────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Express error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
