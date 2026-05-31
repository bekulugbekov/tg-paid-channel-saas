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

## ✅ Bosqich 7 — Audit tuzatishlari (TUGALLANDI)

**Commit:** (joriy)

### Bajarildi (to'liqlik auditi topilmalari):

#### ⚠️ F-07 /renew muddat hisoblash bugi tuzatildi:
- `src/services/payment.service.ts:activateAfterPayment` — yangi sub ACTIVE bo'lganda, avval o'sha kanal uchun mavjud ACTIVE sub bor-yo'qligini tekshiradi
- Agar bor bo'lsa: yangi sub `startedAt = eski sub.expiresAt`, ya'ni eski sub tugagandan KEYIN boshlanadi
- Bot xabarida yozilgan "Yangi muddad eski obuna tugagandan keyin boshlanadi" endi haqiqiy

#### ❌ TZ §9.3 Bot FSM Conversations implement qilindi:
- `src/bot/fsm/state.ts` — FsmState (PlanState | MerchantState) in-memory store
- `src/bot/fsm/plan.ts` — 4-bosqichli tarif yaratish: nom → narx → davomiylik → tavsif → tasdiqlash
  - `fsm:plan:<channelId>:<title>` callback orqali ishga tushadi
  - `fsm:confirm_plan` va `fsm:cancel` callbacklar
  - SAAS limit tekshiruvi (FREE: 5 ta plan)
- `src/bot/fsm/merchant.ts` — Merchant kalitlari bot orqali kiritish:
  - Provider tanlash: Payme / Click / Ikkalasi
  - Barcha kalitlar kiritilgach AES-256-GCM bilan shifrlanib saqlanadi
  - **S-08**: har bir kalit kiritilgandan so'ng `ctx.api.deleteMessage()` chaqiriladi
- `src/bot/commands/creator.ts` — yangilandi: har kanal uchun "📦 Tarif yaratish" tugmasi + "💳 Merchant sozlash" tugmasi
- `src/bot/index.ts` — FSM handlerlari ro'yxatga olindi; `fsm:cancel` global; `message:text` handler FSM holat bo'lganda ishlaydi

#### ⚠️ Dashboard Channels sahifasi qo'shildi (TZ §12.1):
- `dashboard/src/pages/Channels.tsx` — kanal kartalari, tariflar, obunachi soni, deep link
- `dashboard/src/App.tsx` — `/channels` route qo'shildi
- `dashboard/src/components/Layout.tsx` — "📢 Kanallar" nav linki qo'shildi

#### ⚠️ GetStatement Payme implement qilindi (TZ §10.1):
- `src/services/payment.service.ts:getStatementTransactions` — auth header bo'yicha creator topib, uning PAYME tranzaksiyalarini qaytaradi
- `src/payments/payme.router.ts:GetStatement` — `from`/`to` parametrlar bo'yicha filtrlash, to'liq response format

### Build natijasi:
- `tsc --noEmit` backend: ✅
- `tsc --noEmit` dashboard: ✅

---

## ✅ Bosqich 8 — To'liq audit (TUGALLANDI)

**Commit:** (joriy)

### Bajarildi (to'liqlik auditi — TZ §§4, 16, 18 barchasini KODNI O'QIB tekshirish):

#### Natija: barcha talablar bajarilgan — F-01…F-22 ✅, S-01…S-09 ✅, AC barcha 10 ta ✅

#### Topilgan va tuzatilgan:
- **`src/api/routes/channels.ts:24`** — `process.env.BOT_USERNAME` o'rniga `config.BOT_USERNAME` ishlatildi (inconsistency fix)
- **`src/lib/config.ts`** — `BOT_USERNAME` optional ekaniga comment qo'shildi (deep link uchun muhim)

#### Build tasdiqlandi:
- `tsc --noEmit` backend: ✅ (0 xato)
- `tsc --noEmit` dashboard: ✅ (0 xato)
- TODO/FIXME/dead code: topilmadi ✅

---

## ✅ Bosqich 9 — Dashboard mobil-responsiv (TUGALLANDI)

**Commit:** (joriy)

### Bajarildi:

#### Layout.tsx — Hamburger drawer navigatsiya:
- Desktop (lg+): sidebar o'zgarmagan
- Mobil: sticky top header (h-14) + hamburger tugmasi
- Drawer: `fixed inset-0 z-50`, backdrop + 64px panel, barcha nav linklari (min-h-[44px])
- `flex flex-col lg:flex-row` tuzilmasiga o'tkazildi

#### Jadvallar → Kartochka view (mobil):
- **Subscribers.tsx**: `sm:hidden` kartochkalar + `hidden sm:block` jadval
  - Har kartochkada: ism, @username, status badge, kanal/tarif, sanalar, Uzaytir/Chiqar tugmalari
- **Plans.tsx**: `sm:hidden` kartochkalar + `hidden sm:block` jadval
  - Har kartochkada: tarif nomi, kanal, narx·davom., tahrir/o'chir (min-h-[44px])
