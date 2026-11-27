import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createArenaApp } from '../server/app.js';

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

async function api(baseUrl, route, { method = 'GET', body, token, headers: extraHeaders = {} } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
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
  return { status: res.status, json, text, headers: res.headers };
}

async function loadCompiledTopHeader() {
  const tmpCompileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-topheader-compile-'));
  const filesToCompile = [
    { src: 'src/types.ts', out: 'types.mjs' },
    { src: 'src/components/PlayerAvatar.tsx', out: 'PlayerAvatar.mjs' },
    { src: 'src/components/TopHeader.tsx', out: 'TopHeader.mjs' }
  ];

  for (const item of filesToCompile) {
    const fullSrc = path.resolve(process.cwd(), item.src);
    let source = fs.readFileSync(fullSrc, 'utf8');
    // Rewrite relative TypeScript imports to compiled .mjs siblings in tmpCompileDir
    source = source
      .replaceAll("from '../types'", "from './types.mjs'")
      .replaceAll("from './PlayerAvatar'", "from './PlayerAvatar.mjs'");

    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true
      }
    });
    fs.writeFileSync(path.join(tmpCompileDir, item.out), transpiled.outputText, 'utf8');
  }

  // Provide minimal node_modules symlink so compiled .mjs resolves react, react/jsx-runtime, and lucide-react
  const nodeModulesSrc = path.resolve(process.cwd(), 'node_modules');
  fs.symlinkSync(nodeModulesSrc, path.join(tmpCompileDir, 'node_modules'), 'dir');

  const topHeaderMod = await import(pathToFileURL(path.join(tmpCompileDir, 'TopHeader.mjs')).href);
  return {
    TopHeader: topHeaderMod.TopHeader,
    resolveHeaderViewState: topHeaderMod.resolveHeaderViewState,
    cleanup: () => fs.rmSync(tmpCompileDir, { recursive: true, force: true })
  };
}

const SAMPLE_TOURNAMENTS = [
  {
    id: 10,
    name: 'كأس النخبة CP4',
    gameTitle: 'FIFA 22',
    gameCategory: 'كرة قدم',
    scoreUnitLabel: 'هدف',
    description: 'بطولة رسمية',
    bannerUrl: null,
    startDateTime: '2026-12-01',
    maxParticipants: 16,
    format: 'DIRECT_KNOCKOUT',
    groupCount: 4,
    qualifiersPerGroup: 2,
    drawMode: 'RANDOM',
    knockoutTieRule: 'SINGLE_MATCH_PENALTIES',
    matchDurationMinutes: 12,
    targetGoalsRule: '',
    isRegistrationClosedManual: false,
    playMode: 'SOLO_1V1',
    teamSize: 1,
    bestOf: 1,
    racingPointsConfig: [25, 18, 15],
    status: 'REGISTRATION_OPEN',
    championPlayerId: null,
    createdAt: 1700000000000
  }
];

const SAMPLE_DISCORD_PROFILE = {
  id: 24,
  cp4Id: 'CP4-000024',
  name: 'djilali',
  avatarUrl: 'https://cdn.discordapp.com/avatars/123456789012345678/abc.png',
  elysiumNetId: 'ELY_DJILALI',
  xeMoNetId: 'XEMO_DJILALI',
  discordUserId: '123456789012345678',
  createdAt: 1700000000000
};

const SAMPLE_ADMIN = {
  id: 1,
  username: 'HeadAdmin',
  displayName: 'المدير العام',
  role: 'HEAD_ADMIN',
  isActive: true,
  canManageTournament: true,
  canManagePlayers: true,
  canRunDraw: true,
  canEditScores: true,
  canCrownChampion: true,
  lastLoginAt: 1700000000000,
  createdAt: 1700000000000
};

function baseProps(overrides = {}) {
  return {
    currentAdmin: null,
    discordProfile: null,
    tournaments: SAMPLE_TOURNAMENTS,
    activeTournamentId: 10,
    activeTab: 'HOME',
    onSelectTournament: () => {},
    onNavigateTab: () => {},
    onOpenAdmin: () => {},
    onLogoutAdmin: () => {},
    onOpenExportShare: () => {},
    onOpenInstallPwa: () => {},
    onStartDiscordLogin: () => {},
    onLogoutDiscord: () => {},
    onOpenMyProfile: () => {},
    onOpenAccountSettings: () => {},
    canShowInstall: true,
    ...overrides
  };
}

