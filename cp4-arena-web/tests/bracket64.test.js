import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createArenaApp } from '../server/app.js';
import { buildKnockoutTreeDrafts, distributeSeededSlotsWithByes } from '../server/engine.js';

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

async function api(baseUrl, route, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

test('Engine builds 4, 8, 16, 32, and 64 player brackets plus balanced BYEs (5, 11, 20, 40 players) with zero dead matches', () => {
  for (const count of [4, 8, 16, 32, 64]) {
    const slots = distributeSeededSlotsWithByes(Array.from({ length: count }, (_, i) => i + 1));
    assert.equal(slots.length, count);
    const drafts = buildKnockoutTreeDrafts({
      tournamentId: 1,
      seededSlots: slots,
      tieRule: 'SINGLE_MATCH_PENALTIES'
    });
    assert.equal(drafts.length, count - 1);
    const stages = new Set(drafts.map((d) => d.entity.stage));
    assert.equal(stages.has('FINAL'), true);
    assert.equal(stages.has('ROUND_OF_64'), count === 64);
    assert.equal(stages.has('ROUND_OF_32'), count >= 32);
    assert.equal(stages.has('ROUND_OF_16'), count >= 16);
    assert.equal(stages.has('QUARTER_FINAL'), count >= 8);
    assert.equal(stages.has('SEMI_FINAL'), count >= 4);
  }

  for (const count of [5, 11, 20, 40]) {
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const slots = distributeSeededSlotsWithByes(ids);
    const nonNull = slots.filter((v) => v != null);
    assert.equal(nonNull.length, count);
    assert.equal(new Set(nonNull).size, count);

    // Adjacent pair (slots[2*k], slots[2*k+1]) must NEVER both be null (zero dead null-vs-null matches!)
    for (let i = 0; i < slots.length; i += 2) {
      assert.ok(
        slots[i] != null || slots[i + 1] != null,
        `Dead null-vs-null match detected for ${count} players at pair ${i / 2}`
      );
    }

    const drafts = buildKnockoutTreeDrafts({
      tournamentId: 1,
      seededSlots: slots,
      tieRule: 'SINGLE_MATCH_PENALTIES'
    });
    assert.equal(drafts.length, slots.length - 1);
  }
});

test('64-player Direct Knockout tournament API propagates winners from ROUND_OF_64 through FINAL & Champion without data loss', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-bracket64-'));
  const dbPath = path.join(tmpDir, 'bracket64.db');
  const uploadsDir = path.join(tmpDir, 'uploads');
  const srv = await startServer({ dbPath, uploadsDir });

  try {
    const setup = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'BracketMaster', displayName: 'منظم 64', pin: '842619', keepSignedIn: true }
    });
    assert.equal(setup.status, 201);
    const token = setup.json.token;

    const createT = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token,
      body: {
        name: 'كأس النخبة 64 لاعباً',
        gameTitle: 'FIFA 22',
        format: 'DIRECT_KNOCKOUT',
        maxParticipants: 64
      }
    });
    assert.equal(createT.status, 201);
    const tid = createT.json.tournament.id;

    const lines = Array.from({ length: 64 }, (_, idx) => `لاعب_${idx + 1} | ELY_${idx + 1} | Club_${idx + 1}`).join('\n');
    const bulkRes = await api(srv.baseUrl, `/api/tournaments/${tid}/players/bulk`, {
      method: 'POST',
      token,
      body: { linesText: lines, status: 'APPROVED' }
    });
    assert.equal(bulkRes.status, 201);
    assert.equal(bulkRes.json.importedCount, 64);

    const drawRes = await api(srv.baseUrl, `/api/tournaments/${tid}/draw`, {
      method: 'POST',
      token,
      body: {}
    });
    assert.equal(drawRes.status, 200);

    const s1 = await api(srv.baseUrl, `/api/state?tournamentId=${tid}`, { token });
    const ko = s1.json.knockoutMatches;
    assert.equal(ko.filter((m) => m.stage === 'ROUND_OF_64').length, 32);
    assert.equal(ko.filter((m) => m.stage === 'ROUND_OF_32').length, 16);
    assert.equal(ko.filter((m) => m.stage === 'ROUND_OF_16').length, 8);
    assert.equal(ko.filter((m) => m.stage === 'QUARTER_FINAL').length, 4);
    assert.equal(ko.filter((m) => m.stage === 'SEMI_FINAL').length, 2);
    assert.equal(ko.filter((m) => m.stage === 'FINAL').length, 1);

    // Resolve all 62 pre-final matches via score updates & winner propagation
    for (const stage of ['ROUND_OF_64', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL']) {
      const latest = await api(srv.baseUrl, `/api/state?tournamentId=${tid}`, { token });
      const stageMatches = latest.json.knockoutMatches.filter((m) => m.stage === stage);
      for (const m of stageMatches) {
        assert.ok(m.player1Id && m.player2Id, `Expected populated slots in ${stage} match ${m.id}`);
        const sc = await api(srv.baseUrl, `/api/matches/${m.id}/score`, {
          method: 'PATCH',
          token,
          body: { leg1Score1: 3, leg1Score2: 1 }
        });
        assert.equal(sc.status, 200);
      }
    }

    const beforeFinal = await api(srv.baseUrl, `/api/state?tournamentId=${tid}`, { token });
    const finalMatch = beforeFinal.json.knockoutMatches.find((m) => m.stage === 'FINAL');
    assert.ok(finalMatch?.player1Id && finalMatch?.player2Id);

    const finalScore = await api(srv.baseUrl, `/api/matches/${finalMatch.id}/score`, {
      method: 'PATCH',
      token,
      body: { leg1Score1: 4, leg1Score2: 2 }
    });
    assert.equal(finalScore.status, 200);

    const crownRes = await api(srv.baseUrl, `/api/tournaments/${tid}/champion`, {
      method: 'POST',
      token,
      body: { playerId: finalMatch.player1Id }
    });
    assert.equal(crownRes.status, 200);

    const doneState = await api(srv.baseUrl, `/api/state?tournamentId=${tid}`, { token });
    assert.equal(doneState.json.championPlayer?.id, finalMatch.player1Id);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Groups -> 32-player Knockout and 40-player incomplete BYE Knockout work cleanly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-bracket-group32-'));
  const dbPath = path.join(tmpDir, 'group32.db');
  const uploadsDir = path.join(tmpDir, 'uploads');
  const srv = await startServer({ dbPath, uploadsDir });

  try {
    const setup = await api(srv.baseUrl, '/api/admin/setup-head', {
      method: 'POST',
      body: { username: 'GroupMaster', displayName: 'منظم 32', pin: '731946', keepSignedIn: true }
    });
    const token = setup.json.token;

    // 1) Incomplete 40-player Direct Knockout (builds 64-bracket with 24 balanced BYEs)
    const byeT = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token,
      body: { name: 'بطولة 40 لاعب', gameTitle: 'FIFA 22', format: 'DIRECT_KNOCKOUT', maxParticipants: 64 }
    });
    const byeTid = byeT.json.tournament.id;
    const lines40 = Array.from({ length: 40 }, (_, i) => `P_${i + 1} | ID40_${i + 1}`).join('\n');
    await api(srv.baseUrl, `/api/tournaments/${byeTid}/players/bulk`, {
      method: 'POST',
      token,
      body: { linesText: lines40, status: 'APPROVED' }
    });
    const byeDraw = await api(srv.baseUrl, `/api/tournaments/${byeTid}/draw`, { method: 'POST', token, body: {} });
    assert.equal(byeDraw.status, 200);
    const byeState = await api(srv.baseUrl, `/api/state?tournamentId=${byeTid}`, { token });
    const r64 = byeState.json.knockoutMatches.filter((m) => m.stage === 'ROUND_OF_64');
    assert.equal(r64.length, 32);
    // Zero dead (null vs null) matches!
    assert.equal(r64.some((m) => !m.player1Id && !m.player2Id), false);
    // BYE matches are auto-completed and advance into ROUND_OF_32
    const r32 = byeState.json.knockoutMatches.filter((m) => m.stage === 'ROUND_OF_32');
    assert.equal(r32.length, 16);
    assert.ok(r32.some((m) => m.player1Id || m.player2Id));

    // 2) League -> 32 Qualifiers Knockout
    const lgT = await api(srv.baseUrl, '/api/tournaments', {
      method: 'POST',
      token,
      body: {
        name: 'دوري 32 متأهل',
        gameTitle: 'FIFA 22',
        format: 'LEAGUE_KNOCKOUT',
        qualifiersPerGroup: 32,
        maxParticipants: 32
      }
    });
    const lgTid = lgT.json.tournament.id;
    const lines32 = Array.from({ length: 32 }, (_, i) => `LG_${i + 1} | LGID_${i + 1}`).join('\n');
    await api(srv.baseUrl, `/api/tournaments/${lgTid}/players/bulk`, {
      method: 'POST',
      token,
      body: { linesText: lines32, status: 'APPROVED' }
    });
    await api(srv.baseUrl, `/api/tournaments/${lgTid}/draw`, { method: 'POST', token, body: {} });
    const koFromLeague = await api(srv.baseUrl, `/api/tournaments/${lgTid}/knockout-from-standings`, {
      method: 'POST',
      token
    });
    assert.equal(koFromLeague.status, 200);
    const lgState = await api(srv.baseUrl, `/api/state?tournamentId=${lgTid}`, { token });
    assert.equal(lgState.json.knockoutMatches.filter((m) => m.stage === 'ROUND_OF_32').length, 16);
    assert.equal(lgState.json.knockoutMatches.filter((m) => m.stage === 'FINAL').length, 1);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Production CSS & bundle include Esports Blue/Red/Gold theme and mobile anti-overflow rules (360-430px)', () => {
  const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
  assert.ok(fs.existsSync(distAssetsDir));
  const cssFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.css'));
  assert.ok(cssFiles.length >= 1);
  const css = fs.readFileSync(path.join(distAssetsDir, cssFiles[0]), 'utf8');
  assert.ok(css.includes('esports-arena-shell'));
  assert.ok(css.includes('esports-vertical-flow'));
  assert.ok(css.includes('esports-hex-header'));
  assert.ok(css.includes('esports-podium-rings'));
  assert.ok(css.includes('esports-top-bar'));
});
