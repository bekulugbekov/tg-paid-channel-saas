# Production Deploy Runbook

Bu qo'llanma **VPS + Docker Compose + Caddy** muhitiga production deploy uchun.  
Barcha qadamlar **qo'lda** bajariladi — serverga SSH bilan kiring.

---

## Talablar

| Resurs | Minimum |
|--------|---------|
| VPS RAM | 1 GB |
| Disk | 20 GB |
| OS | Ubuntu 22.04 / Debian 12 |
| Docker | ≥ 24.x |
| Docker Compose | ≥ 2.x (plugin) |

---

## 1. DNS sozlash

Domain registraturangizda `A` yozuvini VPS IP manziliga yo'naltiring:

```
yourdomain.com    A    <VPS_IP>
```

> Caddy Let's Encrypt sertifikati olish uchun 80/443 portlar ochiq va DNS tayyor bo'lishi kerak.

---

## 2. VPS tayyorlash

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER   # re-login kerak

# UFW — faqat 22, 80, 443 portlarni ochish
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## 3. Loyihani serverga ko'chirish

```bash
# Git clone (yoki scp/rsync)
git clone https://github.com/your-org/tg-paid-channel-saas.git /opt/tg-saas
cd /opt/tg-saas
```

---

## 4. Environment faylini tayyorlash

```bash
cp .env.production.example .env.production
nano .env.production   # barcha qiymatlarni to'ldiring (quyidagi bo'limlarga qarang)
```

### 4.1 JWT_SECRET generatsiya

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Natijani `JWT_SECRET=` ga qo'ying.

### 4.2 ENCRYPTION_KEY generatsiya

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Natijani `ENCRYPTION_KEY=` ga qo'ying.

> ⚠️ **DIQQAT:** `ENCRYPTION_KEY` ni alohida xavfsiz joyda (masaln, parol menejerida) zaxiralang.
> Bu kalit yo'qolsa, barcha creator'larning Payme/Click kalitlari o'qib bo'lmaydi.

### 4.3 .env.production minimal to'ldirish misoli

```env
NODE_ENV=production
PORT=3000
PUBLIC_URL=https://yourdomain.com
BOT_TOKEN=1234567890:ABCdef...
BOT_USERNAME=YourBotName
DATABASE_URL=postgresql://saas:StrongPass123@postgres:5432/tg_saas
DIRECT_URL=postgresql://saas:StrongPass123@postgres:5432/tg_saas
POSTGRES_USER=saas
POSTGRES_PASSWORD=StrongPass123
POSTGRES_DB=tg_saas
JWT_SECRET=<node -e ... natijasi>
ENCRYPTION_KEY=<node -e ... natijasi>
DASHBOARD_URL=https://yourdomain.com
ADMIN_TELEGRAM_ID=976755848
```

---

## 5. Caddyfile domenini sozlash

```bash
nano Caddyfile
```

`yourdomain.com` ni haqiqiy domeningiz bilan almashtiring:

```
yourdomain.com {
    encode gzip
    header_up X-Real-IP {remote_host}
    header_up X-Forwarded-Proto {scheme}
    reverse_proxy app:3000
}
```

---

## 6. Docker image qurish va ishga tushirish

```bash
cd /opt/tg-saas

# Image qurish
docker compose -f docker-compose.prod.yml build

# Fon rejimida ishga tushirish
docker compose -f docker-compose.prod.yml up -d

# Holat tekshirish
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
```

> Entrypoint `prisma migrate deploy` ni avtomatik bajaradi. Logda `"Starting application..."` ko'rinsangiz, migratsiyalar muvaffaqiyatli o'tgan.

---

## 7. Telegram webhook o'rnatish

Ilova ishga tushgandan so'ng webhook o'rnating:

