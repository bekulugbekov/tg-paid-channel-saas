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

## ✅ Bosqich 4 — Yakuniy sayqal (TUGALLANDI)

**Commit:** `82711aa`

### Bajarildi:

#### `/renew` oqimi (TZ F-06, F-07):
- `src/bot/commands/renew.ts` — `/renew` komandasi: aktiv obunalarni ko'rsatadi, `renew:<subId>` tugmalar
- `src/bot/handlers/subscribe.ts` — `renew:` callback: eski plan asosida yangi PENDING sub yaratadi → to'lov tugmalari
- `src/cron/reminders.job.ts` — eslatma tugmasi `pay:payme/click:` o'rniga `renew:` (to'g'ri yangilash oqimi)
- `PaymentService.getSubscriptionWithPlan()` — yangi helper metod

#### SaaS tariflar cheklovlari (TZ §2.1):
- `src/lib/saas-limits.ts` — `FREE: 1ch/5pl`, `PRO: 3ch/20pl`, `BUSINESS: unlimited`
- `POST /api/plans` — tarif yaratishda SaaS limit tekshiruvi (HTTP 403 agar oshsa)
- `CreatorService.canAddChannel()` — bot kanal ulashdan oldin limit tekshiruvi
- `channel-admin.ts` — limitga yetganda foydalanuvchiga xabar yuboradi

#### Platform admin panel (TZ §4.3, F-20, F-21, F-22):
- `src/api/middleware/admin-auth.ts` — `requireAdmin()`: JWT auth + `ADMIN_TELEGRAM_ID` tekshiruvi
- `GET  /api/admin/stats` — jami: creators, channels, active subs, revenue
- `GET  /api/admin/creators` — sahifalangan ro'yxat (per-creator: kanallar, obunalar, daromad)
- `PATCH /api/admin/creators/:id/plan` — saasPlan + saasExpiresAt o'zgartirish
- `GET /api/me` — `isAdmin: boolean` maydon qo'shildi
- `dashboard/src/pages/Admin.tsx` — stat kartalar + creator jadvali + tarif o'zgartirish modali
- `Layout.tsx` — admin nav linki (faqat `isAdmin=true` bo'lganda ko'rinadi)
- `Overview.tsx` — SaaS plan badge + kanal/tarif ishlatilish hisoblagichi

#### cleanupPending cron — Bosqich 3 da allaqachon mavjud (`src/cron/cleanup.job.ts`)

---

---

## ✅ Bosqich 5 — Audit tuzatishlari (TUGALLANDI)

**Commit:** (joriy)

### Bajarildi (audit topilmalari):

#### S-06 Rate limiting:
- `express-rate-limit` o'rnatildi va `src/api/server.ts` ga qo'shildi
- Umumiy API: 100 req / 15 daqiqa per IP
- Auth endpoint: 10 req / 15 daqiqa per IP (qattiqroq)
- To'lov webhook'lar rate-limit'siz (Payme/Click serverlaridan keladi)

#### `/dashboard` bot komandasi (TZ §9.1):
- `src/bot/commands/dashboard.ts` — creator'ni DB'dan topib, 1 soatlik JWT token generatsiya qiladi
- `src/api/routes/auth.ts:GET /api/auth/bot-login` — tokenni validatsiya qilib, session cookie o'rnatadi va redirects qiladi
- `help.ts` yangilandi

#### F-06 Eslatma aniqligi:
- `src/cron/reminders.job.ts` — endi **aynan 3 kun** (±12 soat) va **aynan 1 kun** (±12 soat) qolgan obunachilarni alohida topib, alohida yuboradi
- Ilgari: 3-kunlik oynada har kuni yuborar edi (bir obunachi 3 ta xabar olishi mumkin edi)

#### README:
- Sarlavha "Bosqich 1" → "MVP" ga o'zgartirildi
- Fayl strukturasi barcha bosqichlar uchun yangilandi

---

## ✅ Bosqich 6 — Magic link login (TUGALLANDI)

**Commit:** (joriy)

### TZ v1.1 yangilandi:
- §8: `LoginToken` modeli hujjatlashtirildi
- §5.5: Magic link oqimi qo'shildi
- §12.2: Asosiy usul = magic link, muqobil = Telegram Login Widget
- §13: `POST /auth/login` endpoint qo'shildi
- Changelog jadvali qo'shildi

### Prisma:
- `LoginToken` modeli: `id, token @unique, creatorId, used, expiresAt, createdAt`
- `Creator` modeliga `loginTokens LoginToken[]` relation qo'shildi
- Migration: `20260530185402_add_login_token`

### Backend (`src/`):
- `src/bot/commands/dashboard.ts` — JWT o'rniga `randomBytes(32)` token, `LoginToken` DB'ga yoziladi, 5 daqiqalik TTL
- `src/api/routes/auth.ts` — `POST /api/auth/login` { token }: mavjudlik + `used=false` + `expiresAt > now` tekshiruvi; `used=true` qilib JWT cookie beradi. Tushunarli o'zbek xato xabarlari.
- `src/cron/cleanup.job.ts` — eskirgan `LoginToken`larni har 6 soatda tozalaydi