test('TopHeader Cases 1-2: Unlinked Guest renders brand, welcome line, Discord Connect CTA, Guest Menu, and hides CP4 ID / Admin / Logout', async () => {
  const { TopHeader, resolveHeaderViewState, cleanup } = await loadCompiledTopHeader();
  try {
    const view = resolveHeaderViewState({ currentAdmin: null, discordProfile: null });
    assert.equal(view.mode, 'GUEST');
    assert.equal(view.showAdminButton, false);
    assert.equal(view.showGuestWelcome, true);
    assert.equal(view.showDiscordConnectCta, true);

    const htmlClosed = renderToStaticMarkup(React.createElement(TopHeader, baseProps()));
    assert.ok(htmlClosed.includes('CP4 ARENA'));
    assert.ok(htmlClosed.includes('COMMUNITY PS4 &amp; GAMING ONLINE'));
    assert.ok(htmlClosed.includes('data-header-mode="GUEST"'));
    assert.ok(htmlClosed.includes('data-testid="header_guest_welcome"'));
    assert.ok(htmlClosed.includes('ربط حساب Discord'));
    assert.ok(htmlClosed.includes('data-testid="header_discord_login_btn"'));
    assert.ok(htmlClosed.includes('data-testid="header_main_menu_btn"'));

    // Strictly forbidden for unlinked visitors
    assert.equal(htmlClosed.includes('CP4-'), false);
    assert.equal(htmlClosed.includes('data-testid="header_admin_btn"'), false);
    assert.equal(htmlClosed.includes('تسجيل الخروج'), false);
    assert.equal(htmlClosed.includes('data-testid="header_account_trigger"'), false);

    // Guest main menu opened
    const htmlGuestMenu = renderToStaticMarkup(
      React.createElement(TopHeader, baseProps({ initialOpenMenu: 'GUEST' }))
    );
    assert.ok(htmlGuestMenu.includes('data-testid="header_main_menu"'));
    assert.ok(htmlGuestMenu.includes('data-testid="guest_menu_nav_home"'));
    assert.ok(htmlGuestMenu.includes('data-testid="guest_menu_nav_bracket"'));
    assert.ok(htmlGuestMenu.includes('data-testid="guest_menu_discord_connect"'));
    assert.equal(htmlGuestMenu.includes('data-testid="header_admin_btn"'), false);
    assert.equal(htmlGuestMenu.includes('تسجيل الخروج'), false);
  } finally {
    cleanup();
  }
});

test('TopHeader Cases 4-5-7: Linked Member renders Discord avatar, username, CP4 ID, Share button, Account dropdown (Profile, Settings, Logout) and NEVER shows Admin button', async () => {
  const { TopHeader, resolveHeaderViewState, cleanup } = await loadCompiledTopHeader();
  try {
    const view = resolveHeaderViewState({ currentAdmin: null, discordProfile: SAMPLE_DISCORD_PROFILE });
    assert.equal(view.mode, 'MEMBER');
    assert.equal(view.showAdminButton, false);
    assert.equal(view.hasDiscordMember, true);

    // Closed dropdown: logout & profile menu items are tucked inside dropdown, not permanently rendered in bar
    const htmlClosed = renderToStaticMarkup(
      React.createElement(TopHeader, baseProps({ discordProfile: SAMPLE_DISCORD_PROFILE }))
    );
    assert.ok(htmlClosed.includes('data-header-mode="MEMBER"'));
    assert.ok(htmlClosed.includes(SAMPLE_DISCORD_PROFILE.avatarUrl));
    assert.ok(htmlClosed.includes('djilali'));
    assert.ok(htmlClosed.includes('CP4-000024'));
    assert.ok(htmlClosed.includes('data-testid="header_share_btn"'));
    assert.ok(htmlClosed.includes('data-testid="header_account_trigger"'));
    assert.equal(htmlClosed.includes('data-testid="header_account_menu"'), false);
    assert.equal(htmlClosed.includes('data-testid="account_menu_logout"'), false);
    assert.equal(htmlClosed.includes('data-testid="header_admin_btn"'), false);

    // Opened dropdown: contains 1. الملف الشخصي 2. الإعدادات 3. تسجيل الخروج
    const htmlOpen = renderToStaticMarkup(
      React.createElement(
        TopHeader,
        baseProps({ discordProfile: SAMPLE_DISCORD_PROFILE, initialOpenMenu: 'ACCOUNT' })
      )
    );
    assert.ok(htmlOpen.includes('data-testid="header_account_menu"'));
    assert.ok(htmlOpen.includes('data-testid="account_menu_profile"'));
    assert.ok(htmlOpen.includes('الملف الشخصي'));
    assert.ok(htmlOpen.includes('data-testid="account_menu_settings"'));
    assert.ok(htmlOpen.includes('الإعدادات'));
    assert.ok(htmlOpen.includes('data-testid="account_menu_logout"'));
    assert.ok(htmlOpen.includes('تسجيل الخروج'));
    assert.equal(htmlOpen.includes('data-testid="header_admin_btn"'), false);
  } finally {
    cleanup();
  }
});

