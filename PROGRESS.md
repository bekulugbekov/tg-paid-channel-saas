# Loyiha Progressi

> **Sessiya protokoli:** Har yangi sessiya boshida shu fayl + `docs/TZ-telegram-paid-channel-saas.md` ni o'qi.

---

## ✅ Bosqich 1 — Yadro mexanizmi (TUGALLANDI)

**Commit:** `a614c67`

### Bajarildi:
- Prisma schema: Creator, Channel, Plan, Subscriber, Subscription, Transaction, InviteLink
- DB migratsiya (PostgreSQL, Supabase-ready)
- `TelegramAccessService` — invite link yaratish + kick (ban+unban)
- `SubscriptionService` — test obuna, aktiv obunalar, muddatlarni tugatish
- `CreatorService` — creator topish/yaratish, kanal ro'yxatdan o'tkazish
- Bot komandalar: `/start`, `/status`, `/creator`, `/help`, `/testsub`
- Bot handler: `my_chat_member` — kanal admin bo'lganda avtomatik aniqlash
- Cron: `expireSubscriptions` — har soatda muddati o'tgan obunalarni tugatish + kick
- Express server + `/health` endpoint

---

## ✅ Bosqich 2 — To'lov integratsiyasi (TUGALLANDI)

**Commit:** `f15b63f`

### Bajarildi:
- **Payme JSON-RPC** (`POST /payments/payme`): CheckPerform, Create, Perform, Cancel, Check Transaction
  - Authorization Basic per-creator tekshiruvi; summalar tiyin'da
- **Click SHOP API**: `POST /payments/click/prepare` (action=0), `/complete` (action=1)
  - MD5 sign_string tekshiruvi
- **Idempotentlik** (TZ §10.3): `@@unique([provider, providerTxnId])`, PAID → skip, bir invite link
- **Bot obuna oqimi**: `/start c_<channelTgId>` deep link, `plan:`, `pay:payme:`, `pay:click:` callbacks
- Telegram `sendMessage` non-fatal
- Transaction schema: `cancelledAt`, `cancelReason`, `@@unique` constraint

### Sandbox test natijalari: barcha 10 test ✅ o'tdi

---

## ✅ Bosqich 3 — Multi-tenant + Dashboard (TUGALLANDI)

**Commit:** `98846ce`

### Backend REST API (`src/api/routes/`):
- `POST /api/auth/telegram` — Telegram Login Widget HMAC-SHA256 tekshiruvi → JWT httpOnly cookie
- `POST /api/auth/logout`
- `GET  /api/me` — creator profili (shifrlangan kalitlar ochilmaydi)
- `GET  /api/channels` — kanallar + activeSubscribers soni + deep link
- `GET/POST /api/plans` — tariflar (Zod validatsiya), kanal egaligiを tekshirish
- `PATCH/DELETE /api/plans/:id` — tahrirlash / soft delete (isActive=false)
- `GET  /api/subscribers` — filter: status, channelId; max 200 ta
- `POST /api/subscribers/:id/extend` — muddatni qo'lda uzaytirish
- `POST /api/subscribers/:id/revoke` — kick + SubStatus.CANCELLED
- `PUT  /api/settings/merchant` — Payme/Click kalitlarini AES-256-GCM bilan shifrlash (TZ §16 S-01)
- `GET  /api/stats` — jami/oylik daromad, aktiv/jami obuna, tariflar bo'yicha breakdown

### Auth middleware (`src/api/middleware/auth.ts`):
- JWT httpOnly cookie tekshiruvi; `AuthRequest.creatorId` inject qiladi
- Barcha `/api/*` endpointlar (auth va logout bundan mustasno) himoyalangan

### Cron joblar:
- `reminders.job.ts` — har kuni 10:00, 1-3 kun qolgan obunachilarga eslatma + to'lov tugmalar
- `cleanup.job.ts` — har 6 soatda, 24 soat o'tgan CREATED/PENDING tranzaksiyalarni FAILED qilish

