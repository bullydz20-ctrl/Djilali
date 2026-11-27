export type TournamentFormat =
  | 'GROUPS_KNOCKOUT'
  | 'LEAGUE_KNOCKOUT'
  | 'DIRECT_KNOCKOUT'
  | 'RACE_POINTS'
  | 'RACE_QUALIFIERS_FINAL';
export type PlayMode = 'SOLO_1V1' | 'TEAMS' | 'RACE_POINTS';
export type RaceStage = 'REGULAR' | 'QUALIFIER' | 'FINAL';
export type OnlineCompatibilityStatus = 'OFFICIAL_ONLINE' | 'LOCAL_OR_LAN_ONLY' | 'VERIFY_REQUIRED';
export type DrawMode = 'RANDOM' | 'MANUAL';
export type KnockoutTieRule = 'SINGLE_MATCH_PENALTIES' | 'TWO_LEGS_FINAL_SINGLE';
export type PlayerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PlayerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'PRO' | 'LEGEND';
export type MatchStage =
  | 'GROUP'
  | 'LEAGUE'
  | 'ROUND_OF_64'
  | 'ROUND_OF_32'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'THIRD_PLACE'
  | 'FINAL';
export type AdminRole = 'HEAD_ADMIN' | 'SUB_ADMIN';
export type TournamentStatus =
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'GROUP_STAGE'
  | 'KNOCKOUT_STAGE'
  | 'COMPLETED';

export type AdminPermission =
  | 'MANAGE_TOURNAMENT'
  | 'MANAGE_PLAYERS'
  | 'RUN_DRAW'
  | 'EDIT_SCORES'
  | 'CROWN_CHAMPION';

export interface Tournament {
  id: number;
  name: string;
  gameTitle: string;
  gameCategory: string;
  scoreUnitLabel: string;
  description: string;
  bannerUrl: string | null;
  startDateTime: string;
  maxParticipants: number;
  format: TournamentFormat;
  groupCount: number;
  qualifiersPerGroup: number;
  drawMode: DrawMode;
  knockoutTieRule: KnockoutTieRule;
  matchDurationMinutes: number;
  targetGoalsRule: string;
  isRegistrationClosedManual: boolean;
  isThirdPlaceEnabled?: boolean;
  playMode: PlayMode;
  teamSize: number;
  bestOf: 1 | 3 | 5;
  racingPointsConfig: number[];
  status: TournamentStatus;
  championPlayerId: number | null;
  createdAt: number;
}

export interface RaceResultEntry {
  id: number;
  raceId: number;
  tournamentId: number;
  playerId: number;
  position: number;
  pointsAwarded: number;
  bestLapOrTime: string;
  dnf: boolean;
}

export interface RaceEntry {
  id: number;
  tournamentId: number;
  raceNumber: number;
  title: string;
  stage: RaceStage;
  trackName: string;
  isCompleted: boolean;
  createdAt: number;
  results: RaceResultEntry[];
}

export interface RacingStandingRow {
  rank: number;
  player: Player;
  racesEntered: number;
  wins: number;
  podiums: number;
  totalPoints: number;
  bestPosition: number | null;
  lastPosition: number | null;
  isQualified: boolean;
}

export interface PlayerProfile {
  id: number;
  cp4Id: string;
  name: string;
  avatarUrl: string | null;
  elysiumNetId: string;
  xeMoNetId: string;
  discordUserId: string | null;
  createdAt: number;
  updatedAt?: number;
  tournamentsCount?: number;
}

export interface DiscordGuildMember {
  discordUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  linkedProfileId: number | null;
  linkedCp4Id: string | null;
}

export interface DiscordStatus {
  oauthConfigured: boolean;
  botConfigured: boolean;
  guildIdConfigured: boolean;
}

export interface Player {
  id: number;
  tournamentId: number;
  profileId?: number | null;
  cp4Id?: string | null;
  name: string;
  elysiumNetId: string;
  xeMoNetId?: string;
  discordUserId?: string | null;
  avatarUrl: string | null;
  level: PlayerLevel;
  ovrRating: number;
  clubName: string;
  status: PlayerStatus;
  groupId: number | null;
  seedOrder: number;
  registeredAt: number;
}

export interface TournamentGroup {
  id: number;
  tournamentId: number;
  name: string;
  displayOrder: number;
}

