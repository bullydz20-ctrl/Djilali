import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createArenaApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
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

async function api(baseUrl, pathUrl, { method = 'GET', body, token, cookie, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (body !== undefined) reqHeaders['Content-Type'] = 'application/json';
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  if (cookie) reqHeaders.Cookie = cookie;
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

test('Automatic pre-migration backup runs before creating friendly_matches on legacy DB without data loss', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-legacy-backup-'));
  const dbPath = path.join(tmpDir, 'arena.db');

  // Create a legacy DB schema WITHOUT friendly_matches
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`
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
      format TEXT NOT NULL DEFAULT 'GROUPS_KNOCKOUT',
      group_count INTEGER NOT NULL DEFAULT 4,
      qualifiers_per_group INTEGER NOT NULL DEFAULT 2,
      draw_mode TEXT NOT NULL DEFAULT 'RANDOM',
      knockout_tie_rule TEXT NOT NULL DEFAULT 'SINGLE_MATCH_PENALTIES',
      match_duration_minutes INTEGER NOT NULL DEFAULT 12,
      target_goals_rule TEXT NOT NULL DEFAULT 'المباراة الكاملة',
      is_registration_closed_manual INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'REGISTRATION_OPEN',
      champion_player_id INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE tournament_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );
    CREATE TABLE player_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cp4_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      avatar_url TEXT,
      elysium_net_id TEXT NOT NULL DEFAULT '',
      xemonet_id TEXT NOT NULL DEFAULT '',
      discord_user_id TEXT UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      profile_id INTEGER,
      name TEXT NOT NULL,
      elysium_net_id TEXT NOT NULL,
      xemonet_id TEXT NOT NULL DEFAULT '',
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
    CREATE TABLE match_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL UNIQUE,
      tournament_id INTEGER NOT NULL,
      match_title TEXT NOT NULL,
      match_stage_label TEXT NOT NULL,
      scheduled_at_millis INTEGER NOT NULL,
      remind_at_millis INTEGER NOT NULL,
      lead_minutes INTEGER NOT NULL DEFAULT 15,
      is_enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      can_manage_tournament INTEGER NOT NULL DEFAULT 0,
      can_manage_players INTEGER NOT NULL DEFAULT 0,
      can_run_draw INTEGER NOT NULL DEFAULT 0,
      can_edit_scores INTEGER NOT NULL DEFAULT 0,
      can_crown_champion INTEGER NOT NULL DEFAULT 0,
      permissions_hash TEXT NOT NULL,
      pin_updated_at INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, keep_signed_in INTEGER NOT NULL DEFAULT 1, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE revoked_tokens (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE revoked_admins (username TEXT PRIMARY KEY, revoked_at INTEGER NOT NULL);
    CREATE TABLE auth_lockout (client_key TEXT PRIMARY KEY, failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until_millis INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE admin_audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER, actor_username TEXT NOT NULL, actor_display_name TEXT NOT NULL, action_type TEXT NOT NULL, summary_ar TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE races (id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER NOT NULL, race_number INTEGER NOT NULL, title TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'REGULAR', track_name TEXT NOT NULL DEFAULT '', is_completed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
    CREATE TABLE race_results (id INTEGER PRIMARY KEY AUTOINCREMENT, race_id INTEGER NOT NULL, tournament_id INTEGER NOT NULL, player_id INTEGER NOT NULL, position INTEGER NOT NULL, points_awarded INTEGER NOT NULL DEFAULT 0, best_lap_or_time TEXT NOT NULL DEFAULT '', dnf INTEGER NOT NULL DEFAULT 0);

    INSERT INTO tournaments (name, description, start_date_time, created_at) VALUES ('Legacy Cup', 'Old Cup', '2026-01-01', 1000);
    INSERT INTO player_profiles (cp4_id, name, elysium_net_id, created_at) VALUES ('CP4-000001', 'LegacyPlayer', 'ELY_LEGACY', 1000);
    INSERT INTO players (tournament_id, profile_id, name, elysium_net_id, status, registered_at) VALUES (1, 1, 'LegacyPlayer', 'ELY_LEGACY', 'APPROVED', 1000);
  `);
  legacy.close();

  const migrated = openDatabase(dbPath);
  try {
    const backupDir = path.join(tmpDir, 'backups');
    assert.equal(fs.existsSync(backupDir), true, 'backups directory should be created');
    const files = fs.readdirSync(backupDir);
    assert.ok(files.some((f) => f.includes('pre-friendly') && f.endsWith('.db')));

    const tRow = migrated.prepare('SELECT name FROM tournaments WHERE id = 1').get();
    assert.equal(tRow.name, 'Legacy Cup');
    const pRow = migrated.prepare('SELECT name FROM players WHERE id = 1').get();
    assert.equal(pRow.name, 'LegacyPlayer');
    const friendlyExists = migrated
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'friendly_matches'")
      .get();
    assert.ok(friendlyExists);
  } finally {
    migrated.close();
  }
});