### Dashboard (React + Vite + Tailwind):
- **Login** — Telegram Login Widget (`VITE_BOT_USERNAME`); `HMAC-SHA256 + JWT` oqimi
- **Overview** — daromad stat kartlari, tariflar breakdown jadvali, kanallar ro'yxati
- **Plans (Tariflar)** — CRUD forma + jadval; kanal tanlash, narx/davomiylik
- **Subscribers (Obunachilar)** — status badge (✅/⏳/❌/🚫), filter, uzaytir/chiqar
- **Settings (Sozlamalar)** — profil, Payme/Click kalitlari (AES-256-GCM eslatmasi ko'rinadi)
- **Layout** — sidebar nav, logout, merchant holat indikatori (💳 Payme / 🟢 Click)

### Dashboard tekshiruvi (screenshot):
- Overview: real daromad (150,000 so'm), 4 aktiv obunachi ✅
- Plans: 2 tarif jadvali, tahrirlash/o'chirish ✅
- Subscribers: 5 obunachi, holat badge, filter ✅
- Settings: Payme/Click "Ulangan" badge, shifrlash eslatmasi ✅

### Fayllar:
```
src/api/middleware/auth.ts
src/api/routes/{auth,me,channels,plans,subscribers,settings,stats}.ts
src/cron/{reminders,cleanup}.job.ts
dashboard/src/{App,api}.tsx
dashboard/src/components/Layout.tsx
dashboard/src/pages/{Login,Overview,Plans,Subscribers,Settings}.tsx
dashboard/{vite.config.ts,tailwind.config.js,tsconfig.json,package.json}
```

---

## 🔜 Bosqich 4 — Polish (keyingi)

TZ §4, §17 asosida:

### To'liq to'g'rilash kerak bo'lganlar:
1. **Telegram Login Widget domen** — `@BotFather → /setdomain` orqali production URL qo'shish
2. **`/renew` komandasi** — TZ F-07: obunani yangilash oqimi (yangi to'lov sikli)
3. **`GetStatement` Payme** — to'liq implementatsiya (paymeKey hash saqlash yoki per-creator endpoint)
4. **Bot FSM — plan yaratish** — Creator bot orqali tarif yaratsin (grammY `conversations` plugin)
5. **Bot FSM — merchant kalitlari** — Bot orqali Payme/Click kalitlarini kiritish, xabarni o'chirish (TZ S-08)
6. **Rate limiting** — TZ S-06: `express-rate-limit` kutubxonasi
7. **SaaS tariflar** — Platform admin paneli, FREE/PRO/BUSINESS cheklovlar
8. **Platform admin paneli** — TZ §4.3: barcha creatorlar, statistika, tarif boshqaruvi
9. **Webhook rejimi test** — ngrok + Payme/Click real sandbox webhook sinovi
10. **`/dashboard` bot komandasi** — Telegram'dan dashboard'ga login havolasi (JWT one-time token)

### Texnik qarz:
- `markTransactionPending` — concurrent CreateTransaction uchun upsert kerak
- Subscriber taraf `/start` oqimi ko'proq polish (kanal ma'lumotlari, obuna holati)
- Dashboard mobile responsive (hozircha desktop-only)
- API error handling frontend'da aniqroq xabarlar

---

## ⚠️ Muhim eslatmalar

- **Merchant kalitlar** faqat `settings` formasidan kiritiladi — `.env`'da emas (TZ §2.3)
- **Deep link format**: `t.me/BotName?start=c_<channelTelegramId>` — minus belgisi (`-`) Telegram'da ruxsat etilgan
- **`dashboard/.env`** fayli yarating: `VITE_BOT_USERNAME=YourBotUsername`
- **Production build**: `cd dashboard && npm run build` → `dashboard/dist/` → Express static tomonidan serve qilinadi

---

## 🧪 Lokalda qanday test qilinadi

### Backend:
```bash
cp .env.example .env   # BOT_TOKEN, DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY to'ldir
docker-compose up -d   # PostgreSQL
npx prisma migrate deploy
npm run dev            # ts-node-dev, port 3000
```

### Dashboard (dev):
```bash
cp dashboard/.env.example dashboard/.env
# dashboard/.env ichiga: VITE_BOT_USERNAME=YourBotUsername
cd dashboard && npm install && npm run dev   # port 5173
# Vite /api/* → Express :3000 proxy qiladi
```

### Dashboard (production preview):
```bash
cd dashboard && npm run build
# Express :3000 da dashboard/dist/ static fayllar sifatida serve qilinadi
```

### REST API test (curl):
```bash
# Auth (development rejimida auth_date tekshiruvi o'tkaziladi)
curl -X POST http://localhost:3000/api/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"id":976755848,"first_name":"Test","auth_date":1234567890,"hash":"abc"}' \
  -c /tmp/cookies.txt

# Stats (cookie bilan)
curl http://localhost:3000/api/stats -b /tmp/cookies.txt

# Plans
curl http://localhost:3000/api/plans -b /tmp/cookies.txt
```

### To'lov webhook test:
```bash
# Server ishlab turganida:
npx ts-node src/scripts/sandbox-test.ts   # Payme + Click
```

### Payme Sandbox:
- Merchant ID va Key: [test.paycom.uz](https://test.paycom.uz)
- Test kartasi: 8600 0691 9150 1111, CVV: 000, muddati: 01/99

### Click Sandbox:
- Credentials: [my.click.uz](https://my.click.uz) → Merchant → Sandbox
