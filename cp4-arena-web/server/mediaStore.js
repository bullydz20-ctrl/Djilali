import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const EXT_TO_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};

export function createMediaStore({ dbPath, uploadsDir, cloudStore = null } = {}) {
  const resolvedUploadsDir = path.resolve(uploadsDir || path.resolve(process.cwd(), 'data', 'uploads'));
  fs.mkdirSync(resolvedUploadsDir, { recursive: true });

  const mediaDbPath =
    !dbPath || dbPath === ':memory:'
      ? ':memory:'
      : `${path.resolve(dbPath)}.media.db`;

  if (mediaDbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(mediaDbPath), { recursive: true });
  }

  const mediaDb = new DatabaseSync(mediaDbPath);
  mediaDb.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS media_files (
      filename TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  function safeDiskPath(filename) {
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename)) return null;
    const targetPath = path.resolve(resolvedUploadsDir, filename);
    if (!targetPath.startsWith(resolvedUploadsDir + path.sep)) return null;
    return targetPath;
  }

  async function saveImage({ filename, ext, buffer, createdAt = Date.now() }) {
    const mimeType = EXT_TO_MIME[String(ext || '').toLowerCase()] || 'image/png';
    const targetPath = safeDiskPath(filename);
    if (!targetPath) {
      throw new Error('Invalid media filename');
    }
    fs.writeFileSync(targetPath, buffer);

    mediaDb
      .prepare(`
        INSERT INTO media_files (filename, mime_type, data, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(filename) DO UPDATE SET
          mime_type = excluded.mime_type,
          data = excluded.data
      `)
      .run(filename, mimeType, buffer, createdAt);

    if (cloudStore?.isEnabled?.()) {
      await cloudStore.saveMediaFile({ filename, mimeType, buffer, createdAt });
    }

    return { url: `/uploads/${filename}`, mimeType };
  }

  async function getImage(filename) {
    const targetPath = safeDiskPath(filename);
    if (!targetPath) return null;

    const ext = filename.split('.').pop()?.toLowerCase() || 'png';
    const fallbackMime = EXT_TO_MIME[ext] || 'image/png';

    // 1. Fast disk cache hit
    if (fs.existsSync(targetPath)) {
      return {
        buffer: fs.readFileSync(targetPath),
        mimeType: fallbackMime
      };
    }

    // 2. Local SQLite media_files fallback (restores missing uploads folder files)
    const row = mediaDb
      .prepare('SELECT mime_type, data FROM media_files WHERE filename = ?')
      .get(filename);
    if (row && row.data) {
      const buf = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
      fs.mkdirSync(resolvedUploadsDir, { recursive: true });
      fs.writeFileSync(targetPath, buf);
      return {
        buffer: buf,
        mimeType: row.mime_type || fallbackMime
      };
    }

    // 3. Cloud PostgreSQL cp4_media_files fallback (recovers after container sleep/redeploy)
    if (cloudStore?.isEnabled?.()) {
      const remote = await cloudStore.getMediaFile(filename);
      if (remote && remote.data) {
        const buf = Buffer.isBuffer(remote.data) ? remote.data : Buffer.from(remote.data);
        fs.mkdirSync(resolvedUploadsDir, { recursive: true });
        fs.writeFileSync(targetPath, buf);
        mediaDb
          .prepare(`
            INSERT INTO media_files (filename, mime_type, data, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
              mime_type = excluded.mime_type,
              data = excluded.data
          `)
          .run(filename, remote.mimeType || fallbackMime, buf, remote.createdAt || Date.now());
        return {
          buffer: buf,
          mimeType: remote.mimeType || fallbackMime
        };
      }
    }

    return null;
  }

  function exportAllMedia() {
    const byName = new Map();
    const rows = mediaDb.prepare('SELECT filename, mime_type, data, created_at FROM media_files ORDER BY created_at ASC').all();
    for (const r of rows) {
      const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
      byName.set(r.filename, {
        filename: r.filename,
        mimeType: r.mime_type,
        base64: buf.toString('base64'),
        createdAt: Number(r.created_at)
      });
    }
    if (fs.existsSync(resolvedUploadsDir)) {
      for (const file of fs.readdirSync(resolvedUploadsDir)) {
        if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(file)) continue;
        if (byName.has(file)) continue;
        const full = path.join(resolvedUploadsDir, file);
        const buf = fs.readFileSync(full);
        const ext = file.split('.').pop()?.toLowerCase() || 'png';
        byName.set(file, {
          filename: file,
          mimeType: EXT_TO_MIME[ext] || 'image/png',
          base64: buf.toString('base64'),
          createdAt: Math.round(fs.statSync(full).mtimeMs || Date.now())
        });
      }
    }
    return Array.from(byName.values());
  }

  async function restoreAllMedia(items = []) {
    if (!Array.isArray(items)) return 0;
    let restored = 0;
    for (const item of items) {
      const filename = String(item?.filename || '');
      const targetPath = safeDiskPath(filename);
      if (!targetPath || !item?.base64) continue;
      const buffer = Buffer.from(String(item.base64), 'base64');
      if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024) continue;
      const ext = filename.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = EXT_TO_MIME[ext] || String(item.mimeType || 'image/png');
      const createdAt = Number(item.createdAt) || Date.now();
      fs.mkdirSync(resolvedUploadsDir, { recursive: true });
      fs.writeFileSync(targetPath, buffer);
      mediaDb
        .prepare(`
          INSERT INTO media_files (filename, mime_type, data, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(filename) DO UPDATE SET
            mime_type = excluded.mime_type,
            data = excluded.data
        `)
        .run(filename, mimeType, buffer, createdAt);
      if (cloudStore?.isEnabled?.()) {
        await cloudStore.saveMediaFile({ filename, mimeType, buffer, createdAt });
      }
      restored += 1;
    }
    return restored;
  }

  function close() {
    try {
      mediaDb.close();
    } catch {
      // ignore close errors
    }
  }

  return {
    resolvedUploadsDir,
    saveImage,
    getImage,
    exportAllMedia,
    restoreAllMedia,
    close
  };
}
