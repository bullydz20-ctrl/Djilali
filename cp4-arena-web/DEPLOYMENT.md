# دليل تجهيز وتشغيل CP4 ARENA على استضافة خارجية

## المتطلبات الأساسية
- **Node.js `>= 22.5.0`** (لأن المحرك الداخلي يستخدم `node:sqlite` المدمج في Node 22).
- **لحفظ المعطيات بشكل دائم 100% على باقة Render المجانية (مهم جداً):**
  - أضف متغير البيئة `DATABASE_URL` برابط قاعدة بيانات **PostgreSQL** مجانية (مثل **Neon.tech** أو **Supabase** أو **Render Postgres**).
  - يقوم الخادم بمزامنة البطولات واللاعبين والمباريات والحسابات **وحتى الصور المرفوعة** تلقائياً مع PostgreSQL عند كل تعديل، ويسترجعها فور استيقاظ الموقع بعد السكون دون أي فقدان للبيانات.

---

## 1. النشر على Render (الباقة المجانية Free بدون ضياع البيانات بعد السكون)
على باقة **Render Free**، يدخل الخادم في وضع السكون (Sleep) بعد 15 دقيقة من عدم النشاط ويُعاد إنشاؤه بقرص مؤقت فارغ؛ لذا اتبع الخطوات التالية لحفظ كل شيء دائماً:

1. أنشئ قاعدة بيانات **PostgreSQL مجانية** (مثلاً على [Neon.tech](https://neon.tech) أو من لوحة Render نفسها عبر **New + -> PostgreSQL**) وانسخ رابط الاتصال (`postgres://...` أو `postgresql://...`).
2. في إعدادات خدمة الويب على Render (**Environment -> Environment Variables**)، أضف المتغيرات التالية:
   - `DATABASE_URL` = رابط PostgreSQL الذي نسخته (ضروري لمنع مسح البيانات والصور بعد سكون الموقع).
   - `JWT_SECRET` = أي نص عشوائي طويل (يبقيك والمشرفين المساعدين مسجلين تلقائياً بعد السكون وإعادة التشغيل).
   - `CP4_HEAD_ADMIN_USERNAME` = `Djilali` (اختياري).
   - `CP4_HEAD_ADMIN_PIN` = رمز PIN من 6 أرقام (اختياري؛ إذا تركته فارغاً تنشئه من واجهة الموقع عند أول فتح).
3. إعدادات البناء والتشغيل في Render (**Web Service** وليس Static Site):
   - **Root Directory:** `cp4-arena-web` (إذا كان في مجلد فرعي داخل المستودع)
   - **Build Command:** `npm ci --include=dev && npm run build`
   - **Start Command:** `npm start`
4. بمجرد إعادة التشغيل، ستظهر في لوحة الإدارة شارة خضراء: **«حفظ سحابي دائم (PostgreSQL)»**.
   - كما يمكنك في أي وقت تنزيل **نسخة احتياطية كاملة (JSON)** أو استعادتها بنقرة واحدة من أعلى لوحة المشرف الرئيسي.

> **ملاحظة:** إذا كنت تستخدم باقة **Starter** المدفوعة من Render مع قرص دائم على `/var/data` بدون PostgreSQL، اضبط:
> - `CP4_DB_PATH=/var/data/cp4_arena.db`
> - `CP4_UPLOADS_DIR=/var/data/uploads`
> - `CP4_PERSISTENT_STORAGE=true`

---

## 2. التشغيل المحلي أو على VPS (Ubuntu / Debian)

```bash
cd cp4-arena-web
cp .env.example .env
# عدّل .env وأضف JWT_SECRET (و DATABASE_URL إذا أردت مزامنة سحابية)

npm ci
npm run build
npm start
```

### تشغيل مستمر عبر PM2
```bash
npm install -g pm2
pm2 start server/index.js --name cp4-arena
pm2 save
pm2 startup
```

### إعداد Nginx كـ Reverse Proxy (مع دعم التحديث الفوري SSE)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 6M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # مهم لمسار التحديثات اللحظية /api/events
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```
> بعد ضبط النطاق، فعّل HTTPS عبر Certbot (`certbot --nginx -d your-domain.com`) ليعمل تثبيت PWA على Safari وChrome بشكل كامل.

---

## 3. التشغيل عبر Docker
```bash
cd cp4-arena-web
docker build -t cp4-arena-web .
docker run -d \
  --name cp4-arena \
  --restart unless-stopped \
  -p 3000:3000 \
  -v cp4_arena_data:/data \
  -e JWT_SECRET="ضع-مفتاحاً-عشوائياً-من-64-حرفاً" \
  -e DATABASE_URL="postgres://..." \
  cp4-arena-web
```

---

## 4. التحقق بعد التشغيل
- افحص صحة الخادم وحالة التخزين: `GET /api/health` -> يعيد `{"ok":true,"persistence":{"mode":"postgres","isDurable":true,...}}`
- إذا ظهرت رسالة `Not Found` عند فتح الموقع على Render، فتأكد أن النوع **Web Service (Node)** وليس Static Site وأن `npm run build` أُنجز بنجاح.