### Frontend (`dashboard/src/`):
- `api.ts` — `api.auth.magicLogin(token)` → `POST /api/auth/login` qo'shildi
- `pages/Login.tsx` — URL'dan `?token=` oladi, `POST /api/auth/login` ga yuboradi; loading holati, aniq xato xabarlari, `/overview` redirect

### Test natijalari (brauzerda tekshirildi):
- ✅ Noto'g'ri token → "Token topilmadi yoki noto'g'ri"
- ✅ To'g'ri token → login + `/overview` redirect
- ✅ Ishlatilgan token qayta → "Bu havola allaqachon ishlatilgan"

---

## 🔜 Kelajakdagi kengaytmalar (ixtiyoriy)

1. **Telegram Login Widget domen** — `@BotFather → /setdomain` production URL
2. **`GetStatement` Payme** — to'liq per-creator implementatsiya
3. **Webhook rejimi test** — ngrok + Payme/Click sandbox
4. **Dashboard mobile responsive** — hozircha desktop-only
5. **Unit/integration testlar** — jest + supertest

---

## ⚠️ Muhim eslatmalar va texnik qarzlar

- **`/api/auth/bot-login` (GET)** — oldingi sessiyada qo'shilgan edi, yangi `POST /api/auth/login` bilan almashtirildi. Eski havola endi ishlamaydi (bu maqsadli).
- **Magic link URL**: `{DASHBOARD_URL}/login?token=<hex>` — frontend `/login` sahifasi
- **Token TTL**: 5 daqiqa; eskirganlar cleanup.job.ts tomonidan tozalanadi

## ⚠️ Muhim eslatmalar

- **Merchant kalitlar** faqat `settings` formasidan kiritiladi — `.env`'da emas (TZ §2.3)
- **Deep link format**: `t.me/BotName?start=c_<channelTelegramId>` — minus belgisi (`-`) Telegram'da ruxsat etilgan
- **`dashboard/.env`** fayli yarating: `VITE_BOT_USERNAME=YourBotUsername`
- **Production build**: `cd dashboard && npm run build` → `dashboard/dist/` → Express static tomonidan serve qilinadi

---

## 🧪 Magic link login test qilish (Bosqich 6)

### Bot orqali (haqiqiy oqim):
```
1. Bot bilan chat oching
2. /dashboard yuboring
3. Bot "Dashboard kirish havolasi" xabarini yuboradi (5 daqiqali havola)
4. Havolaga bosing → /login?token=... sahifasi ochiladi
5. Avtomatik POST /api/auth/login yuboriladi → /overview redirect
6. Xuddi o'sha havolaga qayta bossangiz → "Bu havola allaqachon ishlatilgan"
```

### Curl orqali:
```bash
# Token yaratish (bot buyrug'i o'rniga bevosita)
TOKEN=$(node -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
const c=require('crypto').randomBytes(32).toString('hex');
db.creator.findFirst().then(cr=>
  db.loginToken.create({data:{token:c,creatorId:cr.id,expiresAt:new Date(Date.now()+300000)}})
).then(()=>{console.log(c);db.\$disconnect()});
")

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}" \
  -c /tmp/cookies.txt
# → {"ok":true}

# Ikkinchi urinish
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\"}"
# → {"error":"Bu havola allaqachon ishlatilgan"}
```

## 🧪 Bosqich 4 yangi funksiyalarini test qilish

### /renew oqimi:
```
1. Bot'da /start c_<channelTgId> → tarif tanla → to'lov qil → ACTIVE obuna
2. Bot'da /renew → obuna ko'rinadi "🔄 Kanal nomi (dd.mm.yyyygacha)"
3. "🔄 Yangilash" tugmasini bosing → yangi PENDING sub yaratiladi
4. pay:payme yoki pay:click → to'lov havolasi
```

### SaaS limitlar:
```bash
# Creator FREE tarifda → 1 ta kanaldan ortiq ulashga urinish
# Bot "⛔ Tarif chekloviga yetdingiz!" deb xabar yuboradi

# API orqali 6-chi plan yaratishga urinish (FREE: 5 ta limit)
curl -X POST http://localhost:3000/api/plans -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"channelId":"...","name":"Extra","priceUzs":10000,"durationDays":30}'
# → HTTP 403: "FREE tarifida maksimal 5 ta tarif..."
```

### Admin panel:
```bash
# .env da ADMIN_TELEGRAM_ID=<sizning_telegram_id>
# Dashboard'ga kiring → sidebar'da "🛡️ Admin" ko'rinadi
# GET /api/admin/stats → {"totalCreators":N,"totalChannels":N,...}
# GET /api/admin/creators → creatorlar ro'yxati

# Plan o'zgartirish
curl -X PATCH http://localhost:3000/api/admin/creators/<id>/plan -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"saasPlan":"PRO","saasExpiresAt":"2025-12-31T00:00:00.000Z"}'
```

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