export interface Match {
  id: number;
  tournamentId: number;
  stage: MatchStage;
  groupId: number | null;
  roundNumber: number;
  bracketIndex: number;
  player1Id: number | null;
  player2Id: number | null;
  leg1Score1: number | null;
  leg1Score2: number | null;
  leg2Score1: number | null;
  leg2Score2: number | null;
  penaltyScore1: number | null;
  penaltyScore2: number | null;
  isTwoLegged: boolean;
  isCompleted: boolean;
  winnerId: number | null;
  nextMatchId: number | null;
  nextMatchSlot: number;
  scheduledLabel: string;
  scheduledAtMillis: number | null;
  p1CheckedIn: boolean;
  p2CheckedIn: boolean;
  votesP1: number;
  votesP2: number;
  isWalkover: boolean;
  walkoverReason: string | null;
  disputeStatus: 'NONE' | 'OPEN' | 'RESOLVED';
  disputeNote: string | null;
  disputeSubmittedBy: string | null;
  disputeScreenshotUrl: string | null;
  disputeResolutionNote: string | null;
}

export interface MatchReminder {
  id: number;
  matchId: number;
  tournamentId: number;
  matchTitle: string;
  matchStageLabel: string;
  scheduledAtMillis: number;
  remindAtMillis: number;
  leadMinutes: number;
  isEnabled: boolean;
}

export interface GroupStandingRow {
  player: Player;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isQualified: boolean;
}

export interface GroupWithStandings {
  group: TournamentGroup;
  standings: GroupStandingRow[];
  matches: Match[];
}

export interface PlayerStats {
  player: Player;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  winRatePercent: number;
}

export interface TournamentOverviewStats {
  totalMatches: number;
  completedMatches: number;
  totalGoals: number;
  topScorer: PlayerStats | null;
  bestDefense: PlayerStats | null;
  highestWinRate: PlayerStats | null;
}

export interface AdminDirectoryEntry {
  id: number;
  username: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
}

export interface AdminAccount extends AdminDirectoryEntry {
  canManageTournament: boolean;
  canManagePlayers: boolean;
  canRunDraw: boolean;
  canEditScores: boolean;
  canCrownChampion: boolean;
  lastLoginAt: number | null;
  createdAt: number;
}

export interface LockoutState {
  failedAttempts: number;
  lockedUntilMillis: number;
}

export interface PersistenceInfo {
  mode: 'postgres' | 'persistent_disk' | 'ephemeral';
  isDurable: boolean;
  labelAr: string;
  detailAr: string;
  lastCloudSyncAt: number | null;
  cloudError: string | null;
}

export interface GameCatalogItem {
  id: string;
  label: string;
  categoryAr: string;
  categoryType: 'FOOTBALL' | 'FIGHTING' | 'RACING' | 'SHOOTER';
  scoreUnitLabel: string;
  defaultRule: string;
  defaultDuration: number;
  supportedFormats: TournamentFormat[];
  defaultFormat: TournamentFormat;
  supportedPlayModes: PlayMode[];
  defaultPlayMode: PlayMode;
  supportsTeamSize: boolean;
  defaultTeamSize: number;
  supportsBestOf: boolean;
  defaultBestOf: 1 | 3 | 5;
  supportsCustomRacePoints: boolean;
  onlineStatus: OnlineCompatibilityStatus;
  onlineStatusLabelAr: string;
  compatibilityNoteAr: string;
}

export interface SeasonLeaderboardEntry {
  rank: number;
  elysiumKey: string;
  displayName: string;
  elysiumNetId: string;
  avatarUrl: string | null;
  clubName: string;
  level: PlayerLevel;
  ovrRating: number;
  tournamentsCount: number;
  titles: number;
  runnerUps: number;
  thirdPlaces: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  winRatePercent: number;
  seasonPoints: number;
}

export interface HallOfFameEntry {
  tournamentId: number;
  tournamentName: string;
  gameTitle: string;
  gameCategory: string;
  scoreUnitLabel: string;
  startDateTime: string;
  createdAt: number;
  completedMatches: number;
  totalMatches: number;
  totalGoals: number;
  championName: string;
  championElysiumNetId: string;
  championAvatarUrl: string | null;
  runnerUpName: string | null;
  thirdPlaceName: string | null;
}

export interface AuditLogEntry {
  id: number;
  tournamentId: number | null;
  actorUsername: string;
  actorDisplayName: string;
  actionType: string;
  summaryAr: string;
  createdAt: number;
}

