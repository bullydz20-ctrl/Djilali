import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createCloudStore, getPersistenceDiagnostics } from './cloudStore.js';
import { openDatabase } from './db.js';
import { createMediaStore } from './mediaStore.js';
import { ArenaService } from './service.js';

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

function getClientKey(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'default';
}

function parseValidatedImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const extRaw = match[1].toLowerCase();
  const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024) return null;

  // Magic-byte verification
  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp =
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (ext === 'png' && !isPng) return null;
  if (ext === 'jpg' && !isJpg) return null;
  if (ext === 'webp' && !isWebp) return null;

  return { ext, buffer };
}

function resolveEffectiveDbPath(dbPath) {
  return (
    dbPath ||
    (process.env.CP4_DB_PATH && process.env.CP4_DB_PATH.trim()) ||
    path.resolve(process.cwd(), 'data', 'cp4_arena.db')
  );
}

export async function createArenaAppAsync({ dbPath, uploadsDir, distDir, cloudStore = null, cloudAdapter = null } = {}) {
  const resolvedDbPath = resolveEffectiveDbPath(dbPath);
  const activeCloudStore = cloudStore || createCloudStore({ adapter: cloudAdapter });
  if (activeCloudStore.isEnabled()) {
    await activeCloudStore.initAndHydrate(resolvedDbPath);
  }
  const bundle = createArenaApp({
    dbPath: resolvedDbPath,
    uploadsDir,
    distDir,
    cloudStore: activeCloudStore
  });
  if (activeCloudStore.isEnabled()) {
    await activeCloudStore.syncDatabaseNow(bundle.db, resolvedDbPath);
  }
  return bundle;
}