test('TopHeader Cases 6-7: Admin button appears ONLY for active admins with permissions and preserves Member layout', async () => {
  const { TopHeader, resolveHeaderViewState, cleanup } = await loadCompiledTopHeader();
  try {
    // Head Admin + Discord Member -> same Member design + Admin button
    const htmlHeadWithDiscord = renderToStaticMarkup(
      React.createElement(
        TopHeader,
        baseProps({ currentAdmin: SAMPLE_ADMIN, discordProfile: SAMPLE_DISCORD_PROFILE })
      )
    );
    assert.ok(htmlHeadWithDiscord.includes('data-header-mode="ADMIN"'));
    assert.ok(htmlHeadWithDiscord.includes('data-testid="header_admin_btn"'));
    assert.ok(htmlHeadWithDiscord.includes('الإدارة'));
    assert.ok(htmlHeadWithDiscord.includes('CP4-000024'));
    assert.ok(htmlHeadWithDiscord.includes('data-testid="header_share_btn"'));

    // Active Sub-Admin with score edit permission -> Admin button visible
    const activeSubAdmin = {
      ...SAMPLE_ADMIN,
      id: 2,
      role: 'SUB_ADMIN',
      displayName: 'منسق النتائج',
      canManageTournament: false,
      canManagePlayers: false,
      canRunDraw: false,
      canEditScores: true,
      canCrownChampion: false
    };
    const subView = resolveHeaderViewState({
      currentAdmin: activeSubAdmin,
      discordProfile: SAMPLE_DISCORD_PROFILE
    });
    assert.equal(subView.showAdminButton, true);

    // Inactive Sub-Admin OR zero-permission Sub-Admin -> Admin button hidden!
    const inactiveAdmin = { ...activeSubAdmin, isActive: false };
    const zeroPermAdmin = { ...activeSubAdmin, canEditScores: false };
    assert.equal(
      resolveHeaderViewState({ currentAdmin: inactiveAdmin, discordProfile: SAMPLE_DISCORD_PROFILE }).showAdminButton,
      false
    );
    assert.equal(
      resolveHeaderViewState({ currentAdmin: zeroPermAdmin, discordProfile: SAMPLE_DISCORD_PROFILE }).showAdminButton,
      false
    );
    const htmlZeroPerm = renderToStaticMarkup(
      React.createElement(
        TopHeader,
        baseProps({ currentAdmin: zeroPermAdmin, discordProfile: SAMPLE_DISCORD_PROFILE })
      )
    );
    assert.equal(htmlZeroPerm.includes('data-testid="header_admin_btn"'), false);
  } finally {
    cleanup();
  }
});

