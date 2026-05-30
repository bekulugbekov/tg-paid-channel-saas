import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../lib/config";

export interface AuthRequest extends Request {
  creatorId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req as any).cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { creatorId: string };
    (req as AuthRequest).creatorId = payload.creatorId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
