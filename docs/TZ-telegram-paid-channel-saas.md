# Texnik Topshiriq (TZ)
## Telegram Pullik Kanal Boshqaruvi — Micro SaaS

> **Hujjat maqsadi:** Ushbu TZ bevosita Claude Code (yoki boshqa AI coding agent) yordamida loyihani noldan qurish uchun mo'ljallangan. Har bir bo'lim aniq, bajariladigan talablar shaklida yozilgan.
>
> **Versiya:** 1.1
> **Texnologiya yadrosi:** Node.js + TypeScript + grammY + PostgreSQL
> **Til:** Bot interfeysi — o'zbekcha; kod va izohlar — inglizcha

### Changelog
| Versiya | Sana | O'zgartirish |
|---------|------|--------------|
| 1.1 | 2026-05-30 | §8 LoginToken modeli, §5.5 magic link oqimi, §12.2 asosiy usul magic link, §13 POST /auth/login endpoint |
| 1.0 | 2026-05-30 | Dastlabki MVP TZ |

---

## 1. Loyiha haqida umumiy ma'lumot

### 1.1. Muammo
O'zbekistonda Telegram kontent yaratuvchilari (bloggerlar, ustozlar, mutaxassislar) o'z pullik kanallarini sotmoqchi bo'lganda quyidagi muammolarga duch keladi:
- Obunachilardan pulni **qo'lda** yig'ish (karta raqamini berib, skrinshot kutish) — sekin va xavfli.
- To'lov qilgan odamga linkni qo'lda berish va muddat tugaganda **qo'lda chiqarib yuborish** — vaqt talab qiladi va xatolarga olib keladi.
- Linklar boshqalarga **ulashib yuboriladi** — pulsiz kirishlar.
- Daromad va obunachilar statistikasi **kuzatilmaydi**.

### 1.2. Yechim
Kontent yaratuvchilarga o'z pullik (yopiq) Telegram kanallarini avtomatlashtirilgan tarzda sotish va boshqarish imkonini beruvchi SaaS platforma. Tizim:
- Obunachidan Payme/Click orqali to'lovni avtomatik yig'adi,
- To'lov tasdiqlangach **bir martalik kirish havolasini** generatsiya qiladi,
- Obuna muddati tugaganda obunachini kanaldan **avtomatik chiqarib yuboradi**,
- Kontent yaratuvchiga obunachilar va daromad bo'yicha **dashboard** beradi.

### 1.3. Maqsadli auditoriya
- **Birlamchi:** O'zbekistondagi kontent yaratuvchilar (online kurslar, signal kanallari, premium kontent).
- **Ikkilamchi:** Kichik biznes va jamoalar (yopiq hamjamiyatlar).

---

## 2. Biznes model va muhim prinsiplar

### 2.1. Daromad modeli
Platforma egasi (siz) daromadni quyidagicha oladi:
- **Asosiy variant — SaaS obuna:** Har bir kontent yaratuvchidan tizimdan foydalangani uchun oylik to'lov (masalan, `Free`, `Pro`, `Business` tariflari).
- Tariflar obunachilar soni / kanallar soni / funksiyalar bo'yicha cheklanadi.

### 2.2. KRITIK PRINSIP — pul oqimida bo'lmaslik
> **Platforma obunachilarning pulini O'ZI qabul qilmaydi.**
>
> Har bir kontent yaratuvchi **o'zining Payme/Click merchant hisobini** ulaydi. Obunachining puli to'g'ridan-to'g'ri kontent yaratuvchining merchant hisobiga tushadi. Platforma faqat to'lovni *boshlaydi* va kirishni *boshqaradi*.
>
> **Sababi:** Agar platforma boshqalarning pulini yig'ib taqsimlasa, u to'lov agregatori hisoblanadi — bu O'zbekistonda litsenziya talab qiladi. Bu modeldan qochiladi.