test('TopHeader Cases 3 & 8 (API Integration): Guest -> Discord OAuth link (no duplicate) -> Member state & Settings PATCH -> Logout back to Guest', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp4-header-oauth-'));
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
      if (code !== 'valid_header_code') throw new Error('INVALID_CODE');
      return {
        discordUserId: '777888999000111222',
        username: 'arena_hero',
        displayName: 'بطل الساحة',
        avatarUrl: 'https://cdn.discordapp.com/avatars/777888999000111222/hero.png'
      };
    },
    fetchGuildMembers: async () => []
  };

  const srv = await startServer({ dbPath, uploadsDir, discordAdapter: mockDiscordAdapter });
  try {
    // 1. Visitor state: currentDiscordProfile is null, currentAdmin is null (visitor can browse freely)
    const guestState = await api(srv.baseUrl, '/api/state');
    assert.equal(guestState.status, 200);
    assert.equal(guestState.json.currentDiscordProfile, null);
    assert.equal(guestState.json.currentAdmin, null);

    // 2-3. Connect Discord OAuth
    const startRes = await api(srv.baseUrl, '/api/discord/oauth/start?format=json&returnTo=%2F');
    assert.equal(startRes.status, 200);
    const oauthState = new URL(startRes.json.url).searchParams.get('state');
    const cbRes = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=valid_header_code&state=${encodeURIComponent(oauthState)}`
    );
    assert.equal(cbRes.status, 200);
    const setCookie = cbRes.headers.get('set-cookie') || '';
    const match = setCookie.match(/cp4_discord_session=([^;]+)/);
    assert.ok(match);
    const cookieHeader = `cp4_discord_session=${match[1]}`;

    // Re-running OAuth with same Discord ID resolves same CP4 ID (no duplicate!)
    const startRes2 = await api(srv.baseUrl, '/api/discord/oauth/start?format=json&returnTo=%2F');
    const oauthState2 = new URL(startRes2.json.url).searchParams.get('state');
    const cbRes2 = await api(
      srv.baseUrl,
      `/api/discord/oauth/callback?code=valid_header_code&state=${encodeURIComponent(oauthState2)}`
    );
    assert.equal(cbRes2.status, 200);
    assert.ok(cbRes2.text.includes('CP4-000001'));

    // 4-5. Member state has Discord profile & can save Settings (ElysiumNet / XeMoNet) while CP4 ID remains immutable
    const memberState = await api(srv.baseUrl, '/api/state', { headers: { Cookie: cookieHeader } });
    assert.equal(memberState.json.currentDiscordProfile?.cp4Id, 'CP4-000001');
    assert.equal(memberState.json.currentDiscordProfile?.name, 'بطل الساحة');
    assert.equal(memberState.json.currentAdmin, null);

    const patchFailGuest = await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      body: { elysiumNetId: 'UNAUTH' }
    });
    assert.equal(patchFailGuest.status, 401);

    const patchBadCp4 = await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      headers: { Cookie: cookieHeader },
      body: { cp4Id: 'CP4-999999', elysiumNetId: 'ELY_HERO' }
    });
    assert.equal(patchBadCp4.status, 400);
    assert.equal(patchBadCp4.json.code, 'CP4_ID_IMMUTABLE');

    const patchOk = await api(srv.baseUrl, '/api/discord/session/profile', {
      method: 'PATCH',
      headers: { Cookie: cookieHeader },
      body: { elysiumNetId: 'ELY_HERO', xeMoNetId: 'XEMO_HERO' }
    });
    assert.equal(patchOk.status, 200);
    assert.equal(patchOk.json.profile.cp4Id, 'CP4-000001');
    assert.equal(patchOk.json.profile.elysiumNetId, 'ELY_HERO');
    assert.equal(patchOk.json.profile.xeMoNetId, 'XEMO_HERO');

    // 8. Logout Discord returns cleanly to Guest state
    const logoutRes = await api(srv.baseUrl, '/api/discord/session/logout', {
      method: 'POST',
      headers: { Cookie: cookieHeader }
    });
    assert.equal(logoutRes.status, 200);
    assert.ok((logoutRes.headers.get('set-cookie') || '').includes('Max-Age=0'));

    const postLogoutState = await api(srv.baseUrl, '/api/state');
    assert.equal(postLogoutState.json.currentDiscordProfile, null);
    assert.equal(postLogoutState.json.currentAdmin, null);
  } finally {
    await srv.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('TopHeader Cases 9-11: Mobile/Desktop responsive CSS, non-overlapping tournament ribbon, compact scroll, and dropdown viewport bounds', async () => {
  const { TopHeader, cleanup } = await loadCompiledTopHeader();
  try {
    // Tournament switcher bar renders cleanly inside header separately from top-header-inner
    const html = renderToStaticMarkup(
      React.createElement(TopHeader, baseProps({ discordProfile: SAMPLE_DISCORD_PROFILE }))
    );
    const innerIdx = html.indexOf('top-header-inner');
    const ribbonIdx = html.indexOf('tournament-ribbon');
    assert.ok(innerIdx > 0 && ribbonIdx > innerIdx, 'Tournament ribbon must follow top-header-inner in normal flow');

    // Verify TopHeader source enforces outside click (pointerdown), Escape key, and viewport clamping
    const topHeaderSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TopHeader.tsx'), 'utf8');
    assert.ok(topHeaderSrc.includes("addEventListener('pointerdown'"));
    assert.ok(topHeaderSrc.includes("event.key === 'Escape'"));
    assert.ok(topHeaderSrc.includes('clampToViewport'));

    // Verify built production CSS has responsive mobile-first & desktop single-row header rules + dropdown containment
    const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
    const cssFiles = fs.readdirSync(distAssetsDir).filter((f) => f.endsWith('.css'));
    assert.ok(cssFiles.length >= 1, 'Expected production CSS bundle in dist/assets');
    const css = fs.readFileSync(path.join(distAssetsDir, cssFiles[0]), 'utf8');
    assert.ok(css.includes('.top-header.is-scrolled'));
    assert.ok(css.includes('.header-discord-cta'));
    assert.ok(css.includes('.header-account-trigger'));
    assert.ok(css.includes('.header-cp4-badge'));
    assert.ok(css.includes('.header-dropdown-menu'));
    assert.ok(css.includes('100vw - 24px'));
    assert.ok(css.includes('min-width:640px') || css.includes('min-width: 640px'));
  } finally {
    cleanup();
  }
});