- **Admin.tsx**: `sm:hidden` kartochkalar + `hidden sm:block` jadval
  - Har kartochkada: creator, SaaS badge, kanallar/aktiv/daromad, to'lov holati, Tarif tugmasi

#### Padding mobil uchun:
- Barcha sahifalar: `p-8` → `p-4 md:p-8` + `mx-auto`
- Form ichidagi padding ham sozlandi

#### Input font-size iOS zoom oldini olish:
- Settings, Plans, Admin modal: `text-sm` → `text-base sm:text-sm` (16px mobil)

#### Touch target ≥44px:
- Barcha tugmalar `min-h-[44px]` qo'shildi
- Havola elementi `inline-flex items-center px-3 py-2 min-h-[44px]`

#### Admin modal — bottom-sheet:
- `items-center` → `items-end sm:items-center` (mobil'da pastdan chiqadi)
- `rounded-2xl` → `rounded-t-2xl sm:rounded-2xl`

#### Overview SaaS plan section:
- `flex justify-between` → `flex flex-col sm:flex-row gap-3` (360px'da toshmas)

#### Build natijasi:
- `tsc --noEmit` dashboard: ✅ (0 xato)
- `vite build`: ✅ (43 modul, 2.06s)

---

## ✅ Bosqich 10 — Production deploy artefaktlari (TUGALLANDI)

**Commit:** (joriy)

### Yaratilgan fayllar:

| Fayl | Maqsad |
|------|--------|
| `Dockerfile` | Ko'p bosqichli build: dashboard → backend → production image |
| `docker-entrypoint.sh` | `prisma migrate deploy` → `node dist/index.js` |
| `docker-compose.prod.yml` | postgres + app + caddy (faqat 80/443 tashqaridan) |
| `Caddyfile` | Let's Encrypt HTTPS, reverse proxy → app:3000 |
| `.env.production.example` | Barcha o'zgaruvchilar, qiymatlar bo'sh |
| `scripts/set-webhook.ts` | Telegram webhook'ni PUBLIC_URL ga o'rnatadi |
| `scripts/backup.sh` | Kunlik pg_dump + 7 kun retention |
| `DEPLOY.md` | To'liq qo'lda deploy runbook (14 qadam) |
| `.gitignore` | `.env.production` himoya qo'shildi |

### Arxitektura:
- **Dockerfile** 3 bosqich: `dashboard-build` → `builder` → `production`
- Production image: prod deps + prisma CLI (migrations uchun) + `dist/` + `dashboard/dist/`
- Migratsiyalar entrypoint'da avtomatik bajariladi
- PostgreSQL porti tashqaridan yopiq (faqat Docker ichki tarmoq)
- Caddy Let's Encrypt sertifikatni avtomatik oladi

### Build tekshiruvi:
- `tsc --noEmit` backend: ✅ (0 xato)

---

## ✅ Bosqich 11 — Production server deploy (TUGALLANDI)

### Server holati (2026-05-31) — TO'LIQ ISHGA TUSHDI:
- **VPS**: Oracle Cloud Free Tier — Ubuntu 20.04, VM.Standard.E2.1.Micro, IP: `92.5.5.101`
- **Domain**: `92-5-5-101.sslip.io` (bepul subdomen, Let's Encrypt SSL)
- **Docker**: v28.1.1 o'rnatildi ✅
- **PostgreSQL container**: Healthy ✅
- **App container**: Healthy ✅ (migratsiyalar o'tdi)
- **Caddy container**: ✅ Ishlayapti — Let's Encrypt sertifikat olindi
- **HTTPS**: ✅ `https://92-5-5-101.sslip.io` — `{"status":"ok"}` qaytaryapti
- **HTTP→HTTPS redirect**: ✅ 308 Permanent Redirect
- **Telegram webhook**: ✅ `https://92-5-5-101.sslip.io/bot/<token>` — o'rnatildi

### ✅ Webhook o'rnatildi:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec app \
  node -e "
const {Bot} = require('grammy');
const bot = new Bot(process.env.BOT_TOKEN);
const url = process.env.PUBLIC_URL + '/bot/' + process.env.BOT_TOKEN;
bot.api.setWebhook(url, {drop_pending_updates: true})
  .then(() => bot.api.getWebhookInfo())
  .then(i => console.log('Webhook:', i.url));
"
```

### Server SSH ulanish:
```powershell
ssh -o StrictHostKeyChecking=no -i "C:\Users\Hp\.ssh\oracle.key" ubuntu@92.5.5.101
```

---

## 🔜 Kelajakdagi kengaytmalar (ixtiyoriy)

1. **Telegram Login Widget domen** — `@BotFather → /setdomain` production URL
2. **`GetStatement` Payme** — to'liq per-creator implementatsiya
3. **Webhook rejimi test** — ngrok + Payme/Click sandbox
4. **Unit/integration testlar** — jest + supertest

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
