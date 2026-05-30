import express, { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { PaymentService } from "../services/payment.service";
import { createPaymeRouter } from "../payments/payme.router";
import { createClickRouter } from "../payments/click.router";

export function createServer(paymentService: PaymentService) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/payments/payme", createPaymeRouter(paymentService));
  app.use("/payments/click", createClickRouter(paymentService));

  // 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Express error");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
