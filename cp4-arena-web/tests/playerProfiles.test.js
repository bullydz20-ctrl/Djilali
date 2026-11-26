import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { createArenaApp } from '../server/app.js';
import { backfillPlayerProfiles, openDatabase } from '../server/db.js';
import { createSignedOAuthState } from '../server/discord.js';

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

test('Stage 1 Unified Player Profiles: CP4 IDs, Discord OAuth, Bot members, duplicate prevention, manual merge, backfill & backup', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-profiles-stage1-'));
  const dbPath = path.join(tmpDir, 'arena.db');
  const uploadsDir = path.join(tmpDir, 'uploads');

  const mockDiscordAdapter = {
    getStatus() {
      return {
        oauthConfigured: true,
        botConfigured: true,
        guildIdConfigured: true,
        guildConfigured: true
      };
    },
    buildAuthorizeUrl({ state }) {
      return `https://discord.com/oauth2/authorize?client_id=mock&state=${encodeURIComponent(state)}`;
    },
    async exchangeCodeForUser(code) {
      if (code === 'oauth_code_1') {
        return {
          discordUserId: '109876543210987654',
          username: 'karim_dc',
          displayName: 'كريم ديسكورد',
          avatarUrl: 'https://cdn.discordapp.com/avatars/109876543210987654/abc.png?size=256'
        };
      }
      throw new Error('INVALID_CODE');
    },
    async fetchGuildMembers() {
      return [
        {
          discordUserId: '109876543210987654',
          username: 'karim_dc',
          displayName: 'كريم ديسكورد',
          avatarUrl: 'https://cdn.discordapp.com/avatars/109876543210987654/abc.png?size=256'
        },
        {
          discordUserId: '209876543210987654',
          username: 'youssef_dc',
          displayName: 'يوسف عضو البوت',
          avatarUrl: null
        }
      ];
    }
  };

  let srv = await startServer({ dbPath, uploadsDir, discordAdapter: mockDiscordAdapter });
  try {
    // 1. Setup head admin
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'HeadAdmin', displayName: 'Djilali', pin: '482913', keepSignedIn: true }
    });
    assert.equal(setupRes.status, 201);
    const headToken = setupRes.json.token;

    // 2. Discord status & OAuth start URL
    const statusRes = await api(srv.baseUrl, '/api/discord/status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.json.oauthConfigured, true);
    assert.equal(statusRes.json.botConfigured, true);
    assert.equal(statusRes.json.guildIdConfigured, true);

    const startRes = await api(srv.baseUrl, '/api/discord/oauth/start?format=json', {
      headers: { Origin: 'http://127.0.0.1:5173' }
    });
    assert.equal(startRes.status, 200);
    assert.ok(startRes.json.url.includes('state='));
    const validState = new URL(startRes.json.url).searchParams.get('state');
    assert.ok(validState);

    // 3. Reject tampered OAuth state
    const badStateRes = await api(srv.baseUrl, '/api/discord/oauth/callback?code=oauth_code_1&state=tampered.token');
    assert.equal(badStateRes.status, 400);

    // 4. First OAuth callback creates CP4-000001
    const oauthRes1 = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=oauth_code_1&state=${encodeURIComponent(validState)}`
    );
    assert.equal(oauthRes1.status, 200);
    assert.ok(oauthRes1.text.includes('CP4-000001'));
    assert.ok(oauthRes1.text.includes('"created":true'));

    // 5. Second OAuth callback for same Discord User ID resolves existing profile without duplicate
    const state2 = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173' });
    const oauthRes2 = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=oauth_code_1&state=${encodeURIComponent(state2)}`
    );
    assert.equal(oauthRes2.status, 200);
    assert.ok(oauthRes2.text.includes('CP4-000001'));
    assert.ok(oauthRes2.text.includes('"duplicate":true'));

    const profilesAfterOAuth = await api(srv.baseUrl, '/api/player-profiles', { token: headToken });
    assert.equal(profilesAfterOAuth.status, 200);
    assert.equal(profilesAfterOAuth.json.profiles.length, 1);
    const karimProfile = profilesAfterOAuth.json.profiles[0];
    assert.equal(karimProfile.cp4Id, 'CP4-000001');
    assert.equal(karimProfile.discordUserId, '109876543210987654');

    // 6. Manual creation rejects duplicate Discord User ID with 409 DUPLICATE_DISCORD_ID + existingProfile
    const dupManualRes = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: {
        name: 'اسم مختلف تماماً',
        discordUserId: '109876543210987654',
        elysiumNetId: 'ely_karim',
        xeMoNetId: 'xemo_karim'
      }
    });
    assert.equal(dupManualRes.status, 409);
    assert.equal(dupManualRes.json.code, 'DUPLICATE_DISCORD_ID');
    assert.equal(dupManualRes.json.existingProfile.id, karimProfile.id);
    assert.equal(dupManualRes.json.existingProfile.cp4Id, 'CP4-000001');

    // Invalid Discord User ID rejected
    const badDiscordIdRes = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: { name: 'لاعب', discordUserId: 'not-numeric' }
    });
    assert.equal(badDiscordIdRes.status, 400);
    assert.equal(badDiscordIdRes.json.code, 'INVALID_DISCORD_ID');

    // 7. Create second manual profile (Bot guild member), verifies CP4-000002 & immutability
    const guildMembersRes = await api(srv.baseUrl, '/api/discord/guild-members', { token: headToken });
    assert.equal(guildMembersRes.status, 200);
    assert.equal(guildMembersRes.json.members.length, 2);
    const linkedMember = guildMembersRes.json.members.find((m) => m.discordUserId === '109876543210987654');
    const unlinkedMember = guildMembersRes.json.members.find((m) => m.discordUserId === '209876543210987654');
    assert.equal(linkedMember.linkedCp4Id, 'CP4-000001');
    assert.equal(unlinkedMember.linkedProfileId, null);

    const createManual2 = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: {
        name: 'يوسف عضو البوت',
        discordUserId: '209876543210987654',
        elysiumNetId: 'ely_youssef',
        xeMoNetId: 'xemo_youssef'
      }
    });
    assert.equal(createManual2.status, 201);
    const youssefProfile = createManual2.json.profile;
    assert.equal(youssefProfile.cp4Id, 'CP4-000002');

    // CP4 ID cannot be altered via PATCH
    const immutablePatch = await api(srv.baseUrl, `/api/player-profiles/${youssefProfile.id}`, {
      method: 'PATCH',
      token: headToken,
      body: { cp4Id: 'CP4-999999', name: 'يوسف المحدث' }
    });
    assert.equal(immutablePatch.status, 400);
    assert.equal(immutablePatch.json.code, 'CP4_ID_IMMUTABLE');

    // 8. Register a manual profile without Discord ID + attach to tournament + explicit merge keeping target CP4 ID
    const createNoDiscord = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: {
        name: 'كريم قديم',
        elysiumNetId: 'ely_karim_old',
        xeMoNetId: 'xemo_old'
      }
    });
    assert.equal(createNoDiscord.status, 201);
    const oldKarimProfile = createNoDiscord.json.profile;
    assert.equal(oldKarimProfile.cp4Id, 'CP4-000003');

    const stateRes = await api(srv.baseUrl, '/api/state', { token: headToken });
    const tId = stateRes.json.tournament.id;
    const addPlayerRes = await api(srv.baseUrl, `/api/tournaments/${tId}/players`, {
      method: 'POST',
      token: headToken,
      body: {
        profileId: oldKarimProfile.id,
        name: oldKarimProfile.name,
        elysiumNetId: 'ely_karim_old',
        xeMoNetId: 'xemo_old',
        level: 'PRO',
        ovrRating: 86,
        status: 'APPROVED'
      }
    });
    assert.equal(addPlayerRes.status, 201);
    assert.equal(addPlayerRes.json.player.cp4Id, 'CP4-000003');

    // Merge requires confirmIdentity: true
    const mergeNoConfirm = await api(srv.baseUrl, '/api/player-profiles/merge', {
      method: 'POST',
      token: headToken,
      body: {
        sourceProfileId: oldKarimProfile.id,
        targetProfileId: karimProfile.id,
        confirmIdentity: false
      }
    });
    assert.equal(mergeNoConfirm.status, 400);
    assert.equal(mergeNoConfirm.json.code, 'CONFIRM_REQUIRED');

    const mergeOk = await api(srv.baseUrl, '/api/player-profiles/merge', {
      method: 'POST',
      token: headToken,
      body: {
        sourceProfileId: oldKarimProfile.id,
        targetProfileId: karimProfile.id,
        confirmIdentity: true
      }
    });
    assert.equal(mergeOk.status, 200);
    assert.equal(mergeOk.json.profile.cp4Id, 'CP4-000001');
    assert.equal(mergeOk.json.profile.tournamentsCount, 1);

    // Tournament player now points to CP4-000001 without losing tournament entry
    const postMergeState = await api(srv.baseUrl, '/api/state', { token: headToken });
    const movedPlayer = postMergeState.json.players.find((p) => p.id === addPlayerRes.json.player.id);
    assert.equal(movedPlayer.profileId, karimProfile.id);
    assert.equal(movedPlayer.cp4Id, 'CP4-000001');

    // 9. Backup v4 preserves profiles and exports them
    const backupRes = await api(srv.baseUrl, '/api/admin/backup', { token: headToken });
    assert.equal(backupRes.status, 200);
    assert.equal(backupRes.json.schemaVersion, 4);
    assert.equal(backupRes.json.playerProfiles.length, 2);

    const restoreRes = await api(srv.baseUrl, '/api/admin/restore', {
      method: 'POST',
      token: headToken,
      body: backupRes.json
    });
    assert.equal(restoreRes.status, 200);

    // Next profile created after deleting/merging still never reuses CP4-000003 (monotonic CP4-000004)
    const createFourth = await api(srv.baseUrl, '/api/player-profiles', {
      method: 'POST',
      token: headToken,
      body: { name: 'رابع لاعب', elysiumNetId: 'ely_fourth' }
    });
    assert.equal(createFourth.status, 201);
    assert.equal(createFourth.json.profile.cp4Id, 'CP4-000004');
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Stage 1 backfillPlayerProfiles never auto-merges two players with identical name', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-backfill-test-'));
  const dbPath = path.join(tmpDir, 'backfill.db');
  const db = openDatabase(dbPath);
  try {
    const tId = Number(
      db.prepare(`
        INSERT INTO tournaments (
          name, game_title, game_category, score_unit_label, description,
          start_date_time, max_participants, format, created_at
        ) VALUES ('بطولة أرشيفية', 'FIFA 22', 'كرة قدم', 'هدف', '', '', 16, 'KNOCKOUT', 1000)
      `).run().lastInsertRowid
    );

    const p1 = Number(
      db.prepare(`
        INSERT INTO players (tournament_id, name, elysium_net_id, status, registered_at)
        VALUES (?, 'محمد', 'ely_mohammed_1', 'APPROVED', 1001)
      `).run(tId).lastInsertRowid
    );
    const p2 = Number(
      db.prepare(`
        INSERT INTO players (tournament_id, name, elysium_net_id, status, registered_at)
        VALUES (?, 'محمد', 'ely_mohammed_2', 'APPROVED', 1002)
      `).run(tId).lastInsertRowid
    );

    backfillPlayerProfiles(db);

    const row1 = db.prepare('SELECT profile_id FROM players WHERE id = ?').get(p1);
    const row2 = db.prepare('SELECT profile_id FROM players WHERE id = ?').get(p2);
    assert.ok(row1.profile_id);
    assert.ok(row2.profile_id);
    assert.notEqual(row1.profile_id, row2.profile_id);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Stage 1 Bot guild-members returns 503 when Discord Bot credentials are not configured', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-unconfigured-discord-'));
  const srv = await startServer({
    dbPath: path.join(tmpDir, 'arena.db'),
    uploadsDir: path.join(tmpDir, 'uploads'),
    discordAdapter: {
      getStatus: () => ({ oauthConfigured: false, botConfigured: false, guildIdConfigured: false, guildConfigured: false }),
      buildAuthorizeUrl: () => null,
      exchangeCodeForUser: async () => { throw new Error('UNCONFIGURED'); },
      fetchGuildMembers: async () => { throw new Error('UNCONFIGURED'); }
    }
  });
  try {
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'HeadAdmin', displayName: 'Djilali', pin: '482913' }
    });
    const token = setupRes.json.token;

    const botRes = await api(srv.baseUrl, '/api/discord/guild-members', { token });
    assert.equal(botRes.status, 503);
    assert.equal(botRes.json.code, 'DISCORD_BOT_UNCONFIGURED');

    const oauthRes = await api(srv.baseUrl, '/api/discord/oauth/start?format=json');
    assert.equal(oauthRes.status, 503);
    assert.equal(oauthRes.json.code, 'DISCORD_OAUTH_UNCONFIGURED');
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Stage 1 openDatabase upgrades legacy pre-Stage-1 SQLite snapshot without ERR_SQLITE_ERROR', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-legacy-upgrade-'));
  const dbPath = path.join(tmpDir, 'legacy.db');

  // Create a pre-Stage-1 database where players has no profile_id or xemonet_id columns
  // and player_profiles table does not exist yet (matching live Render snapshots).
  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
    CREATE TABLE tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      game_title TEXT NOT NULL DEFAULT 'FIFA 22',
      game_category TEXT NOT NULL DEFAULT 'كرة قدم',
      score_unit_label TEXT NOT NULL DEFAULT 'هدف',
      description TEXT NOT NULL,
      banner_url TEXT,
      start_date_time TEXT NOT NULL,
      max_participants INTEGER NOT NULL DEFAULT 16,
      format TEXT NOT NULL DEFAULT 'DIRECT_KNOCKOUT',
      group_count INTEGER NOT NULL DEFAULT 4,
      qualifiers_per_group INTEGER NOT NULL DEFAULT 2,
      draw_mode TEXT NOT NULL DEFAULT 'RANDOM',
      knockout_tie_rule TEXT NOT NULL DEFAULT 'SINGLE_MATCH_PENALTIES',
      match_duration_minutes INTEGER NOT NULL DEFAULT 12,
      target_goals_rule TEXT NOT NULL DEFAULT '',
      is_registration_closed_manual INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'REGISTRATION_OPEN',
      champion_player_id INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      elysium_net_id TEXT NOT NULL,
      avatar_url TEXT,
      level TEXT NOT NULL DEFAULT 'INTERMEDIATE',
      ovr_rating INTEGER NOT NULL DEFAULT 81,
      club_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'APPROVED',
      group_id INTEGER,
      seed_order INTEGER NOT NULL DEFAULT 0,
      registered_at INTEGER NOT NULL
    );
    CREATE TABLE matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      stage TEXT NOT NULL,
      group_id INTEGER,
      round_number INTEGER NOT NULL,
      bracket_index INTEGER NOT NULL,
      player1_id INTEGER,
      player2_id INTEGER,
      leg1_score1 INTEGER,
      leg1_score2 INTEGER,
      leg2_score1 INTEGER,
      leg2_score2 INTEGER,
      penalty_score1 INTEGER,
      penalty_score2 INTEGER,
      is_two_legged INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      winner_id INTEGER,
      next_match_id INTEGER,
      next_match_slot INTEGER NOT NULL DEFAULT 1,
      scheduled_label TEXT NOT NULL DEFAULT '',
      scheduled_at_millis INTEGER
    );
  `);
  legacyDb.prepare(`
    INSERT INTO tournaments (name, description, start_date_time, created_at)
    VALUES ('بطولة JUMP FORCE', '', '', 1000)
  `).run();
  legacyDb.prepare(`
    INSERT INTO players (tournament_id, name, elysium_net_id, registered_at)
    VALUES (1, 'لاعب قديم', 'ely_legacy_1', 1001)
  `).run();
  legacyDb.close();

  const upgraded = openDatabase(dbPath);
  try {
    const player = upgraded.prepare('SELECT id, profile_id, xemonet_id FROM players WHERE id = 1').get();
    assert.ok(player.profile_id);
    assert.equal(player.xemonet_id, '');
    const profile = upgraded.prepare('SELECT cp4_id, name, elysium_net_id FROM player_profiles WHERE id = ?').get(player.profile_id);
    assert.equal(profile.cp4_id, 'CP4-000001');
    assert.equal(profile.name, 'لاعب قديم');
    assert.equal(profile.elysium_net_id, 'ely_legacy_1');
  } finally {
    upgraded.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