### 2.3. Texnik natija
- Har bir `creator` o'z merchant kalitlarini (`payme_merchant_id`, `payme_key`, `click_service_id`, `click_merchant_id`, `click_secret`) dashboard orqali kiritadi.
- Kalitlar bazada **shifrlangan holda** saqlanadi (qarang: §16).

---

## 3. Tizim rollari

| Rol | Tavsif | Interfeys |
|-----|--------|-----------|
| **Platform Admin** | Tizim egasi. Barcha creatorlarni, tariflarni, umumiy statistikani ko'radi. | Web admin panel + bot |
| **Creator** | Pullik kanal egasi. O'z kanal(lar)ini, tariflar, obunachilarni boshqaradi. | Web dashboard + bot |
| **Subscriber** | Oddiy foydalanuvchi. Kanalga obuna bo'lib, to'lov qiladi. | Faqat Telegram bot |

---

## 4. Funksional talablar (MVP)

### 4.1. Subscriber (obunachi) tomoni — bot ichida
- **F-01:** `/start <creator_ref>` orqali botga kirib, kontent yaratuvchining mavjud tariflarini ko'rish (deep-link orqali aniq kanalga yo'naltirish).
- **F-02:** Tarif tanlash (masalan: "1 oy — 50 000 so'm", "3 oy — 120 000 so'm").
- **F-03:** To'lov usulini tanlash (Payme yoki Click) va to'lov havolasini olish.
- **F-04:** To'lov muvaffaqiyatli bo'lgach, **bir martalik kirish havolasini** avtomatik olish.
- **F-05:** Obuna holatini ko'rish: `/status` — qaysi kanalga, qachongacha amal qiladi.
- **F-06:** Muddat tugashidan oldin (3 kun, 1 kun qolganda) **eslatma** olish va "Yangilash" tugmasi.
- **F-07:** Obunani yangilash (renew) — yangi to'lov sikli.

### 4.2. Creator (kontent yaratuvchi) tomoni — bot + dashboard
- **F-10:** Bot orqali ro'yxatdan o'tish va dashboard'ga login (Telegram login).
- **F-11:** Kanalni ulash: botni o'z kanaliga admin qilib qo'shadi → bot kanalni avtomatik aniqlaydi va ro'yxatga oladi.
- **F-12:** Merchant kalitlarini kiritish (Payme va/yoki Click).
- **F-13:** Tarif (plan) yaratish/tahrirlash/o'chirish: nom, narx, davomiylik (kunlarda), tavsif.
- **F-14:** Obunachilar ro'yxatini ko'rish (aktiv/tugagan, sana bilan).
- **F-15:** Daromad statistikasi: jami, oylik, tarif bo'yicha.
- **F-16:** Obunachini qo'lda chiqarish yoki muddatni qo'lda uzaytirish.