export interface ArenaState {
  tournaments: Tournament[];
  tournament: Tournament | null;
  players: Player[];
  approvedPlayers: Player[];
  pendingPlayers: Player[];
  rejectedPlayers: Player[];
  groupsWithStandings: GroupWithStandings[];
  leagueStandings: GroupStandingRow[];
  leagueMatches: Match[];
  knockoutMatches: Match[];
  allMatches: Match[];
  races: RaceEntry[];
  racingStandings: RacingStandingRow[];
  matchReminders: MatchReminder[];
  playerStats: PlayerStats[];
  overviewStats: TournamentOverviewStats;
  seasonLeaderboard: SeasonLeaderboardEntry[];
  hallOfFame: HallOfFameEntry[];
  auditLogs?: AuditLogEntry[];
  championPlayer: Player | null;
  isRegistrationOpenNow: boolean;
  hasHeadAdmin: boolean;
  adminDirectory: AdminDirectoryEntry[];
  adminAccounts: AdminAccount[];
  currentAdmin: AdminAccount | null;
  rememberedUsername?: string | null;
  keepSignedIn: boolean;
  lockoutState: LockoutState;
  gameCatalog: GameCatalogItem[];
  persistence?: PersistenceInfo;
  playerProfiles?: PlayerProfile[];
  discordStatus?: DiscordStatus;
  currentDiscordProfile?: PlayerProfile | null;
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  GROUPS_KNOCKOUT: 'مجموعات ثم إقصائيات',
  LEAGUE_KNOCKOUT: 'نظام المجموعات والنقاط (دوري + إقصائيات)',
  DIRECT_KNOCKOUT: 'خروج مباشر (إقصائيات فقط)',
  RACE_POINTS: 'نقاط وترتيب بعد السباقات',
  RACE_QUALIFIERS_FINAL: 'تصفيات ثم نهائي (سباقات)'
};

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  SOLO_1V1: 'فردي (1 ضد 1)',
  TEAMS: 'نظام الفرق',
  RACE_POINTS: 'سباقات وترتيب نقاط'
};

export const RACE_STAGE_LABELS: Record<RaceStage, { label: string }> = {
  REGULAR: { label: 'سباق جولة' },
  QUALIFIER: { label: 'سباق تصفيات' },
  FINAL: { label: 'السباق النهائي' }
};

export const DRAW_MODE_LABELS: Record<DrawMode, string> = {
  RANDOM: 'قرعة عشوائية تلقائية',
  MANUAL: 'قرعة يدوية مخصصة'
};

export const TIE_RULE_LABELS: Record<KnockoutTieRule, { label: string; short: string }> = {
  SINGLE_MATCH_PENALTIES: {
    label: 'مباراة واحدة (مع حسم إضافي عند التعادل)',
    short: 'مباراة واحدة'
  },
  TWO_LEGS_FINAL_SINGLE: {
    label: 'ذهاب وإياب حتى نصف النهائي + نهائي من مباراة واحدة',
    short: 'ذهاب وإياب'
  }
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  REGISTRATION_OPEN: 'التسجيل مفتوح',
  REGISTRATION_CLOSED: 'التسجيل مغلق',
  GROUP_STAGE: 'مرحلة المجموعات / الدوري',
  KNOCKOUT_STAGE: 'الأدوار الإقصائية',
  COMPLETED: 'انتهت البطولة'
};

export const LEVEL_LABELS: Record<PlayerLevel, { label: string; ovr: number }> = {
  BEGINNER: { label: 'مبتدئ', ovr: 74 },
  INTERMEDIATE: { label: 'متوسط', ovr: 81 },
  PRO: { label: 'محترف', ovr: 88 },
  LEGEND: { label: 'أسطوري', ovr: 94 }
};

export const STAGE_LABELS: Record<MatchStage, { label: string; shortLabel: string; order: number }> = {
  GROUP: { label: 'دور المجموعات', shortLabel: 'المجموعات', order: 1 },
  LEAGUE: { label: 'مرحلة الدوري', shortLabel: 'الدوري', order: 1 },
  ROUND_OF_64: { label: 'دور الـ 64', shortLabel: 'دور 64', order: 2 },
  ROUND_OF_32: { label: 'دور الـ 32', shortLabel: 'دور 32', order: 3 },
  ROUND_OF_16: { label: 'دور الـ 16', shortLabel: 'دور 16', order: 4 },
  QUARTER_FINAL: { label: 'ربع النهائي', shortLabel: 'ربع النهائي', order: 5 },
  SEMI_FINAL: { label: 'نصف النهائي', shortLabel: 'نصف النهائي', order: 6 },
  THIRD_PLACE: { label: 'المركز الثالث والرابع', shortLabel: 'المركز الثالث', order: 7 },
  FINAL: { label: 'المباراة النهائية', shortLabel: 'النهائي', order: 8 }
};

