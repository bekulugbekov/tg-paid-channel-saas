# Loyiha Progressi

> **Sessiya protokoli:** Har yangi sessiya boshida shu fayl + `docs/TZ-telegram-paid-channel-saas.md` ni o'qi.

---

## ✅ Bosqich 1 — Yadro mexanizmi (TUGALLANDI)

**Commit:** `a614c67` feat: Bosqich 1 — to'lovsiz yadro mexanizmi

### Bajarildi:
- Prisma schema: Creator, Channel, Plan, Subscriber, Subscription, Transaction, InviteLink modellari
- DB migratsiya (PostgreSQL, Supabase-ready)
- `TelegramAccessService` — invite link yaratish + kick (ban+unban)
- `SubscriptionService` — test obuna yaratish, aktiv obunalarni ko'rish, muddatlarni tugatish
- `CreatorService` — creator topish/yaratish, kanal ro'yxatdan o'tkazish
- Bot komandalar: `/start`, `/status`, `/creator`, `/help`, `/testsub`
- Bot handler: `my_chat_member` — kanal admin bo'lganda avtomatik aniqlash
- Cron: `expireSubscriptions` — har soatda muddati o'tgan obunalarni tugatib, foydalanuvchini chiqaradi
- Express server + `/health` endpoint
- Long-polling (dev) / Webhook (prod) rejimi

### Fayllar:
```
src/services/{creator,subscription,telegram-access}.service.ts
src/bot/{index,types}.ts
src/bot/commands/{start,status,creator,help,test-sub}.ts
src/bot/handlers/channel-admin.ts
src/cron/expire.job.ts
src/api/server.ts
src/lib/{config,crypto,logger,prisma}.ts
src/index.ts
prisma/schema.prisma
prisma/migrations/20260530000000_init/
```

---

## ✅ Bosqich 2 — To'lov integratsiyasi (TUGALLANDI)

**Commit:** `f15b63f` feat: Bosqich 2 — to'lov integratsiyasi (Payme JSON-RPC + Click SHOP API)

### Bajarildi:

**Payme JSON-RPC** (`POST /payments/payme`):
- `CheckPerformTransaction` — summa (tiyin) va order holati tekshiruvi
- `CreateTransaction` — Payme tranzaksiyasini ro'yxatga olish (state=PENDING)
- `PerformTransaction` — to'lovni tasdiqlash → subscription ACTIVE, invite link yuborish
- `CancelTransaction` — bekor qilish (state=-1)
- `CheckTransaction` — holat so'rovi (state: 1/2/-1/-2)
- `GetStatement` — stub (bo'sh ro'yxat)
- Authorization `Basic base64("Paycom:<key>")` per-creator tekshiruvi

**Click SHOP API**:
- `POST /payments/click/prepare` (action=0) — summa+imzo tekshiruvi, `merchant_prepare_id` qaytarish
- `POST /payments/click/complete` (action=1) — to'lovni yakunlash, subscription aktivlashtirish
- MD5 sign_string tekshiruvi: `md5(click_trans_id+service_id+secret+merchant_trans_id+[prepare_id+]amount+action+sign_time)`

**Idempotentlik (TZ §10.3)**:
- `Transaction.providerTxnId` bo'yicha `@@unique([provider, providerTxnId])` — DB darajasida
- `PerformTransaction` / `Complete` — `txn.state === PAID` bo'lsa skip
- Invite link — `inviteLink.findFirst({ subscriptionId })` — ikkinchi link yaratilmaydi
- Telegram `sendMessage` non-fatal (bot boshlamagan foydalanuvchida webhook buzmaydi)

**Bot obuna oqimi**:
- `/start c_<channelTelegramId>` — deep link orqali kanal tariflarini ko'rsatish
- Callback `plan:<planId>` — PENDING subscription yaratish, to'lov usuli tanlash
- Callback `pay:payme:<subId>` — Payme checkout URL generatsiya
- Callback `pay:click:<subId>` — Click payment URL generatsiya

**DB schema o'zgarishi**:
- `Transaction` ga `cancelledAt DateTime?` va `cancelReason Int?` qo'shildi
- `@@index` → `@@unique([provider, providerTxnId])`
- Migratsiya: `20260530200000_add_txn_cancel_fields`

### Fayllar:
```
src/services/payment.service.ts        ← PaymentService (yadro)
src/payments/payme.router.ts           ← Payme JSON-RPC router
src/payments/click.router.ts           ← Click Prepare/Complete router
src/bot/handlers/subscribe.ts          ← plan/pay callback handlerlari
src/bot/commands/start.ts              ← deep link qo'shildi
src/bot/index.ts                       ← PaymentService wiring
src/api/server.ts                      ← /payments/* mount
src/index.ts                           ← PaymentService init
src/scripts/sandbox-test.ts            ← lokal test script
src/scripts/seed-test-creator.ts       ← test ma'lumotlari
prisma/migrations/20260530200000_*/    ← migration SQL
```