### 4.3. Platform Admin tomoni — admin panel
- **F-20:** Barcha creatorlar ro'yxati va ularning SaaS tarif holati.
- **F-21:** Umumiy statistika (creatorlar soni, jami obunachilar, platforma daromadi).
- **F-22:** Creator SaaS obunasini boshqarish (aktivlashtirish/to'xtatish).

---

## 5. Foydalanuvchi oqimlari (User Flows)

### 5.1. Obuna sotib olish oqimi (eng muhim)
```
1. Subscriber bot'ga /start bosadi (yoki creator linkidan kiradi)
2. Bot creatorning aktiv tariflarini ko'rsatadi
3. Subscriber tarifni tanlaydi
4. Bot DB'da "pending" subscription + transaction yozuvini yaratadi
5. Bot to'lov usulini so'raydi (Payme / Click)
6. Bot to'lov havolasini generatsiya qiladi va yuboradi
7. Subscriber web'da to'lovni amalga oshiradi
8. Payme/Click ⟶ platforma webhook'iga so'rov yuboradi
9. Webhook to'lovni tasdiqlaydi ⟶ subscription "active" bo'ladi
10. Bot Telegram API orqali bir martalik invite link yaratadi
11. Bot havolani subscriber'ga yuboradi
12. Subscriber kanalga qo'shiladi
```

### 5.2. Muddat tugashi oqimi (cron)
```
1. Har soatda cron job ishlaydi
2. expires_at < now() bo'lgan "active" subscriptionlarni topadi
3. Har biri uchun: banChatMember + unbanChatMember (kanaldan chiqarish)
4. subscription holatini "expired" qiladi
5. Subscriber'ga "Obunangiz tugadi. Yangilash uchun..." xabari yuboradi
```

### 5.3. Eslatma oqimi (cron)
```
1. Har kuni 1 marta cron ishlaydi
2. 3 kun va 1 kun ichida tugaydigan aktiv obunalarni topadi
3. Subscriber'ga eslatma + "Yangilash" tugmasini yuboradi
```

### 5.5. Dashboard'ga kirish oqimi (magic link)
```
1. Creator botda /dashboard buyrug'ini yozadi
2. Bot DB'da LoginToken yaratadi (random 32-bayt token, 5 daqiqa muddatli)
3. Bot havolani yuboradi: {DASHBOARD_URL}/login?token=<token>
4. Creator havolaga bosadi → /login sahifasi ochiladi
5. Frontend URL'dan tokenni oladi, POST /api/auth/login { token } yuboradi
6. Backend:
   a. LoginToken'ni token qiymati bo'yicha topadi
   b. used=false va expiresAt > now() tekshiradi
   c. used=true qiladi (bir martalik!)
   d. Creator'ni topadi, JWT httpOnly cookie beradi
7. Frontend dashboard'ga (/overview) redirect qiladi
```

> **Xavfsizlik:** Token DB'da saqlanadi va bir martalik. JWT stateless token bilan farqi:
> - Havola ikkinchi marta bosilsa → xato ("Token ishlatilgan yoki muddati o'tgan")
> - 5 daqiqadan so'ng avtomatik eskiradi; eskirgan tokenlar cron tomonidan tozalanadi

### 5.4. Kanal ulash oqimi
```
1. Creator botni o'z yopiq kanaliga admin qilib qo'shadi
   (huquqlar: foydalanuvchilarni taklif qilish + cheklash/chiqarish)
2. Telegram bot'ga "my_chat_member" update yuboradi
3. Bot kanal ID, nomini saqlaydi va creator'ga bog'laydi
4. Bot creator'ga "Kanal muvaffaqiyatli ulandi" deb yozadi
```

---

## 6. Texnik arxitektura

### 6.1. Komponentlar
```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT QATLAMI                         │
│  Telegram Bot (subscriber+creator)   Web Dashboard (React) │
└───────────────┬──────────────────────────┬────────────────┘
                │                           │
┌───────────────▼──────────────────────────▼────────────────┐
│                   BACKEND (Node.js)                         │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ Bot      │  │ REST API     │  │ Payment Webhooks   │    │
│  │ (grammY) │  │ (Express)    │  │ (Payme JSON-RPC,   │    │
│  │          │  │              │  │  Click Prepare/    │    │
│  │          │  │              │  │  Complete)         │    │
│  └────┬─────┘  └──────┬───────┘  └─────────┬──────────┘    │
│       │               │                    │               │
│  ┌────▼───────────────▼────────────────────▼──────────┐    │
│  │           SERVICE QATLAMI (business logic)          │    │
│  │  SubscriptionService, PaymentService,               │    │
│  │  TelegramAccessService, CreatorService              │    │
│  └────────────────────────┬────────────────────────────┘    │
│  ┌──────────────┐         │                                 │
│  │ Cron Jobs    │─────────┤                                 │
│  │ (node-cron)  │         │                                 │
│  └──────────────┘  ┌──────▼────────┐                        │
│                    │ Prisma ORM    │                        │
│                    └──────┬────────┘                        │
└───────────────────────────┼─────────────────────────────────┘
                    ┌────────▼────────┐
                    │  PostgreSQL     │
                    └─────────────────┘
```

### 6.2. Telegram API metodlari (kirish nazorati yadrosi)
| Maqsad | Metod (grammY / Bot API) |
|--------|--------------------------|
| Bir martalik kirish havolasi | `createChatInviteLink(chatId, { member_limit: 1, expire_date })` |
| Obunachini chiqarish | `banChatMember(chatId, userId)` so'ng `unbanChatMember(chatId, userId, { only_if_banned: true })` |
| A'zolikni tekshirish | `getChatMember(chatId, userId)` |
| Kanal ulanganini aniqlash | `my_chat_member` update'ini ushlash |

> **Eslatma:** `ban` + darhol `unban` foydalanuvchini **butunlay bloklamasdan** kanaldan chiqaradi — keyinchalik yangilanganda u qaytadan kira oladi.

---

## 7. Tech Stack

| Qatlam | Texnologiya | Sabab |
|--------|-------------|-------|
| Runtime | **Node.js 20+** | Creator allaqachon biladi |
| Til | **TypeScript** | Type-safety, AI uchun aniq kod |
| Bot framework | **grammY** | Zamonaviy, TS-native, `conversations` plugin bilan FSM |
| Web framework | **Express** | Webhook va REST API uchun |
| ORM | **Prisma** | Toza schema, migratsiya, type generatsiya |
| Ma'lumotlar bazasi | **PostgreSQL** | Ishonchli, relyatsion |
| Scheduler | **node-cron** | Muddat tekshiruvi va eslatmalar |
| Dashboard frontend | **React + Vite + Tailwind CSS** | Creator allaqachon biladi |
| Validatsiya | **Zod** | Input validatsiya |
| Shifrlash | **Node `crypto` (AES-256-GCM)** | Merchant kalitlarini saqlash |
| Logging | **pino** | Strukturali loglar |
| Process manager | **PM2** | Production'da uzluksiz ishlash |
| Reverse proxy | **Nginx** | HTTPS, webhook endpoint |

> Python ushbu loyiha uchun KERAK EMAS — barchasi Node.js/TypeScript'da.

---

## 8. Ma'lumotlar bazasi sxemasi (Prisma)

```prisma
// Kontent yaratuvchi (platforma foydalanuvchisi)
model Creator {
  id              String   @id @default(cuid())
  telegramId      BigInt   @unique
  firstName       String?
  username        String?
  email           String?
  // Merchant kalitlari (shifrlangan holda saqlanadi)
  paymeMerchantId String?
  paymeKeyEnc     String?
  clickServiceId  String?
  clickMerchantId String?
  clickSecretEnc  String?
  clickUserId     String?
  // SaaS obuna
  saasPlan        SaasPlan @default(FREE)
  saasExpiresAt   DateTime?
  createdAt       DateTime @default(now())

  channels        Channel[]
  plans           Plan[]
  loginTokens     LoginToken[]
}

// Dashboard'ga kirish uchun bir martalik magic link token
model LoginToken {
  id        String   @id @default(cuid())
  token     String   @unique
  creatorId String
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())

  creator   Creator  @relation(fields: [creatorId], references: [id])
}

enum SaasPlan { FREE PRO BUSINESS }

// Pullik kanal
model Channel {
  id                String   @id @default(cuid())
  creatorId         String
  telegramChannelId BigInt   @unique
  title             String
  description       String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())

  creator           Creator  @relation(fields: [creatorId], references: [id])
  plans             Plan[]
  subscriptions     Subscription[]
}

// Tarif (obuna paketi)
model Plan {
  id           String   @id @default(cuid())
  channelId    String
  creatorId    String
  name         String
  priceUzs     Int      // so'mda, tiyinsiz
  durationDays Int
  description  String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  channel       Channel  @relation(fields: [channelId], references: [id])
  creator       Creator  @relation(fields: [creatorId], references: [id])
  subscriptions Subscription[]
}

// Obunachi
model Subscriber {
  id         String   @id @default(cuid())
  telegramId BigInt   @unique
  username   String?
  firstName  String?
  createdAt  DateTime @default(now())

  subscriptions Subscription[]
}

// Obuna
model Subscription {
  id           String   @id @default(cuid())
  subscriberId String
  planId       String
  channelId    String
  status       SubStatus @default(PENDING)
  startedAt    DateTime?
  expiresAt    DateTime?
  createdAt    DateTime @default(now())

  subscriber   Subscriber @relation(fields: [subscriberId], references: [id])
  plan         Plan       @relation(fields: [planId], references: [id])
  channel      Channel    @relation(fields: [channelId], references: [id])
  transactions Transaction[]
  inviteLinks  InviteLink[]
}

enum SubStatus { PENDING ACTIVE EXPIRED CANCELLED }

// To'lov tranzaksiyasi
model Transaction {
  id             String   @id @default(cuid())
  subscriptionId String
  provider       Provider
  providerTxnId  String?  // Payme/Click tomonidan berilgan ID
  amountUzs      Int
  state          TxnState @default(CREATED)
  createdAt      DateTime @default(now())
  paidAt         DateTime?

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([provider, providerTxnId])
}

enum Provider { PAYME CLICK }
enum TxnState { CREATED PENDING PAID CANCELLED FAILED }

// Kirish havolalari
model InviteLink {
  id             String   @id @default(cuid())
  subscriptionId String
  link           String
  used           Boolean  @default(false)
  expiresAt      DateTime?
  createdAt      DateTime @default(now())

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
}
```

---

## 9. Telegram bot spetsifikatsiyasi

### 9.1. Buyruqlar
| Buyruq | Rol | Vazifa |
|--------|-----|--------|
| `/start [ref]` | Hammasi | Boshlash; ref bo'lsa — creator kanaliga yo'naltirish |
| `/status` | Subscriber | Aktiv obunalarni ko'rsatish |
| `/renew` | Subscriber | Obunani yangilash |
| `/creator` | Creator | Creator menyusi (kanal/tarif boshqaruvi) |
| `/dashboard` | Creator | Web dashboard'ga login havolasi |
| `/help` | Hammasi | Yordam |

### 9.2. Inline tugmalar (callback)
- Tarif tanlash: `plan:<planId>`
- To'lov usuli: `pay:payme:<subId>`, `pay:click:<subId>`
- Yangilash: `renew:<subId>`

### 9.3. FSM (conversation) holatlar
- **Creator — tarif yaratish:** nom → narx → davomiylik → tavsif → tasdiqlash.
- **Creator — merchant ulash:** provider tanlash → kalitlarni ketma-ket so'rash (xavfsizlik uchun kiritilgach xabar o'chiriladi).

