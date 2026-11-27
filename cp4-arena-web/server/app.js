import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createCloudStore, getPersistenceDiagnostics } from './cloudStore.js';
import { openDatabase } from './db.js';
import {
  createDefaultDiscordAdapter,
  createSignedDiscordSession,
  createSignedOAuthState,
  sanitizeRelativeReturnTo,
  verifySignedDiscordSession,
  verifySignedOAuthState
} from './discord.js';
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

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const DISCORD_SESSION_COOKIE = 'cp4_discord_session';

function parseCookies(cookieHeader) {
  const out = {};
  if (typeof cookieHeader !== 'string' || !cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function buildDiscordCookieHeader(token, { secure = false, maxAge = 604800 } = {}) {
  const parts = [
    `${DISCORD_SESSION_COOKIE}=${encodeURIComponent(token || '')}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Number(maxAge) || 0)}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function renderDiscordOAuthHtml({
  ok,
  title,
  message,
  profile = null,
  duplicate = false,
  origin = '*',
  returnTo = ''
}) {
  const safeOrigin = typeof origin === 'string' && /^https?:\/\/[^/\s]+$/i.test(origin) ? origin : '*';
  const safeReturnTo = sanitizeRelativeReturnTo(returnTo);
  const targetReturnTo = safeReturnTo || '/';
  const postPayload = JSON.stringify({
    type: 'cp4_discord_oauth_result',
    ok: Boolean(ok),
    created: Boolean(ok && !duplicate),
    duplicate: Boolean(duplicate),
    profileId: profile?.id ?? null,
    cp4Id: profile?.cp4Id ?? null,
    name: profile?.name ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    discordUserId: profile?.discordUserId ?? null,
    elysiumNetId: profile?.elysiumNetId ?? '',
    xeMoNetId: profile?.xeMoNetId ?? '',
    profile: profile ?? null,
    errorAr: ok ? null : String(message || ''),
    error: ok ? null : String(message || '')
  });
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — CP4 ARENA</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #070913; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; padding: 20px; }
    .card { max-width: 440px; width: 100%; background: #0f1528; border: 1px solid ${ok ? '#f5b82e' : '#ef4444'}; border-radius: 18px; padding: 24px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: ${ok ? 'rgba(245,184,46,.16)' : 'rgba(239,68,68,.16)'}; color: ${ok ? '#f5b82e' : '#fca5a5'}; font-weight: 700; margin-bottom: 14px; font-size: 14px; }
    h1 { margin: 0 0 10px; font-size: 20px; color: ${ok ? '#f5b82e' : '#fca5a5'}; }
    p { margin: 0 0 18px; line-height: 1.7; color: #cbd5e1; font-size: 15px; }
    .cp4 { font-family: monospace; font-size: 20px; font-weight: 800; color: #38bdf8; background: #161f3b; border: 1px solid #2563eb; border-radius: 12px; padding: 10px 14px; margin: 12px 0 18px; }
    .btn-return { display: inline-block; background: #2563eb; color: #fff; border: 0; border-radius: 12px; padding: 12px 22px; font-weight: 700; cursor: pointer; font-size: 14px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${ok ? (duplicate ? 'ملف موجود مسبقاً' : 'تم الربط بنجاح') : 'تعذر الربط'}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${profile?.cp4Id ? `<div class="cp4">${escapeHtml(profile.cp4Id)} — ${escapeHtml(profile.name)}</div>` : ''}
    <a class="btn-return" href="${escapeHtml(targetReturnTo)}" onclick="event.preventDefault(); window.__cp4CloseAndReturn();">إغلاق والعودة</a>
  </div>
  <script>
    (function () {
      var targetUrl = ${JSON.stringify(targetReturnTo)};
      var hasExplicitReturnTo = ${JSON.stringify(Boolean(safeReturnTo))};
      var payload = ${postPayload};
      var originTarget = ${JSON.stringify(safeOrigin)};
      var hasOpener = false;
      function notifyOpener() {
        try {
          if (window.opener && !window.opener.closed) {
            hasOpener = true;
            window.opener.postMessage(payload, originTarget);
            return true;
          }
        } catch (_) {}
        return false;
      }
      notifyOpener();

      window.__cp4CloseAndReturn = function () {
        var opened = notifyOpener();
        if (opened) {
          try { window.close(); } catch (_) {}
          setTimeout(function () {
            if (!window.closed) {
              window.location.replace(targetUrl);
            }
          }, 150);
        } else {
          window.location.replace(targetUrl);
        }
      };

      if (!hasOpener && (hasExplicitReturnTo || ${JSON.stringify(Boolean(ok))})) {
        setTimeout(function () {
          window.location.replace(targetUrl);
        }, 450);
      }
    })();
  </script>
</body>
</html>`;
}

export async function createArenaAppAsync({ dbPath, uploadsDir, distDir, cloudStore = null, cloudAdapter = null, discordAdapter = null } = {}) {
  const resolvedDbPath = resolveEffectiveDbPath(dbPath);
  const activeCloudStore = cloudStore || createCloudStore({ adapter: cloudAdapter });
  if (activeCloudStore.isEnabled()) {
    await activeCloudStore.initAndHydrate(resolvedDbPath);
  }
  const bundle = createArenaApp({
    dbPath: resolvedDbPath,
    uploadsDir,
    distDir,
    cloudStore: activeCloudStore,
    discordAdapter
  });
  if (activeCloudStore.isEnabled()) {
    await activeCloudStore.syncDatabaseNow(bundle.db, resolvedDbPath);
  }
  return bundle;
}

export function createArenaApp({ dbPath, uploadsDir, distDir, cloudStore = null, discordAdapter = null } = {}) {
  const resolvedDbPath = resolveEffectiveDbPath(dbPath);
  const db = openDatabase(resolvedDbPath);
  const activeDiscordAdapter = discordAdapter || createDefaultDiscordAdapter();
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

  function resolveAuthenticatedDiscordProfile(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[DISCORD_SESSION_COOKIE];
    if (!token) return null;
    const parsed = verifySignedDiscordSession(db.sessionSecret, token);
    if (!parsed) return null;
    const profile = service.getPlayerProfileById(parsed.profileId);
    if (!profile || profile.discordUserId !== parsed.discordUserId) return null;
    return profile;
  }

  app.get('/api/state', (req, res) => {
    const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : null;
    const requestedUsername =
      typeof req.query.username === 'string' && req.query.username.trim()
        ? req.query.username.trim()
        : null;
    const state = service.getPublicState(tournamentId, getBearerToken(req), getClientKey(req), requestedUsername);
    const persistence = getPersistenceDiagnostics({ dbPath: resolvedDbPath, cloudStore });
    const discordStatus = activeDiscordAdapter.getStatus();
    const currentDiscordProfile = resolveAuthenticatedDiscordProfile(req);
    res.json({ ...state, persistence, discordStatus, currentDiscordProfile });
  });

  // Discord OAuth, Bot guild members & Unified Player Profiles (Stage 1)
  app.get('/api/discord/status', (_req, res) => {
    res.json({ ok: true, ...activeDiscordAdapter.getStatus() });
  });

  app.post('/api/discord/session/logout', (req, res) => {
    res.setHeader('Set-Cookie', buildDiscordCookieHeader('', { secure: Boolean(req.secure), maxAge: 0 }));
    res.json({ ok: true, messageAr: 'تم تسجيل الخروج من حساب Discord.' });
  });

  app.get('/api/discord/oauth/start', (req, res) => {
    const status = activeDiscordAdapter.getStatus();
    const wantsJson = req.query.format === 'json';
    const returnTo = sanitizeRelativeReturnTo(typeof req.query.returnTo === 'string' ? req.query.returnTo : '');
    if (!status.oauthConfigured) {
      const errorMsg =
        'ربط Discord OAuth غير مُفعّل على الخادم بعد. يرجى ضبط متغيرات DISCORD_CLIENT_ID و DISCORD_CLIENT_SECRET و DISCORD_REDIRECT_URI.';
      if (wantsJson) {
        return res.status(503).json({ ok: false, code: 'DISCORD_OAUTH_UNCONFIGURED', error: errorMsg });
      }
      return res
        .status(503)
        .type('text/html; charset=utf-8')
        .send(renderDiscordOAuthHtml({ ok: false, title: 'ربط Discord غير مُعد', message: errorMsg, returnTo }));
    }

    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const state = createSignedOAuthState(db.sessionSecret, { origin: originHeader, returnTo });
    const url = activeDiscordAdapter.buildAuthorizeUrl({ state });
    if (!url) {
      const errorMsg = 'تعذر إنشاء رابط تفويض Discord OAuth على الخادم.';
      if (wantsJson) {
        return res.status(503).json({ ok: false, code: 'DISCORD_OAUTH_UNCONFIGURED', error: errorMsg });
      }
      return res
        .status(503)
        .type('text/html; charset=utf-8')
        .send(renderDiscordOAuthHtml({ ok: false, title: 'تعذر إنشاء الرابط', message: errorMsg, returnTo }));
    }

    if (wantsJson) {
      return res.json({ ok: true, url });
    }
    return res.redirect(url);
  });

  app.get('/api/discord/oauth/callback', async (req, res) => {
    const status = activeDiscordAdapter.getStatus();
    if (!status.oauthConfigured) {
      return res
        .status(503)
        .type('text/html; charset=utf-8')
        .send(
          renderDiscordOAuthHtml({
            ok: false,
            title: 'ربط Discord غير مُفعّل',
            message: 'إعدادات Discord OAuth غير مكتملة على الخادم.'
          })
        );
    }

    if (req.query.error) {
      return res
        .status(400)
        .type('text/html; charset=utf-8')
        .send(
          renderDiscordOAuthHtml({
            ok: false,
            title: 'تم إلغاء الربط',
            message: 'لم تكتمل موافقة Discord أو تم إلغاء العملية من المستخدم.'
          })
        );
    }

    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    const rawState = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const verifiedState = verifySignedOAuthState(db.sessionSecret, rawState);
    if (!code || !verifiedState) {
      return res
        .status(400)
        .type('text/html; charset=utf-8')
        .send(
          renderDiscordOAuthHtml({
            ok: false,
            title: 'جلسة التحقق غير صالحة',
            message: 'انتهت صلاحية رمز التحقق (state) أو أن الطلب غير صالح. يرجى المحاولة مجدداً.'
          })
        );
    }

    try {
      const discordUser = await activeDiscordAdapter.exchangeCodeForUser(code);
      const out = service.createOrResolveDiscordOAuthProfile(discordUser);
      if (!out.ok) {
        return res
          .status(out.status || 400)
          .type('text/html; charset=utf-8')
          .send(
            renderDiscordOAuthHtml({
              ok: false,
              title: 'تعذر إتمام الربط',
              message: out.error,
              origin: verifiedState.origin
            })
          );
      }
      if (out.created) {
        await syncCloud();
      }
      const sessionToken = createSignedDiscordSession(db.sessionSecret, {
        profileId: out.profile.id,
        discordUserId: out.profile.discordUserId
      });
      if (sessionToken) {
        res.setHeader('Set-Cookie', buildDiscordCookieHeader(sessionToken, { secure: Boolean(req.secure) }));
      }
      return res
        .status(200)
        .type('text/html; charset=utf-8')
        .send(
          renderDiscordOAuthHtml({
            ok: true,
            title: out.duplicate ? 'الحساب مربوط مسبقاً' : 'تم إنشاء ملف اللاعب الموحد',
            message: out.messageAr,
            profile: out.profile,
            duplicate: out.duplicate,
            origin: verifiedState.origin,
            returnTo: verifiedState.returnTo
          })
        );
    } catch {
      return res
        .status(502)
        .type('text/html; charset=utf-8')
        .send(
          renderDiscordOAuthHtml({
            ok: false,
            title: 'فشل الاتصال بـ Discord',
            message: 'تعذر التحقق من حساب Discord حالياً. يرجى المحاولة مرة أخرى.',
            origin: verifiedState.origin,
            returnTo: verifiedState.returnTo
          })
        );
    }
  });

  app.get('/api/discord/guild-members', async (req, res) => {
    const auth = service.requirePermission(getBearerToken(req), 'MANAGE_PLAYERS');
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const status = activeDiscordAdapter.getStatus();
    if (!status.guildConfigured) {
      return res.status(503).json({
        ok: false,
        code: 'DISCORD_BOT_UNCONFIGURED',
        error: 'بوت Discord غير مُفعّل على الخادم بعد. يرجى ضبط متغيرات DISCORD_BOT_TOKEN و DISCORD_GUILD_ID.'
      });
    }

    try {
      const members = await activeDiscordAdapter.fetchGuildMembers({
        limit: Number(req.query.limit) || 200
      });
      const existingLinks = new Map(
        db
          .prepare('SELECT id, cp4_id, discord_user_id FROM player_profiles WHERE discord_user_id IS NOT NULL')
          .all()
          .map((row) => [String(row.discord_user_id), { id: row.id, cp4Id: row.cp4_id }])
      );
      const enriched = members.map((m) => {
        const linked = existingLinks.get(String(m.discordUserId));
        return {
          ...m,
          linkedProfileId: linked?.id ?? null,
          linkedCp4Id: linked?.cp4Id ?? null
        };
      });
      res.json({ ok: true, members: enriched });
    } catch {
      res.status(502).json({
        ok: false,
        code: 'DISCORD_BOT_FETCH_FAILED',
        error: 'تعذر جلب قائمة أعضاء Discord من البوت حالياً.'
      });
    }
  });

  app.get('/api/player-profiles', (req, res) => {
    const out = service.listPlayerProfiles(getBearerToken(req));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    res.json(out);
  });

  app.post('/api/player-profiles', async (req, res) => {
    const out = service.createPlayerProfile(getBearerToken(req), req.body || {});
    if (!out.ok) {
      return res.status(out.status).json({
        error: out.error,
        code: out.code,
        existingProfile: out.existingProfile
      });
    }
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.patch('/api/player-profiles/:id', async (req, res) => {
    const out = service.updatePlayerProfile(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) {
      return res.status(out.status).json({
        error: out.error,
        code: out.code,
        existingProfile: out.existingProfile
      });
    }
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/player-profiles/merge', async (req, res) => {
    const out = service.mergePlayerProfiles(getBearerToken(req), req.body || {});
    if (!out.ok) {
      return res.status(out.status).json({
        error: out.error,
        code: out.code
      });
    }
    await syncCloud();
    res.status(out.status).json(out);
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

  // Head Admin portable JSON Backup & Restore (includes tournaments, players, matches, sub-admins & media)
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

  // Public player registration (optionally using authenticated Discord session cookie)
  app.post('/api/players/register', async (req, res) => {
    const authDiscordProfile = resolveAuthenticatedDiscordProfile(req);
    const out = service.registerPlayer({
      ...(req.body || {}),
      authenticatedDiscordProfileId: authDiscordProfile?.id ?? null
    });
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

  app.post('/api/tournaments/:id/players/bulk', async (req, res) => {
    const out = service.bulkImportPlayers(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/tournaments/:id/auto-schedule', async (req, res) => {
    const out = service.autoScheduleMatches(getBearerToken(req), Number(req.params.id), req.body || {});
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

  app.post('/api/players/:id/link-discord', async (req, res) => {
    const out = service.linkPlayerToDiscord(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) {
      return res.status(out.status).json({
        error: out.error,
        code: out.code,
        existingProfile: out.existingProfile
      });
    }
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

  app.post('/api/matches/:id/check-in', async (req, res) => {
    const out = service.toggleMatchCheckIn(Number(req.params.id), req.body?.slot);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/matches/:id/vote', async (req, res) => {
    const out = service.voteMatchPrediction(Number(req.params.id), req.body?.slot);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/matches/:id/dispute', async (req, res) => {
    const out = service.submitMatchDispute(Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/matches/:id/dispute/resolve', async (req, res) => {
    const out = service.resolveMatchDispute(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/matches/:id/walkover', async (req, res) => {
    const out = service.applyMatchWalkover(getBearerToken(req), Number(req.params.id), req.body || {});
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

  // Racing tournament endpoints (RIDE 4, DriveClub)
  app.post('/api/tournaments/:id/races', async (req, res) => {
    const out = service.createRace(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.put('/api/races/:id/results', async (req, res) => {
    const out = service.saveRaceResults(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.post('/api/tournaments/:id/races/generate-final', async (req, res) => {
    const out = service.generateFinalRaceFromStandings(getBearerToken(req), Number(req.params.id), req.body || {});
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  app.delete('/api/races/:id', async (req, res) => {
    const out = service.deleteRace(getBearerToken(req), Number(req.params.id));
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    await syncCloud();
    res.status(out.status).json(out);
  });

  // Production SPA static serving
  const resolvedDistDir = path.resolve(distDir || path.resolve(process.cwd(), 'dist'));
  if (fs.existsSync(resolvedDistDir)) {
    const distAssetsDir = path.join(resolvedDistDir, 'assets');
    if (fs.existsSync(distAssetsDir)) {
      app.use(
        '/assets',
        express.static(distAssetsDir, {
          maxAge: '1y',
          immutable: true
        })
      );
    }
    app.get('/sw.js', (_req, res, next) => {
      const swPath = path.join(resolvedDistDir, 'sw.js');
      if (!fs.existsSync(swPath)) return next();
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(swPath);
    });
    app.use(express.static(resolvedDistDir, { index: false }));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
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
