# tg-paid-channel-saas — Claude context

## Loyiha
Telegram kanallar uchun to'lovli obuna SaaS platformasi.
Creator'lar kanallarini ulaydi, tariflar yaratadi; foydalanuvchilar Payme/Click orqali to'lab kanal invite link oladi.

## Tech stack
- **Backend**: Node.js 20 + TypeScript + Express + grammY (Telegram bot)
- **DB**: PostgreSQL + Prisma ORM
- **Frontend**: React + Vite + Tailwind CSS (dashboard)
- **Deploy**: Docker Compose + Caddy (Let's Encrypt HTTPS)
- **To'lov**: Payme JSON-RPC, Click SHOP API

## Ishga tushirish

```bash
# Development
cp .env.example .env          # BOT_TOKEN, DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY to'ldir
docker-compose up -d          # PostgreSQL
npx prisma migrate deploy
npm run dev                   # backend :3000

cd dashboard && npm run dev   # frontend :5173 (Vite proxy → :3000)

# Production (server'da)
cp .env.production.example .env.production   # barcha qiymatlarni to'ldir
nano Caddyfile                               # domenni o'zgartir
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Build / test
```bash
npm run build          # tsc → dist/
npx tsc --noEmit       # type-check
cd dashboard && npm run build   # Vite → dashboard/dist/
```

## Papka strukturasi
```
src/
  api/          — Express routes + middleware (auth, admin-auth)
  bot/          — grammY handlers, commands, FSM (plan/merchant)
  cron/         — expire.job, reminders.job, cleanup.job
  lib/          — config (Zod), crypto (AES-256-GCM), logger, prisma
  payments/     — payme.router.ts, click.router.ts
  services/     — CreatorService, SubscriptionService, TelegramAccessService, PaymentService
scripts/
  set-webhook.ts    — Telegram webhook o'rnatish
  backup.sh         — pg_dump kunlik backup
dashboard/src/
  pages/        — Login, Overview, Plans, Subscribers, Channels, Settings, Admin
prisma/
  schema.prisma + migrations/
Dockerfile, docker-compose.prod.yml, Caddyfile, docker-entrypoint.sh
```

## Muhim arxitektura qarorlari

| Qaror | Sabab |
|-------|-------|
| **Long-polling → Webhook** | `PUBLIC_URL` bo'lsa webhook, bo'lmasa polling (src/index.ts) |
| **Magic-link login** | Bot `/dashboard` → 5 daqiqalik `LoginToken` DB'ga, frontend `?token=` oladi |
| **Idempotentlik** | `@@unique([provider, providerTxnId])` — qayta to'lov ikki marta ishlamasin |
| **Merchant kalitlari** | AES-256-GCM, `ENCRYPTION_KEY` .env'da; DB'da faqat `iv+ciphertext` |
| **SaaS limitlar** | FREE: 1 kanal/5 tarif; PRO: 3/20; BUSINESS: unlimited (`src/lib/saas-limits.ts`) |
| **F-07 /renew** | Yangi sub `startedAt = eski sub.expiresAt` (muddat qo'shiladi, almashtirilmaydi) |
| **S-06 Rate limit** | API: 100 req/15 daqiqa; Auth: 10 req/15 daqiqa (express-rate-limit) |
| **S-08 Merchant xavfsizligi** | Bot FSM: kalit kiritilgach `ctx.api.deleteMessage()` chaqiriladi |

## Muhim env o'zgaruvchilar
- `BOT_TOKEN` — @BotFather
- `JWT_SECRET` — ≥32 belgi, `node -e "...randomBytes(32).toString('base64url')"`
- `ENCRYPTION_KEY` — 64 hex belgi, **alohida zaxiralang** (yo'qolsa merchant kalitlar o'qilmaydi)
- `PUBLIC_URL` — HTTPS URL (webhook uchun); bo'sh bo'lsa long-polling
- `ADMIN_TELEGRAM_ID` — platform admin Telegram ID

## To'liq spetsifikatsiya
- **TZ**: `docs/TZ-telegram-paid-channel-saas.md`
- **Joriy holat**: `PROGRESS.md`
- **Deploy runbook**: `DEPLOY.md`