test('Friendly matches submission, admin review, per-game «ضحاياك» threshold (5+ wins), and season leaderboard isolation', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-victims-'));
  const dbPath = path.join(tmpDir, 'arena.db');
  const uploadsDir = path.join(tmpDir, 'uploads');

  const mockDiscordAdapter = {
    getStatus: () => ({
      oauthConfigured: true,
      botConfigured: false,
      guildIdConfigured: false,
      guildConfigured: false
    }),
    buildAuthorizeUrl: ({ state }) => `https://discord.com/oauth2/authorize?state=${encodeURIComponent(state)}`,
    exchangeCodeForUser: async (code) => {
      if (code === 'player_a') {
        return {
          discordUserId: '100000000000000001',
          username: 'player_a',
          displayName: 'بطل الساحة أ',
          avatarUrl: 'https://cdn.discordapp.com/avatars/100000000000000001/a.png'
        };
      }
      if (code === 'player_b') {
        return {
          discordUserId: '100000000000000002',
          username: 'player_b',
          displayName: 'خصم قوي ب',
          avatarUrl: 'https://cdn.discordapp.com/avatars/100000000000000002/b.png'
        };
      }
      throw new Error('UNKNOWN_CODE');
    }
  };

  const srv = await startServer({ dbPath, uploadsDir, discordAdapter: mockDiscordAdapter });
  try {
    // 1. Setup Head Admin + create unprivileged sub-admin (RUN_DRAW only)
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'HeadAdmin', displayName: 'Djilali', pin: '482913', keepSignedIn: true }
    });
    assert.equal(setupRes.status, 201);
    const headToken = setupRes.json.token;

    const subRes = await api(srv.baseUrl, '/api/admin/sub-admins', {
      method: 'POST',
      token: headToken,
      body: {
        username: 'DrawOnly',
        displayName: 'منسق قرعة',
        pin: '739152',
        canManageTournament: false,
        canManagePlayers: false,
        canRunDraw: true,
        canEditScores: false,
        canCrownChampion: false
      }
    });
    assert.equal(subRes.status, 201);
    const subLogin = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      body: { username: 'DrawOnly', pin: '739152', keepSignedIn: false }
    });
    assert.equal(subLogin.status, 200);
    const drawOnlyToken = subLogin.json.token;

    // 2. Authenticate Player A and Player B via Discord OAuth
    const oauthStateA = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173', returnTo: '/' });
    const cbA = await api(srv.baseUrl, `/api/discord/oauth/callback?code=player_a&state=${encodeURIComponent(oauthStateA)}`);
    assert.equal(cbA.status, 200);
    const cookieA = `cp4_discord_session=${cbA.headers.get('set-cookie').match(/cp4_discord_session=([^;]+)/)[1]}`;

    const oauthStateB = createSignedOAuthState(srv.db.sessionSecret, { origin: 'http://127.0.0.1:5173', returnTo: '/' });
    const cbB = await api(srv.baseUrl, `/api/discord/oauth/callback?code=player_b&state=${encodeURIComponent(oauthStateB)}`);
    assert.equal(cbB.status, 200);
    const cookieB = `cp4_discord_session=${cbB.headers.get('set-cookie').match(/cp4_discord_session=([^;]+)/)[1]}`;

    const stateCheckA = await api(srv.baseUrl, '/api/state', { cookie: cookieA });
    const profileA = stateCheckA.json.currentDiscordProfile;
    const directory = stateCheckA.json.registeredPlayersDirectory;
    const profileB = directory.find((d) => d.id !== profileA.id);
    assert.ok(profileA && profileB);

    // Save Elysium IDs for tournament participation
    await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      cookie: cookieA,
      body: { elysiumNetId: 'ELY_A' }
    });
    await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      cookie: cookieB,
      body: { elysiumNetId: 'ELY_B' }
    });

    // 3. Add 3 official FIFA 22 tournament wins for Player A vs Player B
    const tId = stateCheckA.json.tournament.id;
    const addA = await api(srv.baseUrl, `/api/tournaments/${tId}/players`, {
      method: 'POST',
      token: headToken,
      body: {
        profileId: profileA.id,
        name: profileA.name,
        elysiumNetId: 'ELY_A',
        level: 'PRO',
        ovrRating: 88,
        status: 'APPROVED'
      }
    });
    assert.equal(addA.status, 201);
    const addB = await api(srv.baseUrl, `/api/tournaments/${tId}/players`, {
      method: 'POST',
      token: headToken,
      body: {
        profileId: profileB.id,
        name: profileB.name,
        elysiumNetId: 'ELY_B',
        level: 'PRO',
        ovrRating: 88,
        status: 'APPROVED'
      }
    });
    assert.equal(addB.status, 201);
    const playerAId = addA.json.player.id;
    const playerBId = addB.json.player.id;

    // Insert 3 completed official FIFA 22 tournament matches where Player A defeats Player B
    for (let i = 1; i <= 3; i++) {
      srv.db
        .prepare(`
          INSERT INTO matches (
            tournament_id, stage, round_number, bracket_index,
            player1_id, player2_id, leg1_score1, leg1_score2,
            is_completed, winner_id
          ) VALUES (?, 'GROUP', ?, ?, ?, ?, 2, 0, 1, ?)
        `)
        .run(tId, i, i - 1, playerAId, playerBId, playerAId);
    }

    const beforeFriendlyState = await api(srv.baseUrl, '/api/state');
    const baselinePointsA = beforeFriendlyState.json.seasonLeaderboard.find((e) => e.elysiumNetId === 'ELY_A').seasonPoints;
    const baselinePointsB = beforeFriendlyState.json.seasonLeaderboard.find((e) => e.elysiumNetId === 'ELY_B').seasonPoints;
    // 3 tournament wins only -> NOT yet qualified (< 5)
    assert.equal(beforeFriendlyState.json.playerVictimsMap[String(profileA.id)].length, 0);
    assert.equal(beforeFriendlyState.json.victimsAchievements.length, 0);

    // 4. Auth, validation & duplicate prevention on POST /api/friendly-matches
    const unauthSubmit = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileB.id,
        score1: 4,
        score2: 1,
        matchDate: '2026-11-20'
      }
    });
    assert.equal(unauthSubmit.status, 401);

    const selfSubmit = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      cookie: cookieA,
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileA.id,
        score1: 4,
        score2: 1,
        matchDate: '2026-11-20'
      }
    });
    assert.equal(selfSubmit.status, 400);

    // Valid FIFA 22 friendly submission #1 (with proof URL)
    const subFifa1 = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      cookie: cookieA,
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileB.id,
        score1: 4,
        score2: 1,
        matchDate: '2026-11-20',
        proofImageUrl: '/uploads/fifa-proof-1.png'
      }
    });
    assert.equal(subFifa1.status, 201);
    const fm1Id = subFifa1.json.friendlyMatch.id;
    assert.equal(subFifa1.json.friendlyMatch.status, 'PENDING');

    // Duplicate check from opponent's reversed score perspective -> 409
    const dupCheck = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      cookie: cookieB,
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileA.id,
        score1: 1,
        score2: 4,
        matchDate: '2026-11-20'
      }
    });
    assert.equal(dupCheck.status, 409);
    assert.equal(dupCheck.json.code, 'DUPLICATE_FRIENDLY_MATCH');

    // Pending match does NOT affect public stats or victims
    const publicWhilePending = await api(srv.baseUrl, '/api/state');
    assert.equal(publicWhilePending.json.friendlyMatches.length, 0);
    assert.equal(publicWhilePending.json.playerUnifiedStatsMap[String(profileA.id)].friendlyMatches, 0);

    // Caller A CAN see their own PENDING submission
    const callerWhilePending = await api(srv.baseUrl, '/api/state', { cookie: cookieA });
    assert.equal(callerWhilePending.json.friendlyMatches.length, 1);

    // Unprivileged sub-admin cannot review
    const forbiddenReview = await api(srv.baseUrl, `/api/friendly-matches/${fm1Id}/review`, {
      method: 'PATCH',
      token: drawOnlyToken,
      body: { action: 'APPROVE' }
    });
    assert.equal(forbiddenReview.status, 403);

    // Reject requires reason
    const emptyReject = await api(srv.baseUrl, `/api/friendly-matches/${fm1Id}/review`, {
      method: 'PATCH',
      token: headToken,
      body: { action: 'REJECT', reviewNote: '' }
    });
    assert.equal(emptyReject.status, 400);

    // Reject with reason -> rejected, does NOT count, allows resubmission
    const rejectRes = await api(srv.baseUrl, `/api/friendly-matches/${fm1Id}/review`, {
      method: 'PATCH',
      token: headToken,
      body: { action: 'REJECT', reviewNote: 'الصورة غير واضحة، يرجى إعادة الإرسال' }
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.json.friendlyMatch.status, 'REJECTED');

    // Re-submit corrected match + 2nd FIFA 22 friendly win (combined with 3 tournament wins = 5 FIFA 22 wins!)
    const subFifa1Retry = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      cookie: cookieA,
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileB.id,
        score1: 4,
        score2: 1,
        matchDate: '2026-11-20'
      }
    });
    assert.equal(subFifa1Retry.status, 201);

    const subFifa2 = await api(srv.baseUrl, '/api/friendly-matches', {
      method: 'POST',
      cookie: cookieA,
      body: {
        gameTitle: 'FIFA 22',
        opponentProfileId: profileB.id,
        score1: 2,
        score2: 2,
        matchDate: '2026-11-21'
      }
    });
    assert.equal(subFifa2.status, 201);

    // Approve both FIFA 22 friendlies (admin adjusts score on #2 from 2-2 to 3-2)
    const appF1 = await api(srv.baseUrl, `/api/friendly-matches/${subFifa1Retry.json.friendlyMatch.id}/review`, {
      method: 'PATCH',
      token: headToken,
      body: { action: 'APPROVE' }
    });
    assert.equal(appF1.status, 200);

    const appF2 = await api(srv.baseUrl, `/api/friendly-matches/${subFifa2.json.friendlyMatch.id}/review`, {
      method: 'PATCH',
      token: headToken,
      body: { action: 'APPROVE', score1: 3, score2: 2, reviewNote: 'تم تصحيح النتيجة حسب الصورة' }
    });
    assert.equal(appF2.status, 200);
    assert.equal(appF2.json.friendlyMatch.winnerProfileId, profileA.id);

    // 5. Add 3 JUMP FORCE friendly wins (NOT enough for 5) and 5 Tekken 7 friendly wins (QUALIFIED independently!)
    for (let i = 1; i <= 3; i++) {
      const jf = await api(srv.baseUrl, '/api/friendly-matches', {
        method: 'POST',
        cookie: cookieA,
        body: {
          gameTitle: 'JUMP FORCE',
          opponentProfileId: profileB.id,
          score1: 2,
          score2: 0,
          matchDate: `2026-11-0${i}`
        }
      });
      assert.equal(jf.status, 201);
      const rev = await api(srv.baseUrl, `/api/friendly-matches/${jf.json.friendlyMatch.id}/review`, {
        method: 'PATCH',
        token: headToken,
        body: { action: 'APPROVE' }
      });
      assert.equal(rev.status, 200);
    }

    for (let i = 1; i <= 5; i++) {
      const tk = await api(srv.baseUrl, '/api/friendly-matches', {
        method: 'POST',
        cookie: cookieA,
        body: {
          gameTitle: 'Tekken 7',
          opponentProfileId: profileB.id,
          score1: 3,
          score2: 1,
          matchDate: `2026-11-1${i}`
        }
      });
      assert.equal(tk.status, 201);
      const rev = await api(srv.baseUrl, `/api/friendly-matches/${tk.json.friendlyMatch.id}/review`, {
        method: 'PATCH',
        token: headToken,
        body: { action: 'APPROVE' }
      });
      assert.equal(rev.status, 200);
    }

    // 6. Verify final public state:
    const finalState = await api(srv.baseUrl, '/api/state');
    const victimsA = finalState.json.playerVictimsMap[String(profileA.id)];
    assert.equal(victimsA.length, 2, 'Only FIFA 22 (5) and Tekken 7 (5) qualify; JUMP FORCE (3) must NOT qualify');

    const fifaVictim = victimsA.find((v) => v.gameTitle === 'FIFA 22');
    assert.ok(fifaVictim);
    assert.equal(fifaVictim.winsCount, 5);
    assert.equal(fifaVictim.tournamentWins, 3);
    assert.equal(fifaVictim.friendlyWins, 2);

    const tekkenVictim = victimsA.find((v) => v.gameTitle === 'Tekken 7');
    assert.ok(tekkenVictim);
    assert.equal(tekkenVictim.winsCount, 5);
    assert.equal(tekkenVictim.tournamentWins, 0);
    assert.equal(tekkenVictim.friendlyWins, 5);

    const jfVictim = victimsA.find((v) => v.gameTitle === 'JUMP FORCE');
    assert.equal(jfVictim, undefined);

    // HomeScreen victimsAchievements exposes both FIFA 22 and Tekken 7 achievements
    assert.equal(finalState.json.victimsAchievements.length, 2);

    // Season Leaderboard points MUST be untouched by all 10 approved friendly matches!
    const afterPointsA = finalState.json.seasonLeaderboard.find((e) => e.elysiumNetId === 'ELY_A').seasonPoints;
    const afterPointsB = finalState.json.seasonLeaderboard.find((e) => e.elysiumNetId === 'ELY_B').seasonPoints;
    assert.equal(afterPointsA, baselinePointsA);
    assert.equal(afterPointsB, baselinePointsB);

    // Unified stats include 3 tournament + 10 approved friendly matches = 13 total matches
    const statsA = finalState.json.playerUnifiedStatsMap[String(profileA.id)];
    assert.equal(statsA.tournamentMatches, 3);
    assert.equal(statsA.friendlyMatches, 10);
    assert.equal(statsA.totalMatches, 13);
    assert.equal(statsA.wins, 13);

    // 7. Backup export & restore preserves friendlyMatches and victimsAchievements
    const backupRes = await api(srv.baseUrl, '/api/admin/backup', { token: headToken });
    assert.equal(backupRes.status, 200);
    assert.equal(backupRes.json.schemaVersion, 4);
    assert.equal(backupRes.json.friendlyMatches.length, 11); // 1 rejected + 10 approved

    const restoreRes = await api(srv.baseUrl, '/api/admin/restore', {
      method: 'POST',
      token: headToken,
      body: backupRes.json
    });
    assert.equal(restoreRes.status, 200);

    const afterRestoreState = await api(srv.baseUrl, '/api/state');
    assert.equal(afterRestoreState.json.victimsAchievements.length, 2);
  } finally {
    await srv.close();
  }
});

test('FriendlyMatchModal and modal CSS use mobile-safe dvh sheet rules instead of vh clipping', () => {
  const modalSrc = fs.readFileSync(path.resolve('src/components/FriendlyMatchModal.tsx'), 'utf8');
  const cssSrc = fs.readFileSync(path.resolve('src/styles/theme.css'), 'utf8');
  assert.equal(modalSrc.includes('92vh'), false);
  assert.ok(modalSrc.includes('modal-panel-sheet'));
  assert.ok(modalSrc.includes('modal-sheet-header'));
  assert.ok(modalSrc.includes('modal-sheet-body'));
  assert.ok(modalSrc.includes('modal-sheet-footer'));
  assert.ok(cssSrc.includes('100dvh - 16px'));
  assert.ok(cssSrc.includes('overscroll-behavior: contain'));
});