### Sandbox test natijalari:
| Test | Natija |
|------|--------|
| Payme CheckPerformTransaction | `{allow:true}` ✅ |
| Payme CreateTransaction | `state:1` ✅ |
| Payme PerformTransaction | `state:2`, sub ACTIVE, link yaratildi ✅ |
| Payme PerformTransaction (idempotent) | Xato yo'q, bir xil perform_time ✅ |
| Payme CancelTransaction | `state:-1` ✅ |
| Payme CancelTransaction (idempotent) | Bir xil cancel_time ✅ |
| Click Prepare | `merchant_prepare_id` qaytarildi ✅ |
| Click Complete | sub ACTIVE, invite link yaratildi ✅ |
| Click Complete (idempotent) | Ikkinchi link yaratilmadi ✅ |
| Click noto'g'ri sign | `error:-1` ✅ |

---

## 🔜 Bosqich 3 — Multi-tenant + Dashboard

TZ §12, §13, §17 asosida:

### Backend REST API (`src/api/routes/`):
- `POST /auth/telegram` — Telegram Login Widget → JWT (httpOnly cookie)
- `GET /me` — creator profili
- `GET/POST /plans` — tariflar CRUD
- `PATCH/DELETE /plans/:id`
- `GET /subscribers` — filter: status
- `POST /subscribers/:id/extend` — muddatni qo'lda uzaytirish
- `POST /subscribers/:id/revoke` — qo'lda chiqarish
- `PUT /settings/merchant` — Payme/Click kalitlarini saqlash (shifrlash)
- `GET /stats` — daromad, obunachilar statistikasi

### Dashboard frontend (`dashboard/`):
- React + Vite + Tailwind CSS
- Telegram Login Widget integratsiyasi
- Sahifalar: Login, Overview, Channels, Plans, Subscribers, Settings

### Cron joblar (TZ §11):
- `sendReminders` — har kuni 10:00, 3 kun va 1 kun qolganda eslatma
- `cleanupPending` — har 6 soatda, 24 soat o'tgan PENDING tranzaksiyalarni FAILED qilish

---

## ⚠️ Ochiq muammolar / TODO / Texnik qarzlar

1. **Creator merchant kalitlari bot orqali kiritilmaydi** — hozircha faqat DB da qo'lda. Dashboard yoki bot FSM conversation kerak (TZ §9.3).

2. **`GetStatement`** Payme metodi stub — to'liq implementatsiya uchun creator'ni auth header bo'yicha topish kerak (paymeKey hashini DB da saqlash yoki per-creator endpoint).

3. **`sendReminders` cron yo'q** — TZ §11, F-06 (3 kun, 1 kun eslatma).

4. **`cleanupPending` cron yo'q** — 24 soat o'tgan PENDING tranzaksiyalarni tozalash.

5. **Plan yaratish bot orqali yo'q** — Creator hozircha faqat DB da plan yarata oladi. Bot FSM conversation kerak (TZ §9.3).

6. **Rate limiting yo'q** — TZ S-06, express-rate-limit kutubxonasi kerak.

7. **Webhook rejimi test qilinmadi** — hozircha long-polling (dev). ngrok + webhook sinovi kerak.

8. **`/renew` komandasi yo'q** — TZ F-07, obunani yangilash oqimi.

9. **Deep link format** — `c_<channelTelegramId>` ishlatiladi, lekin minus belgisi (`-100...`) Telegram deep linkda muammo. Creator uchun `channel.id` (CUID) ishlatish yaxshiroq.

10. **Transaction `state: CREATED` holida CheckPerform'da providerTxnId = null** — bu to'g'ri, lekin Payme bir necha marta CreateTransaction chaqirsa, har safar yangi `providerTxnId` o'rnatilishi mumkin. Hozircha `markTransactionPending` oldini olmaydi.

---

## 🧪 Lokalda qanday test qilinadi

### Server ishga tushirish:
```bash
cp .env.example .env   # BOT_TOKEN, DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY to'ldir
docker-compose up -d   # PostgreSQL
npx prisma migrate deploy
npm run dev            # ts-node-dev
```

### Bot test:
1. Botni Telegram'da topib `/start` yuboring
2. `/creator` → kanal ulash yo'riqnomasi
3. Botni kanalingizga admin qilib qo'shing
4. `/testsub <channelId> <days>` → test obuna

### To'lov webhook test (sandbox, real pul yo'q):
```bash
# Avval test ma'lumotlarini qo'shish:
npx ts-node src/scripts/seed-test-creator.ts

# Sandbox test (server ishlab turganida):
npx ts-node src/scripts/sandbox-test.ts
```

### Payme Sandbox:
- Merchant ID va Key olish: [test.paycom.uz](https://test.paycom.uz)
- Webhook URL: `https://yourdomain/payments/payme`
- Test kartasi: 8600 0691 9150 1111, CVV: 000, muddati: 01/99

### Click Sandbox:
- Service ID va Secret olish: [my.click.uz](https://my.click.uz) → Merchant → Sandbox
- Webhook URL: `https://yourdomain/payments/click/prepare` va `/complete`
