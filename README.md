# Telegram Pullik Kanal SaaS — Bosqich 1

Telegram kanallar uchun obuna boshqarish tizimi (to'lovsiz yadro).

## Texnologiyalar

- Node.js 20 + TypeScript (strict)
- grammY (Telegram bot framework)
- Express (HTTP server / webhook)
- Prisma ORM + PostgreSQL
- node-cron (scheduled jobs)

---

## Sozlash (Setup)

### 1. O'rnatish

```bash
npm install
```

### 2. Environment o'zgaruvchilarini sozlash

```bash
cp .env.example .env
```

`.env` faylini to'ldiring:

| O'zgaruvchi | Tavsif | Misol |
|-------------|--------|-------|
| `BOT_TOKEN` | BotFather'dan olingan token | `123456:ABC-DEF...` |
| `DATABASE_URL` | PostgreSQL ulanish string'i | `postgresql://saas:saas_pass@localhost:5432/tg_saas` |
| `JWT_SECRET` | Kamida 32 belgi | — |
| `ENCRYPTION_KEY` | 64 hex belgi (32 bayt) | — |
| `ADMIN_TELEGRAM_ID` | Platforma admin Telegram ID | `123456789` |
| `PUBLIC_URL` | Webhook URL (production). Bo'sh qoldiring → long-polling | `https://yourdomain.uz` |

**Kalit generatsiya:**

```bash
# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 3. PostgreSQL ishga tushirish (local dev)

```bash
docker compose up -d
```

### 4. Prisma migration

```bash
npm run db:generate   # Prisma client generatsiya
npm run db:migrate    # Migratsiya yaratish va qo'llash
```

### 5. Botni ishga tushirish

```bash
# Development (long-polling)
npm run dev

# Production build
npm run build
npm start
```

---

## Test qilish (lokal)

### Telegram test muhiti sozlash

1. BotFather'dan yangi bot yarating: `/newbot`
2. `.env` fayliga `BOT_TOKEN` ni yozing
3. `ADMIN_TELEGRAM_ID` ni o'z Telegram ID'ingizga qo'ying
   - ID'ingizni bilish: [@userinfobot](https://t.me/userinfobot) botiga yozing

### To'liq test siklini o'tkazish

**Qadam 1 — Kanalga bot ulash**

1. Telegram'da yangi **Private channel** yarating
2. Channel settings → Administrators → Add Administrator
3. Botingizni qidiring → Admin qilib qo'shing
4. Huquqlar: ✅ Invite Users, ✅ Restrict Members
5. Botga `/creator` yozing — kanal ro'yxatdan o'tganini ko'rasiz

**Qadam 2 — Test obuna yaratish**

Bot bilan private chatda:

```
/testsub -1001234567890 1
```

`-1001234567890` o'rniga real kanal ID'ingizni qo'ying.
`1` — 1 kunlik test obuna.

Kanal ID'ini `/creator` buyrug'i natijasidan olishingiz mumkin.

**Natija:** Bot bir martalik kirish havolasini beradi.

**Qadam 3 — Kanalga kirish**

Olingan havolaga bosib kanalga kiring. Havola bir martadan ko'p ishlatib bo'lmaydi.

**Qadam 4 — Muddat tugashini tekshirish**

Cron job har soatda ishlaydi. Tez test uchun, bazada `expiresAt` ni o'tgan sana qilib qo'ying:

```bash
npm run db:studio
```

Prisma Studio'da `Subscription` jadvaliga kirib, `expiresAt` ni o'tgan sana qilib o'zgartiring. Keyin cron job'ni qo'lda chaqirish uchun botni qayta ishga tushiring — keyingi soatda ishlaydi, yoki kodni vaqtincha qo'lda trigger qiling.

---

## Loyiha strukturasi

```
src/
├── bot/
│   ├── index.ts              # Handler'larni ro'yxatdan o'tkazish
│   ├── types.ts              # MyContext type
│   ├── commands/
│   │   ├── start.ts
│   │   ├── status.ts
│   │   ├── creator.ts
│   │   ├── help.ts
│   │   └── test-sub.ts       # Test obuna (admin/creator uchun)
│   └── handlers/
│       └── channel-admin.ts  # my_chat_member handler
├── services/
│   ├── creator.service.ts
│   ├── telegram-access.service.ts  # Invite link + kick
│   └── subscription.service.ts
├── cron/
│   └── expire.job.ts         # Har soatda muddati tugaganlarni chiqaradi
├── api/
│   └── server.ts             # Express app
├── lib/
│   ├── config.ts             # Zod env validatsiya
│   ├── prisma.ts             # PrismaClient singleton
│   ├── logger.ts             # pino logger
│   └── crypto.ts             # AES-256-GCM shifrlash
└── index.ts                  # Entry point
```

---

## Keyingi bosqich (Bosqich 2)

- Payme JSON-RPC webhook (CheckPerform / Create / Perform / Cancel)
- Click Prepare/Complete webhook + imzo tekshiruvi
- To'lov tasdiqlanganda avtomatik invite link

---

## Muhim eslatmalar

- Kanal ID Telegram'da manfiy raqam: `-1001234567890`
- `banChatMember` + darhol `unbanChatMember` → foydalanuvchi chiqariladi, lekin keyinchalik yangi link bilan qaytishi mumkin
- Invite link `member_limit: 1` — bir martadan ko'p ishlatib bo'lmaydi (S-05 xavfsizlik talabi)
- Merchant kalitlari (Payme/Click) bazada AES-256-GCM bilan shifrlangan holda saqlanadi
