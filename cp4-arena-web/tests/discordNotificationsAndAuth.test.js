import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createArenaApp } from '../server/app.js';
import { createDefaultDiscordAdapter, createSignedOAuthState } from '../server/discord.js';

function startServer(opts) {
  const { app, db, service, shutdownResources } = createArenaApp(opts);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        db,
        service,
        close: () =>
          new Promise((res) => {
            server.close(async () => {
              await shutdownResources();
              res();
            });
          })
      });
    });
  });
}

async function api(baseUrl, pathUrl, { method = 'GET', body, token, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathUrl}`, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json, text };
}

test('Discord Bot Notifications: Admin channel (link + registration) & Public channel (approval) with <@discord_id>', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-discord-bot-notify-'));
  const dbPath = path.join(tmpDir, 'arena.db');
  const uploadsDir = path.join(tmpDir, 'uploads');

  const ADMIN_CH = '111222333444555666';
  const PUBLIC_CH = '999888777666555444';
  const sentMessages = [];

  const mockDiscordAdapter = {
    getStatus: () => ({
      oauthConfigured: true,
      botConfigured: true,
      guildIdConfigured: true,
      guildConfigured: true,
      adminChannelConfigured: true,
      publicChannelConfigured: true
    }),
    getNotificationChannelIds: () => ({
      adminChannelId: ADMIN_CH,
      publicChannelId: PUBLIC_CH
    }),
    buildAuthorizeUrl: ({ state }) =>
      `https://discord.com/oauth2/authorize?client_id=mock&state=${encodeURIComponent(state)}`,
    exchangeCodeForUser: async (code) => {
      if (code === 'new_member_code') {
        return {
          discordUserId: '321654987012345678',
          username: 'ramy_ps4',
          displayName: 'رامي ديسكورد',
          avatarUrl: 'https://cdn.discordapp.com/avatars/321654987012345678/ramy.png'
        };
      }
      throw new Error('INVALID_CODE');
    },
    fetchGuildMembers: async () => [],
    sendChannelMessage: async (msg) => {
      sentMessages.push(msg);
      return { ok: true, status: 200 };
    }
  };

  const srv = await startServer({ dbPath, uploadsDir, discordAdapter: mockDiscordAdapter });
  try {
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'HeadAdmin', displayName: 'Djilali', pin: '482913', keepSignedIn: true }
    });
    assert.equal(setupRes.status, 201);
    const headToken = setupRes.json.token;

    // 1. OAuth link creates new profile -> triggers ADMIN_CH notification with <@discord_id>
    const state1 = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173', returnTo: '/' });
    const cb1 = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=new_member_code&state=${encodeURIComponent(state1)}`
    );
    assert.equal(cb1.status, 200);
    const cookieMatch = (cb1.headers.get('set-cookie') || '').match(/cp4_discord_session=([^;]+)/);
    assert.ok(cookieMatch);
    const discordCookie = `cp4_discord_session=${cookieMatch[1]}`;

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].channelId, ADMIN_CH);
    assert.ok(sentMessages[0].content.includes('<@321654987012345678>'));
    assert.ok(sentMessages[0].content.includes('رامي ديسكورد'));
    assert.ok(sentMessages[0].content.includes('CP4-000001'));
    assert.deepEqual(sentMessages[0].allowedMentions, { parse: [], users: ['321654987012345678'] });

    // Repeat OAuth login does NOT emit duplicate new-account link notification
    const state2 = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173', returnTo: '/' });
    const cb2 = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=new_member_code&state=${encodeURIComponent(state2)}`
    );
    assert.equal(cb2.status, 200);
    assert.equal(sentMessages.length, 1);

    // 2. Player submits tournament registration -> triggers ADMIN_CH notification with ElysiumNet & XeMoNet + mention
    const st = await api(srv.baseUrl, '/api/state', { headers: { Cookie: discordCookie } });
    const tId = st.json.tournament.id;

    const regRes = await api(srv.baseUrl, '/api/players/register', {
      method: 'POST',
      headers: { Cookie: discordCookie },
      body: {
        tournamentId: tId,
        name: 'رامي ديسكورد',
        elysiumNetId: 'ELY-RAMY-77',
        xeMoNetId: 'XEMO-RAMY-88',
        useDiscordIdentity: true
      }
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.json.notificationMeta, undefined);
    assert.equal(sentMessages.length, 2);
    assert.equal(sentMessages[1].channelId, ADMIN_CH);
    assert.ok(sentMessages[1].content.includes('<@321654987012345678>'));
    assert.ok(sentMessages[1].content.includes('رامي ديسكورد'));
    assert.ok(sentMessages[1].content.includes('ELY-RAMY-77'));
    assert.ok(sentMessages[1].content.includes('XEMO-RAMY-88'));
    assert.ok(sentMessages[1].content.includes('CP4-000001'));

    // 3. Admin approves registration -> triggers PUBLIC_CH notification with <@discord_id>
    const pid = regRes.json.player.id;
    const approveRes = await api(srv.baseUrl, `/api/players/${pid}/status`, {
      method: 'PATCH',
      token: headToken,
      body: { status: 'APPROVED' }
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.json.notificationMeta, undefined);
    assert.equal(sentMessages.length, 3);
    assert.equal(sentMessages[2].channelId, PUBLIC_CH);
    assert.ok(sentMessages[2].content.includes('<@321654987012345678>'));
    assert.ok(sentMessages[2].content.includes('رامي ديسكورد'));
    assert.ok(sentMessages[2].content.includes('ELY-RAMY-77'));
    assert.ok(sentMessages[2].content.includes('XEMO-RAMY-88'));
    assert.deepEqual(sentMessages[2].allowedMentions, { parse: [], users: ['321654987012345678'] });

    // Re-approving an already APPROVED player must NOT spam PUBLIC_CH
    const reApprove = await api(srv.baseUrl, `/api/players/${pid}/status`, {
      method: 'PATCH',
      token: headToken,
      body: { status: 'APPROVED' }
    });
    assert.equal(reApprove.status, 200);
    assert.equal(sentMessages.length, 3);

    // 4. Rejecting must NOT send to PUBLIC_CH
    const rejectRes = await api(srv.baseUrl, `/api/players/${pid}/status`, {
      method: 'PATCH',
      token: headToken,
      body: { status: 'REJECTED' }
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(sentMessages.length, 3);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Discord Bot adapter sends real POST /channels/:id/messages payload and degrades gracefully on HTTP failure', async () => {
  const prevBot = process.env.DISCORD_BOT_TOKEN;
  const prevAdminCh = process.env.DISCORD_ADMIN_CHANNEL_ID;
  const prevPubCh = process.env.DISCORD_PUBLIC_CHANNEL_ID;
  const prevFetch = globalThis.fetch;

  try {
    process.env.DISCORD_BOT_TOKEN = 'bot-token-test';
    process.env.DISCORD_ADMIN_CHANNEL_ID = '111222333444555666';
    process.env.DISCORD_PUBLIC_CHANNEL_ID = '999888777666555444';

    const adapter = createDefaultDiscordAdapter();
    const status = adapter.getStatus();
    assert.equal(status.adminChannelConfigured, true);
    assert.equal(status.publicChannelConfigured, true);

    const fetchCalls = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      return { ok: true, status: 200, json: async () => ({ id: 'msg1' }) };
    };

    const okRes = await adapter.sendChannelMessage({
      channelId: '111222333444555666',
      content: 'مرحباً <@123456789012345678>',
      allowedMentions: { parse: [], users: ['123456789012345678'] }
    });
    assert.equal(okRes.ok, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, 'https://discord.com/api/v10/channels/111222333444555666/messages');
    assert.equal(fetchCalls[0].init.headers.Authorization, 'Bot bot-token-test');

    // Non-fatal failure when Discord API returns 500
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    const failRes = await adapter.sendChannelMessage({
      channelId: '999888777666555444',
      content: 'test fail'
    });
    assert.equal(failRes.ok, false);
    assert.equal(failRes.status, 500);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevBot === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = prevBot;
    if (prevAdminCh === undefined) delete process.env.DISCORD_ADMIN_CHANNEL_ID;
    else process.env.DISCORD_ADMIN_CHANNEL_ID = prevAdminCh;
    if (prevPubCh === undefined) delete process.env.DISCORD_PUBLIC_CHANNEL_ID;
    else process.env.DISCORD_PUBLIC_CHANNEL_ID = prevPubCh;
  }
});

test('Unified Player System & Legacy Linking: No name-only auto-merge, verified legacy claim preserves CP4 ID & history, AccountSettingsModal preserved', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-unified-legacy-'));
  const dbPath = path.join(tmpDir, 'arena.db');
  const uploadsDir = path.join(tmpDir, 'uploads');

  const mockDiscordAdapter = {
    getStatus: () => ({
      oauthConfigured: true,
      botConfigured: false,
      guildIdConfigured: false,
      guildConfigured: false
    }),
    buildAuthorizeUrl: ({ state }) =>
      `https://discord.com/oauth2/authorize?client_id=mock&state=${encodeURIComponent(state)}`,
    exchangeCodeForUser: async (code) => {
      if (code === 'legacy_owner_code') {
        return {
          discordUserId: '888999000111222333',
          username: 'karim_real',
          displayName: 'كريم الأسطورة',
          avatarUrl: 'https://cdn.discordapp.com/avatars/888999000111222333/k.png'
        };
      }
      throw new Error('INVALID_CODE');
    },
    fetchGuildMembers: async () => []
  };

  const srv = await startServer({ dbPath, uploadsDir, discordAdapter: mockDiscordAdapter });
  try {
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'HeadAdmin', displayName: 'Djilali', pin: '482913', keepSignedIn: true }
    });
    const headToken = setupRes.json.token;

    // Create an unlinked legacy profile with SAME display name 'كريم الأسطورة' + tournament history
    const legacyProfileRes = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: {
        name: 'كريم الأسطورة',
        elysiumNetId: 'ELY-KARIM-99',
        xeMoNetId: 'XEMO-KARIM-99'
      }
    });
    assert.equal(legacyProfileRes.status, 201);
    const legacyCp4 = legacyProfileRes.json.profile.cp4Id;
    assert.equal(legacyCp4, 'CP4-000001');

    const st = await api(srv.baseUrl, '/api/state', { token: headToken });
    const tId = st.json.tournament.id;
    const addLegacy = await api(srv.baseUrl, `/api/tournaments/${tId}/players`, {
      method: 'POST',
      token: headToken,
      body: {
        profileId: legacyProfileRes.json.profile.id,
        name: 'كريم الأسطورة',
        elysiumNetId: 'ELY-KARIM-99',
        xeMoNetId: 'XEMO-KARIM-99',
        status: 'APPROVED'
      }
    });
    assert.equal(addLegacy.status, 201);

    // OAuth login with SAME display name must NOT auto-merge based on name similarity alone
    const state1 = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173' });
    const oauthRes = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=legacy_owner_code&state=${encodeURIComponent(state1)}`
    );
    assert.equal(oauthRes.status, 200);
    assert.ok(oauthRes.text.includes('CP4-000002'));
    const cookieMatch = (oauthRes.headers.get('set-cookie') || '').match(/cp4_discord_session=([^;]+)/);
    const cookieHeader = `cp4_discord_session=${cookieMatch[1]}`;

    // Wrong ElysiumNet verification rejects claim-legacy (403)
    const badClaim = await api(srv.baseUrl, '/api/discord/session/claim-legacy', {
      method: 'POST',
      headers: { Cookie: cookieHeader },
      body: { cp4Id: legacyCp4, elysiumNetId: 'WRONG-ELYSIUM' }
    });
    assert.equal(badClaim.status, 403);
    assert.equal(badClaim.json.code, 'IDENTITY_VERIFICATION_FAILED');

    // Correct CP4 ID + ElysiumNet links to legacy CP4-000001, keeping tournament & IDs
    const goodClaim = await api(srv.baseUrl, '/api/discord/session/claim-legacy', {
      method: 'POST',
      headers: { Cookie: cookieHeader },
      body: { cp4Id: legacyCp4, elysiumNetId: 'ely-karim-99' }
    });
    assert.equal(goodClaim.status, 200);
    assert.equal(goodClaim.json.profile.cp4Id, 'CP4-000001');
    assert.equal(goodClaim.json.profile.discordUserId, '888999000111222333');
    assert.equal(goodClaim.json.profile.elysiumNetId, 'ELY-KARIM-99');
    assert.equal(goodClaim.json.profile.xeMoNetId, 'XEMO-KARIM-99');
    assert.equal(goodClaim.json.profile.tournamentsCount, 1);

    const updatedCookieMatch = (goodClaim.headers.get('set-cookie') || '').match(/cp4_discord_session=([^;]+)/);
    assert.ok(updatedCookieMatch);
    const updatedCookie = `cp4_discord_session=${updatedCookieMatch[1]}`;

    // Reject tampering with discordUserId via session settings
    const badDiscordPatch = await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      headers: { Cookie: updatedCookie },
      body: { discordUserId: '111111111111111111' }
    });
    assert.equal(badDiscordPatch.status, 400);
    assert.equal(badDiscordPatch.json.code, 'DISCORD_ID_IMMUTABLE');

    // Audit log recorded DISCORD_OAUTH_REGISTER and CLAIM_LEGACY_PROFILE
    const afterState = await api(srv.baseUrl, '/api/state', { token: headToken });
    assert.ok(afterState.json.auditLogs.some((l) => l.actionType === 'CLAIM_LEGACY_PROFILE'));
    assert.ok(afterState.json.auditLogs.some((l) => l.actionType === 'DISCORD_OAUTH_REGISTER'));

    // Guardrail check: AccountSettingsModal UI preserved & RegisterPlayerModal gated by Discord login
    const dialogsSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dialogs.tsx'), 'utf8');
    assert.ok(dialogsSrc.includes('data-testid="account_settings_modal"'));
    assert.ok(dialogsSrc.includes('إعدادات الحساب'));
    assert.ok(dialogsSrc.includes('(ثابت)'));
    assert.ok(dialogsSrc.includes('Discord متصل'));
    assert.ok(dialogsSrc.includes('معرف ElysiumNet'));
    assert.ok(dialogsSrc.includes('معرف XeMoNet (اختياري)'));
    assert.ok(dialogsSrc.includes('حفظ الإعدادات'));
    assert.ok(dialogsSrc.includes('تسجيل الخروج'));
    assert.ok(dialogsSrc.includes('data-testid="register_discord_gate"'));
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
