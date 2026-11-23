import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createArenaApp } from '../server/app.js';

function startServer(opts) {
  const { app, db, service } = createArenaApp(opts);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        db,
        service,
        close: () =>
          new Promise((res) => {
            server.close(() => {
              try {
                db.close();
              } catch {
                // ignore
              }
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
    body: body !== undefined ? JSON.stringify(body) : undefined
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

// 1x1 valid PNG binary
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('CP4 ARENA full end-to-end backend, security, multi-game, draw, bracket, and persistence suite', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-arena-test-'));
  const dbPath = path.join(tmpDir, 'arena.db');
  const uploadsDir = path.join(tmpDir, 'uploads');

  let srv = await startServer({ dbPath, uploadsDir });

  try {
    // 1. Visitor read access works cleanly & unauthenticated admin routes are blocked
    const initState = await api(srv.baseUrl, '/api/state');
    assert.equal(initState.status, 200);
    assert.equal(initState.json.hasHeadAdmin, false);
    assert.equal(initState.json.currentAdmin, null);
    assert.ok(initState.json.tournaments.length >= 1);
    assert.ok(initState.json.gameCatalog.some((g) => g.id === 'Tekken 8'));

    const unauthCreate = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      body: { name: 'اختبار غير مصرح' }
    });
    assert.equal(unauthCreate.status, 401);

    // 2. First-run Head Admin setup & duplicate claim rejection
    const setupRes = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'Djilali', displayName: 'Djilali Head', pin: '482913', keepSignedIn: true }
    });
    assert.equal(setupRes.status, 201);
    assert.ok(setupRes.json.token);
    let headToken = setupRes.json.token;

    const dupSetup = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'Attacker', displayName: 'Attacker', pin: '999999' }
    });
    assert.equal(dupSetup.status, 409);

    // 3. Brute-force lockout after 5 wrong attempts (using isolated forwarded IP)
    for (let i = 1; i <= 5; i++) {
      const bad = await api(srv.baseUrl, '/api/admin/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': '10.10.10.99' },
        body: { username: 'Djilali', pin: '000000' }
      });
      assert.equal(bad.status, 401);
    }
    const lockedOut = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.99' },
      body: { username: 'Djilali', pin: '482913' }
    });
    assert.equal(lockedOut.status, 429);

    // Valid login from another IP & changeOwnPin test + revoke other sessions + updateOwnProfile test
    const loginOk = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.100' },
      body: { username: 'Djilali', pin: '482913' }
    });
    assert.equal(loginOk.status, 200);
    const otherLogin = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.103' },
      body: { username: 'Djilali', pin: '482913' }
    });
    assert.equal(otherLogin.status, 200);

    const changePin = await api(srv.baseUrl, '/api/admin/change-pin', {
      method: 'POST',
      token: loginOk.json.token,
      body: { currentPin: '482913', newPin: '739152' }
    });
    assert.equal(changePin.status, 200);

    // Other session must be revoked, while current session stays valid
    const revokedOther = await api(srv.baseUrl, '/api/state', { token: otherLogin.json.token });
    assert.equal(revokedOther.json.currentAdmin, null);
    const keptCurrent = await api(srv.baseUrl, '/api/state', { token: loginOk.json.token });
    assert.equal(keptCurrent.json.currentAdmin.username, 'Djilali');

    const profileUpdate = await api(srv.baseUrl, '/api/admin/profile', {
      method: 'PATCH',
      token: loginOk.json.token,
      body: { displayName: 'Djilali Pro', username: 'DjilaliAdmin' }
    });
    assert.equal(profileUpdate.status, 200);
    assert.equal(profileUpdate.json.admin.displayName, 'Djilali Pro');
    assert.equal(profileUpdate.json.admin.username, 'DjilaliAdmin');

    const loginNewPin = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.101' },
      body: { username: 'DjilaliAdmin', pin: '739152' }
    });
    assert.equal(loginNewPin.status, 200);

    // Restore username to Djilali so remaining test assertions remain valid
    const restoreProfile = await api(srv.baseUrl, '/api/admin/profile', {
      method: 'PATCH',
      token: loginNewPin.json.token,
      body: { displayName: 'Djilali Head', username: 'Djilali' }
    });
    assert.equal(restoreProfile.status, 200);
    // Original setup session was also revoked by change-pin; continue with loginNewPin token
    const setupRevoked = await api(srv.baseUrl, '/api/state', { token: headToken });
    assert.equal(setupRevoked.json.currentAdmin, null);
    headToken = loginNewPin.json.token;

    // 4. Up to 5 Sub-Admins & permission isolation
    const createdSubs = [];
    for (let i = 1; i <= 5; i++) {
      const subRes = await api(srv.baseUrl, '/api/admin/sub-admins', {
        method: 'POST',
        token: headToken,
        body: {
          username: `sub${i}`,
          displayName: `مساعد ${i}`,
          pin: `10203${i}`,
          canManageTournament: false,
          canManagePlayers: i === 1,
          canRunDraw: i === 2,
          canEditScores: i === 3,
          canCrownChampion: false
        }
      });
      assert.equal(subRes.status, 201);
      createdSubs.push(subRes.json.admin);
    }
    const sixthSub = await api(srv.baseUrl, '/api/admin/sub-admins', {
      method: 'POST',
      token: headToken,
      body: {
        username: 'sub6',
        displayName: 'مساعد 6',
        pin: '654321',
        canEditScores: true
      }
    });
    assert.equal(sixthSub.status, 400);

    const sub1Login = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.102' },
      body: { username: 'sub1', pin: '102031' }
    });
    assert.equal(sub1Login.status, 200);
    const sub1Token = sub1Login.json.token;

    // sub1 has MANAGE_PLAYERS only — must be forbidden (403) from creating tournaments or running draw
    const sub1Forbidden = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token: sub1Token,
      body: { name: 'غير مصرح' }
    });
    assert.equal(sub1Forbidden.status, 403);

    // 5. Multi-game tournament creation: Tekken 8 (4 maxParticipants, 2 groups, 2 qualifiers per group)
    const tekkenCreate = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token: headToken,
      body: {
        name: 'كأس CP4 للقتال — Tekken 8',
        gameTitle: 'Tekken 8',
        gameCategory: 'ألعاب قتال',
        scoreUnitLabel: 'جولة',
        maxParticipants: 4,
        format: 'GROUPS_KNOCKOUT',
        groupCount: 2,
        qualifiersPerGroup: 2,
        drawMode: 'RANDOM',
        knockoutTieRule: 'SINGLE_MATCH_PENALTIES',
        matchDurationMinutes: 8,
        targetGoalsRule: 'الأفضل من 3 جولات (FT3)'
      }
    });
    assert.equal(tekkenCreate.status, 201);
    const tekkenId = tekkenCreate.json.tournament.id;

    // Upload valid avatar PNG & verify spoofed image fails
    const badImg = await api(srv.baseUrl, '/api/uploads/image', {
      method: 'POST',
      body: { dataUrl: 'data:image/png;base64,bm90LWEtcG5n' }
    });
    assert.equal(badImg.status, 400);

    const okImg = await api(srv.baseUrl, '/api/uploads/image', {
      method: 'POST',
      body: { dataUrl: `data:image/png;base64,${TINY_PNG_BASE64}` }
    });
    assert.equal(okImg.status, 201);
    assert.match(okImg.json.url, /^\/uploads\/[a-zA-Z0-9_-]+\.png$/);

    const imgGet = await fetch(`${srv.baseUrl}${okImg.json.url}`);
    assert.equal(imgGet.status, 200);

    // 6. Visitor registrations (Name + ElysiumNet ID) & duplicate guard
    const registeredIds = [];
    for (let i = 1; i <= 4; i++) {
      const reg = await api(srv.baseUrl, '/api/players/register', {
        method: 'POST',
        body: {
          tournamentId: tekkenId,
          name: `مقاتل ${i}`,
          elysiumNetId: `ELY-T8-0${i}`,
          avatarUrl: i === 1 ? okImg.json.url : null,
          level: i === 1 ? 'LEGEND' : 'PRO',
          clubName: i === 1 ? 'Kazuya' : 'Jin'
        }
      });
      assert.equal(reg.status, 201);
      assert.equal(reg.json.player.status, 'PENDING');
      registeredIds.push(reg.json.player.id);
    }

    const dupPlayer = await api(srv.baseUrl, '/api/players/register', {
      method: 'POST',
      body: {
        tournamentId: tekkenId,
        name: 'مكرر',
        elysiumNetId: 'ely-t8-01'
      }
    });
    assert.equal(dupPlayer.status, 409);

    // Sub-admin 1 approves all 4 players -> auto closes registration at 4/4
    for (const pid of registeredIds) {
      const appRes = await api(srv.baseUrl, `/api/players/${pid}/status`, {
        method: 'PATCH',
        token: sub1Token,
        body: { status: 'APPROVED' }
      });
      assert.equal(appRes.status, 200);
    }

    // Deactivating sub-admin 1 immediately invalidates token
    await api(srv.baseUrl, `/api/admin/sub-admins/${createdSubs[0].id}`, {
      method: 'PATCH',
      token: headToken,
      body: { displayName: 'مساعد 1', isActive: false }
    });
    const revokedRes = await api(srv.baseUrl, `/api/players/${registeredIds[0]}/status`, {
      method: 'PATCH',
      token: sub1Token,
      body: { status: 'APPROVED' }
    });
    assert.equal(revokedRes.status, 401);

    // Verify 5th registration fails because 4/4 full
    const fullReg = await api(srv.baseUrl, '/api/players/register', {
      method: 'POST',
      body: { tournamentId: tekkenId, name: 'خامس', elysiumNetId: 'ELY-T8-05' }
    });
    assert.equal(fullReg.status, 400);

    // 7. PERSISTENCE CHECK: Restart server against the SAME SQLite file (without CP4_SESSION_SECRET)
    await srv.close();
    srv = await startServer({ dbPath, uploadsDir });

    // Stored Bearer session token must remain valid across server restart
    const persistedState = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}&username=Djilali`, {
      token: headToken
    });
    assert.equal(persistedState.status, 200);
    assert.equal(persistedState.json.currentAdmin?.username, 'Djilali');
    assert.equal(persistedState.json.rememberedUsername, 'Djilali');

    // Unsigned username query param alone must return rememberedUsername hint without granting currentAdmin
    const hintOnlyState = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}&username=djilali`);
    assert.equal(hintOnlyState.status, 200);
    assert.equal(hintOnlyState.json.currentAdmin, null);
    assert.equal(hintOnlyState.json.rememberedUsername, 'Djilali');
    assert.equal(persistedState.json.tournament.gameTitle, 'Tekken 8');
    assert.equal(persistedState.json.tournament.scoreUnitLabel, 'جولة');
    assert.equal(persistedState.json.approvedPlayers.length, 4);
    assert.equal(persistedState.json.isRegistrationOpenNow, false);
    assert.equal(persistedState.json.hasHeadAdmin, true);

    // Login again after restart using updated Head Admin PIN
    const relogin = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.105' },
      body: { username: 'Djilali', pin: '739152' }
    });
    assert.equal(relogin.status, 200);
    const freshToken = relogin.json.token;

    // 8. Run Groups Draw -> schedule reminder -> score matches -> advance to Knockouts -> crown champion
    const drawRes = await api(srv.baseUrl, `/api/tournaments/${tekkenId}/draw`, {
      method: 'POST',
      token: freshToken,
      body: {}
    });
    assert.equal(drawRes.status, 200);

    let afterDraw = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}`);
    assert.equal(afterDraw.json.groupsWithStandings.length, 2);
    assert.equal(afterDraw.json.allMatches.length, 2);

    // Schedule reminder on match 1
    const firstMatch = afterDraw.json.allMatches[0];
    const schedRes = await api(srv.baseUrl, '/api/reminders', {
      method: 'POST',
      body: {
        matchId: firstMatch.id,
        matchTitle: 'نهائي المجموعة أ',
        scheduledAtMillis: Date.now() + 3_600_000,
        leadMinutes: 15
      }
    });
    assert.equal(schedRes.status, 200);

    // Score both group matches
    for (const m of afterDraw.json.allMatches) {
      const sc = await api(srv.baseUrl, `/api/matches/${m.id}/score`, {
        method: 'PATCH',
        token: freshToken,
        body: { leg1Score1: 3, leg1Score2: 1 }
      });
      assert.equal(sc.status, 200);
    }

    // Generate knockout from standings (4 qualifiers -> Semi-Finals + Final)
    const koGen = await api(srv.baseUrl, `/api/tournaments/${tekkenId}/knockout-from-standings`, {
      method: 'POST',
      token: freshToken
    });
    assert.equal(koGen.status, 200);

    const afterKo = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}`);
    const semis = afterKo.json.knockoutMatches.filter((m) => m.stage === 'SEMI_FINAL');
    const finalM = afterKo.json.knockoutMatches.find((m) => m.stage === 'FINAL');
    assert.equal(semis.length, 2);
    assert.ok(finalM);

    // Tie without penalties must fail on knockout single match
    const tieFail = await api(srv.baseUrl, `/api/matches/${semis[0].id}/score`, {
      method: 'PATCH',
      token: freshToken,
      body: { leg1Score1: 2, leg1Score2: 2 }
    });
    assert.equal(tieFail.status, 400);

    // Tie WITH penalties advances winner to Final
    const sf1Ok = await api(srv.baseUrl, `/api/matches/${semis[0].id}/score`, {
      method: 'PATCH',
      token: freshToken,
      body: { leg1Score1: 2, leg1Score2: 2, penaltyScore1: 5, penaltyScore2: 4 }
    });
    assert.equal(sf1Ok.status, 200);

    const sf2Ok = await api(srv.baseUrl, `/api/matches/${semis[1].id}/score`, {
      method: 'PATCH',
      token: freshToken,
      body: { leg1Score1: 1, leg1Score2: 3 }
    });
    assert.equal(sf2Ok.status, 200);

    let beforeFinal = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}`);
    let liveFinal = beforeFinal.json.knockoutMatches.find((m) => m.stage === 'FINAL');
    assert.equal(liveFinal.player1Id, semis[0].player1Id);
    assert.equal(liveFinal.player2Id, semis[1].player2Id);

    // Play Final and verify champion crowned automatically or via endpoint
    await api(srv.baseUrl, `/api/matches/${liveFinal.id}/winner`, {
      method: 'PATCH',
      token: freshToken,
      body: { winnerPlayerId: liveFinal.player1Id }
    });

    // Test cascading reset: change Semi-Final 1 winner directly -> Final must reset & champion cleared
    await api(srv.baseUrl, `/api/matches/${semis[0].id}/winner`, {
      method: 'PATCH',
      token: freshToken,
      body: { winnerPlayerId: semis[0].player2Id }
    });
    let afterCascade = await api(srv.baseUrl, `/api/state?tournamentId=${tekkenId}`);
    liveFinal = afterCascade.json.knockoutMatches.find((m) => m.stage === 'FINAL');
    assert.equal(liveFinal.player1Id, semis[0].player2Id);
    assert.equal(liveFinal.isCompleted, false);
    assert.equal(afterCascade.json.championPlayer, null);

    // Complete final & verify export
    await api(srv.baseUrl, `/api/matches/${liveFinal.id}/score`, {
      method: 'PATCH',
      token: freshToken,
      body: { leg1Score1: 3, leg1Score2: 0 }
    });
    await api(srv.baseUrl, `/api/tournaments/${tekkenId}/champion`, {
      method: 'POST',
      token: freshToken,
      body: { playerId: liveFinal.player1Id }
    });

    const expRes = await api(srv.baseUrl, `/api/tournaments/${tekkenId}/export`);
    assert.equal(expRes.status, 200);
    assert.ok(expRes.json.fullText.includes('Tekken 8'));
    assert.ok(expRes.json.fullText.includes('جولة'));
    assert.ok(expRes.json.socialText.includes('CP4 ARENA'));

    // 9. Test DIRECT_KNOCKOUT + Two-Legged ties + 3-player BYE advancement (Rocket League)
    const rlCreate = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token: freshToken,
      body: {
        name: 'دوري Rocket League السريع',
        gameTitle: 'Rocket League',
        scoreUnitLabel: 'هدف',
        format: 'DIRECT_KNOCKOUT',
        drawMode: 'MANUAL',
        knockoutTieRule: 'TWO_LEGS_FINAL_SINGLE',
        maxParticipants: 8
      }
    });
    assert.equal(rlCreate.status, 201);
    const rlId = rlCreate.json.tournament.id;
    const rlPlayers = [];
    for (let i = 1; i <= 2; i++) {
      const r = await api(srv.baseUrl, '/api/players/register', {
        method: 'POST',
        body: { tournamentId: rlId, name: `RL_${i}`, elysiumNetId: `RL-ID-${i}` }
      });
      await api(srv.baseUrl, `/api/players/${r.json.player.id}/status`, {
        method: 'PATCH',
        token: freshToken,
        body: { status: 'APPROVED' }
      });
      rlPlayers.push(r.json.player.id);
    }

    // Admin direct add player (immediately APPROVED with custom avatar & OVR) + PATCH avatarUrl edit
    const directAdd = await api(srv.baseUrl, `/api/tournaments/${rlId}/players`, {
      method: 'POST',
      token: freshToken,
      body: {
        name: 'RL_3',
        elysiumNetId: 'RL-ID-3',
        clubName: 'Octane',
        level: 'LEGEND',
        ovrRating: 95,
        avatarUrl: okImg.json.url,
        status: 'APPROVED'
      }
    });
    assert.equal(directAdd.status, 201);
    assert.equal(directAdd.json.player.status, 'APPROVED');
    assert.equal(directAdd.json.player.ovrRating, 95);
    assert.equal(directAdd.json.player.avatarUrl, okImg.json.url);
    rlPlayers.push(directAdd.json.player.id);

    const editAvatar = await api(srv.baseUrl, `/api/players/${rlPlayers[0]}`, {
      method: 'PATCH',
      token: freshToken,
      body: {
        name: 'RL_1_Pro',
        elysiumNetId: 'RL-ID-1',
        clubName: 'Fennec',
        level: 'PRO',
        ovrRating: 89,
        avatarUrl: okImg.json.url
      }
    });
    assert.equal(editAvatar.status, 200);
    const afterRlPlayerEdit = await api(srv.baseUrl, `/api/state?tournamentId=${rlId}`);
    const editedP1 = afterRlPlayerEdit.json.players.find((p) => p.id === rlPlayers[0]);
    assert.equal(editedP1.name, 'RL_1_Pro');
    assert.equal(editedP1.avatarUrl, okImg.json.url);

    const rlDraw = await api(srv.baseUrl, `/api/tournaments/${rlId}/draw`, {
      method: 'POST',
      token: freshToken,
      body: { manualKnockoutOrder: rlPlayers }
    });
    assert.equal(rlDraw.status, 200);
    const rlState = await api(srv.baseUrl, `/api/state?tournamentId=${rlId}`);
    const rlSemis = rlState.json.knockoutMatches.filter((m) => m.stage === 'SEMI_FINAL');
    const rlFinal = rlState.json.knockoutMatches.find((m) => m.stage === 'FINAL');
    assert.equal(rlSemis.length, 2);
    assert.equal(rlSemis[0].isTwoLegged, true);
    assert.equal(rlFinal.isTwoLegged, false);
    // Match 2 had a bye -> rlPlayers[2] automatically placed in Final slot 2
    assert.equal(rlFinal.player2Id, rlPlayers[2]);

    // 10. Test LEAGUE_KNOCKOUT flow (Call of Duty)
    const codCreate = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token: freshToken,
      body: {
        name: 'بطولة Call of Duty الأسبوعية',
        gameTitle: 'Call of Duty',
        scoreUnitLabel: 'نقطة',
        format: 'LEAGUE_KNOCKOUT',
        qualifiersPerGroup: 2,
        maxParticipants: 8
      }
    });
    assert.equal(codCreate.status, 201);
    const codId = codCreate.json.tournament.id;
    for (let i = 1; i <= 3; i++) {
      const r = await api(srv.baseUrl, '/api/players/register', {
        method: 'POST',
        body: { tournamentId: codId, name: `COD_${i}`, elysiumNetId: `COD-ID-${i}` }
      });
      await api(srv.baseUrl, `/api/players/${r.json.player.id}/status`, {
        method: 'PATCH',
        token: freshToken,
        body: { status: 'APPROVED' }
      });
    }
    const codDraw = await api(srv.baseUrl, `/api/tournaments/${codId}/draw`, {
      method: 'POST',
      token: freshToken,
      body: {}
    });
    assert.equal(codDraw.status, 200);
    const codState = await api(srv.baseUrl, `/api/state?tournamentId=${codId}`);
    assert.equal(codState.json.leagueStandings.length, 3);
    assert.equal(codState.json.leagueMatches.length, 3);
    const codKo = await api(srv.baseUrl, `/api/tournaments/${codId}/knockout-from-standings`, {
      method: 'POST',
      token: freshToken
    });
    assert.equal(codKo.status, 200);

    // 11. Test DELETE TOURNAMENT genuinely deletes and never auto-recreates default when last tournament is removed
    const beforeDelState = await api(srv.baseUrl, '/api/state');
    const allIds = beforeDelState.json.tournaments.map((item) => item.id);
    assert.ok(allIds.length >= 3);
    for (const delId of allIds) {
      const delRes = await api(srv.baseUrl, `/api/tournaments/${delId}`, {
        method: 'DELETE',
        token: freshToken
      });
      assert.equal(delRes.status, 200);
    }
    const afterDelAll = await api(srv.baseUrl, '/api/state');
    assert.equal(afterDelAll.json.tournaments.length, 0);
    assert.equal(afterDelAll.json.tournament, null);

    // Restart server and confirm 0 tournaments stay deleted (not resurrected)
    // Also confirm CP4_HEAD_ADMIN_PIN env var does NOT overwrite an existing Head Admin's updated PIN
    await srv.close();
    const prevEnvPin = process.env.CP4_HEAD_ADMIN_PIN;
    process.env.CP4_HEAD_ADMIN_PIN = '111222';
    try {
      srv = await startServer({ dbPath, uploadsDir });
    } finally {
      if (prevEnvPin === undefined) delete process.env.CP4_HEAD_ADMIN_PIN;
      else process.env.CP4_HEAD_ADMIN_PIN = prevEnvPin;
    }
    const afterRestart = await api(srv.baseUrl, '/api/state', { token: freshToken });
    assert.equal(afterRestart.json.tournaments.length, 0);
    assert.equal(afterRestart.json.tournament, null);
    assert.equal(afterRestart.json.currentAdmin?.username, 'Djilali');

    const preservedPinLogin = await api(srv.baseUrl, '/api/admin/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '10.10.10.108' },
      body: { username: 'Djilali', pin: '739152' }
    });
    assert.equal(preservedPinLogin.status, 200);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Production dist bundle and PWA assets (iPhone Safari + Android Chrome) serve HTTP 200', async () => {
  const distDir = path.resolve(process.cwd(), 'dist');
  assert.ok(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html must exist after vite build');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-arena-pwa-'));
  const srv = await startServer({
    dbPath: path.join(tmpDir, 'pwa.db'),
    uploadsDir: path.join(tmpDir, 'uploads'),
    distDir
  });

  try {
    const home = await fetch(`${srv.baseUrl}/`);
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.ok(html.includes('dir="rtl"'));
    assert.ok(html.includes('viewport-fit=cover'));
    assert.ok(html.includes('apple-touch-icon'));
    assert.ok(html.includes('CP4 ARENA'));

    const manifestRes = await fetch(`${srv.baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    const manifestJson = await manifestRes.json();
    assert.equal(manifestJson.short_name, 'CP4 ARENA');
    assert.equal(manifestJson.dir, 'rtl');
    assert.ok(Array.isArray(manifestJson.icons) && manifestJson.icons.length >= 2);

    for (const assetPath of [
      '/sw.js',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/apple-touch-icon.png',
      '/images/community-logo.jpg',
      '/images/default-banner.jpg',
      '/api/health'
    ]) {
      const r = await fetch(`${srv.baseUrl}${assetPath}`);
      assert.equal(r.status, 200, `Expected 200 for ${assetPath}`);
    }
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
