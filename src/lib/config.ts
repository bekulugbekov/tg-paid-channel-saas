import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),
  PUBLIC_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  BOT_USERNAME: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
  DASHBOARD_URL: z.preprocess(
    (v) => (v === "" ? "http://localhost:5173" : v),
    z.string().url().default("http://localhost:5173")
  ),
  ADMIN_TELEGRAM_ID: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? BigInt(v.trim()) : undefined)),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid configuration:");
  const errors = result.error.flatten().fieldErrors;
  for (const [key, msgs] of Object.entries(errors)) {
    console.error(`  ${key}: ${msgs?.join(", ")}`);
  }
  process.exit(1);
}

export const config = result.data;
export type Config = typeof config;
