import {
  AdminRole,
  DEFAULT_RACING_POINTS,
  DrawMode,
  GAME_CATALOG,
  KnockoutTieRule,
  MATCH_STAGE_META,
  MatchStage,
  PLAYER_LEVEL_META,
  PLAYER_STATUS_META,
  PlayMode,
  PlayerLevel,
  PlayerStatus,
  RaceStage,
  TournamentFormat,
  TournamentStatus
} from './constants.js';
import {
  buildExportData,
  buildHallOfFame,
  buildKnockoutSeedPairsFromGroups,
  buildKnockoutTreeDrafts,
  computeRacingStandings,
  computeSeasonLeaderboard,
  computeStandings,
  computeTournamentStats,
  distributePlayersIntoGroups,
  distributeSeededSlotsWithByes,
  generateRoundRobinMatches,
  groupDisplayName,
  nextPowerOfTwo,
  parseRacingPointsConfig,
  resolveMatchResult,
  shuffleArray
} from './engine.js';
import {
  allocateNextCp4Id,
  backfillPlayerProfiles,
  syncCp4ProfileSequence
} from './db.js';
import {
  isValidDiscordUserId,
  normalizeDiscordUserId
} from './discord.js';
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  MAX_SUB_ADMINS,
  SESSION_TTL_EPHEMERAL_MS,
  SESSION_TTL_PERSISTENT_MS,
  computePermissionsHash,
  generateSalt,
  hasEnvJwtSecret,
  hashPin,
  hashSessionToken,
  hasPermission,
  isValidPinFormat,
  sanitizeAdminPublic,
  signAdminJwt,
  verifyAdminJwt,
  verifyPermissionsIntegrity,
  verifyPin
} from './security.js';

function mapTournament(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    gameTitle: row.game_title,
    gameCategory: row.game_category,
    scoreUnitLabel: row.score_unit_label,
    description: row.description,
    bannerUrl: row.banner_url ?? null,
    startDateTime: row.start_date_time,
    maxParticipants: row.max_participants,
    format: row.format,
    groupCount: row.group_count,
    qualifiersPerGroup: row.qualifiers_per_group,
    drawMode: row.draw_mode,
    knockoutTieRule: row.knockout_tie_rule,
    matchDurationMinutes: row.match_duration_minutes,
    targetGoalsRule: row.target_goals_rule,
    isRegistrationClosedManual: Boolean(row.is_registration_closed_manual),
    isThirdPlaceEnabled: row.is_third_place_enabled === undefined ? true : Boolean(row.is_third_place_enabled),
    playMode: row.play_mode || PlayMode.SOLO_1V1,
    teamSize: Math.max(1, Number(row.team_size) || 1),
    bestOf: [1, 3, 5].includes(Number(row.best_of)) ? Number(row.best_of) : 1,
    racingPointsConfig: parseRacingPointsConfig(row.racing_points_config),
    status: row.status,
    championPlayerId: row.champion_player_id ?? null,
    createdAt: row.created_at
  };
}

function mapRaceResult(row) {
  return {
    id: row.id,
    raceId: row.race_id,
    tournamentId: row.tournament_id,
    playerId: row.player_id,
    position: row.position,
    pointsAwarded: Number(row.points_awarded) || 0,
    bestLapOrTime: row.best_lap_or_time || '',
    dnf: Boolean(row.dnf)
  };
}

function mapRace(row, results = []) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    raceNumber: row.race_number,
    title: row.title,
    stage: row.stage || RaceStage.REGULAR,
    trackName: row.track_name || '',
    isCompleted: Boolean(row.is_completed),
    createdAt: row.created_at,
    results
  };
}

function resolveGamePreset(gameTitle) {
  const clean = String(gameTitle || '').trim().toLowerCase();
  return GAME_CATALOG.find((g) => g.id.toLowerCase() === clean) || null;
}

function resolveTournamentGameRules(payload, fallbackCurrent = null) {
  const gameTitle = String(payload.gameTitle ?? fallbackCurrent?.gameTitle ?? 'FIFA 22').trim() || 'FIFA 22';
  const preset = resolveGamePreset(gameTitle);

  let gameCategory = String(payload.gameCategory ?? fallbackCurrent?.gameCategory ?? preset?.categoryAr ?? 'ألعاب إلكترونية').trim() || 'ألعاب إلكترونية';
  let scoreUnitLabel = String(payload.scoreUnitLabel ?? fallbackCurrent?.scoreUnitLabel ?? preset?.scoreUnitLabel ?? 'هدف').trim() || 'هدف';
  let format = Object.values(TournamentFormat).includes(payload.format)
    ? payload.format
    : (fallbackCurrent?.format ?? preset?.defaultFormat ?? TournamentFormat.GROUPS_KNOCKOUT);
  let playMode = Object.values(PlayMode).includes(payload.playMode)
    ? payload.playMode
    : (fallbackCurrent?.playMode ?? preset?.defaultPlayMode ?? PlayMode.SOLO_1V1);
  let teamSize = Math.max(1, Math.min(11, Number(payload.teamSize ?? fallbackCurrent?.teamSize ?? preset?.defaultTeamSize ?? 1) || 1));
  let bestOfRaw = Number(payload.bestOf ?? fallbackCurrent?.bestOf ?? preset?.defaultBestOf ?? 1);
  let bestOf = [1, 3, 5].includes(bestOfRaw) ? bestOfRaw : 1;
  let racingPointsConfig = parseRacingPointsConfig(
    payload.racingPointsConfig ?? fallbackCurrent?.racingPointsConfig ?? DEFAULT_RACING_POINTS
  );

  if (preset) {
    gameCategory = String(payload.gameCategory ?? preset.categoryAr).trim() || preset.categoryAr;
    scoreUnitLabel = String(payload.scoreUnitLabel ?? preset.scoreUnitLabel).trim() || preset.scoreUnitLabel;
    if (!preset.supportedFormats.includes(format)) {
      format = preset.defaultFormat;
    }
    if (!preset.supportedPlayModes.includes(playMode)) {
      playMode = preset.defaultPlayMode;
    }
    if (preset.categoryType === 'RACING') {
      playMode = PlayMode.RACE_POINTS;
      teamSize = 1;
      bestOf = 1;
      scoreUnitLabel = 'نقطة';
    } else if (preset.categoryType === 'FIGHTING') {
      playMode = PlayMode.SOLO_1V1;
      teamSize = 1;
    } else if (!preset.supportsTeamSize || playMode !== PlayMode.TEAMS) {
      teamSize = 1;
    } else {
      teamSize = Math.max(2, Math.min(11, teamSize));
    }
    if (!preset.supportsBestOf) {
      bestOf = 1;
    }
  } else if (playMode !== PlayMode.TEAMS) {
    teamSize = 1;
  }

  return {
    gameTitle,
    gameCategory,
    scoreUnitLabel,
    format,
    playMode,
    teamSize,
    bestOf,
    racingPointsConfig
  };
}

function mapPlayer(row, { includeDiscordId = false } = {}) {
  const xemo =
    row.xemonet_id && String(row.xemonet_id).trim()
      ? String(row.xemonet_id).trim()
      : (row.profile_xemonet_id || '');
  const mapped = {
    id: row.id,
    tournamentId: row.tournament_id,
    profileId: row.profile_id ?? null,
    cp4Id: row.profile_cp4_id ?? row.cp4_id ?? null,
    name: row.name,
    elysiumNetId: row.elysium_net_id,
    xeMoNetId: xemo,
    avatarUrl: row.avatar_url ?? null,
    level: row.level,
    ovrRating: row.ovr_rating,
    clubName: row.club_name ?? '',
    status: row.status,
    groupId: row.group_id ?? null,
    seedOrder: row.seed_order ?? 0,
    registeredAt: row.registered_at
  };
  if (includeDiscordId) {
    mapped.discordUserId = row.profile_discord_user_id ?? row.discord_user_id ?? null;
  }
  return mapped;
}

function mapPlayerProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    cp4Id: row.cp4_id,
    name: row.name,
    avatarUrl: row.avatar_url ?? null,
    elysiumNetId: row.elysium_net_id || '',
    xeMoNetId: row.xemonet_id || '',
    discordUserId: row.discord_user_id ?? null,
    createdAt: row.created_at,
    tournamentsCount: Number(row.tournaments_count || 0)
  };
}

function mapGroup(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    displayOrder: row.display_order
  };
}

function mapMatch(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    stage: row.stage,
    groupId: row.group_id ?? null,
    roundNumber: row.round_number,
    bracketIndex: row.bracket_index,
    player1Id: row.player1_id ?? null,
    player2Id: row.player2_id ?? null,
    leg1Score1: row.leg1_score1 ?? null,
    leg1Score2: row.leg1_score2 ?? null,
    leg2Score1: row.leg2_score1 ?? null,
    leg2Score2: row.leg2_score2 ?? null,
    penaltyScore1: row.penalty_score1 ?? null,
    penaltyScore2: row.penalty_score2 ?? null,
    isTwoLegged: Boolean(row.is_two_legged),
    isCompleted: Boolean(row.is_completed),
    winnerId: row.winner_id ?? null,
    nextMatchId: row.next_match_id ?? null,
    nextMatchSlot: row.next_match_slot ?? 1,
    scheduledLabel: row.scheduled_label ?? '',
    scheduledAtMillis: row.scheduled_at_millis ?? null,
    p1CheckedIn: Boolean(row.p1_checked_in),
    p2CheckedIn: Boolean(row.p2_checked_in),
    votesP1: Number(row.votes_p1) || 0,
    votesP2: Number(row.votes_p2) || 0,
    isWalkover: Boolean(row.is_walkover),
    walkoverReason: row.walkover_reason ?? null,
    disputeStatus: row.dispute_status || 'NONE',
    disputeNote: row.dispute_note ?? null,
    disputeSubmittedBy: row.dispute_submitted_by ?? null,
    disputeScreenshotUrl: row.dispute_screenshot_url ?? null,
    disputeResolutionNote: row.dispute_resolution_note ?? null
  };
}

function mapAuditLog(row) {
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? null,
    actorUsername: row.actor_username,
    actorDisplayName: row.actor_display_name,
    actionType: row.action_type,
    summaryAr: row.summary_ar,
    createdAt: row.created_at
  };
}

function mapReminder(row) {
  return {
    id: row.id,
    matchId: row.match_id,
    tournamentId: row.tournament_id,
    matchTitle: row.match_title,
    matchStageLabel: row.match_stage_label,
    scheduledAtMillis: row.scheduled_at_millis,
    remindAtMillis: row.remind_at_millis,
    leadMinutes: row.lead_minutes,
    isEnabled: Boolean(row.is_enabled)
  };
}

function mapAdminRaw(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    pinHash: row.pin_hash,
    pinSalt: row.pin_salt,
    canManageTournament: Boolean(row.can_manage_tournament),
    canManagePlayers: Boolean(row.can_manage_players),
    canRunDraw: Boolean(row.can_run_draw),
    canEditScores: Boolean(row.can_edit_scores),
    canCrownChampion: Boolean(row.can_crown_champion),
    permissionsHash: row.permissions_hash,
    pinUpdatedAt: row.pin_updated_at,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at
  };
}

export class ArenaService {
  constructor(db, onEvent = () => {}) {
    this.db = db;
    this.onEvent = onEvent;
  }

  withTx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  emitChange(type = 'state_updated', payload = {}) {
    this.onEvent({ type, ts: Date.now(), ...payload });
  }