### 9.4. Telegram konfiguratsiyasi
- **Webhook** rejimi (long-polling emas) — production uchun.
- Bot kanalda **admin** bo'lishi shart (invite + restrict huquqlari bilan).
- `allowed_updates`: `message`, `callback_query`, `my_chat_member`, `chat_member`.

---

## 10. To'lov integratsiyasi

> **Muhim:** Har bir to'lov **creator'ning** merchant hisobiga boradi. Webhook'lar kelganda tegishli creator kalitlari bo'yicha tekshiriladi.

### 10.1. Payme (Paycom) — Merchant API
- **Protokol:** JSON-RPC 2.0, bitta endpoint orqali.
- **Endpoint (bizning serverda):** `POST /payments/payme`
- **Auth:** Payme `Authorization: Basic base64("Paycom:<PAYME_KEY>")` header'ini yuboradi; biz uni tekshiramiz.
- **Payme chaqiradigan metodlar (biz implement qilamiz):**
  - `CheckPerformTransaction` — to'lov mumkinligini tekshirish (subscription PENDING va summa to'g'rimi).
  - `CreateTransaction` — tranzaksiya yaratish (state = PENDING).
  - `PerformTransaction` — to'lovni yakunlash (state = PAID) ⟶ **bu yerda invite link generatsiya va subscription ACTIVE bo'ladi**.
  - `CancelTransaction` — bekor qilish.
  - `CheckTransaction` — holatni qaytarish.
  - `GetStatement` — davr bo'yicha tranzaksiyalar.