export const ADMIN_PERMISSIONS_META: Array<{
  key: AdminPermission;
  field: keyof Pick<
    AdminAccount,
    'canManageTournament' | 'canManagePlayers' | 'canRunDraw' | 'canEditScores' | 'canCrownChampion'
  >;
  title: string;
  desc: string;
}> = [
  {
    key: 'MANAGE_TOURNAMENT',
    field: 'canManageTournament',
    title: 'إدارة البطولة',
    desc: 'تعديل اسم البطولة واللعبة والقواعد والعدد والموعد'
  },
  {
    key: 'MANAGE_PLAYERS',
    field: 'canManagePlayers',
    title: 'إدارة المشاركين',
    desc: 'قبول أو رفض أو تعديل أو حذف اللاعبين'
  },
  {
    key: 'RUN_DRAW',
    field: 'canRunDraw',
    title: 'إجراء القرعة',
    desc: 'توزيع المجموعات وتوليد جداول المباريات والإقصائيات'
  },
  {
    key: 'EDIT_SCORES',
    field: 'canEditScores',
    title: 'تسجيل النتائج',
    desc: 'إدخال وتعديل نتائج المباريات والحسم الإضافي'
  },
  {
    key: 'CROWN_CHAMPION',
    field: 'canCrownChampion',
    title: 'تتويج البطل',
    desc: 'اعتماد بطل البطولة وإعلان النتائج النهائية'
  }
];

export const SUB_ADMIN_PRESETS: Array<{ label: string; permissions: AdminPermission[] }> = [
  { label: 'مراقب نتائج', permissions: ['EDIT_SCORES'] },
  { label: 'مسؤول تسجيل', permissions: ['MANAGE_PLAYERS'] },
  { label: 'منسق مباريات', permissions: ['MANAGE_PLAYERS', 'RUN_DRAW', 'EDIT_SCORES'] },
  {
    label: 'نائب مشرف',
    permissions: ['MANAGE_TOURNAMENT', 'MANAGE_PLAYERS', 'RUN_DRAW', 'EDIT_SCORES', 'CROWN_CHAMPION']
  }
];

export function adminHasPermission(admin: AdminAccount | null, perm: AdminPermission): boolean {
  if (!admin || !admin.isActive) return false;
  if (admin.role === 'HEAD_ADMIN') return true;
  switch (perm) {
    case 'MANAGE_TOURNAMENT':
      return admin.canManageTournament;
    case 'MANAGE_PLAYERS':
      return admin.canManagePlayers;
    case 'RUN_DRAW':
      return admin.canRunDraw;
    case 'EDIT_SCORES':
      return admin.canEditScores;
    case 'CROWN_CHAMPION':
      return admin.canCrownChampion;
  }
}

const ARABIC_GROUP_LETTERS = [
  'المجموعة أ',
  'المجموعة ب',
  'المجموعة ج',
  'المجموعة د',
  'المجموعة هـ',
  'المجموعة و',
  'المجموعة ز',
  'المجموعة ح'
];

export function getGroupDisplayName(idx: number): string {
  return ARABIC_GROUP_LETTERS[idx] ?? `المجموعة ${idx + 1}`;
}

export function evaluatePinStrengthClient(pin: string): { code: string; label: string } {
  if (!/^\d{6}$/.test(pin)) return { code: 'INVALID', label: 'يجب أن يكون 6 أرقام' };
  const uniq = new Set(pin.split('')).size;
  if (uniq <= 2) return { code: 'WEAK', label: 'ضعيف (أرقام مكررة)' };
  const seq = ['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210'];
  if (seq.includes(pin)) return { code: 'WEAK', label: 'ضعيف (تسلسل واضح)' };
  if (uniq >= 4) return { code: 'STRONG', label: 'قوي ومشفر' };
  return { code: 'GOOD', label: 'مقبول' };
}
