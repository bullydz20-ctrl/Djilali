# دليل تجهيز وتشغيل CP4 ARENA على استضافة خارجية

## المتطلبات الأساسية
- **Node.js `>= 22.5.0`** (ضروري لأن قاعدة البيانات تستخدم `node:sqlite` المدمجة في Node 22).
- **قرص تخزين دائم (Persistent Disk / Volume)** لحفظ ملف قاعدة البيانات `cp4_arena.db` ومجلد الصور المرفوعة `uploads/`.

---

## 1. التشغيل المحلي أو على VPS (Ubuntu / Debian)

```bash
cd cp4-arena-web
cp .env.example .env
# عدّل .env وأضف قيمة قوية للمتغير CP4_SESSION_SECRET

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

## 2. التشغيل عبر Docker
```bash
cd cp4-arena-web
docker build -t cp4-arena-web .
docker run -d \
  --name cp4-arena \
  --restart unless-stopped \
  -p 3000:3000 \
  -v cp4_arena_data:/data \
  -e CP4_SESSION_SECRET="ضع-مفتاحاً-عشوائياً-من-64-حرفاً" \
  cp4-arena-web
```

---

## 3. النشر على Render أو Railway
- أنشئ الخدمة على Render كـ **Web Service** (وليس Static Site، لأن المشروع يجمع الواجهة والخادم وقاعدة البيانات معاً).
- إذا رفعت مجلد `cp4-arena-web/` داخل مستودع، اضبط **Root Directory** على `cp4-arena-web` (أو ارفع محتوى `cp4-arena-web/` مباشرة في الجذر).
- **Build Command:** `npm ci --include=dev && npm run build` (مهم لتثبيت `vite` و`typescript` حتى مع وجود `NODE_ENV=production`).
- **Start Command:** `npm start`
- اربط قرصاً دائماً (Persistent Disk / Volume) على المسار `/var/data` (في Render يمكنك استخدام ملف `render.yaml` الجاهز).
- اضبط المتغيرات البيئية التالية:
  - `CP4_DB_PATH=/var/data/cp4_arena.db`
  - `CP4_UPLOADS_DIR=/var/data/uploads`
  - `JWT_SECRET=<مفتاح عشوائي طويل>` (لتوقيع جلسات المشرف الرئيسي والحسابات المساعدة وحفظ الدخول تلقائياً حتى بعد إعادة تشغيل الخادم؛ وإذا لم يُضبط يُستخدم `ADMIN_PASSWORD` أو `CP4_SESSION_SECRET`)
  - `CP4_HEAD_ADMIN_USERNAME=Djilali` (اختياري)
  - `CP4_HEAD_ADMIN_PIN=<رمز PIN من 6 أرقام>` (اختياري؛ إذا تركته فارغاً يمكنك إنشاء المشرف الرئيسي من شاشة الإدارة عند أول دخول)

> **تنبيه مهم:** إذا ظهرت رسالة `Not Found` عند فتح الموقع على Render، فغالباً السبب أحد ثلاثة أمور:
> 1. الخدمة لم تُنشر بعد على هذا الرابط أو أن Render أعطاك رابطاً مختلفاً (مثل `https://cp4-arena-xxxx.onrender.com`).
> 2. تم نشر المشروع كـ **Static Site** بدلاً من **Web Service (Node)**.
> 3. لم يتم ضبط **Root Directory** على `cp4-arena-web` عند الرفع، أو لم يُبنَ مجلد `dist/` عبر `npm ci --include=dev && npm run build`.

---

## 4. التحقق بعد التشغيل
- افحص صحة الخادم وقاعدة البيانات: `GET /api/health` -> يعيد `{"ok":true,"service":"cp4-arena-api",...}`
- احتفظ بنسخة احتياطية دورية من مجلد البيانات (`cp4_arena.db*` و`uploads/`).