  logAudit(admin, tournamentId, actionType, summaryAr) {
    if (!admin) return;
    try {
      this.db
        .prepare(`
          INSERT INTO admin_audit_logs (
            tournament_id, actor_username, actor_display_name, action_type, summary_ar, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          tournamentId ?? null,
          String(admin.username || 'admin'),
          String(admin.displayName || admin.username || 'المشرف'),
          String(actionType || 'ACTION'),
          String(summaryAr || ''),
          Date.now()
        );
    } catch {
      // keep audit logging non-fatal
    }
  }

  getLockoutState(clientKey = 'default') {
    const row = this.db
      .prepare('SELECT failed_attempts, locked_until_millis FROM auth_lockout WHERE client_key = ?')
      .get(clientKey);
    if (!row) return { failedAttempts: 0, lockedUntilMillis: 0 };
    return {
      failedAttempts: row.failed_attempts,
      lockedUntilMillis: row.locked_until_millis
    };
  }

  recordFailedAttempt(clientKey, failedAttempts, lockedUntilMillis) {
    this.db
      .prepare(`
        INSERT INTO auth_lockout (client_key, failed_attempts, locked_until_millis)
        VALUES (?, ?, ?)
        ON CONFLICT(client_key) DO UPDATE SET
          failed_attempts = excluded.failed_attempts,
          locked_until_millis = excluded.locked_until_millis
      `)
      .run(clientKey, failedAttempts, lockedUntilMillis);
  }

  resetLockout(clientKey) {
    this.db.prepare('DELETE FROM auth_lockout WHERE client_key = ?').run(clientKey);
  }

  getAdminDirectory() {
    const rows = this.db
      .prepare('SELECT * FROM admin_accounts ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END, id ASC')
      .all(AdminRole.HEAD_ADMIN);
    return rows.map((r) => {
      const raw = mapAdminRaw(r);
      return {
        id: raw.id,
        username: raw.username,
        displayName: raw.displayName,
        role: raw.role,
        isActive: raw.isActive
      };
    });
  }

  listFullAdminsForHead() {
    const rows = this.db
      .prepare('SELECT * FROM admin_accounts ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END, id ASC')
      .all(AdminRole.HEAD_ADMIN);
    return rows.map((r) => sanitizeAdminPublic(mapAdminRaw(r)));
  }

  hasHeadAdmin() {
    const row = this.db
      .prepare('SELECT COUNT(*) AS c FROM admin_accounts WHERE role = ?')
      .get(AdminRole.HEAD_ADMIN);
    return row.c > 0;
  }

  verifySessionToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const secret = this.db?.sessionSecret;
    const tokenHash = hashSessionToken(rawToken, secret);
    const now = Date.now();

    const isRevokedToken = this.db
      .prepare('SELECT 1 FROM revoked_tokens WHERE token_hash = ? AND expires_at > ?')
      .get(tokenHash, now);
    if (isRevokedToken) return null;

    const jwtPayload = verifyAdminJwt(rawToken, secret);
    if (jwtPayload) {
      const jwtIatMs = Number(jwtPayload.iatMs || Number(jwtPayload.iat || 0) * 1000);
      const revokedAdmin = this.db
        .prepare('SELECT revoked_at FROM revoked_admins WHERE username = ? COLLATE NOCASE')
        .get(String(jwtPayload.username));
      if (revokedAdmin && Number(revokedAdmin.revoked_at) >= jwtIatMs) {
        return null;
      }

      let row = null;
      if (jwtPayload.sub != null) {
        const byId = this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(Number(jwtPayload.sub));
        if (byId) {
          const sameUser = byId.username.toLowerCase() === String(jwtPayload.username).toLowerCase();
          const sameAccountRenamed =
            Number(byId.created_at) === Number(jwtPayload.createdAt) &&
            byId.role === jwtPayload.role &&
            Boolean(
              this.db
                .prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND admin_id = ? AND expires_at > ?')
                .get(tokenHash, byId.id, now)
            );
          if (sameUser || sameAccountRenamed) {
            row = byId;
          }
        }
      }
      if (!row) {
        row = this.db
          .prepare('SELECT * FROM admin_accounts WHERE username = ? COLLATE NOCASE')
          .get(String(jwtPayload.username));
      }

      if (row) {
        const admin = mapAdminRaw(row);
        if (!admin.isActive || !verifyPermissionsIntegrity(admin)) {
          this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
          return null;
        }
        if (Number(admin.pinUpdatedAt || 0) > Number(jwtPayload.pinVer || 0)) {
          const whitelisted = this.db
            .prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
            .get(tokenHash, now);
          if (!whitelisted) return null;
        }
        return {
          admin: sanitizeAdminPublic(admin),
          rawAdmin: admin,
          keepSignedIn: Boolean(jwtPayload.keepSignedIn),
          isStatelessJwt: false
        };
      }

      // Stateless JWT fallback when DB was reset (e.g. Render ephemeral storage after server restart)
      // Requires an explicit persistent secret env var (JWT_SECRET / ADMIN_PASSWORD / CP4_SESSION_SECRET / CP4_HEAD_ADMIN_PIN).
      if (!hasEnvJwtSecret()) {
        return null;
      }

      const isHead = jwtPayload.role === AdminRole.HEAD_ADMIN;
      const role = isHead ? AdminRole.HEAD_ADMIN : AdminRole.SUB_ADMIN;
      const canManageTournament = isHead || Boolean(jwtPayload.canManageTournament);
      const canManagePlayers = isHead || Boolean(jwtPayload.canManagePlayers);
      const canRunDraw = isHead || Boolean(jwtPayload.canRunDraw);
      const canEditScores = isHead || Boolean(jwtPayload.canEditScores);
      const canCrownChampion = isHead || Boolean(jwtPayload.canCrownChampion);
      const salt = 'stateless_jwt_v1';
      const pHash = 'stateless_jwt_pin';
      const permHash = computePermissionsHash({
        username: jwtPayload.username,
        role,
        canManageTournament,
        canManagePlayers,
        canRunDraw,
        canEditScores,
        canCrownChampion,
        pinSalt: salt,
        pinHash: pHash
      });
      const syntheticAdmin = {
        id: Number(jwtPayload.sub) || (isHead ? 1 : 2),
        username: String(jwtPayload.username),
        displayName: String(jwtPayload.displayName || jwtPayload.username),
        role,
        pinHash: pHash,
        pinSalt: salt,
        canManageTournament,
        canManagePlayers,
        canRunDraw,
        canEditScores,
        canCrownChampion,
        permissionsHash: permHash,
        pinUpdatedAt: Number(jwtPayload.pinVer || 0),
        isActive: true,
        lastLoginAt: jwtIatMs || now,
        createdAt: Number(jwtPayload.createdAt || now)
      };
      return {
        admin: sanitizeAdminPublic(syntheticAdmin),
        rawAdmin: syntheticAdmin,
        keepSignedIn: Boolean(jwtPayload.keepSignedIn),
        isStatelessJwt: true
      };
    }

    // Legacy opaque DB session fallback
    const row = this.db
      .prepare(`
        SELECT s.token_hash, s.keep_signed_in, s.expires_at, a.*
        FROM admin_sessions s
        JOIN admin_accounts a ON a.id = s.admin_id
        WHERE s.token_hash = ? AND s.expires_at > ?
      `)
      .get(tokenHash, now);
    if (!row) return null;
    const admin = mapAdminRaw(row);
    if (!admin.isActive || !verifyPermissionsIntegrity(admin)) {
      this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }
    if (Boolean(row.keep_signed_in) && row.expires_at - now < SESSION_TTL_PERSISTENT_MS / 2) {
      this.db
        .prepare('UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ?')
        .run(now + SESSION_TTL_PERSISTENT_MS, tokenHash);
    }
    return {
      admin: sanitizeAdminPublic(admin),
      rawAdmin: admin,
      keepSignedIn: Boolean(row.keep_signed_in),
      isStatelessJwt: false
    };
  }

  requirePermission(rawToken, permission) {
    const session = this.verifySessionToken(rawToken);
    if (!session) {
      return { ok: false, status: 401, error: 'يرجى تسجيل الدخول بحساب مشرف صالح أولاً.' };
    }
    if (permission && !hasPermission(session.rawAdmin, permission)) {
      return { ok: false, status: 403, error: 'ليس لديك صلاحية تنفيذ هذا الإجراء.' };
    }
    return { ok: true, session };
  }

  setupHeadAdmin({ username, displayName, pin, keepSignedIn = true, clientKey = 'default' }) {
    if (process.env.CP4_HEAD_ADMIN_PIN && isValidPinFormat(process.env.CP4_HEAD_ADMIN_PIN.trim())) {
      return { ok: false, status: 409, error: 'حساب المشرف الرئيسي مُعد مسبقاً عبر إعدادات الخادم.' };
    }
    const cleanUser = String(username || '').trim();
    const cleanDisplay = String(displayName || '').trim() || cleanUser || 'المشرف الرئيسي';
    if (cleanUser.length < 3 || cleanUser.length > 32) {
      return { ok: false, status: 400, error: 'يجب أن يكون اسم المستخدم بين 3 و32 حرفاً.' };
    }
    if (!isValidPinFormat(pin)) {
      return { ok: false, status: 400, error: 'يجب أن يتكون رمز PIN من 6 أرقام.' };
    }

    const result = this.withTx(() => {
      if (this.hasHeadAdmin()) {
        return { ok: false, status: 409, error: 'حساب المشرف الرئيسي مُعد بالفعل.' };
      }
      const salt = generateSalt();
      const pHash = hashPin(pin, salt);
      const now = Date.now();
      const permHash = computePermissionsHash({
        username: cleanUser,
        role: AdminRole.HEAD_ADMIN,
        canManageTournament: true,
        canManagePlayers: true,
        canRunDraw: true,
        canEditScores: true,
        canCrownChampion: true,
        pinSalt: salt,
        pinHash: pHash
      });
      const info = this.db
        .prepare(`
          INSERT INTO admin_accounts (
            username, display_name, role, pin_hash, pin_salt,
            can_manage_tournament, can_manage_players, can_run_draw,
            can_edit_scores, can_crown_champion, permissions_hash,
            pin_updated_at, is_active, last_login_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, 1, 1, ?, ?, 1, ?, ?)
        `)
        .run(cleanUser, cleanDisplay, AdminRole.HEAD_ADMIN, pHash, salt, permHash, now, now, now);

      const created = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(info.lastInsertRowid));
      const ttl = keepSignedIn ? SESSION_TTL_PERSISTENT_MS : SESSION_TTL_EPHEMERAL_MS;
      const token = signAdminJwt(created, {
        keepSignedIn,
        ttlMs: ttl,
        secretOverride: this.db?.sessionSecret
      });
      const tokenHash = hashSessionToken(token, this.db?.sessionSecret);
      this.db
        .prepare('INSERT INTO admin_sessions (token_hash, admin_id, keep_signed_in, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(tokenHash, created.id, keepSignedIn ? 1 : 0, now + ttl, now);

      this.resetLockout(clientKey);
      return {
        ok: true,
        status: 201,
        token,
        admin: sanitizeAdminPublic(created),
        messageAr: 'تم إعداد حساب المشرف الرئيسي وتشفير رمز PIN بنجاح.'
      };
    });

    if (result.ok) this.emitChange('admin_updated');
    return result;
  }

  loginAdmin({ username, pin, keepSignedIn = true, clientKey = 'default' }) {
    const now = Date.now();
    const lock = this.getLockoutState(clientKey);
    if (lock.lockedUntilMillis > now) {
      const rem = Math.max(1, Math.ceil((lock.lockedUntilMillis - now) / 1000));
      return {
        ok: false,
        status: 429,
        error: `تم قفل الدخول مؤقتاً بعد محاولات خاطئة. انتظر ${rem} ثانية.`,
        lockoutState: lock
      };
    }

    const row = this.db
      .prepare('SELECT * FROM admin_accounts WHERE username = ? COLLATE NOCASE')
      .get(String(username || '').trim());
    const admin = mapAdminRaw(row);

    if (!admin || !verifyPin(String(pin || ''), admin.pinSalt, admin.pinHash)) {
      const nextAttempts = lock.failedAttempts + 1;
      if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
        const until = now + LOCKOUT_DURATION_MS;
        this.recordFailedAttempt(clientKey, 0, until);
        return {
          ok: false,
          status: 401,
          error: 'تم تجاوز الحد المسموح (5 محاولات). تم القفل لمدة 30 ثانية.',
          lockoutState: { failedAttempts: 0, lockedUntilMillis: until }
        };
      }
      this.recordFailedAttempt(clientKey, nextAttempts, 0);
      const left = MAX_FAILED_ATTEMPTS - nextAttempts;
      return {
        ok: false,
        status: 401,
        error: `بيانات الدخول غير صحيحة (متبقي ${left} محاولات).`,
        lockoutState: { failedAttempts: nextAttempts, lockedUntilMillis: 0 }
      };
    }

    if (!admin.isActive) {
      return {
        ok: false,
        status: 403,
        error: 'تم تعليق هذا الحساب من قِبل المشرف الرئيسي.',
        lockoutState: this.getLockoutState(clientKey)
      };
    }

    if (!verifyPermissionsIntegrity(admin)) {
      return {
        ok: false,
        status: 403,
        error: 'فشل التحقق الأمني من سلامة صلاحيات الحساب.',
        lockoutState: this.getLockoutState(clientKey)
      };
    }

    const ttl = keepSignedIn ? SESSION_TTL_PERSISTENT_MS : SESSION_TTL_EPHEMERAL_MS;
    const token = signAdminJwt(admin, {
      keepSignedIn,
      ttlMs: ttl,
      secretOverride: this.db?.sessionSecret
    });
    const tokenHash = hashSessionToken(token, this.db?.sessionSecret);

    this.withTx(() => {
      this.resetLockout(clientKey);
      this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now);
      this.db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(now);
      this.db.prepare('UPDATE admin_accounts SET last_login_at = ? WHERE id = ?').run(now, admin.id);
      this.db
        .prepare('INSERT INTO admin_sessions (token_hash, admin_id, keep_signed_in, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(tokenHash, admin.id, keepSignedIn ? 1 : 0, now + ttl, now);
    });

    const updated = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(admin.id));
    return {
      ok: true,
      status: 200,
      token,
      admin: sanitizeAdminPublic(updated),
      lockoutState: { failedAttempts: 0, lockedUntilMillis: 0 },
      messageAr: `تم تسجيل الدخول بنجاح — مرحباً ${updated.displayName}`
    };
  }

  logoutAdmin(rawToken) {
    if (rawToken) {
      const secret = this.db?.sessionSecret;
      const tokenHash = hashSessionToken(rawToken, secret);
      const now = Date.now();
      this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      const jwtPayload = verifyAdminJwt(rawToken, secret);
      if (jwtPayload) {
        const expMs = Math.max(now + 60_000, Number(jwtPayload.exp || 0) * 1000);
        this.db.prepare('INSERT OR REPLACE INTO revoked_tokens (token_hash, expires_at) VALUES (?, ?)').run(tokenHash, expMs);
      }
      this.db.prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(now);
    }
    return { ok: true, status: 200, messageAr: 'تم تسجيل الخروج من لوحة المشرف.' };
  }

  changeOwnPin(rawToken, { currentPin, newPin }) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.isStatelessJwt) {
      return { ok: false, status: 400, error: 'الحساب غير مسجل في قاعدة البيانات الحالية لتغيير رمز PIN.' };
    }
    const account = auth.session.rawAdmin;

    if (!verifyPin(String(currentPin || ''), account.pinSalt, account.pinHash)) {
      return { ok: false, status: 400, error: 'رمز PIN الحالي غير صحيح.' };
    }
    if (!isValidPinFormat(String(newPin || ''))) {
      return { ok: false, status: 400, error: 'رمز PIN الجديد يجب أن يتكون من 6 أرقام.' };
    }

    const salt = generateSalt();
    const pHash = hashPin(newPin, salt);
    const now = Date.now();
    const nextPinUpdatedAt = Math.max(now, Number(account.pinUpdatedAt || 0) + 1);
    const permHash = computePermissionsHash({
      username: account.username,
      role: account.role,
      canManageTournament: account.canManageTournament,
      canManagePlayers: account.canManagePlayers,
      canRunDraw: account.canRunDraw,
      canEditScores: account.canEditScores,
      canCrownChampion: account.canCrownChampion,
      pinSalt: salt,
      pinHash: pHash
    });

    const currentTokenHash = hashSessionToken(rawToken, this.db?.sessionSecret);
    const keepSignedIn = Boolean(auth.session.keepSignedIn);
    const ttl = keepSignedIn ? SESSION_TTL_PERSISTENT_MS : SESSION_TTL_EPHEMERAL_MS;
    let refreshedToken = null;

    this.withTx(() => {
      this.db
        .prepare('UPDATE admin_accounts SET pin_salt = ?, pin_hash = ?, permissions_hash = ?, pin_updated_at = ? WHERE id = ?')
        .run(salt, pHash, permHash, nextPinUpdatedAt, account.id);
      // Revoke other active sessions for this account while preserving current session
      this.db
        .prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND token_hash != ?')
        .run(account.id, currentTokenHash);
      // Issue refreshed JWT carrying the updated pinVer for seamless stateless persistence
      const updated = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(account.id));
      refreshedToken = signAdminJwt(updated, {
        keepSignedIn,
        ttlMs: ttl,
        secretOverride: this.db?.sessionSecret
      });
      const refreshedHash = hashSessionToken(refreshedToken, this.db?.sessionSecret);
      this.db
        .prepare('INSERT OR REPLACE INTO admin_sessions (token_hash, admin_id, keep_signed_in, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(refreshedHash, account.id, keepSignedIn ? 1 : 0, now + ttl, now);
    });

    this.emitChange('admin_updated');
    return {
      ok: true,
      status: 200,
      token: refreshedToken,
      messageAr: 'تم تحديث وتشفير رمز PIN بنجاح.'
    };
  }

  updateOwnProfile(rawToken, { displayName, username } = {}) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.isStatelessJwt) {
      return { ok: false, status: 400, error: 'الحساب غير مسجل في قاعدة البيانات الحالية لتعديل الملف الشخصي.' };
    }
    const account = auth.session.rawAdmin;

    const cleanDisplay = displayName !== undefined ? String(displayName).trim() : account.displayName;
    if (!cleanDisplay || cleanDisplay.length > 50) {
      return { ok: false, status: 400, error: 'يرجى إدخال الاسم الظاهر (من 1 إلى 50 حرفاً).' };
    }

    const cleanUser = username !== undefined && String(username).trim() !== ''
      ? String(username).trim()
      : account.username;
    if (cleanUser.length < 3 || cleanUser.length > 32) {
      return { ok: false, status: 400, error: 'اسم المستخدم يجب أن يكون بين 3 و 32 حرفاً.' };
    }

    const now = Date.now();
    const keepSignedIn = Boolean(auth.session.keepSignedIn);
    const ttl = keepSignedIn ? SESSION_TTL_PERSISTENT_MS : SESSION_TTL_EPHEMERAL_MS;

    const res = this.withTx(() => {
      if (cleanUser.toLowerCase() !== account.username.toLowerCase()) {
        const conflict = this.db
          .prepare('SELECT id FROM admin_accounts WHERE username = ? COLLATE NOCASE AND id != ?')
          .get(cleanUser, account.id);
        if (conflict) {
          return { ok: false, status: 409, error: 'اسم المستخدم مستخدم بالفعل لحساب آخر.' };
        }
      }

      const permHash = computePermissionsHash({
        username: cleanUser,
        role: account.role,
        canManageTournament: account.canManageTournament,
        canManagePlayers: account.canManagePlayers,
        canRunDraw: account.canRunDraw,
        canEditScores: account.canEditScores,
        canCrownChampion: account.canCrownChampion,
        pinSalt: account.pinSalt,
        pinHash: account.pinHash
      });

      this.db
        .prepare('UPDATE admin_accounts SET username = ?, display_name = ?, permissions_hash = ? WHERE id = ?')
        .run(cleanUser, cleanDisplay, permHash, account.id);
      this.db.prepare('DELETE FROM revoked_admins WHERE username = ? COLLATE NOCASE').run(cleanUser);

      const updated = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(account.id));
      const refreshedToken = signAdminJwt(updated, {
        keepSignedIn,
        ttlMs: ttl,
        secretOverride: this.db?.sessionSecret
      });
      const refreshedHash = hashSessionToken(refreshedToken, this.db?.sessionSecret);
      this.db
        .prepare('INSERT OR REPLACE INTO admin_sessions (token_hash, admin_id, keep_signed_in, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(refreshedHash, account.id, keepSignedIn ? 1 : 0, now + ttl, now);

      return {
        ok: true,
        status: 200,
        token: refreshedToken,
        admin: sanitizeAdminPublic(updated),
        messageAr: 'تم تحديث بيانات حساب المشرف بنجاح.'
      };
    });

    if (res.ok) this.emitChange('admin_updated');
    return res;
  }

  createSubAdmin(rawToken, payload) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.rawAdmin.role !== AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 403, error: 'المشرف الرئيسي فقط يمتلك صلاحية إنشاء الحسابات المساعدة.' };
    }

    const cleanUser = String(payload.username || '').trim();
    const cleanName = String(payload.displayName || '').trim();
    const pin = String(payload.pin || '');
    if (cleanUser.length < 3 || cleanName.length < 1) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم مستخدم (3 أحرف على الأقل) واسم عرض.' };
    }
    if (!isValidPinFormat(pin)) {
      return { ok: false, status: 400, error: 'رمز PIN يجب أن يتكون من 6 أرقام.' };
    }

    const res = this.withTx(() => {
      const subCount = this.db.prepare('SELECT COUNT(*) AS c FROM admin_accounts WHERE role = ?').get(AdminRole.SUB_ADMIN).c;
      if (subCount >= MAX_SUB_ADMINS) {
        return { ok: false, status: 400, error: `تم بلوغ الحد الأقصى (${MAX_SUB_ADMINS} حسابات مساعدة).` };
      }
      const exists = this.db.prepare('SELECT id FROM admin_accounts WHERE username = ? COLLATE NOCASE').get(cleanUser);
      if (exists) {
        return { ok: false, status: 409, error: 'اسم المستخدم مسجل مسبقاً.' };
      }

      const p1 = Boolean(payload.canManageTournament);
      const p2 = Boolean(payload.canManagePlayers);
      const p3 = Boolean(payload.canRunDraw);
      const p4 = Boolean(payload.canEditScores);
      const p5 = Boolean(payload.canCrownChampion);

      const salt = generateSalt();
      const pHash = hashPin(pin, salt);
      const now = Date.now();
      const revokedRow = this.db
        .prepare('SELECT revoked_at FROM revoked_admins WHERE username = ? COLLATE NOCASE')
        .get(cleanUser);
      const pinUpdatedAt = Math.max(now, Number(revokedRow?.revoked_at || 0) + 1);
      this.db.prepare('DELETE FROM revoked_admins WHERE username = ? COLLATE NOCASE').run(cleanUser);

      const permHash = computePermissionsHash({
        username: cleanUser,
        role: AdminRole.SUB_ADMIN,
        canManageTournament: p1,
        canManagePlayers: p2,
        canRunDraw: p3,
        canEditScores: p4,
        canCrownChampion: p5,
        pinSalt: salt,
        pinHash: pHash
      });

      const info = this.db
        .prepare(`
          INSERT INTO admin_accounts (
            username, display_name, role, pin_hash, pin_salt,
            can_manage_tournament, can_manage_players, can_run_draw,
            can_edit_scores, can_crown_champion, permissions_hash,
            pin_updated_at, is_active, last_login_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)
        `)
        .run(
          cleanUser,
          cleanName,
          AdminRole.SUB_ADMIN,
          pHash,
          salt,
          p1 ? 1 : 0,
          p2 ? 1 : 0,
          p3 ? 1 : 0,
          p4 ? 1 : 0,
          p5 ? 1 : 0,
          permHash,
          pinUpdatedAt,
          now
        );

      const created = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(info.lastInsertRowid));
      return {
        ok: true,
        status: 201,
        admin: sanitizeAdminPublic(created),
        messageAr: 'تم إنشاء الحساب المساعد وتشفير رمز PIN بنجاح.'
      };
    });

    if (res.ok) this.emitChange('admin_updated');
    return res;
  }

  updateSubAdmin(rawToken, targetId, payload) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.rawAdmin.role !== AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 403, error: 'المشرف الرئيسي فقط يمكنه تعديل الحسابات المساعدة.' };
    }

    const row = this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(Number(targetId));
    const target = mapAdminRaw(row);
    if (!target) return { ok: false, status: 404, error: 'الحساب المساعد غير موجود.' };
    if (target.role === AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 400, error: 'لا يمكن تعديل صلاحيات المشرف الرئيسي من هنا.' };
    }

    let pinSalt = target.pinSalt;
    let pinHash = target.pinHash;
    let pinUpdatedAt = target.pinUpdatedAt;
    const pinChanged = payload.newPin != null && String(payload.newPin).trim() !== '';
    if (pinChanged) {
      if (!isValidPinFormat(String(payload.newPin))) {
        return { ok: false, status: 400, error: 'رمز PIN الجديد يجب أن يتكون من 6 أرقام.' };
      }
      pinSalt = generateSalt();
      pinHash = hashPin(String(payload.newPin), pinSalt);
      pinUpdatedAt = Math.max(Date.now(), Number(target.pinUpdatedAt || 0) + 1);
    }

    const displayName = String(payload.displayName || '').trim() || target.displayName;
    const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : target.isActive;
    const p1 = payload.canManageTournament !== undefined ? Boolean(payload.canManageTournament) : target.canManageTournament;
    const p2 = payload.canManagePlayers !== undefined ? Boolean(payload.canManagePlayers) : target.canManagePlayers;
    const p3 = payload.canRunDraw !== undefined ? Boolean(payload.canRunDraw) : target.canRunDraw;
    const p4 = payload.canEditScores !== undefined ? Boolean(payload.canEditScores) : target.canEditScores;
    const p5 = payload.canCrownChampion !== undefined ? Boolean(payload.canCrownChampion) : target.canCrownChampion;

    const permHash = computePermissionsHash({
      username: target.username,
      role: target.role,
      canManageTournament: p1,
      canManagePlayers: p2,
      canRunDraw: p3,
      canEditScores: p4,
      canCrownChampion: p5,
      pinSalt,
      pinHash
    });

    this.withTx(() => {
      this.db
        .prepare(`
          UPDATE admin_accounts SET
            display_name = ?, pin_salt = ?, pin_hash = ?, pin_updated_at = ?,
            is_active = ?, can_manage_tournament = ?, can_manage_players = ?,
            can_run_draw = ?, can_edit_scores = ?, can_crown_champion = ?, permissions_hash = ?
          WHERE id = ?
        `)
        .run(
          displayName,
          pinSalt,
          pinHash,
          pinUpdatedAt,
          isActive ? 1 : 0,
          p1 ? 1 : 0,
          p2 ? 1 : 0,
          p3 ? 1 : 0,
          p4 ? 1 : 0,
          p5 ? 1 : 0,
          permHash,
          target.id
        );
      if (!isActive || pinChanged) {
        this.db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(target.id);
      }
    });

    this.emitChange('admin_updated');
    const updated = mapAdminRaw(this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(target.id));
    return {
      ok: true,
      status: 200,
      admin: sanitizeAdminPublic(updated),
      messageAr: 'تم تحديث إعدادات وصلاحيات المشرف المساعد.'
    };
  }

  deleteSubAdmin(rawToken, targetId) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.rawAdmin.role !== AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 403, error: 'غير مصرح بحذف الحسابات المساعدة.' };
    }

    const row = this.db.prepare('SELECT * FROM admin_accounts WHERE id = ?').get(Number(targetId));
    const target = mapAdminRaw(row);
    if (!target || target.role === AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 400, error: 'غير مصرح بحذف هذا الحساب.' };
    }

    this.withTx(() => {
      this.db.prepare('INSERT OR REPLACE INTO revoked_admins (username, revoked_at) VALUES (?, ?)').run(target.username, Date.now());
      this.db.prepare('DELETE FROM admin_sessions WHERE admin_id = ?').run(target.id);
      this.db.prepare('DELETE FROM admin_accounts WHERE id = ?').run(target.id);
    });
    this.emitChange('admin_updated');
    return { ok: true, status: 200, messageAr: 'تم حذف الحساب المساعد بنجاح.' };
  }

  queryPlayerProfiles() {
    return this.db
      .prepare(`
        SELECT pp.*, COUNT(p.id) AS tournaments_count
        FROM player_profiles pp
        LEFT JOIN players p ON p.profile_id = pp.id
        GROUP BY pp.id
        ORDER BY pp.id DESC
      `)
      .all()
      .map(mapPlayerProfile);
  }

  getPlayerProfileById(profileId) {
    const row = this.db
      .prepare(`
        SELECT pp.*, COUNT(p.id) AS tournaments_count
        FROM player_profiles pp
        LEFT JOIN players p ON p.profile_id = pp.id
        WHERE pp.id = ?
        GROUP BY pp.id
      `)
      .get(Number(profileId));
    return mapPlayerProfile(row);
  }

  fetchMappedPlayerById(playerId, includeDiscordId = false) {
    const row = this.db
      .prepare(`
        SELECT p.*, pp.cp4_id AS profile_cp4_id, pp.discord_user_id AS profile_discord_user_id, pp.xemonet_id AS profile_xemonet_id
        FROM players p
        LEFT JOIN player_profiles pp ON pp.id = p.profile_id
        WHERE p.id = ?
      `)
      .get(Number(playerId));
    return row ? mapPlayer(row, { includeDiscordId }) : null;
  }

  resolveOrCreateProfileForPlayer({
    name,
    elysiumNetId,
    xeMoNetId = '',
    avatarUrl = null,
    profileId = null,
    now = Date.now()
  }) {
    if (profileId != null) {
      const existing = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(Number(profileId));
      if (existing) return existing;
    }

    const cleanElysium = String(elysiumNetId || '').trim();
    if (cleanElysium) {
      const matched = this.db
        .prepare("SELECT * FROM player_profiles WHERE elysium_net_id != '' AND LOWER(elysium_net_id) = LOWER(?) ORDER BY id ASC LIMIT 1")
        .get(cleanElysium);
      if (matched) {
        return matched;
      }
    }

    const cp4Id = allocateNextCp4Id(this.db);
    const info = this.db
      .prepare(`
        INSERT INTO player_profiles (
          cp4_id, name, avatar_url, elysium_net_id, xemonet_id, discord_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?)
      `)
      .run(
        cp4Id,
        String(name || 'لاعب').trim() || 'لاعب',
        avatarUrl ? String(avatarUrl).trim() : null,
        cleanElysium,
        String(xeMoNetId || '').trim(),
        now
      );
    return this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(Number(info.lastInsertRowid));
  }

  listPlayerProfiles(rawToken) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;
    return {
      ok: true,
      status: 200,
      profiles: this.queryPlayerProfiles()
    };
  }

  createPlayerProfile(rawToken, payload = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const cleanName = String(payload.name || '').trim();
    if (!cleanName || cleanName.length > 60) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم اللاعب (من 1 إلى 60 حرفاً).' };
    }

    const cleanDiscordRaw = normalizeDiscordUserId(payload.discordUserId);
    const cleanDiscordId = cleanDiscordRaw ? cleanDiscordRaw : null;
    if (cleanDiscordId && !isValidDiscordUserId(cleanDiscordId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_DISCORD_ID',
        error: 'يرجى إدخال معرف Discord User ID صحيح (من 17 إلى 22 رقماً).'
      };
    }

    const cleanElysium = String(payload.elysiumNetId || '').trim().slice(0, 60);
    const cleanXeMoNet = String(payload.xeMoNetId || '').trim().slice(0, 60);
    const cleanAvatar = payload.avatarUrl ? String(payload.avatarUrl).trim().slice(0, 500) : null;

    const res = this.withTx(() => {
      if (cleanDiscordId) {
        const dupRow = this.db
          .prepare('SELECT id FROM player_profiles WHERE discord_user_id = ?')
          .get(cleanDiscordId);
        if (dupRow) {
          return {
            ok: false,
            status: 409,
            code: 'DUPLICATE_DISCORD_ID',
            error: 'يوجد ملف لاعب مسجل مسبقاً بنفس معرف Discord User ID.',
            existingProfile: this.getPlayerProfileById(dupRow.id)
          };
        }
      }

      const cp4Id = allocateNextCp4Id(this.db);
      const now = Date.now();
      const info = this.db
        .prepare(`
          INSERT INTO player_profiles (
            cp4_id, name, avatar_url, elysium_net_id, xemonet_id, discord_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(cp4Id, cleanName, cleanAvatar, cleanElysium, cleanXeMoNet, cleanDiscordId, now);

      const profile = this.getPlayerProfileById(info.lastInsertRowid);
      this.logAudit(
        auth.session.rawAdmin,
        null,
        'CREATE_PLAYER_PROFILE',
        `إنشاء ملف لاعب موحد جديد: ${profile.name} (${profile.cp4Id})`
      );
      return {
        ok: true,
        status: 201,
        profile,
        messageAr: `تم إنشاء ملف اللاعب الموحد بنجاح (${profile.cp4Id}).`
      };
    });

    if (res.ok) this.emitChange('player_profile_created');
    return res;
  }

  updatePlayerProfile(rawToken, profileId, payload = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const targetId = Number(profileId);
    const existingRow = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(targetId);
    if (!existingRow) {
      return { ok: false, status: 404, error: 'ملف اللاعب غير موجود.' };
    }

    if (payload.cp4Id !== undefined && String(payload.cp4Id).trim() !== existingRow.cp4_id) {
      return {
        ok: false,
        status: 400,
        code: 'CP4_ID_IMMUTABLE',
        error: 'رقم اللاعب CP4 ثابت ولا يمكن تعديله أو تغييره.'
      };
    }

    const cleanName = payload.name !== undefined ? String(payload.name).trim() : existingRow.name;
    if (!cleanName || cleanName.length > 60) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم اللاعب (من 1 إلى 60 حرفاً).' };
    }

    let cleanDiscordId = existingRow.discord_user_id;
    if (payload.discordUserId !== undefined) {
      const normalized = normalizeDiscordUserId(payload.discordUserId);
      cleanDiscordId = normalized ? normalized : null;
      if (cleanDiscordId && !isValidDiscordUserId(cleanDiscordId)) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_DISCORD_ID',
          error: 'يرجى إدخال معرف Discord User ID صحيح (من 17 إلى 22 رقماً).'
        };
      }
    }

    const cleanElysium =
      payload.elysiumNetId !== undefined ? String(payload.elysiumNetId || '').trim().slice(0, 60) : existingRow.elysium_net_id;
    const cleanXeMoNet =
      payload.xeMoNetId !== undefined ? String(payload.xeMoNetId || '').trim().slice(0, 60) : existingRow.xemonet_id;
    const cleanAvatar =
      payload.avatarUrl !== undefined
        ? (payload.avatarUrl ? String(payload.avatarUrl).trim().slice(0, 500) : null)
        : existingRow.avatar_url;

    const res = this.withTx(() => {
      if (cleanDiscordId) {
        const dupRow = this.db
          .prepare('SELECT id FROM player_profiles WHERE discord_user_id = ? AND id != ?')
          .get(cleanDiscordId, existingRow.id);
        if (dupRow) {
          return {
            ok: false,
            status: 409,
            code: 'DUPLICATE_DISCORD_ID',
            error: 'هذا Discord User ID مرتبط بملف لاعب آخر بالفعل.',
            existingProfile: this.getPlayerProfileById(dupRow.id)
          };
        }
      }

      this.db
        .prepare(`
          UPDATE player_profiles SET
            name = ?, avatar_url = ?, elysium_net_id = ?, xemonet_id = ?, discord_user_id = ?
          WHERE id = ?
        `)
        .run(cleanName, cleanAvatar, cleanElysium, cleanXeMoNet, cleanDiscordId, existingRow.id);

      const profile = this.getPlayerProfileById(existingRow.id);
      this.logAudit(
        auth.session.rawAdmin,
        null,
        'UPDATE_PLAYER_PROFILE',
        `تحديث ملف اللاعب الموحد: ${profile.name} (${profile.cp4Id})`
      );
      return {
        ok: true,
        status: 200,
        profile,
        messageAr: `تم تحديث بيانات الملف (${profile.cp4Id}) بنجاح.`
      };
    });

    if (res.ok) this.emitChange('player_profile_updated');
    return res;
  }

  createOrResolveDiscordOAuthProfile({ discordUserId, displayName, username, avatarUrl = null } = {}) {
    const cleanDiscordId = normalizeDiscordUserId(discordUserId);
    if (!isValidDiscordUserId(cleanDiscordId)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_DISCORD_ID',
        error: 'معرف Discord User ID المستلم غير صالح.'
      };
    }

    const cleanName = String(displayName || username || 'لاعب Discord').trim().slice(0, 60) || 'لاعب Discord';
    const cleanAvatar = avatarUrl ? String(avatarUrl).trim().slice(0, 500) : null;

    const res = this.withTx(() => {
      const existing = this.db
        .prepare('SELECT id FROM player_profiles WHERE discord_user_id = ?')
        .get(cleanDiscordId);
      if (existing) {
        const profile = this.getPlayerProfileById(existing.id);
        return {
          ok: true,
          status: 200,
          created: false,
          duplicate: true,
          code: 'DUPLICATE_DISCORD_ID',
          profile,
          messageAr: `هذا الحساب مربوط بالفعل بملف اللاعب (${profile.cp4Id}) — لم يتم إنشاء ملف مكرر.`
        };
      }

      const cp4Id = allocateNextCp4Id(this.db);
      const now = Date.now();
      const info = this.db
        .prepare(`
          INSERT INTO player_profiles (
            cp4_id, name, avatar_url, elysium_net_id, xemonet_id, discord_user_id, created_at
          ) VALUES (?, ?, ?, '', '', ?, ?)
        `)
        .run(cp4Id, cleanName, cleanAvatar, cleanDiscordId, now);

      const profile = this.getPlayerProfileById(info.lastInsertRowid);
      this.logAudit(
        { username: 'discord_oauth', displayName: cleanName },
        null,
        'DISCORD_OAUTH_REGISTER',
        `ربط حساب Discord جديد وإنشاء ملف موحد: ${profile.name} (${profile.cp4Id})`
      );
      return {
        ok: true,
        status: 201,
        created: true,
        duplicate: false,
        profile,
        messageAr: `تم ربط حساب Discord وإنشاء ملفك الموحد بنجاح (${profile.cp4Id}).`
      };
    });

    if (res.ok && res.created) this.emitChange('player_profile_created');
    return res;
  }

  updateOwnDiscordProfile(profileId, payload = {}) {
    const targetId = Number(profileId);
    const existingRow = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(targetId);
    if (!existingRow) {
      return { ok: false, status: 404, error: 'ملف اللاعب غير موجود.' };
    }

    if (payload.cp4Id !== undefined && String(payload.cp4Id).trim() !== existingRow.cp4_id) {
      return {
        ok: false,
        status: 400,
        code: 'CP4_ID_IMMUTABLE',
        error: 'رقم اللاعب CP4 ثابت ولا يمكن تعديله أو تغييره.'
      };
    }

    if (
      payload.discordUserId !== undefined &&
      normalizeDiscordUserId(payload.discordUserId) !== normalizeDiscordUserId(existingRow.discord_user_id)
    ) {
      return {
        ok: false,
        status: 400,
        code: 'DISCORD_ID_IMMUTABLE',
        error: 'لا يمكن تغيير ربط حساب Discord مباشرة من الإعدادات دون موافقة المشرف.'
      };
    }

    const cleanElysium =
      payload.elysiumNetId !== undefined
        ? String(payload.elysiumNetId || '').trim().slice(0, 60)
        : existingRow.elysium_net_id;
    const cleanXeMoNet =
      payload.xeMoNetId !== undefined
        ? String(payload.xeMoNetId || '').trim().slice(0, 60)
        : existingRow.xemonet_id;

    if (cleanElysium) {
      const conflictingDiscordOwner = this.db
        .prepare(
          "SELECT id, cp4_id FROM player_profiles WHERE elysium_net_id != '' AND LOWER(elysium_net_id) = LOWER(?) AND discord_user_id IS NOT NULL AND id != ?"
        )
        .get(cleanElysium, existingRow.id);
      if (conflictingDiscordOwner) {
        return {
          ok: false,
          status: 409,
          code: 'DUPLICATE_ELYSIUM_ID',
          error: `معرف ElysiumNet مستخدم بالفعل لحساب Discord آخر (${conflictingDiscordOwner.cp4_id}).`
        };
      }
    }

    this.db
      .prepare('UPDATE player_profiles SET elysium_net_id = ?, xemonet_id = ? WHERE id = ?')
      .run(cleanElysium, cleanXeMoNet, existingRow.id);

    const profile = this.getPlayerProfileById(existingRow.id);
    this.logAudit(
      { username: 'discord_player', displayName: profile.name },
      null,
      'PLAYER_SETTINGS_UPDATED',
      `تحديث معرفات الحساب الموحد (${profile.cp4Id}): ElysiumNet=${cleanElysium || '-'}, XeMoNet=${cleanXeMoNet || '-'}`
    );
    this.emitChange('player_profile_updated');
    return {
      ok: true,
      status: 200,
      profile,
      messageAr: `تم حفظ إعدادات ملفك بنجاح (${profile.cp4Id}).`
    };
  }

  claimVerifiedLegacyProfile(currentProfileId, { cp4Id, elysiumNetId } = {}) {
    const cleanCp4Id = String(cp4Id || '').trim().toUpperCase();
    const cleanElysium = String(elysiumNetId || '').trim();
    if (!cleanCp4Id || !cleanElysium) {
      return {
        ok: false,
        status: 400,
        code: 'VERIFICATION_REQUIRED',
        error: 'يرجى إدخال رقم CP4 ومعرف ElysiumNet للتحقق من ملكية الملف القديم.'
      };
    }

    const res = this.withTx(() => {
      const currentProfile = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(Number(currentProfileId));
      if (!currentProfile || !currentProfile.discord_user_id) {
        return { ok: false, status: 401, error: 'يجب تسجيل الدخول عبر Discord أولاً.' };
      }

      const legacyProfile = this.db
        .prepare('SELECT * FROM player_profiles WHERE UPPER(cp4_id) = ?')
        .get(cleanCp4Id);
      if (!legacyProfile) {
        return { ok: false, status: 404, code: 'LEGACY_PROFILE_NOT_FOUND', error: 'لم يتم العثور على ملف قديم بهذا المعرف.' };
      }

      if (legacyProfile.id === currentProfile.id) {
        return {
          ok: true,
          status: 200,
          profile: this.getPlayerProfileById(currentProfile.id),
          messageAr: `حسابك مرتبط بالفعل بالملف (${currentProfile.cp4_id}).`
        };
      }

      if (legacyProfile.discord_user_id && legacyProfile.discord_user_id !== currentProfile.discord_user_id) {
        return {
          ok: false,
          status: 409,
          code: 'ALREADY_LINKED_TO_DISCORD',
          error: 'هذا الملف مرتبط بالفعل بحساب Discord آخر. يرجى مراجعة المشرف.'
        };
      }

      if (
        !legacyProfile.elysium_net_id ||
        legacyProfile.elysium_net_id.trim().toLowerCase() !== cleanElysium.toLowerCase()
      ) {
        return {
          ok: false,
          status: 403,
          code: 'IDENTITY_VERIFICATION_FAILED',
          error: 'تعذر التحقق من الهوية: معرف ElysiumNet لا يطابق الملف القديم المسجل.'
        };
      }

      const duplicateTournamentConflict = this.db
        .prepare(`
          SELECT p1.tournament_id
          FROM players p1
          INNER JOIN players p2 ON p1.tournament_id = p2.tournament_id
          WHERE p1.profile_id = ? AND p2.profile_id = ?
          LIMIT 1
        `)
        .get(currentProfile.id, legacyProfile.id);
      if (duplicateTournamentConflict) {
        return {
          ok: false,
          status: 409,
          code: 'TOURNAMENT_CONFLICT',
          error: 'يوجد اشتراك مزدوج في نفس البطولة بين الملفين؛ يرجى تنفيذ الدمج عبر المشرف.'
        };
      }

      const discordUserId = currentProfile.discord_user_id;
      const mergedAvatar = legacyProfile.avatar_url || currentProfile.avatar_url || null;
      const mergedXeMoNet = String(legacyProfile.xemonet_id || '').trim() || String(currentProfile.xemonet_id || '').trim();

      this.db.prepare('UPDATE player_profiles SET discord_user_id = NULL WHERE id = ?').run(currentProfile.id);
      this.db.prepare('UPDATE players SET profile_id = ? WHERE profile_id = ?').run(legacyProfile.id, currentProfile.id);
      this.db
        .prepare('UPDATE player_profiles SET discord_user_id = ?, avatar_url = ?, xemonet_id = ? WHERE id = ?')
        .run(discordUserId, mergedAvatar, mergedXeMoNet, legacyProfile.id);
      this.db.prepare('DELETE FROM player_profiles WHERE id = ?').run(currentProfile.id);
      syncCp4ProfileSequence(this.db);

      const claimed = this.getPlayerProfileById(legacyProfile.id);
      this.logAudit(
        { username: 'discord_oauth', displayName: claimed.name },
        null,
        'CLAIM_LEGACY_PROFILE',
        `ربط ملف اللاعب القديم (${claimed.cp4Id}) بحساب Discord بعد التحقق من الهوية`
      );
      return {
        ok: true,
        status: 200,
        profile: claimed,
        messageAr: `تم التحقق وربط ملفك القديم (${claimed.cp4Id}) بحساب Discord مع الحفاظ على جميع البطولات والنتائج.`
      };
    });

    if (res.ok) this.emitChange('player_profiles_merged');
    return res;
  }

  mergePlayerProfiles(rawToken, { sourceProfileId, targetProfileId, confirmIdentity = false } = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    if (confirmIdentity !== true) {
      return {
        ok: false,
        status: 400,
        code: 'CONFIRM_REQUIRED',
        error: 'يجب تأكيد تطابق هوية اللاعب يدوياً قبل دمج الملفين.'
      };
    }

    const srcId = Number(sourceProfileId);
    const dstId = Number(targetProfileId);
    if (!Number.isInteger(srcId) || !Number.isInteger(dstId) || srcId <= 0 || dstId <= 0) {
      return { ok: false, status: 400, error: 'معرفات الملفات المطلوب دمجها غير صالحة.' };
    }
    if (srcId === dstId) {
      return { ok: false, status: 400, error: 'يرجى اختيار ملفين مختلفين لتنفيذ الدمج.' };
    }

    const res = this.withTx(() => {
      const source = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(srcId);
      const target = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(dstId);
      if (!source || !target) {
        return { ok: false, status: 404, error: 'أحد ملفي اللاعبين غير موجود.' };
      }

      if (source.discord_user_id && target.discord_user_id && source.discord_user_id !== target.discord_user_id) {
        return {
          ok: false,
          status: 409,
          error: 'يرتبط كلا الملفين بحسابي Discord مختلفين. لا يمكن الدمج التلقائي دون فك أحد الارتباطين.'
        };
      }

      const mergedDiscordId = target.discord_user_id || source.discord_user_id || null;
      const mergedElysium = String(target.elysium_net_id || '').trim() || String(source.elysium_net_id || '').trim();
      const mergedXeMoNet = String(target.xemonet_id || '').trim() || String(source.xemonet_id || '').trim();
      const mergedAvatar = target.avatar_url || source.avatar_url || null;

      this.db.prepare('UPDATE players SET profile_id = ? WHERE profile_id = ?').run(target.id, source.id);
      this.db.prepare('DELETE FROM player_profiles WHERE id = ?').run(source.id);
      this.db
        .prepare(`
          UPDATE player_profiles SET
            avatar_url = ?, elysium_net_id = ?, xemonet_id = ?, discord_user_id = ?
          WHERE id = ?
        `)
        .run(mergedAvatar, mergedElysium, mergedXeMoNet, mergedDiscordId, target.id);

      syncCp4ProfileSequence(this.db);
      const mergedProfile = this.getPlayerProfileById(target.id);
      this.logAudit(
        auth.session.rawAdmin,
        null,
        'MERGE_PLAYER_PROFILES',
        `دمج الملف ${source.cp4_id} داخل الملف الأساسي ${mergedProfile.cp4_id}`
      );
      return {
        ok: true,
        status: 200,
        profile: mergedProfile,
        mergedFromCp4Id: source.cp4_id,
        messageAr: `تم دمج الملف (${source.cp4_id}) داخل الملف الأساسي (${mergedProfile.cp4Id}) مع الحفاظ على جميع البطولات والنتائج.`
      };
    });

    if (res.ok) this.emitChange('player_profiles_merged');
    return res;
  }

  getPublicState(requestedTournamentId = null, rawToken = null, clientKey = 'default', requestedUsername = null) {
    const session = rawToken ? this.verifySessionToken(rawToken) : null;
    const isHeadAdmin = session?.admin?.role === AdminRole.HEAD_ADMIN;
    const canManagePlayers = Boolean(session && hasPermission(session.rawAdmin, 'MANAGE_PLAYERS'));

    const tournamentRows = this.db.prepare('SELECT * FROM tournaments ORDER BY id DESC').all();
    const tournaments = tournamentRows.map(mapTournament);
    let tournament = null;
    if (requestedTournamentId != null) {
      tournament = tournaments.find((t) => t.id === Number(requestedTournamentId)) || null;
    }
    if (!tournament) {
      tournament = tournaments[0] || null;
    }

    const players = tournament
      ? this.db
          .prepare(`
            SELECT p.*, pp.cp4_id AS profile_cp4_id, pp.discord_user_id AS profile_discord_user_id, pp.xemonet_id AS profile_xemonet_id
            FROM players p
            LEFT JOIN player_profiles pp ON pp.id = p.profile_id
            WHERE p.tournament_id = ?
            ORDER BY p.registered_at ASC, p.id ASC
          `)
          .all(tournament.id)
          .map((row) => mapPlayer(row, { includeDiscordId: canManagePlayers }))
      : [];
    const groups = tournament
      ? this.db.prepare('SELECT * FROM tournament_groups WHERE tournament_id = ? ORDER BY display_order ASC').all(tournament.id).map(mapGroup)
      : [];
    const allMatches = tournament
      ? this.db.prepare('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round_number ASC, bracket_index ASC, id ASC').all(tournament.id).map(mapMatch)
      : [];
    const matchReminders = tournament
      ? this.db.prepare('SELECT * FROM match_reminders WHERE tournament_id = ? ORDER BY remind_at_millis ASC').all(tournament.id).map(mapReminder)
      : [];

    const raceRows = tournament
      ? this.db.prepare('SELECT * FROM races WHERE tournament_id = ? ORDER BY race_number ASC, id ASC').all(tournament.id)
      : [];
    const raceResultRows = tournament
      ? this.db.prepare('SELECT * FROM race_results WHERE tournament_id = ? ORDER BY position ASC, id ASC').all(tournament.id)
      : [];
    const resultsByRaceId = new Map();
    for (const rr of raceResultRows) {
      const mapped = mapRaceResult(rr);
      if (!resultsByRaceId.has(mapped.raceId)) resultsByRaceId.set(mapped.raceId, []);
      resultsByRaceId.get(mapped.raceId).push(mapped);
    }
    const races = raceRows.map((r) => mapRace(r, resultsByRaceId.get(r.id) || []));

    const approvedPlayers = players.filter((p) => p.status === PlayerStatus.APPROVED);
    const pendingPlayers = players.filter((p) => p.status === PlayerStatus.PENDING);
    const rejectedPlayers = players.filter((p) => p.status === PlayerStatus.REJECTED);

    const isRacingFormat =
      tournament &&
      (tournament.format === TournamentFormat.RACE_POINTS || tournament.format === TournamentFormat.RACE_QUALIFIERS_FINAL);
    const racingStandings =
      isRacingFormat || races.length > 0
        ? computeRacingStandings(approvedPlayers, races, tournament?.qualifiersPerGroup || 4)
        : [];

    const groupsWithStandings =
      tournament && tournament.format === TournamentFormat.GROUPS_KNOCKOUT
        ? groups.map((group) => {
            const gPlayers = approvedPlayers.filter((p) => p.groupId === group.id);
            const gMatches = allMatches.filter((m) => m.stage === MatchStage.GROUP && m.groupId === group.id);
            const standings = computeStandings(gPlayers, gMatches, tournament.qualifiersPerGroup);
            return { group, standings, matches: gMatches };
          })
        : [];

    const leagueMatches = allMatches.filter((m) => m.stage === MatchStage.LEAGUE);
    const leagueStandings =
      tournament && tournament.format === TournamentFormat.LEAGUE_KNOCKOUT
        ? computeStandings(approvedPlayers, leagueMatches, tournament.qualifiersPerGroup)
        : [];

    const knockoutMatches = allMatches
      .filter(
        (m) =>
          m.stage === MatchStage.ROUND_OF_64 ||
          m.stage === MatchStage.ROUND_OF_32 ||
          m.stage === MatchStage.ROUND_OF_16 ||
          m.stage === MatchStage.QUARTER_FINAL ||
          m.stage === MatchStage.SEMI_FINAL ||
          m.stage === MatchStage.FINAL ||
          m.stage === MatchStage.THIRD_PLACE
      )
      .sort((a, b) => {
        const orderDiff = (MATCH_STAGE_META[a.stage]?.order ?? 99) - (MATCH_STAGE_META[b.stage]?.order ?? 99);
        if (orderDiff !== 0) return orderDiff;
        if (a.bracketIndex !== b.bracketIndex) return a.bracketIndex - b.bracketIndex;
        return a.id - b.id;
      });

    const { playerStats, overviewStats } = computeTournamentStats(approvedPlayers, allMatches);
    const seasonLeaderboard = computeSeasonLeaderboard(this.db);
    const hallOfFame = buildHallOfFame(this.db);
    const championPlayer = tournament?.championPlayerId
      ? players.find((p) => p.id === tournament.championPlayerId) || null
      : null;

    const adminDirectory = this.getAdminDirectory();
    const cleanRequestedUsername =
      typeof requestedUsername === 'string' && requestedUsername.trim() ? requestedUsername.trim() : null;
    const matchedDirectoryAdmin = cleanRequestedUsername
      ? adminDirectory.find((a) => a.username.toLowerCase() === cleanRequestedUsername.toLowerCase()) || null
      : null;

    const isRegistrationOpenNow = Boolean(
      tournament &&
        !tournament.isRegistrationClosedManual &&
        tournament.status === TournamentStatus.REGISTRATION_OPEN &&
        approvedPlayers.length < tournament.maxParticipants
    );

    const auditLogs = session
      ? this.db.prepare('SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT 60').all().map(mapAuditLog)
      : [];

    const playerProfiles = canManagePlayers ? this.queryPlayerProfiles() : [];

    return {
      tournaments,
      tournament,
      players,
      approvedPlayers,
      pendingPlayers,
      rejectedPlayers,
      playerProfiles,
      groupsWithStandings,
      leagueStandings,
      leagueMatches,
      knockoutMatches,
      allMatches,
      races,
      racingStandings,
      matchReminders,
      playerStats,
      overviewStats,
      seasonLeaderboard,
      hallOfFame,
      auditLogs,
      championPlayer,
      isRegistrationOpenNow,
      hasHeadAdmin: this.hasHeadAdmin() || session?.admin?.role === AdminRole.HEAD_ADMIN,
      adminDirectory,
      adminAccounts: isHeadAdmin ? this.listFullAdminsForHead() : [],
      currentAdmin: session ? session.admin : null,
      rememberedUsername: session ? session.admin.username : matchedDirectoryAdmin?.username ?? null,
      keepSignedIn: session ? session.keepSignedIn : true,
      lockoutState: this.getLockoutState(clientKey),
      gameCatalog: GAME_CATALOG
    };
  }

  getTournamentExport(tournamentId) {
    const state = this.getPublicState(tournamentId);
    if (!state.tournament) {
      return { ok: false, status: 404, error: 'البطولة غير موجودة.' };
    }
    return { ok: true, status: 200, ...buildExportData(state) };
  }

  createTournament(rawToken, payload) {
    const auth = this.requirePermission(rawToken, 'MANAGE_TOURNAMENT');
    if (!auth.ok) return auth;

    const name = String(payload.name || '').trim();
    if (!name) return { ok: false, status: 400, error: 'يرجى إدخال اسم البطولة.' };

    const rules = resolveTournamentGameRules(payload, null);
    const description =
      String(payload.description || '').trim() ||
      `بطولة ${rules.gameTitle} الرسمية لمجتمع CP4 ARENA على منصة COMMUNITY PS4 & GAMING ONLINE.`;
    const startDateTime = String(payload.startDateTime || '').trim() || 'يُحدد لاحقاً';
    const maxParticipants = Math.max(2, Math.min(64, Number(payload.maxParticipants) || 16));
    const groupCount = Math.max(1, Math.min(8, Number(payload.groupCount) || 4));
    const qualifiersPerGroup = Math.max(1, Math.min(64, Number(payload.qualifiersPerGroup) || 2));
    const drawMode = Object.values(DrawMode).includes(payload.drawMode) ? payload.drawMode : DrawMode.RANDOM;
    const knockoutTieRule = Object.values(KnockoutTieRule).includes(payload.knockoutTieRule)
      ? payload.knockoutTieRule
      : KnockoutTieRule.SINGLE_MATCH_PENALTIES;
    const matchDurationMinutes = Math.max(3, Math.min(60, Number(payload.matchDurationMinutes) || 12));
    const targetGoalsRule = String(payload.targetGoalsRule || '').trim() || 'المباراة الكاملة';
    const bannerUrl = payload.bannerUrl ? String(payload.bannerUrl).trim() : null;
    const isThirdPlaceEnabled = payload.isThirdPlaceEnabled !== undefined ? Boolean(payload.isThirdPlaceEnabled) : true;
    const now = Date.now();

    const info = this.db
      .prepare(`
        INSERT INTO tournaments (
          name, game_title, game_category, score_unit_label, description,
          banner_url, start_date_time, max_participants, format, group_count,
          qualifiers_per_group, draw_mode, knockout_tie_rule, match_duration_minutes,
          target_goals_rule, is_registration_closed_manual, is_third_place_enabled,
          play_mode, team_size, best_of, racing_points_config,
          status, champion_player_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL, ?)
      `)
      .run(
        name,
        rules.gameTitle,
        rules.gameCategory,
        rules.scoreUnitLabel,
        description,
        bannerUrl,
        startDateTime,
        maxParticipants,
        rules.format,
        groupCount,
        qualifiersPerGroup,
        drawMode,
        knockoutTieRule,
        matchDurationMinutes,
        targetGoalsRule,
        isThirdPlaceEnabled ? 1 : 0,
        rules.playMode,
        rules.teamSize,
        rules.bestOf,
        JSON.stringify(rules.racingPointsConfig),
        TournamentStatus.REGISTRATION_OPEN,
        now
      );

    const created = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(info.lastInsertRowid));
    this.logAudit(auth.session.rawAdmin, created.id, 'CREATE_TOURNAMENT', `إنشاء بطولة جديدة: ${created.name}`);
    this.emitChange('tournament_created', { tournamentId: created.id });
    return { ok: true, status: 201, tournament: created, messageAr: 'تم إنشاء البطولة الجديدة بنجاح.' };
  }

  updateTournament(rawToken, tournamentId, payload) {
    const auth = this.requirePermission(rawToken, 'MANAGE_TOURNAMENT');
    if (!auth.ok) return auth;

    const current = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
    if (!current) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

    const name = String(payload.name ?? current.name).trim();
    if (!name) return { ok: false, status: 400, error: 'يرجى إدخال اسم البطولة.' };

    const rules = resolveTournamentGameRules(payload, current);
    const maxParticipants = Math.max(2, Math.min(64, Number(payload.maxParticipants ?? current.maxParticipants)));
    const groupCount = Math.max(1, Math.min(8, Number(payload.groupCount ?? current.groupCount)));
    const qualifiersPerGroup = Math.max(1, Math.min(64, Number(payload.qualifiersPerGroup ?? current.qualifiersPerGroup)));
    const drawMode = Object.values(DrawMode).includes(payload.drawMode) ? payload.drawMode : current.drawMode;
    const knockoutTieRule = Object.values(KnockoutTieRule).includes(payload.knockoutTieRule)
      ? payload.knockoutTieRule
      : current.knockoutTieRule;
    const matchDurationMinutes = Math.max(3, Math.min(60, Number(payload.matchDurationMinutes ?? current.matchDurationMinutes)));
    const manualClosed =
      payload.isRegistrationClosedManual !== undefined
        ? Boolean(payload.isRegistrationClosedManual)
        : current.isRegistrationClosedManual;
    const isThirdPlaceEnabled =
      payload.isThirdPlaceEnabled !== undefined
        ? Boolean(payload.isThirdPlaceEnabled)
        : current.isThirdPlaceEnabled;

    const approvedCount = this.db
      .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
      .get(current.id, PlayerStatus.APPROVED).c;

    let status = current.status;
    if (manualClosed && status === TournamentStatus.REGISTRATION_OPEN) {
      status = TournamentStatus.REGISTRATION_CLOSED;
    } else if (!manualClosed && status === TournamentStatus.REGISTRATION_CLOSED && approvedCount < maxParticipants) {
      status = TournamentStatus.REGISTRATION_OPEN;
    } else if (approvedCount >= maxParticipants && status === TournamentStatus.REGISTRATION_OPEN) {
      status = TournamentStatus.REGISTRATION_CLOSED;
    }

    this.db
      .prepare(`
        UPDATE tournaments SET
          name = ?, game_title = ?, game_category = ?, score_unit_label = ?,
          description = ?, banner_url = ?, start_date_time = ?, max_participants = ?,
          format = ?, group_count = ?, qualifiers_per_group = ?, draw_mode = ?,
          knockout_tie_rule = ?, match_duration_minutes = ?, target_goals_rule = ?,
          is_registration_closed_manual = ?, is_third_place_enabled = ?,
          play_mode = ?, team_size = ?, best_of = ?, racing_points_config = ?,
          status = ?
        WHERE id = ?
      `)
      .run(
        name,
        rules.gameTitle,
        rules.gameCategory,
        rules.scoreUnitLabel,
        String(payload.description ?? current.description).trim(),
        payload.bannerUrl !== undefined ? payload.bannerUrl : current.bannerUrl,
        String(payload.startDateTime ?? current.startDateTime).trim() || 'يُحدد لاحقاً',
        maxParticipants,
        rules.format,
        groupCount,
        qualifiersPerGroup,
        drawMode,
        knockoutTieRule,
        matchDurationMinutes,
        String(payload.targetGoalsRule ?? current.targetGoalsRule).trim() || 'المباراة الكاملة',
        manualClosed ? 1 : 0,
        isThirdPlaceEnabled ? 1 : 0,
        rules.playMode,
        rules.teamSize,
        rules.bestOf,
        JSON.stringify(rules.racingPointsConfig),
        status,
        current.id
      );

    this.logAudit(auth.session.rawAdmin, current.id, 'UPDATE_TOURNAMENT', `تحديث إعدادات البطولة: ${name}`);
    this.emitChange('tournament_updated', { tournamentId: current.id });
    const updated = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(current.id));
    return { ok: true, status: 200, tournament: updated, messageAr: 'تم حفظ إعدادات البطولة بنجاح.' };
  }

  deleteTournament(rawToken, tournamentId) {
    const auth = this.requirePermission(rawToken, 'MANAGE_TOURNAMENT');
    if (!auth.ok) return auth;

    const id = Number(tournamentId);
    const exists = this.db.prepare('SELECT id FROM tournaments WHERE id = ?').get(id);
    if (!exists) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

    this.withTx(() => {
      this.db.prepare('DELETE FROM tournaments WHERE id = ?').run(id);
      this.db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_tournament_seeded', '1')").run();
    });

    this.emitChange('tournament_deleted', { deletedId: id });
    return { ok: true, status: 200, messageAr: 'تم حذف البطولة نهائياً بنجاح.' };
  }

  registerPlayer({
    tournamentId,
    name,
    elysiumNetId,
    xeMoNetId = '',
    avatarUrl = null,
    level = PlayerLevel.INTERMEDIATE,
    clubName = '',
    authenticatedDiscordProfileId = null,
    useDiscordIdentity = false
  }) {
    const cleanElysium = String(elysiumNetId || '').trim();
    const cleanXeMoNet = String(xeMoNetId || '').trim().slice(0, 60);
    const authProfileRow =
      authenticatedDiscordProfileId != null
        ? this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(Number(authenticatedDiscordProfileId))
        : null;

    const useVerifiedDiscord = Boolean(authProfileRow && (useDiscordIdentity || !String(name || '').trim()));
    const cleanName = useVerifiedDiscord
      ? String(authProfileRow.name || '').trim()
      : String(name || '').trim();
    const resolvedAvatarUrl = useVerifiedDiscord
      ? (authProfileRow.avatar_url ?? (avatarUrl ? String(avatarUrl).trim() : null))
      : (avatarUrl ? String(avatarUrl).trim() : null);

    if (!cleanName || !cleanElysium) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم اللاعب ومعرف ElysiumNet/ XeMoNat.' };
    }
    if (cleanName.length > 50 || cleanElysium.length > 50) {
      return { ok: false, status: 400, error: 'الاسم أو معرف ElysiumNet/ XeMoNat طويل جداً.' };
    }

    const safeLevel = Object.values(PlayerLevel).includes(level) ? level : PlayerLevel.INTERMEDIATE;
    const defaultOvr = PLAYER_LEVEL_META[safeLevel].defaultOvr;

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'لا توجد بطولة نشطة حالياً.' };

      const approvedCount = this.db
        .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
        .get(tournament.id, PlayerStatus.APPROVED).c;

      if (
        tournament.isRegistrationClosedManual ||
        tournament.status !== TournamentStatus.REGISTRATION_OPEN ||
        approvedCount >= tournament.maxParticipants
      ) {
        return { ok: false, status: 400, error: 'تم إغلاق التسجيل لاكتمال العدد المحدد أو بدء البطولة.' };
      }

      const duplicate = this.db
        .prepare('SELECT id FROM players WHERE tournament_id = ? AND LOWER(elysium_net_id) = LOWER(?)')
        .get(tournament.id, cleanElysium);
      if (duplicate) {
        return { ok: false, status: 409, error: 'معرف ElysiumNet/ XeMoNat مسجل مسبقاً في هذه البطولة.' };
      }

      if (authProfileRow) {
        const duplicateProfileEntry = this.db
          .prepare('SELECT id FROM players WHERE tournament_id = ? AND profile_id = ?')
          .get(tournament.id, authProfileRow.id);
        if (duplicateProfileEntry) {
          return { ok: false, status: 409, error: 'حساب Discord الخاص بك مسجل مسبقاً في هذه البطولة.' };
        }
      }

      const now = Date.now();
      const profileRow = authProfileRow
        ? (() => {
            const nextElysium = String(authProfileRow.elysium_net_id || '').trim() || cleanElysium;
            const nextXeMoNet = String(authProfileRow.xemonet_id || '').trim() || cleanXeMoNet;
            const nextAvatar = authProfileRow.avatar_url || resolvedAvatarUrl || null;
            this.db
              .prepare('UPDATE player_profiles SET elysium_net_id = ?, xemonet_id = ?, avatar_url = ? WHERE id = ?')
              .run(nextElysium, nextXeMoNet, nextAvatar, authProfileRow.id);
            return this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(authProfileRow.id);
          })()
        : this.resolveOrCreateProfileForPlayer({
            name: cleanName,
            elysiumNetId: cleanElysium,
            xeMoNetId: cleanXeMoNet,
            avatarUrl: resolvedAvatarUrl,
            now
          });

      const info = this.db
        .prepare(`
          INSERT INTO players (
            tournament_id, profile_id, name, elysium_net_id, xemonet_id, avatar_url, level,
            ovr_rating, club_name, status, group_id, seed_order, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)
        `)
        .run(
          tournament.id,
          profileRow?.id ?? null,
          cleanName,
          cleanElysium,
          cleanXeMoNet,
          resolvedAvatarUrl,
          safeLevel,
          defaultOvr,
          String(clubName || '').trim().slice(0, 50),
          PlayerStatus.PENDING,
          now
        );

      const player = this.fetchMappedPlayerById(info.lastInsertRowid, Boolean(authProfileRow));
      return {
        ok: true,
        status: 201,
        player,
        messageAr: 'تم إرسال طلب التسجيل بنجاح! بانتظار موافقة المشرف.',
        notificationMeta: {
          discordUserId: profileRow?.discord_user_id ?? null,
          name: player.name,
          cp4Id: player.cp4Id ?? profileRow?.cp4_id ?? null,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          gameTitle: tournament.gameTitle,
          elysiumNetId: player.elysiumNetId,
          xeMoNetId: player.xeMoNetId || profileRow?.xemonet_id || ''
        }
      };
    });

    if (res.ok) this.emitChange('player_registered', { tournamentId: Number(tournamentId) });
    return res;
  }

  updatePlayerStatus(rawToken, playerId, newStatus) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;
    if (!Object.values(PlayerStatus).includes(newStatus)) {
      return { ok: false, status: 400, error: 'حالة اللاعب غير صالحة.' };
    }

    const res = this.withTx(() => {
      const playerRow = this.db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
      if (!playerRow) return { ok: false, status: 404, error: 'اللاعب غير موجود.' };
      const player = mapPlayer(playerRow);
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(player.tournamentId));
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const isApprovedNow = newStatus === PlayerStatus.APPROVED && player.status !== PlayerStatus.APPROVED;
      if (isApprovedNow) {
        const approvedCount = this.db
          .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
          .get(tournament.id, PlayerStatus.APPROVED).c;
        if (approvedCount >= tournament.maxParticipants) {
          return { ok: false, status: 400, error: `تم الوصول للحد الأقصى للمشاركين (${tournament.maxParticipants}).` };
        }
      }

      this.db.prepare('UPDATE players SET status = ? WHERE id = ?').run(newStatus, player.id);
      const newApprovedCount = this.db
        .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
        .get(tournament.id, PlayerStatus.APPROVED).c;

      if (newApprovedCount >= tournament.maxParticipants && tournament.status === TournamentStatus.REGISTRATION_OPEN) {
        this.db
          .prepare('UPDATE tournaments SET is_registration_closed_manual = 1, status = ? WHERE id = ?')
          .run(TournamentStatus.REGISTRATION_CLOSED, tournament.id);
      }

      const mappedWithDiscord = this.fetchMappedPlayerById(player.id, true);
      return {
        ok: true,
        status: 200,
        messageAr: `تم تحديث حالة اللاعب إلى ${PLAYER_STATUS_META[newStatus].labelAr}.`,
        notificationMeta: {
          isApprovedNow,
          previousStatus: player.status,
          newStatus,
          discordUserId: mappedWithDiscord?.discordUserId ?? null,
          name: mappedWithDiscord?.name ?? player.name,
          cp4Id: mappedWithDiscord?.cp4Id ?? null,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          gameTitle: tournament.gameTitle,
          elysiumNetId: mappedWithDiscord?.elysiumNetId ?? player.elysiumNetId,
          xeMoNetId: mappedWithDiscord?.xeMoNetId ?? player.xeMoNetId ?? ''
        }
      };
    });

    if (res.ok) this.emitChange('player_updated');
    return res;
  }

  adminAddPlayer(rawToken, tournamentId, payload = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const requestedProfileId = payload.profileId != null ? Number(payload.profileId) : null;
    const requestedProfileRow = requestedProfileId
      ? this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(requestedProfileId)
      : null;

    const cleanName = String(payload.name ?? requestedProfileRow?.name ?? '').trim();
    const cleanElysium = String(payload.elysiumNetId ?? requestedProfileRow?.elysium_net_id ?? '').trim();
    const cleanXeMoNet = String(payload.xeMoNetId ?? requestedProfileRow?.xemonet_id ?? '').trim().slice(0, 60);
    if (!cleanName || !cleanElysium) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم اللاعب ومعرف ElysiumNet/ XeMoNat.' };
    }
    if (cleanName.length > 50 || cleanElysium.length > 50) {
      return { ok: false, status: 400, error: 'الاسم أو معرف ElysiumNet/ XeMoNat طويل جداً.' };
    }

    const safeLevel = Object.values(PlayerLevel).includes(payload.level) ? payload.level : PlayerLevel.INTERMEDIATE;
    const ovrRating = Math.max(60, Math.min(99, Number(payload.ovrRating ?? PLAYER_LEVEL_META[safeLevel].defaultOvr) || 81));
    const clubName = String(payload.clubName || '').trim().slice(0, 50);
    const avatarUrl =
      payload.avatarUrl !== undefined
        ? (payload.avatarUrl ? String(payload.avatarUrl).trim() : null)
        : (requestedProfileRow?.avatar_url ?? null);
    const desiredStatus = payload.status === PlayerStatus.PENDING ? PlayerStatus.PENDING : PlayerStatus.APPROVED;

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const duplicate = this.db
        .prepare('SELECT id FROM players WHERE tournament_id = ? AND LOWER(elysium_net_id) = LOWER(?)')
        .get(tournament.id, cleanElysium);
      if (duplicate) {
        return { ok: false, status: 409, error: 'معرف ElysiumNet/ XeMoNat مسجل مسبقاً في هذه البطولة.' };
      }

      const approvedCount = this.db
        .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
        .get(tournament.id, PlayerStatus.APPROVED).c;
      if (desiredStatus === PlayerStatus.APPROVED && approvedCount >= tournament.maxParticipants) {
        return { ok: false, status: 400, error: `تم الوصول للحد الأقصى للمشاركين (${tournament.maxParticipants}).` };
      }

      const now = Date.now();
      const profileRow = this.resolveOrCreateProfileForPlayer({
        name: cleanName,
        elysiumNetId: cleanElysium,
        xeMoNetId: cleanXeMoNet,
        avatarUrl,
        profileId: requestedProfileRow?.id ?? null,
        now
      });

      const info = this.db
        .prepare(`
          INSERT INTO players (
            tournament_id, profile_id, name, elysium_net_id, xemonet_id, avatar_url, level,
            ovr_rating, club_name, status, group_id, seed_order, registered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)
        `)
        .run(
          tournament.id,
          profileRow?.id ?? null,
          cleanName,
          cleanElysium,
          cleanXeMoNet,
          avatarUrl,
          safeLevel,
          ovrRating,
          clubName,
          desiredStatus,
          now
        );

      const newApprovedCount = approvedCount + (desiredStatus === PlayerStatus.APPROVED ? 1 : 0);
      if (newApprovedCount >= tournament.maxParticipants && tournament.status === TournamentStatus.REGISTRATION_OPEN) {
        this.db
          .prepare('UPDATE tournaments SET is_registration_closed_manual = 1, status = ? WHERE id = ?')
          .run(TournamentStatus.REGISTRATION_CLOSED, tournament.id);
      }

      const player = this.fetchMappedPlayerById(info.lastInsertRowid, true);
      return {
        ok: true,
        status: 201,
        player,
        messageAr: `تمت إضافة اللاعب (${player.name}) إلى البطولة بنجاح.`
      };
    });

    if (res.ok) this.emitChange('player_added');
    return res;
  }

  bulkImportPlayers(rawToken, tournamentId, { linesText = '', status = PlayerStatus.APPROVED } = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const desiredStatus = status === PlayerStatus.PENDING ? PlayerStatus.PENDING : PlayerStatus.APPROVED;
    const rawLines = String(linesText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      return { ok: false, status: 400, error: 'يرجى إدخال سطر واحد على الأقل للاستيراد.' };
    }

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      let approvedCount = this.db
        .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
        .get(tournament.id, PlayerStatus.APPROVED).c;

      const insertStmt = this.db.prepare(`
        INSERT INTO players (
          tournament_id, profile_id, name, elysium_net_id, xemonet_id, avatar_url, level,
          ovr_rating, club_name, status, group_id, seed_order, registered_at
        ) VALUES (?, ?, ?, ?, '', NULL, ?, ?, ?, ?, NULL, 0, ?)
      `);
      const dupStmt = this.db.prepare('SELECT id FROM players WHERE tournament_id = ? AND LOWER(elysium_net_id) = LOWER(?)');

      let importedCount = 0;
      let skippedCount = 0;
      const now = Date.now();

      for (const line of rawLines) {
        const parts = line.includes('|')
          ? line.split('|').map((s) => s.trim())
          : line.includes('\t')
          ? line.split('\t').map((s) => s.trim())
          : line.split(',').map((s) => s.trim());

        const pName = (parts[0] || '').slice(0, 50);
        const pElysium = (parts[1] || parts[0] || '').slice(0, 50);
        const pClub = (parts[2] || '').slice(0, 50);
        if (!pName || !pElysium) {
          skippedCount += 1;
          continue;
        }
        if (dupStmt.get(tournament.id, pElysium)) {
          skippedCount += 1;
          continue;
        }
        if (desiredStatus === PlayerStatus.APPROVED && approvedCount >= tournament.maxParticipants) {
          skippedCount += 1;
          continue;
        }

        const profileRow = this.resolveOrCreateProfileForPlayer({
          name: pName,
          elysiumNetId: pElysium,
          now: now + importedCount
        });

        insertStmt.run(
          tournament.id,
          profileRow?.id ?? null,
          pName,
          pElysium,
          PlayerLevel.INTERMEDIATE,
          PLAYER_LEVEL_META[PlayerLevel.INTERMEDIATE].defaultOvr,
          pClub,
          desiredStatus,
          now + importedCount
        );
        importedCount += 1;
        if (desiredStatus === PlayerStatus.APPROVED) approvedCount += 1;
      }

      if (approvedCount >= tournament.maxParticipants && tournament.status === TournamentStatus.REGISTRATION_OPEN) {
        this.db
          .prepare('UPDATE tournaments SET is_registration_closed_manual = 1, status = ? WHERE id = ?')
          .run(TournamentStatus.REGISTRATION_CLOSED, tournament.id);
      }

      this.logAudit(
        auth.session.rawAdmin,
        tournament.id,
        'BULK_IMPORT_PLAYERS',
        `استيراد ${importedCount} لاعب دفعة واحدة (تخطي ${skippedCount})`
      );

      return {
        ok: true,
        status: 201,
        importedCount,
        skippedCount,
        messageAr: `تم استيراد ${importedCount} لاعب بنجاح${skippedCount > 0 ? ` (تم تخطي ${skippedCount})` : ''}.`
      };
    });

    if (res.ok) this.emitChange('player_added');
    return res;
  }

  updatePlayerDetails(rawToken, playerId, payload) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const existing = this.db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
    if (!existing) return { ok: false, status: 404, error: 'اللاعب غير موجود.' };

    const name = String(payload.name ?? existing.name).trim();
    const elysiumNetId = String(payload.elysiumNetId ?? existing.elysium_net_id).trim();
    const xeMoNetId =
      payload.xeMoNetId !== undefined ? String(payload.xeMoNetId || '').trim().slice(0, 60) : (existing.xemonet_id || '');
    if (!name || !elysiumNetId) {
      return { ok: false, status: 400, error: 'الاسم ومعرف ElysiumNet/ XeMoNat مطلوبان.' };
    }

    const duplicate = this.db
      .prepare('SELECT id FROM players WHERE tournament_id = ? AND LOWER(elysium_net_id) = LOWER(?) AND id != ?')
      .get(existing.tournament_id, elysiumNetId, existing.id);
    if (duplicate) {
      return { ok: false, status: 409, error: 'معرف ElysiumNet/ XeMoNat مستخدم بالفعل للاعب آخر.' };
    }

    const level = Object.values(PlayerLevel).includes(payload.level) ? payload.level : existing.level;
    const ovrRating = Math.max(60, Math.min(99, Number(payload.ovrRating ?? existing.ovr_rating) || 81));
    const clubName = String(payload.clubName ?? existing.club_name).trim();
    const avatarUrl =
      payload.avatarUrl !== undefined
        ? (payload.avatarUrl ? String(payload.avatarUrl).trim() : null)
        : existing.avatar_url;

    this.db
      .prepare('UPDATE players SET name = ?, elysium_net_id = ?, xemonet_id = ?, avatar_url = ?, club_name = ?, level = ?, ovr_rating = ? WHERE id = ?')
      .run(name, elysiumNetId, xeMoNetId, avatarUrl, clubName, level, ovrRating, existing.id);

    this.emitChange('player_updated');
    return { ok: true, status: 200, messageAr: 'تم تحديث بيانات اللاعب بنجاح.' };
  }

  linkPlayerToDiscord(rawToken, playerId, payload = {}) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const targetPlayerId = Number(playerId);
    const syncIdentity = payload.syncIdentity !== false;
    const confirmMerge = payload.confirmMerge === true;
    const requestedTargetProfileId =
      payload.targetProfileId != null && Number(payload.targetProfileId) > 0
        ? Number(payload.targetProfileId)
        : null;
    const cleanDiscordInput = normalizeDiscordUserId(payload.discordUserId);
    const cleanDiscordName = payload.discordName ? String(payload.discordName).trim().slice(0, 60) : '';
    const cleanDiscordAvatar = payload.discordAvatarUrl ? String(payload.discordAvatarUrl).trim().slice(0, 500) : null;

    if (payload.unlink === true) {
      const res = this.withTx(() => {
        const playerRow = this.db.prepare('SELECT * FROM players WHERE id = ?').get(targetPlayerId);
        if (!playerRow) return { ok: false, status: 404, error: 'المشارك غير موجود.' };
        if (playerRow.profile_id) {
          this.db.prepare('UPDATE player_profiles SET discord_user_id = NULL WHERE id = ?').run(playerRow.profile_id);
        }
        const updatedPlayer = this.fetchMappedPlayerById(playerRow.id, true);
        this.logAudit(
          auth.session.rawAdmin,
          playerRow.tournament_id,
          'UNLINK_PLAYER_DISCORD',
          `فك ربط Discord عن المشارك: ${playerRow.name}`
        );
        return {
          ok: true,
          status: 200,
          player: updatedPlayer,
          profile: updatedPlayer.profileId ? this.getPlayerProfileById(updatedPlayer.profileId) : null,
          messageAr: `تم فك ربط حساب Discord عن (${updatedPlayer.name}).`
        };
      });
      if (res.ok) this.emitChange('player_updated');
      return res;
    }

    if (!requestedTargetProfileId && !cleanDiscordInput) {
      return { ok: false, status: 400, error: 'يرجى اختيار حساب Discord موثق أو إدخال Discord User ID.' };
    }
    if (cleanDiscordInput && !isValidDiscordUserId(cleanDiscordInput)) {
      return {
        ok: false,
        status: 400,
        code: 'INVALID_DISCORD_ID',
        error: 'يرجى إدخال معرف Discord User ID صحيح (من 17 إلى 22 رقماً).'
      };
    }

    const res = this.withTx(() => {
      const playerRow = this.db.prepare('SELECT * FROM players WHERE id = ?').get(targetPlayerId);
      if (!playerRow) return { ok: false, status: 404, error: 'المشارك غير موجود.' };

      const sourceProfile =
        playerRow.profile_id != null
          ? this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(playerRow.profile_id)
          : this.resolveOrCreateProfileForPlayer({
              name: playerRow.name,
              elysiumNetId: playerRow.elysium_net_id,
              xeMoNetId: playerRow.xemonet_id || '',
              avatarUrl: playerRow.avatar_url ?? null,
              now: Date.now()
            });

      if (playerRow.profile_id == null && sourceProfile?.id) {
        this.db.prepare('UPDATE players SET profile_id = ? WHERE id = ?').run(sourceProfile.id, playerRow.id);
      }

      let targetProfile = requestedTargetProfileId
        ? this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(requestedTargetProfileId)
        : null;

      if (requestedTargetProfileId && !targetProfile) {
        return { ok: false, status: 404, error: 'ملف Discord المختار غير موجود.' };
      }
      if (targetProfile && !targetProfile.discord_user_id) {
        return { ok: false, status: 400, error: 'الملف المختار غير مرتبط بحساب Discord موثق بعد.' };
      }

      if (!targetProfile && cleanDiscordInput) {
        const existingByDiscord = this.db
          .prepare('SELECT * FROM player_profiles WHERE discord_user_id = ?')
          .get(cleanDiscordInput);
        if (existingByDiscord && existingByDiscord.id !== sourceProfile.id) {
          if (!confirmMerge) {
            return {
              ok: false,
              status: 409,
              code: 'DUPLICATE_DISCORD_ID',
              error: 'هذا الحساب على Discord مرتبط مسبقاً بملف لاعب آخر. يمكنك تأكيد الدمج لربط المشارك به مع الحفاظ على نتائجه.',
              existingProfile: this.getPlayerProfileById(existingByDiscord.id)
            };
          }
          targetProfile = existingByDiscord;
        }
      }

      if (targetProfile) {
        if (sourceProfile.id !== targetProfile.id) {
          if (
            sourceProfile.discord_user_id &&
            targetProfile.discord_user_id &&
            sourceProfile.discord_user_id !== targetProfile.discord_user_id
          ) {
            return {
              ok: false,
              status: 409,
              error: 'هذا المشارك مربوط بالفعل بحساب Discord آخر مختلف.'
            };
          }

          const duplicateInSameTournament = this.db
            .prepare('SELECT id FROM players WHERE tournament_id = ? AND profile_id = ? AND id != ?')
            .get(playerRow.tournament_id, targetProfile.id, playerRow.id);
          if (duplicateInSameTournament) {
            return {
              ok: false,
              status: 409,
              error: 'حساب Discord المختار مشارك بالفعل في هذه البطولة بسجل آخر.'
            };
          }

          const mergedElysium =
            String(targetProfile.elysium_net_id || '').trim() ||
            String(sourceProfile.elysium_net_id || '').trim() ||
            String(playerRow.elysium_net_id || '').trim();
          const mergedXeMoNet =
            String(targetProfile.xemonet_id || '').trim() ||
            String(sourceProfile.xemonet_id || '').trim() ||
            String(playerRow.xemonet_id || '').trim();
          const mergedAvatar = targetProfile.avatar_url || sourceProfile.avatar_url || playerRow.avatar_url || null;

          this.db.prepare('UPDATE players SET profile_id = ? WHERE profile_id = ?').run(targetProfile.id, sourceProfile.id);
          this.db.prepare('DELETE FROM player_profiles WHERE id = ?').run(sourceProfile.id);
          this.db
            .prepare('UPDATE player_profiles SET avatar_url = ?, elysium_net_id = ?, xemonet_id = ? WHERE id = ?')
            .run(mergedAvatar, mergedElysium, mergedXeMoNet, targetProfile.id);
          syncCp4ProfileSequence(this.db);
        }

        const refreshedTarget = this.db.prepare('SELECT * FROM player_profiles WHERE id = ?').get(targetProfile.id);
        if (syncIdentity && refreshedTarget) {
          const nextName = String(refreshedTarget.name || playerRow.name).trim().slice(0, 50) || playerRow.name;
          const nextAvatar = refreshedTarget.avatar_url ?? playerRow.avatar_url ?? null;
          this.db
            .prepare('UPDATE players SET name = ?, avatar_url = ? WHERE id = ?')
            .run(nextName, nextAvatar, playerRow.id);
        }

        const updatedPlayer = this.fetchMappedPlayerById(playerRow.id, true);
        const updatedProfile = this.getPlayerProfileById(targetProfile.id);
        this.logAudit(
          auth.session.rawAdmin,
          playerRow.tournament_id,
          'LINK_PLAYER_DISCORD',
          `ربط المشارك (${updatedPlayer.name}) بحساب Discord الموثق (${updatedProfile.cp4Id})`
        );
        return {
          ok: true,
          status: 200,
          player: updatedPlayer,
          profile: updatedProfile,
          messageAr: `تم ربط (${updatedPlayer.name}) بحساب Discord الموثق (${updatedProfile.cp4Id}) بنجاح.`
        };
      }

      // Otherwise attach cleanDiscordInput directly to sourceProfile
      if (
        sourceProfile.discord_user_id &&
        sourceProfile.discord_user_id !== cleanDiscordInput &&
        payload.confirmRelink !== true
      ) {
        return {
          ok: false,
          status: 409,
          code: 'EXISTING_DISCORD_LINK',
          error: 'هذا الملف مربوط بالفعل بحساب Discord آخر. يرجى فك الارتباط أولاً أو تأكيد تغيير الربط.'
        };
      }

      const wasUnlinked = !sourceProfile.discord_user_id;
      const nextProfileName = syncIdentity && cleanDiscordName ? cleanDiscordName : sourceProfile.name;
      const nextProfileAvatar =
        syncIdentity && cleanDiscordAvatar ? cleanDiscordAvatar : (sourceProfile.avatar_url || playerRow.avatar_url || null);
      const nextProfileElysium = String(sourceProfile.elysium_net_id || '').trim() || String(playerRow.elysium_net_id || '').trim();
      const nextProfileXeMoNet = String(sourceProfile.xemonet_id || '').trim() || String(playerRow.xemonet_id || '').trim();

      this.db
        .prepare(`
          UPDATE player_profiles SET
            name = ?, avatar_url = ?, elysium_net_id = ?, xemonet_id = ?, discord_user_id = ?
          WHERE id = ?
        `)
        .run(nextProfileName, nextProfileAvatar, nextProfileElysium, nextProfileXeMoNet, cleanDiscordInput, sourceProfile.id);

      if (syncIdentity) {
        const nextPlayerName = (cleanDiscordName || playerRow.name).slice(0, 50);
        const nextPlayerAvatar = cleanDiscordAvatar ?? playerRow.avatar_url ?? null;
        this.db
          .prepare('UPDATE players SET name = ?, avatar_url = ? WHERE id = ?')
          .run(nextPlayerName, nextPlayerAvatar, playerRow.id);
      }

      const updatedPlayer = this.fetchMappedPlayerById(playerRow.id, true);
      const updatedProfile = this.getPlayerProfileById(sourceProfile.id);
      this.logAudit(
        auth.session.rawAdmin,
        playerRow.tournament_id,
        'LINK_PLAYER_DISCORD',
        `ربط المشارك (${updatedPlayer.name}) بمعرف Discord (${cleanDiscordInput})`
      );
      return {
        ok: true,
        status: 200,
        player: updatedPlayer,
        profile: updatedProfile,
        wasUnlinked,
        messageAr: `تم ربط (${updatedPlayer.name}) بحساب Discord بنجاح (${updatedProfile.cp4Id}).`
      };
    });

    if (res.ok) this.emitChange('player_updated');
    return res;
  }

  deletePlayer(rawToken, playerId) {
    const auth = this.requirePermission(rawToken, 'MANAGE_PLAYERS');
    if (!auth.ok) return auth;

    const res = this.withTx(() => {
      const existing = this.db.prepare('SELECT * FROM players WHERE id = ?').get(Number(playerId));
      if (!existing) return { ok: false, status: 404, error: 'اللاعب غير موجود.' };
      this.db.prepare('DELETE FROM players WHERE id = ?').run(existing.id);

      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(existing.tournament_id));
      if (tournament) {
        const approvedCount = this.db
          .prepare('SELECT COUNT(*) AS c FROM players WHERE tournament_id = ? AND status = ?')
          .get(tournament.id, PlayerStatus.APPROVED).c;
        if (
          approvedCount < tournament.maxParticipants &&
          tournament.status === TournamentStatus.REGISTRATION_CLOSED &&
          !tournament.isRegistrationClosedManual
        ) {
          this.db.prepare('UPDATE tournaments SET status = ? WHERE id = ?').run(TournamentStatus.REGISTRATION_OPEN, tournament.id);
        }
      }
      return { ok: true, status: 200, messageAr: 'تم حذف اللاعب.' };
    });

    if (res.ok) this.emitChange('player_deleted');
    return res;
  }

  insertMatchRow(m) {
    const info = this.db
      .prepare(`
        INSERT INTO matches (
          tournament_id, stage, group_id, round_number, bracket_index,
          player1_id, player2_id, leg1_score1, leg1_score2, leg2_score1, leg2_score2,
          penalty_score1, penalty_score2, is_two_legged, is_completed, winner_id,
          next_match_id, next_match_slot, scheduled_label, scheduled_at_millis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        m.tournamentId,
        m.stage,
        m.groupId ?? null,
        m.roundNumber,
        m.bracketIndex,
        m.player1Id ?? null,
        m.player2Id ?? null,
        m.leg1Score1 ?? null,
        m.leg1Score2 ?? null,
        m.leg2Score1 ?? null,
        m.leg2Score2 ?? null,
        m.penaltyScore1 ?? null,
        m.penaltyScore2 ?? null,
        m.isTwoLegged ? 1 : 0,
        m.isCompleted ? 1 : 0,
        m.winnerId ?? null,
        m.nextMatchId ?? null,
        m.nextMatchSlot ?? 1,
        m.scheduledLabel ?? '',
        m.scheduledAtMillis ?? null
      );
    return Number(info.lastInsertRowid);
  }

  insertLinkedKnockoutBracket(tournament, seededSlots) {
    const drafts = buildKnockoutTreeDrafts({
      tournamentId: tournament.id,
      seededSlots,
      tieRule: tournament.knockoutTieRule,
      includeThirdPlace: Boolean(tournament.isThirdPlaceEnabled)
    });

    const tempToRealId = new Map();
    const insertedMatches = [];
    for (const draft of drafts) {
      const realParentId = draft.parentTempIndex != null ? tempToRealId.get(draft.parentTempIndex) ?? null : null;
      const toInsert = { ...draft.entity, nextMatchId: realParentId };
      const realId = this.insertMatchRow(toInsert);
      tempToRealId.set(draft.tempIndex, realId);
      insertedMatches.push({ ...toInsert, id: realId });
    }

    if (!insertedMatches.length) return;
    const minOrder = Math.min(...insertedMatches.map((m) => MATCH_STAGE_META[m.stage].order));
    const firstRound = insertedMatches.filter((m) => MATCH_STAGE_META[m.stage].order === minOrder);
    for (const m of firstRound) {
      if ((m.player1Id != null && m.player2Id == null) || (m.player2Id != null && m.player1Id == null)) {
        const byeWinner = m.player1Id ?? m.player2Id;
        this.db.prepare('UPDATE matches SET is_completed = 1, winner_id = ? WHERE id = ?').run(byeWinner, m.id);
        if (m.nextMatchId != null && byeWinner != null) {
          if (m.nextMatchSlot === 1) {
            this.db.prepare('UPDATE matches SET player1_id = ? WHERE id = ?').run(byeWinner, m.nextMatchId);
          } else {
            this.db.prepare('UPDATE matches SET player2_id = ? WHERE id = ?').run(byeWinner, m.nextMatchId);
          }
        }
      }
    }
  }

  runDraw(rawToken, tournamentId, { manualGroupAssignments = {}, manualKnockoutOrder = [] } = {}) {
    const auth = this.requirePermission(rawToken, 'RUN_DRAW');
    if (!auth.ok) return auth;

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'لا توجد بطولة نشطة.' };

      const approved = this.db
        .prepare('SELECT * FROM players WHERE tournament_id = ? AND status = ? ORDER BY id ASC')
        .all(tournament.id, PlayerStatus.APPROVED)
        .map(mapPlayer);

      if (approved.length < 2) {
        return { ok: false, status: 400, error: 'يجب اعتماد لاعبين اثنين على الأقل لإجراء القرعة.' };
      }

      this.db.prepare('DELETE FROM match_reminders WHERE tournament_id = ?').run(tournament.id);
      this.db.prepare('DELETE FROM matches WHERE tournament_id = ?').run(tournament.id);
      this.db.prepare('DELETE FROM tournament_groups WHERE tournament_id = ?').run(tournament.id);
      this.db.prepare('DELETE FROM race_results WHERE tournament_id = ?').run(tournament.id);
      this.db.prepare('DELETE FROM races WHERE tournament_id = ?').run(tournament.id);

      if (
        tournament.format === TournamentFormat.RACE_POINTS ||
        tournament.format === TournamentFormat.RACE_QUALIFIERS_FINAL
      ) {
        const stage =
          tournament.format === TournamentFormat.RACE_QUALIFIERS_FINAL ? RaceStage.QUALIFIER : RaceStage.REGULAR;
        const firstTitle =
          tournament.format === TournamentFormat.RACE_QUALIFIERS_FINAL ? 'سباق التصفيات 1' : 'السباق 1';
        this.db
          .prepare('INSERT INTO races (tournament_id, race_number, title, stage, track_name, is_completed, created_at) VALUES (?, 1, ?, ?, ?, 0, ?)')
          .run(tournament.id, firstTitle, stage, '', Date.now());
        this.db
          .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1, champion_player_id = NULL WHERE id = ?')
          .run(TournamentStatus.GROUP_STAGE, tournament.id);
        this.logAudit(auth.session.rawAdmin, tournament.id, 'RUN_DRAW', `بدء بطولة السباقات وتجهيز ${firstTitle}`);
        return { ok: true, status: 200, messageAr: `تم اعتماد المتسابقين وفتح ${firstTitle} بنجاح!` };
      }

      if (tournament.format === TournamentFormat.GROUPS_KNOCKOUT) {
        const gCount = Math.max(1, Math.min(tournament.groupCount, approved.length));
        const insertedGroups = [];
        for (let i = 0; i < gCount; i++) {
          const name = groupDisplayName(i);
          const info = this.db
            .prepare('INSERT INTO tournament_groups (tournament_id, name, display_order) VALUES (?, ?, ?)')
            .run(tournament.id, name, i);
          insertedGroups.push({ id: Number(info.lastInsertRowid), tournamentId: tournament.id, name, displayOrder: i });
        }

        let updatedPlayers;
        if (tournament.drawMode === DrawMode.MANUAL && Object.keys(manualGroupAssignments).length > 0) {
          updatedPlayers = approved.map((p, idx) => {
            const rawIdx = manualGroupAssignments[String(p.id)] ?? manualGroupAssignments[p.id];
            const targetIdx = Math.max(0, Math.min(gCount - 1, Number.isFinite(Number(rawIdx)) ? Number(rawIdx) : idx % gCount));
            return { ...p, groupId: insertedGroups[targetIdx].id, seedOrder: idx + 1 };
          });
        } else {
          updatedPlayers = distributePlayersIntoGroups(approved, insertedGroups, true);
        }

        const updatePlayerStmt = this.db.prepare('UPDATE players SET group_id = ?, seed_order = ? WHERE id = ?');
        for (const p of updatedPlayers) {
          updatePlayerStmt.run(p.groupId, p.seedOrder, p.id);
        }

        for (const group of insertedGroups) {
          const gPlayerIds = updatedPlayers.filter((p) => p.groupId === group.id).map((p) => p.id);
          if (gPlayerIds.length >= 2) {
            const fixtures = generateRoundRobinMatches({
              tournamentId: tournament.id,
              stage: MatchStage.GROUP,
              groupId: group.id,
              playerIds: gPlayerIds
            });
            for (const f of fixtures) this.insertMatchRow(f);
          }
        }

        this.db
          .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1, champion_player_id = NULL WHERE id = ?')
          .run(TournamentStatus.GROUP_STAGE, tournament.id);

        return { ok: true, status: 200, messageAr: 'تم إجراء قرعة المجموعات وتوليد جدول المباريات بنجاح!' };
      }

      if (tournament.format === TournamentFormat.LEAGUE_KNOCKOUT) {
        let ordered;
        if (tournament.drawMode === DrawMode.MANUAL && manualKnockoutOrder.length > 0) {
          const byId = new Map(approved.map((p) => [p.id, p]));
          const chosen = manualKnockoutOrder.map((id) => byId.get(Number(id))).filter(Boolean);
          const chosenSet = new Set(chosen.map((p) => p.id));
          ordered = [...chosen, ...approved.filter((p) => !chosenSet.has(p.id))];
        } else {
          ordered = shuffleArray(approved);
        }

        const stmt = this.db.prepare('UPDATE players SET group_id = NULL, seed_order = ? WHERE id = ?');
        ordered.forEach((p, idx) => stmt.run(idx + 1, p.id));

        const fixtures = generateRoundRobinMatches({
          tournamentId: tournament.id,
          stage: MatchStage.LEAGUE,
          groupId: null,
          playerIds: ordered.map((p) => p.id)
        });
        for (const f of fixtures) this.insertMatchRow(f);

        this.db
          .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1, champion_player_id = NULL WHERE id = ?')
          .run(TournamentStatus.GROUP_STAGE, tournament.id);

        return { ok: true, status: 200, messageAr: 'تم توليد جدول الدوري بنجاح!' };
      }

      // DIRECT_KNOCKOUT
      let orderedIds;
      if (tournament.drawMode === DrawMode.MANUAL && manualKnockoutOrder.length > 0) {
        const validSet = new Set(approved.map((p) => p.id));
        const chosen = manualKnockoutOrder.map(Number).filter((id) => validSet.has(id));
        const chosenSet = new Set(chosen);
        orderedIds = [...chosen, ...approved.map((p) => p.id).filter((id) => !chosenSet.has(id))].slice(0, 64);
      } else {
        orderedIds = shuffleArray(approved).map((p) => p.id).slice(0, 64);
      }
      const padded = distributeSeededSlotsWithByes(orderedIds);
      this.db.prepare('UPDATE players SET group_id = NULL WHERE tournament_id = ?').run(tournament.id);
      this.insertLinkedKnockoutBracket(tournament, padded);
      this.db
        .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1, champion_player_id = NULL WHERE id = ?')
        .run(TournamentStatus.KNOCKOUT_STAGE, tournament.id);

      return { ok: true, status: 200, messageAr: 'تم إنشاء مخطط الأدوار الإقصائية المباشرة!' };
    });

    if (res.ok) this.emitChange('draw_completed');
    return res;
  }

  generateKnockoutFromStandings(rawToken, tournamentId) {
    const auth = this.requirePermission(rawToken, 'RUN_DRAW');
    if (!auth.ok) return auth;

    const res = this.withTx(() => {
      const state = this.getPublicState(Number(tournamentId));
      const tournament = state.tournament;
      if (!tournament) return { ok: false, status: 404, error: 'لا توجد بطولة نشطة.' };

      let seededSlots = [];
      if (tournament.format === TournamentFormat.GROUPS_KNOCKOUT) {
        if (!state.groupsWithStandings.length) {
          return { ok: false, status: 400, error: 'لا توجد مجموعات لتأهيل اللاعبين.' };
        }
        seededSlots = buildKnockoutSeedPairsFromGroups(
          state.groupsWithStandings.map((g) => g.standings),
          tournament.qualifiersPerGroup
        );
      } else if (tournament.format === TournamentFormat.LEAGUE_KNOCKOUT) {
        const topCount = Math.max(2, Math.min(64, tournament.qualifiersPerGroup));
        const topIds = state.leagueStandings.slice(0, topCount).map((r) => r.player.id);
        if (topIds.length < 2) {
          return { ok: false, status: 400, error: 'يلزم تأهل لاعبين اثنين على الأقل.' };
        }
        const bracketSize = Math.min(64, nextPowerOfTwo(topIds.length));
        if (topIds.length === bracketSize || topIds.length === bracketSize - 1) {
          let left = 0;
          let right = bracketSize - 1;
          while (left < right) {
            seededSlots.push(topIds[left] ?? null, topIds[right] ?? null);
            left += 1;
            right -= 1;
          }
        } else {
          seededSlots = distributeSeededSlotsWithByes(topIds);
        }
      } else {
        return { ok: false, status: 400, error: 'البطولة بنظام الإقصائيات المباشرة بالفعل.' };
      }

      if (seededSlots.filter((id) => id != null).length < 2) {
        return { ok: false, status: 400, error: 'عدد المتأهلين غير كافٍ لبدء الأدوار الإقصائية.' };
      }

      this.db
        .prepare('DELETE FROM matches WHERE tournament_id = ? AND stage NOT IN (?, ?)')
        .run(tournament.id, MatchStage.GROUP, MatchStage.LEAGUE);

      this.insertLinkedKnockoutBracket(tournament, seededSlots);
      this.db
        .prepare('UPDATE tournaments SET status = ?, champion_player_id = NULL WHERE id = ?')
        .run(TournamentStatus.KNOCKOUT_STAGE, tournament.id);

      return { ok: true, status: 200, messageAr: 'تم تأهيل المتصدرين وبناء مخطط الأدوار الإقصائية بنجاح!' };
    });

    if (res.ok) this.emitChange('knockout_generated');
    return res;
  }

  propagateWinnerAndResetIfChanged(nextMatchId, slot, oldWinnerId, newWinnerId) {
    const nextRow = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(nextMatchId);
    if (!nextRow) return;
    const nextMatch = mapMatch(nextRow);
    const winnerChanged = oldWinnerId !== newWinnerId;

    const nextP1 = slot === 1 ? newWinnerId : nextMatch.player1Id;
    const nextP2 = slot === 2 ? newWinnerId : nextMatch.player2Id;

    if (winnerChanged) {
      const previousNextWinner = nextMatch.winnerId;
      this.db
        .prepare(`
          UPDATE matches SET
            player1_id = ?, player2_id = ?,
            leg1_score1 = NULL, leg1_score2 = NULL,
            leg2_score1 = NULL, leg2_score2 = NULL,
            penalty_score1 = NULL, penalty_score2 = NULL,
            is_completed = 0, winner_id = NULL
          WHERE id = ?
        `)
        .run(nextP1 ?? null, nextP2 ?? null, nextMatch.id);

      if (nextMatch.stage === MatchStage.FINAL) {
        this.db
          .prepare('UPDATE tournaments SET champion_player_id = NULL, status = ? WHERE id = ?')
          .run(TournamentStatus.KNOCKOUT_STAGE, nextMatch.tournamentId);
      }

      if (nextMatch.nextMatchId != null) {
        this.propagateWinnerAndResetIfChanged(
          nextMatch.nextMatchId,
          nextMatch.nextMatchSlot,
          previousNextWinner,
          null
        );
      }
    } else {
      this.db
        .prepare('UPDATE matches SET player1_id = ?, player2_id = ? WHERE id = ?')
        .run(nextP1 ?? null, nextP2 ?? null, nextMatch.id);
    }
  }

  syncThirdPlaceParticipant(match, newWinnerId) {
    if (match.stage !== MatchStage.SEMI_FINAL) return;
    const thirdRow = this.db
      .prepare('SELECT * FROM matches WHERE tournament_id = ? AND stage = ? LIMIT 1')
      .get(match.tournamentId, MatchStage.THIRD_PLACE);
    if (!thirdRow) return;
    const thirdMatch = mapMatch(thirdRow);
    const slot = match.bracketIndex === 0 ? 1 : 2;
    let loserId = null;
    if (newWinnerId != null && match.player1Id != null && match.player2Id != null) {
      loserId = newWinnerId === match.player1Id ? match.player2Id : match.player1Id;
    }
    const nextP1 = slot === 1 ? loserId : thirdMatch.player1Id;
    const nextP2 = slot === 2 ? loserId : thirdMatch.player2Id;
    const changed = nextP1 !== thirdMatch.player1Id || nextP2 !== thirdMatch.player2Id;
    if (changed) {
      this.db
        .prepare(`
          UPDATE matches SET
            player1_id = ?, player2_id = ?,
            leg1_score1 = NULL, leg1_score2 = NULL,
            leg2_score1 = NULL, leg2_score2 = NULL,
            penalty_score1 = NULL, penalty_score2 = NULL,
            is_completed = 0, is_walkover = 0, walkover_reason = NULL, winner_id = NULL
          WHERE id = ?
        `)
        .run(nextP1 ?? null, nextP2 ?? null, thirdMatch.id);
    }
  }

  updateMatchScore(rawToken, matchId, payload) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    const toIntOrNull = (val) => (val === null || val === undefined || val === '' ? null : Number(val));
    const leg1S1 = toIntOrNull(payload.leg1Score1);
    const leg1S2 = toIntOrNull(payload.leg1Score2);
    const leg2S1 = toIntOrNull(payload.leg2Score1);
    const leg2S2 = toIntOrNull(payload.leg2Score2);
    const pen1 = toIntOrNull(payload.penaltyScore1);
    const pen2 = toIntOrNull(payload.penaltyScore2);

    const nums = [leg1S1, leg1S2, leg2S1, leg2S2, pen1, pen2];
    if (nums.some((n) => n !== null && (!Number.isInteger(n) || n < 0))) {
      return { ok: false, status: 400, error: 'قيم النتيجة غير صالحة.' };
    }

    const res = this.withTx(() => {
      const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
      if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
      const match = mapMatch(row);

      const resolution = resolveMatchResult({ match, leg1S1, leg1S2, leg2S1, leg2S2, pen1, pen2 });
      if (!resolution.ok) {
        return { ok: false, status: 400, error: resolution.error };
      }

      const oldWinnerId = match.winnerId;
      this.db
        .prepare(`
          UPDATE matches SET
            leg1_score1 = ?, leg1_score2 = ?,
            leg2_score1 = ?, leg2_score2 = ?,
            penalty_score1 = ?, penalty_score2 = ?,
            is_completed = ?, is_walkover = 0, walkover_reason = NULL, winner_id = ?
          WHERE id = ?
        `)
        .run(
          leg1S1,
          leg1S2,
          match.isTwoLegged ? leg2S1 : null,
          match.isTwoLegged ? leg2S2 : null,
          pen1,
          pen2,
          resolution.isCompleted ? 1 : 0,
          resolution.winnerId ?? null,
          match.id
        );

      if (resolution.isCompleted) {
        this.db.prepare('DELETE FROM match_reminders WHERE match_id = ?').run(match.id);
      }

      if (match.nextMatchId != null) {
        this.propagateWinnerAndResetIfChanged(match.nextMatchId, match.nextMatchSlot, oldWinnerId, resolution.winnerId ?? null);
      }
      this.syncThirdPlaceParticipant(match, resolution.winnerId ?? null);

      if (match.stage === MatchStage.FINAL) {
        const t = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(match.tournamentId));
        if (t) {
          if (!resolution.isCompleted) {
            this.db
              .prepare('UPDATE tournaments SET champion_player_id = NULL, status = ? WHERE id = ?')
              .run(TournamentStatus.KNOCKOUT_STAGE, t.id);
          } else if (resolution.winnerId != null && t.championPlayerId != null && t.championPlayerId !== resolution.winnerId) {
            this.db.prepare('UPDATE tournaments SET champion_player_id = ? WHERE id = ?').run(resolution.winnerId, t.id);
          }
        }
      }

      this.logAudit(
        auth.session.rawAdmin,
        match.tournamentId,
        'UPDATE_SCORE',
        `تحديث نتيجة مباراة #${match.id} (${leg1S1 ?? '-'} : ${leg1S2 ?? '-'})`
      );
      return { ok: true, status: 200, messageAr: 'تم حفظ النتيجة وتحديث المخطط بنجاح.' };
    });

    if (res.ok) this.emitChange('match_updated');
    return res;
  }

  updateKnockoutMatchWinner(rawToken, matchId, winnerPlayerId) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    const chosenWinnerId = winnerPlayerId == null ? null : Number(winnerPlayerId);

    const res = this.withTx(() => {
      const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
      if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
      const match = mapMatch(row);

      if (match.stage === MatchStage.GROUP || match.stage === MatchStage.LEAGUE) {
        return { ok: false, status: 400, error: 'تحديث المتأهل المباشر متاح لمباريات الأدوار الإقصائية فقط.' };
      }
      if (chosenWinnerId != null && (match.player1Id == null || match.player2Id == null)) {
        return { ok: false, status: 400, error: 'لا يمكن تحديد الفائز قبل اكتمال طرفي المواجهة.' };
      }
      if (chosenWinnerId != null && chosenWinnerId !== match.player1Id && chosenWinnerId !== match.player2Id) {
        return { ok: false, status: 400, error: 'اللاعب المختار ليس طرفاً في هذه المواجهة.' };
      }

      let keepScores = false;
      if (chosenWinnerId != null && match.leg1Score1 != null && match.leg1Score2 != null) {
        const r = resolveMatchResult({
          match,
          leg1S1: match.leg1Score1,
          leg1S2: match.leg1Score2,
          leg2S1: match.leg2Score1,
          leg2S2: match.leg2Score2,
          pen1: match.penaltyScore1,
          pen2: match.penaltyScore2
        });
        keepScores = r.ok && r.isCompleted && r.winnerId === chosenWinnerId;
      }

      const oldWinnerId = match.winnerId;
      this.db
        .prepare(`
          UPDATE matches SET
            leg1_score1 = ?, leg1_score2 = ?,
            leg2_score1 = ?, leg2_score2 = ?,
            penalty_score1 = ?, penalty_score2 = ?,
            is_completed = ?, winner_id = ?
          WHERE id = ?
        `)
        .run(
          keepScores ? match.leg1Score1 : null,
          keepScores ? match.leg1Score2 : null,
          keepScores && match.isTwoLegged ? match.leg2Score1 : null,
          keepScores && match.isTwoLegged ? match.leg2Score2 : null,
          keepScores ? match.penaltyScore1 : null,
          keepScores ? match.penaltyScore2 : null,
          chosenWinnerId != null ? 1 : 0,
          chosenWinnerId,
          match.id
        );

      if (match.nextMatchId != null) {
        this.propagateWinnerAndResetIfChanged(match.nextMatchId, match.nextMatchSlot, oldWinnerId, chosenWinnerId);
      }
      this.syncThirdPlaceParticipant(match, chosenWinnerId);

      if (match.stage === MatchStage.FINAL) {
        if (chosenWinnerId == null) {
          this.db
            .prepare('UPDATE tournaments SET champion_player_id = NULL, status = ? WHERE id = ?')
            .run(TournamentStatus.KNOCKOUT_STAGE, match.tournamentId);
        } else {
          this.db
            .prepare('UPDATE tournaments SET champion_player_id = ?, status = ? WHERE id = ?')
            .run(chosenWinnerId, TournamentStatus.COMPLETED, match.tournamentId);
        }
      }

      const msg =
        chosenWinnerId == null
          ? 'تم إلغاء اعتماد الفائز وإعادة فتح المواجهة.'
          : match.stage === MatchStage.FINAL
          ? 'تم اعتماد الفائز بالنهائي وتتويجه بطلاً للبطولة!'
          : 'تم تحديث الفائز وتأهيله للدور التالي بنجاح.';
      this.logAudit(auth.session.rawAdmin, match.tournamentId, 'SELECT_WINNER', msg);
      return { ok: true, status: 200, messageAr: msg };
    });

    if (res.ok) this.emitChange('match_updated');
    return res;
  }

  autoScheduleMatches(rawToken, tournamentId, { startAtMillis, intervalMinutes = 30, onlyUnscheduled = false } = {}) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    const baseStart = Number.isFinite(Number(startAtMillis)) ? Number(startAtMillis) : Date.now() + 15 * 60_000;
    const stepMinutes = Math.max(5, Math.min(240, Number(intervalMinutes) || 30));

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const candidates = this.db
        .prepare('SELECT * FROM matches WHERE tournament_id = ? AND is_completed = 0 ORDER BY round_number ASC, bracket_index ASC, id ASC')
        .all(tournament.id)
        .filter((m) => (!onlyUnscheduled ? true : m.scheduled_at_millis == null));

      if (candidates.length === 0) {
        return { ok: false, status: 400, error: 'لا توجد مباريات غير مكتملة لتحديد مواعيدها.' };
      }

      const stmt = this.db.prepare('UPDATE matches SET scheduled_at_millis = ?, scheduled_label = ? WHERE id = ?');
      candidates.forEach((m, idx) => {
        const ts = baseStart + idx * stepMinutes * 60_000;
        const label = new Date(ts).toLocaleString('ar-EG', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        stmt.run(ts, label, m.id);
      });

      this.logAudit(
        auth.session.rawAdmin,
        tournament.id,
        'AUTO_SCHEDULE',
        `جدولة ${candidates.length} مباراة تلقائياً (كل ${stepMinutes} دقيقة)`
      );
      return {
        ok: true,
        status: 200,
        scheduledCount: candidates.length,
        messageAr: `تم تحديد مواعيد ${candidates.length} مباراة تلقائياً (كل ${stepMinutes} دقيقة).`
      };
    });

    if (res.ok) this.emitChange('match_updated');
    return res;
  }

  toggleMatchCheckIn(matchId, slot) {
    const slotNum = Number(slot);
    if (slotNum !== 1 && slotNum !== 2) {
      return { ok: false, status: 400, error: 'طرف المباراة غير صالح.' };
    }
    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
    if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
    if (row.is_completed) return { ok: false, status: 400, error: 'المباراة منتهية بالفعل.' };
    if (row.player1_id == null || row.player2_id == null) {
      return { ok: false, status: 400, error: 'بانتظار تحديد طرفي المباراة.' };
    }

    const col = slotNum === 1 ? 'p1_checked_in' : 'p2_checked_in';
    const nextVal = row[col] ? 0 : 1;
    this.db.prepare(`UPDATE matches SET ${col} = ? WHERE id = ?`).run(nextVal, row.id);
    this.emitChange('match_updated');
    return {
      ok: true,
      status: 200,
      checkedIn: Boolean(nextVal),
      messageAr: nextVal ? 'تم تأكيد جاهزية اللاعب ✓' : 'تم إلغاء حالة الجاهزية.'
    };
  }

  voteMatchPrediction(matchId, slot) {
    const slotNum = Number(slot);
    if (slotNum !== 1 && slotNum !== 2) {
      return { ok: false, status: 400, error: 'خيار التصويت غير صالح.' };
    }
    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
    if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
    if (row.is_completed) return { ok: false, status: 400, error: 'تم إغلاق التصويت بانتهاء المباراة.' };
    if (row.player1_id == null || row.player2_id == null) {
      return { ok: false, status: 400, error: 'بانتظار تحديد طرفي المباراة.' };
    }

    const col = slotNum === 1 ? 'votes_p1' : 'votes_p2';
    this.db.prepare(`UPDATE matches SET ${col} = COALESCE(${col}, 0) + 1 WHERE id = ?`).run(row.id);
    this.emitChange('match_updated');
    return { ok: true, status: 200, messageAr: 'تم تسجيل توقعك بنجاح!' };
  }

  submitMatchDispute(matchId, { submittedBy, note, screenshotUrl = null } = {}) {
    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
    if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
    const cleanBy = String(submittedBy || '').trim().slice(0, 60);
    const cleanNote = String(note || '').trim().slice(0, 500);
    if (!cleanBy || !cleanNote) {
      return { ok: false, status: 400, error: 'يرجى إدخال اسم مقدّم الطعن وتفاصيل النتيجة.' };
    }
    const cleanUrl = screenshotUrl ? String(screenshotUrl).trim().slice(0, 300) : null;

    this.db
      .prepare(`
        UPDATE matches SET
          dispute_status = 'OPEN',
          dispute_submitted_by = ?,
          dispute_note = ?,
          dispute_screenshot_url = ?,
          dispute_resolution_note = NULL
        WHERE id = ?
      `)
      .run(cleanBy, cleanNote, cleanUrl, row.id);

    this.emitChange('match_updated');
    return { ok: true, status: 200, messageAr: 'تم إرسال الإثبات / الطعن لمراجعة المشرفين.' };
  }

  resolveMatchDispute(rawToken, matchId, { resolutionNote = '' } = {}) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
    if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };

    const cleanNote = String(resolutionNote || '').trim().slice(0, 300) || 'تمت المراجعة وحسم النتيجة من المشرف';
    this.db
      .prepare("UPDATE matches SET dispute_status = 'RESOLVED', dispute_resolution_note = ? WHERE id = ?")
      .run(cleanNote, row.id);

    this.logAudit(auth.session.rawAdmin, row.tournament_id, 'RESOLVE_DISPUTE', `حسم طعن المباراة #${row.id}: ${cleanNote}`);
    this.emitChange('match_updated');
    return { ok: true, status: 200, messageAr: 'تم حسم الطعن وإغلاقه بنجاح.' };
  }

  applyMatchWalkover(rawToken, matchId, { winnerSlot, reason = '' } = {}) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    const slotNum = Number(winnerSlot);
    if (slotNum !== 1 && slotNum !== 2) {
      return { ok: false, status: 400, error: 'يرجى اختيار الطرف الفائز بالانسحاب.' };
    }

    const res = this.withTx(() => {
      const row = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
      if (!row) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
      const match = mapMatch(row);
      if (match.player1Id == null || match.player2Id == null) {
        return { ok: false, status: 400, error: 'لا يمكن احتساب انسحاب قبل تحديد طرفي المباراة.' };
      }

      const winnerId = slotNum === 1 ? match.player1Id : match.player2Id;
      const s1 = slotNum === 1 ? 3 : 0;
      const s2 = slotNum === 2 ? 3 : 0;
      const cleanReason = String(reason || '').trim().slice(0, 120) || 'عدم الحضور في الموعد';
      const oldWinnerId = match.winnerId;

      this.db
        .prepare(`
          UPDATE matches SET
            leg1_score1 = ?, leg1_score2 = ?,
            leg2_score1 = NULL, leg2_score2 = NULL,
            penalty_score1 = NULL, penalty_score2 = NULL,
            is_completed = 1, is_walkover = 1, walkover_reason = ?,
            winner_id = ?
          WHERE id = ?
        `)
        .run(s1, s2, cleanReason, winnerId, match.id);

      this.db.prepare('DELETE FROM match_reminders WHERE match_id = ?').run(match.id);
      if (match.nextMatchId != null) {
        this.propagateWinnerAndResetIfChanged(match.nextMatchId, match.nextMatchSlot, oldWinnerId, winnerId);
      }
      this.syncThirdPlaceParticipant(match, winnerId);

      if (match.stage === MatchStage.FINAL) {
        this.db
          .prepare('UPDATE tournaments SET champion_player_id = ?, status = ? WHERE id = ?')
          .run(winnerId, TournamentStatus.COMPLETED, match.tournamentId);
      }

      this.logAudit(
        auth.session.rawAdmin,
        match.tournamentId,
        'WALKOVER',
        `احتساب فوز بالانسحاب (3-0) في المباراة #${match.id}: ${cleanReason}`
      );
      return { ok: true, status: 200, messageAr: 'تم احتساب الفوز بالانسحاب (3-0) وتحديث الجدول.' };
    });

    if (res.ok) this.emitChange('match_updated');
    return res;
  }

  crownChampion(rawToken, tournamentId, playerId) {
    const auth = this.requirePermission(rawToken, 'CROWN_CHAMPION');
    if (!auth.ok) return auth;

    const tRow = this.db.prepare('SELECT id FROM tournaments WHERE id = ?').get(Number(tournamentId));
    if (!tRow) return { ok: false, status: 404, error: 'لا توجد بطولة نشطة.' };

    const chosenId = playerId == null ? null : Number(playerId);
    if (chosenId != null) {
      const p = this.db
        .prepare('SELECT id FROM players WHERE id = ? AND tournament_id = ?')
        .get(chosenId, Number(tournamentId));
      if (!p) return { ok: false, status: 404, error: 'اللاعب غير موجود في هذه البطولة.' };
    }

    this.db
      .prepare('UPDATE tournaments SET champion_player_id = ?, status = ? WHERE id = ?')
      .run(chosenId, chosenId != null ? TournamentStatus.COMPLETED : TournamentStatus.KNOCKOUT_STAGE, Number(tournamentId));

    this.emitChange('champion_updated');
    return {
      ok: true,
      status: 200,
      messageAr: chosenId != null ? 'تم تتويج بطل البطولة وإعلانه للجميع!' : 'تم إلغاء اعتماد البطل لإعادة المراجعة.'
    };
  }

  createRace(rawToken, tournamentId, { title, stage, trackName = '' } = {}) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (!hasPermission(auth.session.rawAdmin, 'EDIT_SCORES') && !hasPermission(auth.session.rawAdmin, 'RUN_DRAW')) {
      return { ok: false, status: 403, error: 'ليس لديك صلاحية إضافة سباقات.' };
    }

    const res = this.withTx(() => {
      const tournament = mapTournament(this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(Number(tournamentId)));
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const maxNum = this.db
        .prepare('SELECT COALESCE(MAX(race_number), 0) AS m FROM races WHERE tournament_id = ?')
        .get(tournament.id).m;
      const raceNumber = Number(maxNum) + 1;
      const safeStage = Object.values(RaceStage).includes(stage)
        ? stage
        : tournament.format === TournamentFormat.RACE_QUALIFIERS_FINAL
          ? RaceStage.QUALIFIER
          : RaceStage.REGULAR;
      const cleanTitle =
        String(title || '').trim().slice(0, 80) ||
        (safeStage === RaceStage.FINAL
          ? 'السباق النهائي'
          : safeStage === RaceStage.QUALIFIER
            ? `سباق التصفيات ${raceNumber}`
            : `السباق ${raceNumber}`);
      const cleanTrack = String(trackName || '').trim().slice(0, 80);

      const info = this.db
        .prepare(`
          INSERT INTO races (tournament_id, race_number, title, stage, track_name, is_completed, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `)
        .run(tournament.id, raceNumber, cleanTitle, safeStage, cleanTrack, Date.now());

      if (safeStage === RaceStage.FINAL) {
        this.db
          .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1 WHERE id = ?')
          .run(TournamentStatus.KNOCKOUT_STAGE, tournament.id);
      } else if (
        tournament.status === TournamentStatus.REGISTRATION_OPEN ||
        tournament.status === TournamentStatus.REGISTRATION_CLOSED
      ) {
        this.db
          .prepare('UPDATE tournaments SET status = ?, is_registration_closed_manual = 1 WHERE id = ?')
          .run(TournamentStatus.GROUP_STAGE, tournament.id);
      }

      const createdRow = this.db.prepare('SELECT * FROM races WHERE id = ?').get(info.lastInsertRowid);
      const race = mapRace(createdRow, []);
      this.logAudit(auth.session.rawAdmin, tournament.id, 'CREATE_RACE', `إضافة سباق: ${cleanTitle}`);
      return { ok: true, status: 201, race, messageAr: `تمت إضافة (${cleanTitle}) بنجاح.` };
    });

    if (res.ok) this.emitChange('race_updated');
    return res;
  }

  saveRaceResults(rawToken, raceId, { entries = [], trackName, title } = {}) {
    const auth = this.requirePermission(rawToken, 'EDIT_SCORES');
    if (!auth.ok) return auth;

    if (!Array.isArray(entries) || entries.length === 0) {
      return { ok: false, status: 400, error: 'يرجى إدخال نتائج المتسابقين للسباق.' };
    }

    const res = this.withTx(() => {
      const raceRow = this.db.prepare('SELECT * FROM races WHERE id = ?').get(Number(raceId));
      if (!raceRow) return { ok: false, status: 404, error: 'السباق غير موجود.' };

      const tournament = mapTournament(
        this.db.prepare('SELECT * FROM tournaments WHERE id = ?').get(raceRow.tournament_id)
      );
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const approvedIds = new Set(
        this.db
          .prepare('SELECT id FROM players WHERE tournament_id = ? AND status = ?')
          .all(tournament.id, PlayerStatus.APPROVED)
          .map((p) => p.id)
      );

      const pointsConfig = parseRacingPointsConfig(tournament.racingPointsConfig);
      const seenPlayers = new Set();
      const cleaned = [];

      for (const item of entries) {
        const pid = Number(item.playerId);
        const pos = Number(item.position);
        const dnf = Boolean(item.dnf);
        if (!approvedIds.has(pid)) {
          return { ok: false, status: 400, error: 'أحد المتسابقين غير معتمد في هذه البطولة.' };
        }
        if (seenPlayers.has(pid)) {
          return { ok: false, status: 400, error: 'لا يمكن تكرار المتسابق في نفس السباق.' };
        }
        if (!Number.isInteger(pos) || pos < 1) {
          return { ok: false, status: 400, error: 'ترتيب المراكز يجب أن يكون رقماً صحيحاً يبدأ من 1.' };
        }
        seenPlayers.add(pid);
        const pointsAwarded = dnf ? 0 : (pointsConfig[pos - 1] ?? 0);
        cleaned.push({
          playerId: pid,
          position: pos,
          pointsAwarded,
          bestLapOrTime: String(item.bestLapOrTime || '').trim().slice(0, 40),
          dnf: dnf ? 1 : 0
        });
      }

      this.db.prepare('DELETE FROM race_results WHERE race_id = ?').run(raceRow.id);
      const insertStmt = this.db.prepare(`
        INSERT INTO race_results (race_id, tournament_id, player_id, position, points_awarded, best_lap_or_time, dnf)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const row of cleaned) {
        insertStmt.run(
          raceRow.id,
          tournament.id,
          row.playerId,
          row.position,
          row.pointsAwarded,
          row.bestLapOrTime,
          row.dnf
        );
      }

      const nextTitle = title !== undefined && String(title).trim() ? String(title).trim().slice(0, 80) : raceRow.title;
      const nextTrack = trackName !== undefined ? String(trackName).trim().slice(0, 80) : raceRow.track_name;
      this.db
        .prepare('UPDATE races SET title = ?, track_name = ?, is_completed = 1 WHERE id = ?')
        .run(nextTitle, nextTrack, raceRow.id);

      const resultRows = this.db
        .prepare('SELECT * FROM race_results WHERE race_id = ? ORDER BY position ASC, id ASC')
        .all(raceRow.id)
        .map(mapRaceResult);
      const updatedRace = mapRace(
        this.db.prepare('SELECT * FROM races WHERE id = ?').get(raceRow.id),
        resultRows
      );

      this.logAudit(
        auth.session.rawAdmin,
        tournament.id,
        'SAVE_RACE_RESULTS',
        `حفظ نتائج ${nextTitle} وتحديث ترتيب النقاط (${cleaned.length} متسابق)`
      );
      return { ok: true, status: 200, race: updatedRace, messageAr: 'تم حفظ نتائج السباق وتحديث ترتيب المتسابقين!' };
    });

    if (res.ok) this.emitChange('race_updated');
    return res;
  }

  generateFinalRaceFromStandings(rawToken, tournamentId, { title, trackName = '', qualifiersCount } = {}) {
    const auth = this.requirePermission(rawToken, 'RUN_DRAW');
    if (!auth.ok) return auth;

    const res = this.withTx(() => {
      const state = this.getPublicState(Number(tournamentId));
      const tournament = state.tournament;
      if (!tournament) return { ok: false, status: 404, error: 'البطولة غير موجودة.' };

      const count = Math.max(2, Math.min(32, Number(qualifiersCount ?? tournament.qualifiersPerGroup) || 4));
      const qualified = (state.racingStandings || []).slice(0, count);
      if (qualified.length < 2) {
        return { ok: false, status: 400, error: 'يلزم وجود متسابقين اثنين على الأقل لتوليد السباق النهائي.' };
      }

      // Remove previous incomplete FINAL race if regenerating
      const oldFinals = this.db
        .prepare('SELECT id FROM races WHERE tournament_id = ? AND stage = ?')
        .all(tournament.id, RaceStage.FINAL);
      for (const f of oldFinals) {
        this.db.prepare('DELETE FROM races WHERE id = ?').run(f.id);
      }

      const maxNum = this.db
        .prepare('SELECT COALESCE(MAX(race_number), 0) AS m FROM races WHERE tournament_id = ?')
        .get(tournament.id).m;
      const raceNumber = Number(maxNum) + 1;
      const cleanTitle = String(title || '').trim().slice(0, 80) || 'السباق النهائي';
      const cleanTrack = String(trackName || '').trim().slice(0, 80);

      const info = this.db
        .prepare(`
          INSERT INTO races (tournament_id, race_number, title, stage, track_name, is_completed, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `)
        .run(tournament.id, raceNumber, cleanTitle, RaceStage.FINAL, cleanTrack, Date.now());
      const raceId = Number(info.lastInsertRowid);

      const insertStmt = this.db.prepare(`
        INSERT INTO race_results (race_id, tournament_id, player_id, position, points_awarded, best_lap_or_time, dnf)
        VALUES (?, ?, ?, ?, 0, '', 0)
      `);
      qualified.forEach((row, idx) => {
        insertStmt.run(raceId, tournament.id, row.player.id, idx + 1);
      });

      this.db
        .prepare('UPDATE tournaments SET status = ?, champion_player_id = NULL WHERE id = ?')
        .run(TournamentStatus.KNOCKOUT_STAGE, tournament.id);

      const results = this.db
        .prepare('SELECT * FROM race_results WHERE race_id = ? ORDER BY position ASC')
        .all(raceId)
        .map(mapRaceResult);
      const race = mapRace(this.db.prepare('SELECT * FROM races WHERE id = ?').get(raceId), results);

      this.logAudit(
        auth.session.rawAdmin,
        tournament.id,
        'GENERATE_FINAL_RACE',
        `تأهيل أفضل ${qualified.length} متسابقين إلى ${cleanTitle}`
      );
      return {
        ok: true,
        status: 201,
        race,
        messageAr: `تم تأهيل أفضل ${qualified.length} متسابقين وإنشاء ${cleanTitle} بنجاح!`
      };
    });

    if (res.ok) this.emitChange('race_updated');
    return res;
  }

  deleteRace(rawToken, raceId) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (
      !hasPermission(auth.session.rawAdmin, 'EDIT_SCORES') &&
      !hasPermission(auth.session.rawAdmin, 'MANAGE_TOURNAMENT')
    ) {
      return { ok: false, status: 403, error: 'ليس لديك صلاحية حذف السباق.' };
    }

    const row = this.db.prepare('SELECT * FROM races WHERE id = ?').get(Number(raceId));
    if (!row) return { ok: false, status: 404, error: 'السباق غير موجود.' };

    this.db.prepare('DELETE FROM races WHERE id = ?').run(row.id);
    this.logAudit(auth.session.rawAdmin, row.tournament_id, 'DELETE_RACE', `حذف السباق: ${row.title}`);
    this.emitChange('race_updated');
    return { ok: true, status: 200, messageAr: 'تم حذف السباق وتحديث الترتيب.' };
  }

  scheduleReminder({ matchId, matchTitle, scheduledAtMillis, leadMinutes = 15 }) {
    const matchRow = this.db.prepare('SELECT * FROM matches WHERE id = ?').get(Number(matchId));
    if (!matchRow) return { ok: false, status: 404, error: 'المباراة غير موجودة.' };
    const match = mapMatch(matchRow);
    if (match.isCompleted) return { ok: false, status: 400, error: 'لا يمكن جدولة تنبيه لمباراة منتهية بالفعل.' };

    const schedMs = Number(scheduledAtMillis);
    const now = Date.now();
    if (!Number.isFinite(schedMs) || schedMs <= now) {
      return { ok: false, status: 400, error: 'يرجى تحديد وقت مستقبلي لموعد المباراة.' };
    }

    const safeLead = Math.max(0, Math.min(180, Number(leadMinutes) || 0));
    const remindAtMillis = Math.max(schedMs - safeLead * 60_000, now + 2_000);
    const stageLabel = MATCH_STAGE_META[match.stage]?.labelAr ?? match.stage;
    const formatted = new Date(schedMs).toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    this.withTx(() => {
      const label = match.scheduledLabel && match.scheduledLabel.trim() ? match.scheduledLabel : formatted;
      this.db
        .prepare('UPDATE matches SET scheduled_at_millis = ?, scheduled_label = ? WHERE id = ?')
        .run(schedMs, label, match.id);
      this.db
        .prepare(`
          INSERT INTO match_reminders (
            match_id, tournament_id, match_title, match_stage_label,
            scheduled_at_millis, remind_at_millis, lead_minutes, is_enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT(match_id) DO UPDATE SET
            match_title = excluded.match_title,
            match_stage_label = excluded.match_stage_label,
            scheduled_at_millis = excluded.scheduled_at_millis,
            remind_at_millis = excluded.remind_at_millis,
            lead_minutes = excluded.lead_minutes,
            is_enabled = 1
        `)
        .run(match.id, match.tournamentId, String(matchTitle || 'مباراة قادمة').slice(0, 100), stageLabel, schedMs, remindAtMillis, safeLead);
    });

    const saved = mapReminder(this.db.prepare('SELECT * FROM match_reminders WHERE match_id = ?').get(match.id));
    this.emitChange('reminder_updated');
    return {
      ok: true,
      status: 200,
      reminder: saved,
      messageAr: 'تم حفظ موعد المباراة والتذكير على الخادم لجميع الأجهزة.'
    };
  }

  cancelReminder(matchId) {
    this.db.prepare('DELETE FROM match_reminders WHERE match_id = ?').run(Number(matchId));
    this.emitChange('reminder_updated');
    return { ok: true, status: 200, messageAr: 'تم إلغاء التنبيه المجدول للمباراة.' };
  }

  exportBackup(rawToken, mediaItems = []) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.rawAdmin.role !== AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 403, error: 'المشرف الرئيسي فقط يمتلك صلاحية تصدير النسخة الاحتياطية الكاملة.' };
    }

    const tournaments = this.db.prepare('SELECT * FROM tournaments ORDER BY id ASC').all();
    const tournamentGroups = this.db.prepare('SELECT * FROM tournament_groups ORDER BY id ASC').all();
    const playerProfiles = this.db.prepare('SELECT * FROM player_profiles ORDER BY id ASC').all();
    const players = this.db.prepare('SELECT * FROM players ORDER BY id ASC').all();
    const matches = this.db.prepare('SELECT * FROM matches ORDER BY id ASC').all();
    const races = this.db.prepare('SELECT * FROM races ORDER BY id ASC').all();
    const raceResults = this.db.prepare('SELECT * FROM race_results ORDER BY id ASC').all();
    const matchReminders = this.db.prepare('SELECT * FROM match_reminders ORDER BY id ASC').all();
    const adminAccounts = this.db.prepare('SELECT * FROM admin_accounts ORDER BY id ASC').all();
    const revokedAdmins = this.db.prepare('SELECT * FROM revoked_admins ORDER BY revoked_at ASC').all();
    const adminAuditLogs = this.db.prepare('SELECT * FROM admin_audit_logs ORDER BY id ASC').all();
    const appMeta = this.db
      .prepare("SELECT key, value FROM app_meta WHERE key != 'server_session_secret' ORDER BY key ASC")
      .all();

    return {
      ok: true,
      status: 200,
      backup: {
        schemaVersion: 4,
        app: 'CP4_ARENA',
        exportedAt: Date.now(),
        tournaments,
        tournamentGroups,
        playerProfiles,
        players,
        matches,
        races,
        raceResults,
        matchReminders,
        adminAccounts,
        revokedAdmins,
        adminAuditLogs,
        appMeta,
        mediaFiles: Array.isArray(mediaItems) ? mediaItems : []
      }
    };
  }

  restoreBackup(rawToken, rawPayload = {}) {
    const auth = this.requirePermission(rawToken, null);
    if (!auth.ok) return auth;
    if (auth.session.rawAdmin.role !== AdminRole.HEAD_ADMIN) {
      return { ok: false, status: 403, error: 'المشرف الرئيسي فقط يمتلك صلاحية استعادة النسخة الاحتياطية.' };
    }

    const backup = rawPayload?.backup && typeof rawPayload.backup === 'object' ? rawPayload.backup : rawPayload;
    if (
      !backup ||
      typeof backup !== 'object' ||
      !Array.isArray(backup.tournaments) ||
      !Array.isArray(backup.players) ||
      !Array.isArray(backup.matches)
    ) {
      return { ok: false, status: 400, error: 'ملف النسخة الاحتياطية غير صالح أو تالف.' };
    }

    const tournamentGroups = Array.isArray(backup.tournamentGroups) ? backup.tournamentGroups : [];
    const playerProfiles = Array.isArray(backup.playerProfiles) ? backup.playerProfiles : [];
    const races = Array.isArray(backup.races) ? backup.races : [];
    const raceResults = Array.isArray(backup.raceResults) ? backup.raceResults : [];
    const matchReminders = Array.isArray(backup.matchReminders) ? backup.matchReminders : [];
    const adminAccounts = Array.isArray(backup.adminAccounts) ? backup.adminAccounts : [];
    const revokedAdmins = Array.isArray(backup.revokedAdmins) ? backup.revokedAdmins : [];
    const adminAuditLogs = Array.isArray(backup.adminAuditLogs) ? backup.adminAuditLogs : [];
    const appMeta = Array.isArray(backup.appMeta) ? backup.appMeta : [];
    const subAdminsRestoredCount = adminAccounts.filter((a) => a.role === AdminRole.SUB_ADMIN).length;

    this.withTx(() => {
      this.db.prepare('DELETE FROM race_results').run();
      this.db.prepare('DELETE FROM races').run();
      this.db.prepare('DELETE FROM match_reminders').run();
      this.db.prepare('DELETE FROM matches').run();
      this.db.prepare('DELETE FROM players').run();
      this.db.prepare('DELETE FROM player_profiles').run();
      this.db.prepare('DELETE FROM tournament_groups').run();
      this.db.prepare('DELETE FROM tournaments').run();
      this.db.prepare('DELETE FROM revoked_tokens').run();
      this.db.prepare('DELETE FROM revoked_admins').run();
      this.db.prepare('DELETE FROM admin_audit_logs').run();
      this.db.prepare('DELETE FROM auth_lockout').run();
      this.db.prepare("DELETE FROM app_meta WHERE key != 'server_session_secret'").run();

      const insertTournament = this.db.prepare(`
        INSERT INTO tournaments (
          id, name, game_title, game_category, score_unit_label, description,
          banner_url, start_date_time, max_participants, format, group_count,
          qualifiers_per_group, draw_mode, knockout_tie_rule, match_duration_minutes,
          target_goals_rule, is_registration_closed_manual, is_third_place_enabled,
          play_mode, team_size, best_of, racing_points_config,
          status, champion_player_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of backup.tournaments) {
        insertTournament.run(
          Number(t.id),
          String(t.name || ''),
          String(t.game_title || 'FIFA 22'),
          String(t.game_category || 'كرة قدم'),
          String(t.score_unit_label || 'هدف'),
          String(t.description || ''),
          t.banner_url ?? null,
          String(t.start_date_time || ''),
          Number(t.max_participants) || 16,
          String(t.format || TournamentFormat.GROUPS_KNOCKOUT),
          Number(t.group_count) || 4,
          Number(t.qualifiers_per_group) || 2,
          String(t.draw_mode || DrawMode.RANDOM),
          String(t.knockout_tie_rule || KnockoutTieRule.SINGLE_MATCH_PENALTIES),
          Number(t.match_duration_minutes) || 12,
          String(t.target_goals_rule || ''),
          t.is_registration_closed_manual ? 1 : 0,
          t.is_third_place_enabled === undefined ? 1 : t.is_third_place_enabled ? 1 : 0,
          String(t.play_mode || PlayMode.SOLO_1V1),
          Math.max(1, Number(t.team_size) || 1),
          [1, 3, 5].includes(Number(t.best_of)) ? Number(t.best_of) : 1,
          typeof t.racing_points_config === 'string' && t.racing_points_config.trim()
            ? t.racing_points_config
            : JSON.stringify(parseRacingPointsConfig(t.racing_points_config)),
          String(t.status || TournamentStatus.REGISTRATION_OPEN),
          t.champion_player_id != null ? Number(t.champion_player_id) : null,
          Number(t.created_at) || Date.now()
        );
      }

      const insertGroup = this.db.prepare(
        'INSERT INTO tournament_groups (id, tournament_id, name, display_order) VALUES (?, ?, ?, ?)'
      );
      for (const g of tournamentGroups) {
        insertGroup.run(Number(g.id), Number(g.tournament_id), String(g.name || ''), Number(g.display_order) || 0);
      }

      const insertProfile = this.db.prepare(`
        INSERT INTO player_profiles (
          id, cp4_id, name, avatar_url, elysium_net_id, xemonet_id, discord_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pp of playerProfiles) {
        insertProfile.run(
          Number(pp.id),
          String(pp.cp4_id || ''),
          String(pp.name || ''),
          pp.avatar_url ?? null,
          String(pp.elysium_net_id || ''),
          String(pp.xemonet_id || ''),
          pp.discord_user_id ? String(pp.discord_user_id) : null,
          Number(pp.created_at) || Date.now()
        );
      }

      const insertPlayer = this.db.prepare(`
        INSERT INTO players (
          id, tournament_id, profile_id, name, elysium_net_id, xemonet_id, avatar_url, level,
          ovr_rating, club_name, status, group_id, seed_order, registered_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of backup.players) {
        insertPlayer.run(
          Number(p.id),
          Number(p.tournament_id),
          p.profile_id != null ? Number(p.profile_id) : null,
          String(p.name || ''),
          String(p.elysium_net_id || ''),
          String(p.xemonet_id || ''),
          p.avatar_url ?? null,
          String(p.level || PlayerLevel.INTERMEDIATE),
          Number(p.ovr_rating) || 81,
          String(p.club_name || ''),
          String(p.status || PlayerStatus.PENDING),
          p.group_id != null ? Number(p.group_id) : null,
          Number(p.seed_order) || 0,
          Number(p.registered_at) || Date.now()
        );
      }

      const insertMatch = this.db.prepare(`
        INSERT INTO matches (
          id, tournament_id, stage, group_id, round_number, bracket_index,
          player1_id, player2_id, leg1_score1, leg1_score2, leg2_score1, leg2_score2,
          penalty_score1, penalty_score2, is_two_legged, is_completed, winner_id,
          next_match_id, next_match_slot, scheduled_label, scheduled_at_millis,
          p1_checked_in, p2_checked_in, votes_p1, votes_p2,
          is_walkover, walkover_reason, dispute_status, dispute_note,
          dispute_submitted_by, dispute_screenshot_url, dispute_resolution_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of backup.matches) {
        insertMatch.run(
          Number(m.id),
          Number(m.tournament_id),
          String(m.stage || MatchStage.GROUP),
          m.group_id != null ? Number(m.group_id) : null,
          Number(m.round_number) || 1,
          Number(m.bracket_index) || 0,
          m.player1_id != null ? Number(m.player1_id) : null,
          m.player2_id != null ? Number(m.player2_id) : null,
          m.leg1_score1 ?? null,
          m.leg1_score2 ?? null,
          m.leg2_score1 ?? null,
          m.leg2_score2 ?? null,
          m.penalty_score1 ?? null,
          m.penalty_score2 ?? null,
          m.is_two_legged ? 1 : 0,
          m.is_completed ? 1 : 0,
          m.winner_id != null ? Number(m.winner_id) : null,
          m.next_match_id != null ? Number(m.next_match_id) : null,
          Number(m.next_match_slot) || 1,
          String(m.scheduled_label || ''),
          m.scheduled_at_millis ?? null,
          m.p1_checked_in ? 1 : 0,
          m.p2_checked_in ? 1 : 0,
          Number(m.votes_p1) || 0,
          Number(m.votes_p2) || 0,
          m.is_walkover ? 1 : 0,
          m.walkover_reason ?? null,
          String(m.dispute_status || 'NONE'),
          m.dispute_note ?? null,
          m.dispute_submitted_by ?? null,
          m.dispute_screenshot_url ?? null,
          m.dispute_resolution_note ?? null
        );
      }

      const insertRace = this.db.prepare(`
        INSERT INTO races (
          id, tournament_id, race_number, title, stage, track_name, is_completed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of races) {
        insertRace.run(
          Number(r.id),
          Number(r.tournament_id),
          Number(r.race_number) || 1,
          String(r.title || 'سباق'),
          String(r.stage || RaceStage.REGULAR),
          String(r.track_name || ''),
          r.is_completed ? 1 : 0,
          Number(r.created_at) || Date.now()
        );
      }

      const insertRaceResult = this.db.prepare(`
        INSERT INTO race_results (
          id, race_id, tournament_id, player_id, position, points_awarded, best_lap_or_time, dnf
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rr of raceResults) {
        insertRaceResult.run(
          Number(rr.id),
          Number(rr.race_id),
          Number(rr.tournament_id),
          Number(rr.player_id),
          Number(rr.position) || 1,
          Number(rr.points_awarded) || 0,
          String(rr.best_lap_or_time || ''),
          rr.dnf ? 1 : 0
        );
      }

      const insertReminder = this.db.prepare(`
        INSERT INTO match_reminders (
          id, match_id, tournament_id, match_title, match_stage_label,
          scheduled_at_millis, remind_at_millis, lead_minutes, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of matchReminders) {
        insertReminder.run(
          Number(r.id),
          Number(r.match_id),
          Number(r.tournament_id),
          String(r.match_title || ''),
          String(r.match_stage_label || ''),
          Number(r.scheduled_at_millis) || Date.now(),
          Number(r.remind_at_millis) || Date.now(),
          Number(r.lead_minutes) || 15,
          r.is_enabled ? 1 : 0
        );
      }

      if (adminAccounts.length > 0) {
        this.db.prepare('DELETE FROM admin_sessions').run();
        this.db.prepare('DELETE FROM admin_accounts').run();
        const insertAdmin = this.db.prepare(`
          INSERT INTO admin_accounts (
            id, username, display_name, role, pin_hash, pin_salt,
            can_manage_tournament, can_manage_players, can_run_draw,
            can_edit_scores, can_crown_champion, permissions_hash,
            pin_updated_at, is_active, last_login_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of adminAccounts) {
          insertAdmin.run(
            Number(a.id),
            String(a.username || ''),
            String(a.display_name || ''),
            String(a.role || AdminRole.SUB_ADMIN),
            String(a.pin_hash || ''),
            String(a.pin_salt || ''),
            a.can_manage_tournament ? 1 : 0,
            a.can_manage_players ? 1 : 0,
            a.can_run_draw ? 1 : 0,
            a.can_edit_scores ? 1 : 0,
            a.can_crown_champion ? 1 : 0,
            String(a.permissions_hash || ''),
            Number(a.pin_updated_at) || 0,
            a.is_active ? 1 : 0,
            a.last_login_at ?? null,
            Number(a.created_at) || Date.now()
          );
        }

        // Issue a fresh session for the restored HEAD_ADMIN so the caller remains authenticated cleanly
        const restoredHead = this.db
          .prepare('SELECT * FROM admin_accounts WHERE role = ? ORDER BY id ASC LIMIT 1')
          .get(AdminRole.HEAD_ADMIN);
        if (restoredHead) {
          const mappedHead = mapAdminRaw(restoredHead);
          const now = Date.now();
          const refreshedToken = signAdminJwt(mappedHead, {
            keepSignedIn: Boolean(auth.session.keepSignedIn),
            ttlMs: SESSION_TTL_PERSISTENT_MS,
            secretOverride: this.db?.sessionSecret
          });
          const refreshedHash = hashSessionToken(refreshedToken, this.db?.sessionSecret);
          this.db
            .prepare(
              'INSERT OR REPLACE INTO admin_sessions (token_hash, admin_id, keep_signed_in, expires_at, created_at) VALUES (?, ?, 1, ?, ?)'
            )
            .run(refreshedHash, mappedHead.id, now + SESSION_TTL_PERSISTENT_MS, now);
          this._lastRestoredSession = {
            token: refreshedToken,
            admin: sanitizeAdminPublic(mappedHead)
          };
        }
      }

      for (const ra of revokedAdmins) {
        this.db
          .prepare('INSERT OR REPLACE INTO revoked_admins (username, revoked_at) VALUES (?, ?)')
          .run(String(ra.username || ''), Number(ra.revoked_at) || Date.now());
      }

      for (const meta of appMeta) {
        if (meta?.key && meta.key !== 'server_session_secret') {
          this.db
            .prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)')
            .run(String(meta.key), String(meta.value ?? ''));
        }
      }

      const insertAudit = this.db.prepare(`
        INSERT INTO admin_audit_logs (
          id, tournament_id, actor_username, actor_display_name, action_type, summary_ar, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const log of adminAuditLogs) {
        insertAudit.run(
          Number(log.id),
          log.tournament_id != null ? Number(log.tournament_id) : null,
          String(log.actor_username || 'admin'),
          String(log.actor_display_name || 'المشرف'),
          String(log.action_type || 'ACTION'),
          String(log.summary_ar || ''),
          Number(log.created_at) || Date.now()
        );
      }

      this.db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_tournament_seeded', '1')").run();
      backfillPlayerProfiles(this.db);
      syncCp4ProfileSequence(this.db);

      for (const table of [
        'tournaments',
        'tournament_groups',
        'player_profiles',
        'players',
        'matches',
        'races',
        'race_results',
        'match_reminders',
        'admin_accounts',
        'admin_audit_logs'
      ]) {
        const maxRow = this.db.prepare(`SELECT COALESCE(MAX(id), 0) AS max_id FROM ${table}`).get();
        this.db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run(table);
        if (maxRow.max_id > 0) {
          this.db.prepare('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(table, maxRow.max_id);
        }
      }
    });

    const restoredSession = this._lastRestoredSession || null;
    this._lastRestoredSession = null;

    this.emitChange('backup_restored');
    return {
      ok: true,
      status: 200,
      ...(restoredSession || {}),
      tournamentsCount: backup.tournaments.length,
      playersCount: backup.players.length,
      matchesCount: backup.matches.length,
      subAdminsCount: subAdminsRestoredCount,
      messageAr: `تمت استعادة البيانات وحسابات المساعدين بنجاح (${backup.tournaments.length} بطولة، ${backup.players.length} لاعب، ${subAdminsRestoredCount} مساعد).`
    };
  }
}