- **To'lov havolasi (checkout):** `https://checkout.paycom.uz/<base64(params)>` ko'rinishida, bunda `m=<merchant_id>`, `ac.order_id=<transactionId>`, `a=<amount_in_tiyin>`.
- **Diqqat:** Payme summalarni **tiyin**da ishlatadi (so'm × 100).
- **Rasmiy hujjat:** `https://developer.help.paycom.uz/protokol-merchant-api/` va `https://developer.help.paycom.uz/metody-merchant-api/`

### 10.2. Click — SHOP API (Prepare/Complete)
- **Endpoint'lar (bizning serverda):**
  - `POST /payments/click/prepare`
  - `POST /payments/click/complete`
- **Imzo tekshiruvi:** Click `sign_string` yuboradi; biz `md5` (yoki hujjatdagi formula) orqali tekshiramiz. Formula tarkibi: `click_trans_id`, `service_id`, `secret_key`, `merchant_trans_id`, `amount`, `action`, `sign_time`.
- **Oqim:**
  - **Prepare (action=0):** buyurtma (subscription) mavjudligi va summasi tekshiriladi; `merchant_prepare_id` qaytariladi.
  - **Complete (action=1):** to'lov yakunlanadi ⟶ **invite link generatsiya, subscription ACTIVE**.
- **To'lov havolasi:** `https://my.click.uz/services/pay?service_id=<id>&merchant_id=<id>&amount=<uzs>&transaction_param=<transactionId>&return_url=<url>`
- **Konfiguratsiya:** `service_id`, `merchant_id`, `merchant_user_id`, `secret_key`.
- **Rasmiy hujjat:** `https://docs.click.uz`

### 10.3. Idempotentlik
- Har bir webhook chaqiruvi **idempotent** bo'lishi shart: bir tranzaksiya ikki marta PAID bo'lmasligi va ikkita invite link yaratilmasligi kerak.
- `Transaction.providerTxnId` bo'yicha unique tekshiruv.

---

## 11. Rejalashtirilgan vazifalar (Cron Jobs)

| Job | Jadval | Vazifa |
|-----|--------|--------|
| `expireSubscriptions` | har soatda | Muddati tugagan obunalarni topib, kanaldan chiqarish + EXPIRED qilish + xabar |
| `sendReminders` | har kuni soat 10:00 | 3 va 1 kun qolgan obunalarga eslatma + yangilash tugmasi |
| `cleanupPending` | har 6 soatda | 24 soatdan ortiq PENDING bo'lgan tranzaksiyalarni FAILED qilish |

> Cron joblar **ban/kick** qilganda Telegram rate-limit'ni hisobga olib, ketma-ket (throttle bilan) ishlashi kerak.

---

## 12. Web Dashboard (Creator paneli)

### 12.1. Sahifalar
- **Login** — Telegram Login Widget orqali.
- **Overview** — daromad, aktiv obunachilar, kanallar soni.
- **Channels** — ulangan kanallar ro'yxati.
- **Plans** — tarif yaratish/tahrirlash.
- **Subscribers** — obunachilar jadvali (status, muddat, qo'lda boshqarish).
- **Settings** — merchant kalitlari (Payme/Click), profil.

### 12.2. Autentifikatsiya
- **Asosiy usul — Magic link (bot orqali):**
  1. Creator botda `/dashboard` yozadi
  2. Bot 5 daqiqalik bir martalik token yaratadi (`LoginToken` jadvalida)
  3. Bot `{DASHBOARD_URL}/login?token=<token>` havolasini yuboradi
  4. `/login` sahifasi tokenni `POST /api/auth/login` ga yuboradi
  5. Backend tokenni tekshirib, JWT httpOnly cookie beradi
- **Muqobil usul — Telegram Login Widget:**
  - `POST /api/auth/telegram` orqali HMAC-SHA256 tekshiruvi
  - Hozirda `/login` sahifasida ham mavjud (fallback)
- Muvaffaqiyatdan keyin **JWT** (httpOnly cookie, 30 kun) beriladi.

---

## 13. REST API (asosiy endpoint'lar)

```
POST   /auth/telegram          -> Telegram Login Widget tekshiruvi, JWT
POST   /auth/login             -> Magic link token tekshiruvi, JWT (body: { token })
GET    /me                     -> joriy creator profili
GET    /channels               -> creator kanallari
GET    /plans                  -> tariflar
POST   /plans                  -> tarif yaratish
PATCH  /plans/:id              -> tarif tahrirlash
DELETE /plans/:id              -> tarif o'chirish (soft delete)
GET    /subscribers            -> obunachilar (filter: status)
POST   /subscribers/:id/extend -> muddatni qo'lda uzaytirish
POST   /subscribers/:id/revoke -> qo'lda chiqarish
PUT    /settings/merchant      -> merchant kalitlarini saqlash (shifrlab)
GET    /stats                  -> daromad/obuna statistikasi

// Webhook'lar (auth talab qilmaydi, lekin imzo tekshiriladi)
POST   /payments/payme
POST   /payments/click/prepare
POST   /payments/click/complete
```

---

## 14. Loyiha strukturasi

```
telegram-paid-channel-saas/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── bot/
│   │   ├── index.ts              # grammY bot setup
│   │   ├── commands/             # /start, /status, /creator ...
│   │   ├── conversations/        # FSM oqimlari
│   │   └── keyboards/            # inline tugmalar
│   ├── api/
│   │   ├── server.ts             # Express app
│   │   ├── routes/               # auth, plans, subscribers, stats
│   │   └── middleware/           # JWT, error handler
│   ├── payments/
│   │   ├── payme/                # JSON-RPC handler + checkout
│   │   └── click/                # prepare/complete + sign verify
│   ├── services/
│   │   ├── subscription.service.ts
│   │   ├── telegram-access.service.ts   # invite/kick mantiqi
│   │   ├── payment.service.ts
│   │   └── creator.service.ts
│   ├── cron/
│   │   ├── expire.job.ts
│   │   ├── reminders.job.ts
│   │   └── cleanup.job.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── crypto.ts             # AES-256-GCM shifrlash
│   │   ├── logger.ts
│   │   └── config.ts             # env validatsiya (Zod)
│   └── index.ts                  # entry point (bot + api + cron)
├── dashboard/                    # React + Vite frontend
│   ├── src/
│   └── ...
├── .env.example
├── docker-compose.yml            # postgres (dev uchun)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 15. Environment Variables (`.env.example`)

```env
# Server
NODE_ENV=production
PORT=3000
PUBLIC_URL=https://yourdomain.uz

# Telegram
BOT_TOKEN=
BOT_USERNAME=

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/saas

# Security
JWT_SECRET=
ENCRYPTION_KEY=        # 32-baytli kalit (merchant kalitlarini shifrlash uchun)

# Dashboard
DASHBOARD_URL=https://yourdomain.uz/app
```

> Creator-ga oid Payme/Click kalitlari **.env'da emas**, bazada (shifrlab) saqlanadi, chunki ular har bir creator uchun har xil.

---

## 16. Xavfsizlik talablari

- **S-01:** Merchant kalitlari (`payme_key`, `click_secret`) bazada **AES-256-GCM** bilan shifrlangan holda saqlanadi; faqat to'lov chaqiruvida deshifrlanadi.
- **S-02:** Payme `Authorization` header'i va Click `sign_string` **har bir webhook'da** tekshiriladi.
- **S-03:** Webhook handlerlar **idempotent** (takroriy chaqiruvga chidamli).
- **S-04:** Telegram Login `initData` HMAC-SHA256 bilan tasdiqlanadi.
- **S-05:** Invite linklar **bir martalik** (`member_limit: 1`) va muddatli (`expire_date`).
- **S-06:** API endpoint'lar **rate-limiting** bilan himoyalanadi.
- **S-07:** Barcha foydalanuvchi inputlari **Zod** orqali validatsiya qilinadi.
- **S-08:** Maxfiy ma'lumot (kalitlar) bot chatida kiritilgach, xabar **o'chiriladi**.
- **S-09:** Loglarga maxfiy ma'lumot **yozilmaydi**.

---

## 17. MVP bosqichlari (Roadmap)

### Bosqich 1 — Yadro mexanizmi (to'lovsiz)
- Loyiha skeleti, Prisma schema, DB migratsiya.
- Bot ishga tushadi; creator botni kanalga admin qilib ulay oladi.
- `TelegramAccessService`: invite link yaratish + kick ishlaydi.
- Cron: test obunani muddati tugaganda chiqarib yuboradi.
- **Natija:** to'lovsiz, qo'lda yaratilgan obuna butun siklni o'taydi.

### Bosqich 2 — To'lov integratsiyasi
- Payme JSON-RPC handler (CheckPerform/Create/Perform/Cancel/Check).
- Click Prepare/Complete handler + imzo tekshiruvi.
- To'lov tasdiqlangach invite link avtomatik yuboriladi.
- **Natija:** to'liq avtomatik to'lov ⟶ kirish oqimi.

### Bosqich 3 — Multi-tenant + dashboard
- Bir nechta creator, har biri o'z kanali va merchant kalitlari bilan.
- React dashboard: login, tariflar, obunachilar, statistika.
- **Natija:** real creatorlar mustaqil foydalana oladi.

### Bosqich 4 — Polish
- Eslatmalar, yangilash oqimi, SaaS tariflari, platform admin paneli.

---

## 18. Qabul qilish mezonlari (Acceptance Criteria)

- [ ] Creator botni kanalga admin qilib ulaganda, kanal avtomatik bazaga yoziladi.
- [ ] Subscriber tarif tanlab, to'lov havolasini oladi.
- [ ] Payme sandbox'da to'lov qilinganda webhook PerformTransaction ishlaydi.
- [ ] Click sandbox'da Prepare va Complete to'g'ri javob qaytaradi.
- [ ] To'lov muvaffaqiyatli bo'lgach, subscriber bir martalik link oladi va kanalga kira oladi.
- [ ] Link ikkinchi marta ishlatib bo'lmaydi.
- [ ] Muddat tugaganda cron subscriber'ni kanaldan chiqaradi.
- [ ] Bir webhook ikki marta kelsa, ikkita link/tranzaksiya yaratilmaydi (idempotentlik).
- [ ] Merchant kalitlari bazada shifrlangan ko'rinishda saqlanadi.
- [ ] Dashboard'da daromad va obunachilar to'g'ri ko'rinadi.

---

## 19. Kelajakdagi kengaytmalar (MVP'dan keyin)

- Telegram Stars orqali to'lov (global bozor uchun).
- Bir nechta kanal uchun bitta obuna (bundle).
- Referral / promokod tizimi.
- Avtomatik yangilanuvchi obuna (recurring) — Payme/Click subscribe API.
- Telegram Mini App ko'rinishidagi boy interfeys.
- Ko'p tilli interfeys (uz/ru/en).
- Analytics: churn rate, LTV, retention.

---

## 20. Claude Code uchun ko'rsatma

Ushbu loyihani qurishda quyidagi tartibda yuring:
1. Avval **Bosqich 1**ni to'liq ishlatib, yadro mexanizmini isbotlang (to'lovsiz).
2. Har bosqichdan keyin lokal test qiling (Telegram test kanal + bot).
3. To'lovlarni avval **sandbox** rejimida sinab ko'ring (real pul emas).
4. Kodni TypeScript strict rejimda yozing; barcha service'lar testlanadigan (alohida) bo'lsin.
5. `README.md`da setup qadamlarini (env, migratsiya, ishga tushirish) yozing.

> **Birinchi prompt namunasi:** "Ushbu TZ asosida Bosqich 1ni qur: Node.js + TypeScript + grammY + Prisma + PostgreSQL skeleti, Creator botni kanalga ulay olishi, va TelegramAccessService orqali invite link yaratish hamda muddat tugaganda kick qilish mexanizmi. Hozircha to'lovsiz."
