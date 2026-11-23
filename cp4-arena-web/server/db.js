import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AdminRole,
  DrawMode,
  KnockoutTieRule,
  TournamentFormat,
  TournamentStatus
} from './constants.js';
import {
  computePermissionsHash,
  generateSalt,
  hashPin,
  isValidPinFormat,
  resolveEnvJwtSecret
} from './security.js';

export function openDatabase(customPath) {
  const resolvedPath =
    customPath ||
    (process.env.CP4_DB_PATH && process.env.CP4_DB_PATH.trim()) ||
    path.resolve(process.cwd(), 'data', 'cp4_arena.db');

  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      game_title TEXT NOT NULL DEFAULT 'FIFA 22',
      game_category TEXT NOT NULL DEFAULT 'كرة قدم',
      score_unit_label TEXT NOT NULL DEFAULT 'هدف',
      description TEXT NOT NULL,
      banner_url TEXT,
      start_date_time TEXT NOT NULL,
      max_participants INTEGER NOT NULL DEFAULT 16,
      format TEXT NOT NULL DEFAULT '${TournamentFormat.GROUPS_KNOCKOUT}',
      group_count INTEGER NOT NULL DEFAULT 4,
      qualifiers_per_group INTEGER NOT NULL DEFAULT 2,
      draw_mode TEXT NOT NULL DEFAULT '${DrawMode.RANDOM}',
      knockout_tie_rule TEXT NOT NULL DEFAULT '${KnockoutTieRule.SINGLE_MATCH_PENALTIES}',
      match_duration_minutes INTEGER NOT NULL DEFAULT 12,
      target_goals_rule TEXT NOT NULL DEFAULT 'المباراة الكاملة (6 دقائق لكل شوط)',
      is_registration_closed_manual INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '${TournamentStatus.REGISTRATION_OPEN}',
      champion_player_id INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tournament_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      elysium_net_id TEXT NOT NULL,
      avatar_url TEXT,
      level TEXT NOT NULL DEFAULT 'INTERMEDIATE',
      ovr_rating INTEGER NOT NULL DEFAULT 81,
      club_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'PENDING',
      group_id INTEGER,
      seed_order INTEGER NOT NULL DEFAULT 0,
      registered_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_players_elysium_unique
      ON players(tournament_id, LOWER(elysium_net_id));

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS match_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
      match_title TEXT NOT NULL,
      match_stage_label TEXT NOT NULL,
      scheduled_at_millis INTEGER NOT NULL,
      remind_at_millis INTEGER NOT NULL,
      lead_minutes INTEGER NOT NULL DEFAULT 15,
      is_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
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

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL REFERENCES admin_accounts(id) ON DELETE CASCADE,
      keep_signed_in INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revoked_admins (
      username TEXT PRIMARY KEY COLLATE NOCASE,
      revoked_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_lockout (
      client_key TEXT PRIMARY KEY,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until_millis INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      admin_username TEXT NOT NULL,
      admin_display_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      summary_ar TEXT NOT NULL,
      tournament_id INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_predictions (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      voter_key TEXT NOT NULL,
      picked_slot INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (match_id, voter_key)
    );
  `);

  ensureSchemaMigrations(db);
  ensureSeedData(db);
  return db;
}

function ensureColumn(db, tableName, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

function ensureSchemaMigrations(db) {
  ensureColumn(db, 'tournaments', 'is_third_place_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'matches', 'p1_checked_in', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'matches', 'p2_checked_in', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'matches', 'is_walkover', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'matches', 'walkover_reason', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'matches', 'dispute_note', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'matches', 'dispute_screenshot_url', 'TEXT');
  ensureColumn(db, 'matches', 'dispute_submitted_by', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'matches', 'dispute_status', "TEXT NOT NULL DEFAULT 'NONE'");
  ensureColumn(db, 'matches', 'votes_p1', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'matches', 'votes_p2', 'INTEGER NOT NULL DEFAULT 0');
}

function ensureSeedData(db) {
  const existingTournamentCount = db.prepare('SELECT COUNT(*) AS c FROM tournaments').get().c;
  const seededRow = db.prepare("SELECT value FROM app_meta WHERE key = 'initial_tournament_seeded'").get();
  if (existingTournamentCount === 0 && !seededRow) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO tournaments (
        name, game_title, game_category, score_unit_label, description,
        banner_url, start_date_time, max_participants, format, group_count,
        qualifiers_per_group, draw_mode, knockout_tie_rule, match_duration_minutes,
        target_goals_rule, is_registration_closed_manual, status, champion_player_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'بطولة CP4 ARENA الرسمية — COMMUNITY PS4 ONLINE',
      'FIFA 22',
      'كرة قدم',
      'هدف',
      'المنصة الرسمية لبطولات مجتمع Discord عبر شبكة ElysiumNet. تدعم جميع الألعاب ونظام المجموعات والإقصائيات المباشرة.',
      null,
      'يُحدد من لوحة الإدارة',
      16,
      TournamentFormat.GROUPS_KNOCKOUT,
      4,
      2,
      DrawMode.RANDOM,
      KnockoutTieRule.SINGLE_MATCH_PENALTIES,
      12,
      'المباراة الكاملة (6 دقائق لكل شوط)',
      0,
      TournamentStatus.REGISTRATION_OPEN,
      null,
      now
    );
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_tournament_seeded', '1')").run();
  } else if (existingTournamentCount > 0 && !seededRow) {
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_tournament_seeded', '1')").run();
  }

  // Resolve stateless JWT secret from JWT_SECRET / CP4_SESSION_SECRET / ADMIN_PASSWORD,
  // or persist a deterministic secret in SQLite app_meta if none is set in env
  const envSecret = resolveEnvJwtSecret();
  if (envSecret) {
    db.sessionSecret = envSecret;
  } else {
    const metaSecretRow = db.prepare("SELECT value FROM app_meta WHERE key = 'server_session_secret'").get();
    if (metaSecretRow?.value && metaSecretRow.value.length >= 16) {
      db.sessionSecret = metaSecretRow.value;
    } else {
      const generatedSecret = crypto.randomBytes(32).toString('hex');
      db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('server_session_secret', ?)").run(generatedSecret);
      db.sessionSecret = generatedSecret;
    }
  }

  // Optional env-configured Head Admin seeding ONLY when no Head Admin exists yet (never overwrite existing PIN changes)
  const rawHeadPin = process.env.CP4_HEAD_ADMIN_PIN?.trim();
  const rawAdminPassPin = process.env.ADMIN_PASSWORD?.trim();
  const envPin = isValidPinFormat(rawHeadPin)
    ? rawHeadPin
    : isValidPinFormat(rawAdminPassPin)
      ? rawAdminPassPin
      : '';
  const envUsername = (process.env.CP4_HEAD_ADMIN_USERNAME || 'Djilali').trim();
  if (envPin) {
    const existingHead = db
      .prepare('SELECT id, username FROM admin_accounts WHERE role = ? LIMIT 1')
      .get(AdminRole.HEAD_ADMIN);
    if (!existingHead) {
      const now = Date.now();
      const salt = generateSalt();
      const pHash = hashPin(envPin, salt);
      const permHash = computePermissionsHash({
        username: envUsername,
        role: AdminRole.HEAD_ADMIN,
        canManageTournament: true,
        canManagePlayers: true,
        canRunDraw: true,
        canEditScores: true,
        canCrownChampion: true,
        pinSalt: salt,
        pinHash: pHash
      });
      db.prepare(`
        INSERT INTO admin_accounts (
          username, display_name, role, pin_hash, pin_salt,
          can_manage_tournament, can_manage_players, can_run_draw,
          can_edit_scores, can_crown_champion, permissions_hash,
          pin_updated_at, is_active, last_login_at, created_at
        ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, 1, 1, ?, 0, 1, NULL, ?)
      `).run(envUsername, envUsername, AdminRole.HEAD_ADMIN, pHash, salt, permHash, now);
    }
  }
}
