import { SaasPlan } from "@prisma/client";

export const SAAS_LIMITS: Record<SaasPlan, { channels: number; plans: number }> = {
  FREE:     { channels: 1, plans: 5 },
  PRO:      { channels: 3, plans: 20 },
  BUSINESS: { channels: 999, plans: 999 },
};