```bash
# Server ichida ishga tushirish (muhit o'zgaruvchilar .env.production'dan o'qiladi)
docker compose -f docker-compose.prod.yml exec app \
  node -e "
const {Bot} = require('grammy');
const bot = new Bot(process.env.BOT_TOKEN);
const url = process.env.PUBLIC_URL + '/bot/' + process.env.BOT_TOKEN;
bot.api.setWebhook(url, {
  allowed_updates: ['message','callback_query','my_chat_member','chat_member'],
  drop_pending_updates: true
}).then(() => bot.api.getWebhookInfo()).then(i => console.log('Webhook:', i.url));
"
```

Yoki lokal mashinadan (`.env.production` mavjud bo'lsa):

```bash
npx ts-node --esm scripts/set-webhook.ts
```

---

## 8. Payme webhook URL ro'yxatdan o'tkazish

[Merchant Payme kabinetiga](https://merchant.paycom.uz) kiring:

1. **Kassa** → sozlamalar
2. **Notify URL** maydoniga: `https://yourdomain.com/payments/payme`
3. Saqlang

---

## 9. Click webhook URL ro'yxatdan o'tkazish

[My.Click kabinetiga](https://my.click.uz) kiring:

1. **Merchant** → **Xizmat** → tahrirlash
2. Quyidagi URL'larni belgilang:
   - **Prepare URL**: `https://yourdomain.com/payments/click/prepare`
   - **Complete URL**: `https://yourdomain.com/payments/click/complete`
3. Saqlang

---

## 10. Sog'liqni tekshirish

```bash
# Health endpoint
curl https://yourdomain.com/health
# → {"status":"ok","timestamp":"..."}

# HTTPS sertifikati
curl -I https://yourdomain.com
# → HTTP/2 200

# Bot webhook holati
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo
# → {"ok":true,"result":{"url":"https://yourdomain.com/bot/...","pending_update_count":0}}
```

---

## 11. Kunlik backup sozlash

```bash
chmod +x /opt/tg-saas/scripts/backup.sh

# Cron job qo'shish (har kuni soat 02:00 da)
crontab -e
```

Quyidagi qatorni qo'shing:

```
0 2 * * * cd /opt/tg-saas && ./scripts/backup.sh >> /var/log/tg-saas-backup.log 2>&1
```

Backuplar `/var/backups/tg-saas/` papkasiga saqlanadi, 7 kundan eskilari o'chiriladi.

---

## 12. Yangilash (update) jarayoni

```bash
cd /opt/tg-saas
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --no-deps app
```

> Entrypoint yangi migratsiyalarni avtomatik bajaradi.

---

## 13. Foydali buyruqlar

```bash
# Loglar (real-time)
docker compose -f docker-compose.prod.yml logs -f app

# Konteyner ichiga kirish
docker compose -f docker-compose.prod.yml exec app sh

# PostgreSQL CLI
docker compose -f docker-compose.prod.yml exec postgres psql -U saas tg_saas

# Barcha konteynerlarni to'xtatish
docker compose -f docker-compose.prod.yml down

# To'xtatish + volume'larni o'chirish (BARCHA DATA YO'QOLADI!)
docker compose -f docker-compose.prod.yml down -v
```

---

## 14. Telegram Bot domen sozlash (Telegram Login Widget uchun)

Dashboard'dagi Telegram Login Widget ishlaши uchun `@BotFather`'da domenni ro'yxatdan o'tkazing:

```
/setdomain → Bot tanlash → yourdomain.com
```

---

## Xavfsizlik tekshiruvi

- [ ] `.env.production` git'ga commit bo'lmagan (`git status` bilan tekshiring)
- [ ] `JWT_SECRET` ≥ 32 belgidan iborat
- [ ] `ENCRYPTION_KEY` = 64 hex belgi (32 bayt)
- [ ] Faqat 80/443 portlar ochiq (`ufw status`)
- [ ] PostgreSQL port tashqaridan yopiq (docker-compose.prod.yml'da expose yo'q)
- [ ] HTTPS sertifikati amal qilmoqda (`curl -I https://yourdomain.com`)
- [ ] `ENCRYPTION_KEY` xavfsiz joyda zaxiralangan