export function createArenaApp({ dbPath, uploadsDir, distDir, cloudStore = null } = {}) {
  const resolvedDbPath = resolveEffectiveDbPath(dbPath);
  const db = openDatabase(resolvedDbPath);
  const mediaStore = createMediaStore({
    dbPath: resolvedDbPath,
    uploadsDir: uploadsDir || path.resolve(process.cwd(), 'data', 'uploads'),
    cloudStore
  });

  async function syncCloud(force = false) {
    if (cloudStore?.isEnabled?.()) {
      await cloudStore.syncDatabaseNow(db, resolvedDbPath, { force });
    }
  }

  const sseClients = new Set();
  const service = new ArenaService(db, (event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        sseClients.delete(res);
      }
    }
  });

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });
  app.use((req, res, next) => {
    if (req.path === '/api/admin/restore') {
      return express.json({ limit: '25mb' })(req, res, next);
    }
    return express.json({ limit: '4.5mb' })(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1 AS ok').get();
      const persistence = getPersistenceDiagnostics({ dbPath: resolvedDbPath, cloudStore });
      res.json({ ok: true, service: 'cp4-arena-api', ts: Date.now(), persistence });
    } catch {
      res.status(503).json({ ok: false, service: 'cp4-arena-api', ts: Date.now() });
    }
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);
    sseClients.add(res);
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/state', (req, res) => {
    const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : null;
    const requestedUsername =
      typeof req.query.username === 'string' && req.query.username.trim()
        ? req.query.username.trim()
        : null;
    const state = service.getPublicState(tournamentId, getBearerToken(req), getClientKey(req), requestedUsername);
    const persistence = getPersistenceDiagnostics({ dbPath: resolvedDbPath, cloudStore });
    res.json({ ...state, persistence });
  });

  app.get('/api/tournaments/:id/export', (req, res) => {
    const out = service.getTournamentExport(Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(out);
  });

  // Safe image upload for player avatars & tournament banners (disk + media DB + optional cloud)
  app.post('/api/uploads/image', async (req, res) => {
    try {
      const parsed = parseValidatedImageDataUrl(req.body?.dataUrl);
      if (!parsed) {
        return res.status(400).json({ error: 'صيغة الصورة غير مدعومة أو حجمها يتجاوز 3 ميجابايت.' });
      }
      const filename = `${crypto.randomUUID()}.${parsed.ext}`;
      const saved = await mediaStore.saveImage({ filename, ext: parsed.ext, buffer: parsed.buffer });
      res.status(201).json({ url: saved.url });
    } catch {
      res.status(500).json({ error: 'تعذر حفظ الصورة على الخادم.' });
    }
  });

  app.get('/uploads/:file', async (req, res) => {
    const name = String(req.params.file || '');
    if (!/^[a-zA-Z0-9_-]+\.(png|jpg|webp)$/.test(name)) {
      return res.status(400).end();
    }
    try {
      const img = await mediaStore.getImage(name);
      if (!img) {
        return res.status(404).end();
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', img.mimeType);
      res.send(img.buffer);
    } catch {
      res.status(500).end();
    }
  });

  // Head Admin portable JSON Backup & Restore
  app.get('/api/admin/backup', (req, res) => {
    const mediaItems = mediaStore.exportAllMedia();
    const out = service.exportBackup(getBearerToken(req), mediaItems);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    const stamp = new Date(out.backup.exportedAt).toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="cp4-arena-backup-${stamp}.json"`);
    res.json(out.backup);
  });

  app.post('/api/admin/restore', async (req, res) => {
    const backupObj = req.body?.backup && typeof req.body.backup === 'object' ? req.body.backup : req.body;
    const out = service.restoreBackup(getBearerToken(req), backupObj);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    const restoredMedia = await mediaStore.restoreAllMedia(backupObj?.mediaFiles || []);
    await syncCloud(true);
    res.status(out.status).json({ ...out, restoredMedia });
  });

  // Public player registration
  app.post('/api/players/register', async (req, res) => {
    const out = service.registerPlayer(req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Public/shared match reminders
  app.post('/api/reminders', async (req, res) => {
    const out = service.scheduleReminder(req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.delete('/api/reminders/:matchId', async (req, res) => {
    const out = service.cancelReminder(Number(req.params.matchId));
    if (out.ok) await syncCloud();
    res.status(out.status).json(out);
  });

  // Admin auth routes
  app.post('/api/admin/setup-head', async (req, res) => {
    const out = service.setupHeadAdmin({
      ...(req.body || {}),
      clientKey: getClientKey(req)
    });
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/admin/login', async (req, res) => {
    const out = service.loginAdmin({
      ...(req.body || {}),
      clientKey: getClientKey(req)
    });
    if (!out.ok) {
      return res.status(out.status).json({ error: out.error, lockoutState: out.lockoutState });
    }
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/admin/logout', async (req, res) => {
    const out = service.logoutAdmin(getBearerToken(req));
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/admin/change-pin', async (req, res) => {
    const out = service.changeOwnPin(getBearerToken(req), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/admin/profile', async (req, res) => {
    const out = service.updateOwnProfile(getBearerToken(req), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/admin/sub-admins', async (req, res) => {
    const out = service.createSubAdmin(getBearerToken(req), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/admin/sub-admins/:id', async (req, res) => {
    const out = service.updateSubAdmin(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.delete('/api/admin/sub-admins/:id', async (req, res) => {
    const out = service.deleteSubAdmin(getBearerToken(req), Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Protected tournament management
  app.post('/api/tournaments', async (req, res) => {
    const out = service.createTournament(getBearerToken(req), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.put('/api/tournaments/:id', async (req, res) => {
    const out = service.updateTournament(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.delete('/api/tournaments/:id', async (req, res) => {
    const out = service.deleteTournament(getBearerToken(req), Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Protected player management
  app.post('/api/tournaments/:id/players', async (req, res) => {
    const out = service.adminAddPlayer(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/players/:id/status', async (req, res) => {
    const out = service.updatePlayerStatus(getBearerToken(req), Number(req.params.id), req.body?.status);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/players/:id', async (req, res) => {
    const out = service.updatePlayerDetails(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.delete('/api/players/:id', async (req, res) => {
    const out = service.deletePlayer(getBearerToken(req), Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Protected draw & knockout progression
  app.post('/api/tournaments/:id/draw', async (req, res) => {
    const out = service.runDraw(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/tournaments/:id/knockout-from-standings', async (req, res) => {
    const out = service.generateKnockoutFromStandings(getBearerToken(req), Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/matches/:id/score', async (req, res) => {
    const out = service.updateMatchScore(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/matches/:id/winner', async (req, res) => {
    const out = service.updateKnockoutMatchWinner(getBearerToken(req), Number(req.params.id), req.body?.winnerPlayerId ?? null);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/tournaments/:id/champion', async (req, res) => {
    const out = service.crownChampion(getBearerToken(req), Number(req.params.id), req.body?.playerId ?? null);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Production SPA static serving
  const resolvedDistDir = path.resolve(distDir || path.resolve(process.cwd(), 'dist'));
  if (fs.existsSync(resolvedDistDir)) {
    app.use(express.static(resolvedDistDir, { index: false }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => {
      res.sendFile(path.join(resolvedDistDir, 'index.html'));
    });
  } else {
    app.get(/^\/(?!api|uploads).*/, (_req, res) => {
      res.status(503).type('text/plain; charset=utf-8').send('Frontend bundle not built yet. Run: npm run build');
    });
  }

  async function shutdownResources() {
    try {
      await cloudStore?.flushAndClose?.(db, resolvedDbPath);
    } catch {
      // ignore cloud close errors on exit
    }
    try {
      mediaStore.close();
    } catch {
      // ignore close errors
    }
    try {
      db.close();
    } catch {
      // ignore close errors
    }
  }

  return { app, db, service, mediaStore, cloudStore, shutdownResources };
}
