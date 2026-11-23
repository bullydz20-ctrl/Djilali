# استعادة نسخة قاعدة البيانات الاحتياطية على Render

تحتوي هذه الحزمة على مجلدين منفصلين:
1. `cp4-arena-web/` — كود الموقع الكامل وملفات التشغيل والنشر على Render (`render.yaml` و`package.json` و`server/` و`src/`).
2. `database-backup/` — نسخة احتياطية سليمة ومستقلة من قاعدة البيانات (`cp4_arena.db`) مستخرجة عبر **SQLite Backup API** ومتوافقة مع الإنتاج.

## خطوات النشر واستعادة قاعدة البيانات على Render

1. ارفع محتوى مجلد `cp4-arena-web/` إلى مستودع GitHub (أو اربط المجلد كـ **Root Directory: cp4-arena-web**).
2. أنشئ الخدمة على Render (باستخدام **Blueprint** عبر `render.yaml` أو كـ **Web Service**):
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Persistent Disk Mount Path:** `/var/data`
   - **Environment Variables:**
     - `NODE_VERSION=22`
     - `CP4_DB_PATH=/var/data/cp4_arena.db`
     - `CP4_UPLOADS_DIR=/var/data/uploads`
     - `CP4_SESSION_SECRET=<سلسلة عشوائية طويلة>`
3. لاستعادة بياناتك الحالية (`cp4_arena.db`) إلى القرص الدائم على Render:
   - افتح **Shell** الخاص بالخدمة في Render (أو اتصل عبر SSH).
   - انسخ ملف `database-backup/cp4_arena.db` إلى المسار `/var/data/cp4_arena.db` (مثلاً عبر رفعه من رابط آمن مؤقت أو عبر `scp` / Render SSH).
   - أعد تشغيل الخدمة (**Manual Restart**) ليقرأ الخادم القاعدة المستعادة فوراً.

## ملاحظة حول الصور المرفوعة
- تم استرجاع جميع جداول القاعدة وبيانات البطولة وحساب المشرف الرئيسي (`Djilali`) بنجاح (`PRAGMA integrity_check = ok`).
- حقل `banner_url` للبطولة يشير إلى `/uploads/f254010c-a990-4de4-98ef-6300c5beaea6.png`؛ هذا الملف لم يكن موجوداً داخل مساحة العمل الحالية (المتبقّي كان `cp4_arena.db-wal` و`cp4_arena.db-shm` فقط)، لذلك سيعرض الموقع الغلاف الافتراضي بأمان أو يمكنك إعادة رفع صورة الغلاف من لوحة الإدارة بعد النشر.
