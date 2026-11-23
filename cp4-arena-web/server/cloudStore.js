import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

export function resolveCloudDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.NEON_DATABASE_URL,
    process.env.CP4_CLOUD_DB_URL
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return null;
}

function shouldUseSsl(connectionString) {
  const lower = connectionString.toLowerCase();
  if (lower.includes('sslmode=disable')) return false;
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  return true;
}

export function createMemoryCloudAdapter() {
  let snapshot = null;
  const media = new Map();

  return {
    providerName: 'memory-cloud-test',
    async init() {},
    async loadSnapshot() {
      return snapshot ? { ...snapshot, stateBlob: Buffer.from(snapshot.stateBlob) } : null;
    },
    async saveSnapshot({ stateBlob, sha256, version, updatedAt }) {
      snapshot = {
        stateBlob: Buffer.from(stateBlob),
        sha256,
        version,
        updatedAt
      };
    },
    async loadMedia(filename) {
      const row = media.get(filename);
      return row ? { ...row, data: Buffer.from(row.data) } : null;
    },
    async saveMedia({ filename, mimeType, data, createdAt }) {
      media.set(filename, {
        filename,
        mimeType,
        data: Buffer.from(data),
        createdAt
      });
    },
    async close() {}
  };
}

export function createPostgresCloudAdapter(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 12_000,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false
  });

  return {
    providerName: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cp4_arena_snapshots (
          id INTEGER PRIMARY KEY,
          state_blob BYTEA NOT NULL,
          sha256 TEXT NOT NULL,
          version BIGINT NOT NULL,
          updated_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cp4_media_files (
          filename TEXT PRIMARY KEY,
          mime_type TEXT NOT NULL,
          data BYTEA NOT NULL,
          created_at BIGINT NOT NULL
        );
      `);
    },
    async loadSnapshot() {
      const res = await pool.query(
        'SELECT state_blob, sha256, version, updated_at FROM cp4_arena_snapshots WHERE id = 1'
      );
      if (!res.rows.length) return null;
      const row = res.rows[0];
      return {
        stateBlob: Buffer.isBuffer(row.state_blob) ? row.state_blob : Buffer.from(row.state_blob),
        sha256: row.sha256,
        version: Number(row.version),
        updatedAt: Number(row.updated_at)
      };
    },
    async saveSnapshot({ stateBlob, sha256, version, updatedAt }) {
      await pool.query(
        `
          INSERT INTO cp4_arena_snapshots (id, state_blob, sha256, version, updated_at)
          VALUES (1, $1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            state_blob = EXCLUDED.state_blob,
            sha256 = EXCLUDED.sha256,
            version = EXCLUDED.version,
            updated_at = EXCLUDED.updated_at
        `,
        [stateBlob, sha256, version, updatedAt]
      );
    },
    async loadMedia(filename) {
      const res = await pool.query(
        'SELECT filename, mime_type, data, created_at FROM cp4_media_files WHERE filename = $1',
        [filename]
      );
      if (!res.rows.length) return null;
      const row = res.rows[0];
      return {
        filename: row.filename,
        mimeType: row.mime_type,
        data: Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data),
        createdAt: Number(row.created_at)
      };
    },
    async saveMedia({ filename, mimeType, data, createdAt }) {
      await pool.query(
        `
          INSERT INTO cp4_media_files (filename, mime_type, data, created_at)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (filename) DO UPDATE SET
            mime_type = EXCLUDED.mime_type,
            data = EXCLUDED.data
        `,
        [filename, mimeType, data, createdAt]
      );
    },
    async close() {
      await pool.end();
    }
  };
}

export function createCloudStore({ databaseUrl = resolveCloudDatabaseUrl(), adapter = null } = {}) {
  const activeAdapter = adapter || (databaseUrl ? createPostgresCloudAdapter(databaseUrl) : null);

  let initialized = false;
  let lastSyncedSha256 = null;
  let lastSyncedAt = null;
  let lastVersion = 0;
  let lastError = null;
  let syncChain = Promise.resolve();

  function isEnabled() {
    return Boolean(activeAdapter);
  }

  async function initAndHydrate(dbPath) {
    if (!activeAdapter) return { hydrated: false };
    await activeAdapter.init();
    initialized = true;

    const remote = await activeAdapter.loadSnapshot();
    if (!remote || !remote.stateBlob || remote.stateBlob.length === 0) {
      return { hydrated: false };
    }

    lastVersion = remote.version || 0;
    lastSyncedSha256 = remote.sha256 || null;
    lastSyncedAt = remote.updatedAt || null;

    if (!dbPath || dbPath === ':memory:') {
      return { hydrated: false };
    }

    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });

    let shouldRestore = !fs.existsSync(resolved);
    if (!shouldRestore) {
      const localBytes = fs.readFileSync(resolved);
      if (localBytes.length === 0) {
        shouldRestore = true;
      } else {
        const localSha = crypto.createHash('sha256').update(localBytes).digest('hex');
        if (localSha !== remote.sha256) {
          // On a clean container wake-up, remote snapshot is canonical if file wasn't synced from it
          // Check mtime vs remote updatedAt so stale build-baked DB never overrides newer cloud snapshot
          const stat = fs.statSync(resolved);
          if (remote.updatedAt > stat.mtimeMs + 1000) {
            shouldRestore = true;
          }
        }
      }
    }

    if (shouldRestore) {
      for (const suffix of ['-wal', '-shm', '-journal']) {
        const sidecar = `${resolved}${suffix}`;
        if (fs.existsSync(sidecar)) {
          fs.rmSync(sidecar, { force: true });
        }
      }
      const tmpPath = `${resolved}.cloudrestore.tmp`;
      fs.writeFileSync(tmpPath, remote.stateBlob);
      fs.renameSync(tmpPath, resolved);
      lastSyncedSha256 = crypto.createHash('sha256').update(remote.stateBlob).digest('hex');
      return { hydrated: true, version: remote.version, bytes: remote.stateBlob.length };
    }

    return { hydrated: false };
  }

  function syncDatabaseNow(db, dbPath, { force = false } = {}) {
    if (!activeAdapter || !db || !dbPath || dbPath === ':memory:') {
      return Promise.resolve({ synced: false });
    }

    const job = async () => {
      try {
        if (!initialized) {
          await activeAdapter.init();
          initialized = true;
        }
        try {
          db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
        } catch {
          // ignore if connection is read-only or closing
        }

        const resolved = path.resolve(dbPath);
        if (!fs.existsSync(resolved)) {
          return { synced: false };
        }
        const bytes = fs.readFileSync(resolved);
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        if (!force && sha256 === lastSyncedSha256) {
          return { synced: false, unchanged: true };
        }

        const now = Date.now();
        const nextVersion = Math.max(now, lastVersion + 1);
        await activeAdapter.saveSnapshot({
          stateBlob: bytes,
          sha256,
          version: nextVersion,
          updatedAt: now
        });

        lastSyncedSha256 = sha256;
        lastSyncedAt = now;
        lastVersion = nextVersion;
        lastError = null;
        return { synced: true, version: nextVersion, bytes: bytes.length };
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Cloud sync failed';
        console.error('[CP4 CloudStore] syncDatabaseNow error:', lastError);
        return { synced: false, error: lastError };
      }
    };

    syncChain = syncChain.then(job, job);
    return syncChain;
  }

  async function saveMediaFile({ filename, mimeType, buffer, createdAt = Date.now() }) {
    if (!activeAdapter) return;
    if (!initialized) {
      await activeAdapter.init();
      initialized = true;
    }
    await activeAdapter.saveMedia({
      filename,
      mimeType,
      data: buffer,
      createdAt
    });
  }

  async function getMediaFile(filename) {
    if (!activeAdapter) return null;
    if (!initialized) {
      await activeAdapter.init();
      initialized = true;
    }
    return activeAdapter.loadMedia(filename);
  }

  async function flushAndClose(db, dbPath) {
    if (!activeAdapter) return;
    try {
      if (db && dbPath && dbPath !== ':memory:') {
        await syncDatabaseNow(db, dbPath);
      } else {
        await syncChain;
      }
    } finally {
      await activeAdapter.close();
    }
  }

  function getStatus() {
    return {
      enabled: Boolean(activeAdapter),
      provider: activeAdapter ? activeAdapter.providerName : null,
      lastSyncedAt,
      lastError
    };
  }

  return {
    isEnabled,
    initAndHydrate,
    syncDatabaseNow,
    saveMediaFile,
    getMediaFile,
    flushAndClose,
    getStatus
  };
}

export function getPersistenceDiagnostics({ dbPath, cloudStore } = {}) {
  const cloudStatus = cloudStore?.getStatus?.() || { enabled: false, lastSyncedAt: null, lastError: null };
  if (cloudStatus.enabled) {
    return {
      mode: 'postgres',
      isDurable: true,
      labelAr: 'حفظ سحابي دائم (PostgreSQL)',
      detailAr:
        'البطولات واللاعبون والنتائج والصور ومفاتيح المشرفين محفوظة تلقائياً في قاعدة البيانات السحابية ولن تُفقد بعد سكون الموقع.',
      lastCloudSyncAt: cloudStatus.lastSyncedAt,
      cloudError: cloudStatus.lastError
    };
  }

  const normalizedDb = dbPath ? path.resolve(dbPath) : '';
  const hasPersistentMount =
    process.env.CP4_PERSISTENT_STORAGE === 'true' ||
    normalizedDb.startsWith('/var/data') ||
    normalizedDb.startsWith('/data/');

  if (hasPersistentMount) {
    return {
      mode: 'persistent_disk',
      isDurable: true,
      labelAr: 'قرص تخزين دائم (Persistent Disk)',
      detailAr: 'البيانات والصور محفوظة على قرص دائم خارجي على الخادم.',
      lastCloudSyncAt: null,
      cloudError: null
    };
  }

  const isCloudContainer = Boolean(
    process.env.RENDER ||
      process.env.RENDER_SERVICE_ID ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.FLY_APP_NAME ||
      process.env.NODE_ENV === 'production'
  );

  if (isCloudContainer) {
    return {
      mode: 'ephemeral',
      isDurable: false,
      labelAr: 'تخزين مؤقت ⚠️ (معرّض للمسح بعد سكون الخادم)',
      detailAr:
        'الخادم يعمل حالياً على قرص مؤقت بدون متغير DATABASE_URL. على باقة Render المجانية تُمسح البيانات بعد سكون الموقع؛ أضف قاعدة PostgreSQL مجانية (Neon أو Supabase أو Render) في متغير DATABASE_URL لحفظ دائم 100%.',
      lastCloudSyncAt: null,
      cloudError: null
    };
  }

  return {
    mode: 'persistent_disk',
    isDurable: true,
    labelAr: 'تخزين محلي (بيئة تطوير / خادم خاص)',
    detailAr: 'يتم الحفظ مباشرة على القرص المحلي للخادم.',
    lastCloudSyncAt: null,
    cloudError: null
  };
}
