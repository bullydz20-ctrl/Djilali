export const TournamentFormat = {
  GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT',
  LEAGUE_KNOCKOUT: 'LEAGUE_KNOCKOUT',
  DIRECT_KNOCKOUT: 'DIRECT_KNOCKOUT',
  RACE_POINTS: 'RACE_POINTS',
  RACE_QUALIFIERS_FINAL: 'RACE_QUALIFIERS_FINAL'
};

export const TOURNAMENT_FORMAT_META = {
  GROUPS_KNOCKOUT: {
    labelAr: 'مجموعات ثم إقصائيات',
    descriptionAr: 'توزيع على مجموعات ثم تأهل المتصدرين للأدوار الإقصائية'
  },
  LEAGUE_KNOCKOUT: {
    labelAr: 'نظام المجموعات والنقاط (دوري + إقصائيات)',
    descriptionAr: 'مواجهات نقاط وترتيب ثم تأهل أفضل اللاعبين للإقصائيات'
  },
  DIRECT_KNOCKOUT: {
    labelAr: 'خروج مباشر (إقصائيات فقط)',
    descriptionAr: 'مواجهات إقصائية مباشرة من الدور الأول حتى النهائي'
  },
  RACE_POINTS: {
    labelAr: 'نقاط وترتيب بعد السباقات',
    descriptionAr: 'تجميع نقاط المراكز وتحديث ترتيب المتسابقين تلقائياً بعد كل سباق'
  },
  RACE_QUALIFIERS_FINAL: {
    labelAr: 'تصفيات ثم نهائي (سباقات)',
    descriptionAr: 'جولات تصفيات بنقاط المراكز ثم تأهل المتصدرين للسباق النهائي'
  }
};

export const PlayMode = {
  SOLO_1V1: 'SOLO_1V1',
  TEAMS: 'TEAMS',
  RACE_POINTS: 'RACE_POINTS'
};

export const PLAY_MODE_META = {
  SOLO_1V1: { labelAr: 'فردي (1 ضد 1)' },
  TEAMS: { labelAr: 'نظام الفرق' },
  RACE_POINTS: { labelAr: 'سباقات وترتيب نقاط' }
};

export const RaceStage = {
  REGULAR: 'REGULAR',
  QUALIFIER: 'QUALIFIER',
  FINAL: 'FINAL'
};

export const RACE_STAGE_META = {
  REGULAR: { labelAr: 'سباق جولة' },
  QUALIFIER: { labelAr: 'سباق تصفيات' },
  FINAL: { labelAr: 'السباق النهائي' }
};

export const OnlineCompatibilityStatus = {
  OFFICIAL_ONLINE: 'OFFICIAL_ONLINE',
  LOCAL_OR_LAN_ONLY: 'LOCAL_OR_LAN_ONLY',
  VERIFY_REQUIRED: 'VERIFY_REQUIRED'
};

export const DEFAULT_RACING_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const DrawMode = {
  RANDOM: 'RANDOM',
  MANUAL: 'MANUAL'
};

export const DRAW_MODE_META = {
  RANDOM: { labelAr: 'قرعة عشوائية تلقائية' },
  MANUAL: { labelAr: 'قرعة يدوية مخصصة' }
};

export const KnockoutTieRule = {
  SINGLE_MATCH_PENALTIES: 'SINGLE_MATCH_PENALTIES',
  TWO_LEGS_FINAL_SINGLE: 'TWO_LEGS_FINAL_SINGLE'
};

export const KNOCKOUT_TIE_RULE_META = {
  SINGLE_MATCH_PENALTIES: {
    labelAr: 'مباراة واحدة (مع حسم إضافي عند التعادل)',
    shortAr: 'مباراة واحدة'
  },
  TWO_LEGS_FINAL_SINGLE: {
    labelAr: 'ذهاب وإياب حتى نصف النهائي + نهائي من مباراة واحدة',
    shortAr: 'ذهاب وإياب'
  }
};

export const PlayerStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

export const PLAYER_STATUS_META = {
  PENDING: { labelAr: 'بانتظار الموافقة' },
  APPROVED: { labelAr: 'معتمد' },
  REJECTED: { labelAr: 'مرفوض' }
};

export const PlayerLevel = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  PRO: 'PRO',
  LEGEND: 'LEGEND'
};

export const PLAYER_LEVEL_META = {
  BEGINNER: { labelAr: 'مبتدئ', defaultOvr: 74 },
  INTERMEDIATE: { labelAr: 'متوسط', defaultOvr: 81 },
  PRO: { labelAr: 'محترف', defaultOvr: 88 },
  LEGEND: { labelAr: 'أسطوري', defaultOvr: 94 }
};

export const MatchStage = {
  GROUP: 'GROUP',
  LEAGUE: 'LEAGUE',
  ROUND_OF_64: 'ROUND_OF_64',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINAL: 'QUARTER_FINAL',
  SEMI_FINAL: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL'
};

export const MATCH_STAGE_META = {
  GROUP: { labelAr: 'دور المجموعات', shortAr: 'المجموعات', order: 1 },
  LEAGUE: { labelAr: 'مرحلة الدوري', shortAr: 'الدوري', order: 1 },
  ROUND_OF_64: { labelAr: 'دور الـ 64', shortAr: 'دور 64', order: 2 },
  ROUND_OF_32: { labelAr: 'دور الـ 32', shortAr: 'دور 32', order: 3 },
  ROUND_OF_16: { labelAr: 'دور الـ 16', shortAr: 'دور 16', order: 4 },
  QUARTER_FINAL: { labelAr: 'ربع النهائي', shortAr: 'ربع النهائي', order: 5 },
  SEMI_FINAL: { labelAr: 'نصف النهائي', shortAr: 'نصف النهائي', order: 6 },
  THIRD_PLACE: { labelAr: 'المركز الثالث والرابع', shortAr: 'المركز الثالث', order: 7 },
  FINAL: { labelAr: 'المباراة النهائية', shortAr: 'النهائي', order: 8 }
};

export const AdminRole = {
  HEAD_ADMIN: 'HEAD_ADMIN',
  SUB_ADMIN: 'SUB_ADMIN'
};

export const ADMIN_ROLE_META = {
  HEAD_ADMIN: { labelAr: 'المشرف الرئيسي' },
  SUB_ADMIN: { labelAr: 'مشرف مساعد' }
};

export const TournamentStatus = {
  REGISTRATION_OPEN: 'REGISTRATION_OPEN',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  GROUP_STAGE: 'GROUP_STAGE',
  KNOCKOUT_STAGE: 'KNOCKOUT_STAGE',
  COMPLETED: 'COMPLETED'
};

export const TOURNAMENT_STATUS_META = {
  REGISTRATION_OPEN: { labelAr: 'التسجيل مفتوح' },
  REGISTRATION_CLOSED: { labelAr: 'التسجيل مغلق' },
  GROUP_STAGE: { labelAr: 'مرحلة المجموعات / السباقات' },
  KNOCKOUT_STAGE: { labelAr: 'الأدوار الإقصائية / النهائي' },
  COMPLETED: { labelAr: 'انتهت البطولة' }
};

export const AdminPermission = {
  MANAGE_TOURNAMENT: 'MANAGE_TOURNAMENT',
  MANAGE_PLAYERS: 'MANAGE_PLAYERS',
  RUN_DRAW: 'RUN_DRAW',
  EDIT_SCORES: 'EDIT_SCORES',
  CROWN_CHAMPION: 'CROWN_CHAMPION'
};

export const ADMIN_PERMISSION_LIST = [
  {
    key: AdminPermission.MANAGE_TOURNAMENT,
    field: 'canManageTournament',
    titleAr: 'إدارة البطولة',
    descriptionAr: 'تعديل اسم البطولة واللعبة والقواعد والعدد والموعد'
  },
  {
    key: AdminPermission.MANAGE_PLAYERS,
    field: 'canManagePlayers',
    titleAr: 'إدارة المشاركين',
    descriptionAr: 'قبول أو رفض أو تعديل أو حذف اللاعبين'
  },
  {
    key: AdminPermission.RUN_DRAW,
    field: 'canRunDraw',
    titleAr: 'إجراء القرعة',
    descriptionAr: 'توزيع المجموعات وتوليد جداول المباريات والإقصائيات أو السباقات'
  },
  {
    key: AdminPermission.EDIT_SCORES,
    field: 'canEditScores',
    titleAr: 'تسجيل النتائج',
    descriptionAr: 'إدخال وتعديل نتائج المباريات أو مراكز السباقات'
  },
  {
    key: AdminPermission.CROWN_CHAMPION,
    field: 'canCrownChampion',
    titleAr: 'تتويج البطل',
    descriptionAr: 'اعتماد بطل البطولة وإعلان النتائج النهائية'
  }
];

export const SUB_ADMIN_PRESETS = [
  {
    id: 'SCOREKEEPER',
    labelAr: 'مراقب نتائج',
    permissions: [AdminPermission.EDIT_SCORES]
  },
  {
    id: 'REGISTRAR',
    labelAr: 'مسؤول تسجيل',
    permissions: [AdminPermission.MANAGE_PLAYERS]
  },
  {
    id: 'ORGANIZER',
    labelAr: 'منسق مباريات',
    permissions: [AdminPermission.MANAGE_PLAYERS, AdminPermission.RUN_DRAW, AdminPermission.EDIT_SCORES]
  },
  {
    id: 'CO_DIRECTOR',
    labelAr: 'نائب مشرف',
    permissions: [
      AdminPermission.MANAGE_TOURNAMENT,
      AdminPermission.MANAGE_PLAYERS,
      AdminPermission.RUN_DRAW,
      AdminPermission.EDIT_SCORES,
      AdminPermission.CROWN_CHAMPION
    ]
  }
];

export const GAME_CATALOG = [
  {
    id: 'FIFA 22',
    label: 'FIFA 22',
    categoryAr: 'كرة قدم',
    categoryType: 'FOOTBALL',
    scoreUnitLabel: 'هدف',
    defaultRule: 'المباراة الكاملة (6 دقائق لكل شوط)',
    defaultDuration: 12,
    supportedFormats: [
      TournamentFormat.GROUPS_KNOCKOUT,
      TournamentFormat.LEAGUE_KNOCKOUT,
      TournamentFormat.DIRECT_KNOCKOUT
    ],
    defaultFormat: TournamentFormat.GROUPS_KNOCKOUT,
    supportedPlayModes: [PlayMode.TEAMS, PlayMode.SOLO_1V1],
    defaultPlayMode: PlayMode.TEAMS,
    supportsTeamSize: true,
    defaultTeamSize: 2,
    supportsBestOf: false,
    defaultBestOf: 1,
    supportsCustomRacePoints: false,
    onlineStatus: OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
    onlineStatusLabelAr: 'محلي / تحقق مطلوب (خوادم EA الرسمية أُغلقت في نوفمبر 2024)',
    compatibilityNoteAr:
      'تم إغلاق خوادم EA الرسمية لـ FIFA 22. اللعب المعتمد حالياً محلي (حضوري) أو عبر Share Play / شبكة محلية بعد تحقق المنظم.'
  },
  {
    id: 'JUMP FORCE',
    label: 'JUMP FORCE',
    categoryAr: 'ألعاب قتال — 1 ضد 1',
    categoryType: 'FIGHTING',
    scoreUnitLabel: 'جولة',
    defaultRule: 'نظام 1 ضد 1 — Best of 3',
    defaultDuration: 8,
    supportedFormats: [TournamentFormat.DIRECT_KNOCKOUT, TournamentFormat.GROUPS_KNOCKOUT],
    defaultFormat: TournamentFormat.DIRECT_KNOCKOUT,
    supportedPlayModes: [PlayMode.SOLO_1V1],
    defaultPlayMode: PlayMode.SOLO_1V1,
    supportsTeamSize: false,
    defaultTeamSize: 1,
    supportsBestOf: true,
    defaultBestOf: 3,
    supportsCustomRacePoints: false,
    onlineStatus: OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
    onlineStatusLabelAr: 'محلي / غرف أصدقاء (خوادم التصنيف الرسمية أُغلقت في 2022)',
    compatibilityNoteAr:
      'خوادم الأونلاين والتصنيف الرسمية لـ JUMP FORCE مغلقة منذ أغسطس 2022. يجب التحقق من إمكانية اللعب المحلي أو غرف الأصدقاء قبل بدء البطولة.'
  },
  {
    id: 'Tekken 7',
    label: 'Tekken 7',
    categoryAr: 'ألعاب قتال — 1 ضد 1',
    categoryType: 'FIGHTING',
    scoreUnitLabel: 'جولة',
    defaultRule: 'نظام 1 ضد 1 — Best of 3',
    defaultDuration: 8,
    supportedFormats: [TournamentFormat.DIRECT_KNOCKOUT, TournamentFormat.GROUPS_KNOCKOUT],
    defaultFormat: TournamentFormat.DIRECT_KNOCKOUT,
    supportedPlayModes: [PlayMode.SOLO_1V1],
    defaultPlayMode: PlayMode.SOLO_1V1,
    supportsTeamSize: false,
    defaultTeamSize: 1,
    supportsBestOf: true,
    defaultBestOf: 3,
    supportsCustomRacePoints: false,
    onlineStatus: OnlineCompatibilityStatus.VERIFY_REQUIRED,
    onlineStatusLabelAr: 'يتطلب التحقق من توافق PSN والمنطقة قبل اللعب أونلاين',
    compatibilityNoteAr:
      'تدعم Tekken 7 اللعب المحلي وطور أونلاين P2P عبر PlayStation Network (يتطلب اشتراك PS Plus والتحقق من توافق الاتصال والمنطقة).'
  },
  {
    id: 'Mortal Kombat 11',
    label: 'Mortal Kombat 11',
    categoryAr: 'ألعاب قتال — 1 ضد 1',
    categoryType: 'FIGHTING',
    scoreUnitLabel: 'جولة',
    defaultRule: 'نظام 1 ضد 1 — Best of 3',
    defaultDuration: 8,
    supportedFormats: [TournamentFormat.DIRECT_KNOCKOUT, TournamentFormat.GROUPS_KNOCKOUT],
    defaultFormat: TournamentFormat.DIRECT_KNOCKOUT,
    supportedPlayModes: [PlayMode.SOLO_1V1],
    defaultPlayMode: PlayMode.SOLO_1V1,
    supportsTeamSize: false,
    defaultTeamSize: 1,
    supportsBestOf: true,
    defaultBestOf: 3,
    supportsCustomRacePoints: false,
    onlineStatus: OnlineCompatibilityStatus.VERIFY_REQUIRED,
    onlineStatusLabelAr: 'يتطلب التحقق من توافق PSN والحساب قبل اللعب أونلاين',
    compatibilityNoteAr:
      'تدعم Mortal Kombat 11 اللعب المحلي 1 ضد 1 وغرف أونلاين عبر PSN (يتطلب اشتراك PS Plus والتحقق من تطابق الإصدار والتحديث).'
  },
  {
    id: 'RIDE 4',
    label: 'RIDE 4',
    categoryAr: 'ألعاب سباق',
    categoryType: 'RACING',
    scoreUnitLabel: 'نقطة',
    defaultRule: 'نقاط وترتيب المراكز بعد كل سباق',
    defaultDuration: 10,
    supportedFormats: [TournamentFormat.RACE_POINTS, TournamentFormat.RACE_QUALIFIERS_FINAL],
    defaultFormat: TournamentFormat.RACE_POINTS,
    supportedPlayModes: [PlayMode.RACE_POINTS],
    defaultPlayMode: PlayMode.RACE_POINTS,
    supportsTeamSize: false,
    defaultTeamSize: 1,
    supportsBestOf: false,
    defaultBestOf: 1,
    supportsCustomRacePoints: true,
    onlineStatus: OnlineCompatibilityStatus.VERIFY_REQUIRED,
    onlineStatusLabelAr: 'يتطلب التحقق من غرف السباق أونلاين أو تحدي الأزمنة المحلي',
    compatibilityNoteAr:
      'تدعم RIDE 4 غرف السباق عبر PSN وتحديات الأزمنة الأوفلاين. يجب على المنظم التحقق من استقرار الغرفة وفئة الدراجات قبل الإعلان عن الأونلاين.'
  },
  {
    id: 'DriveClub',
    label: 'DriveClub',
    categoryAr: 'ألعاب سباق',
    categoryType: 'RACING',
    scoreUnitLabel: 'نقطة',
    defaultRule: 'نقاط المراكز / تحدي الأزمنة الفردي',
    defaultDuration: 10,
    supportedFormats: [TournamentFormat.RACE_POINTS, TournamentFormat.RACE_QUALIFIERS_FINAL],
    defaultFormat: TournamentFormat.RACE_POINTS,
    supportedPlayModes: [PlayMode.RACE_POINTS],
    defaultPlayMode: PlayMode.RACE_POINTS,
    supportsTeamSize: false,
    defaultTeamSize: 1,
    supportsBestOf: false,
    defaultBestOf: 1,
    supportsCustomRacePoints: true,
    onlineStatus: OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
    onlineStatusLabelAr: 'محلي / أوفلاين فقط (خوادم سوني الرسمية أُغلقت في مارس 2020)',
    compatibilityNoteAr:
      'تم إغلاق خوادم DriveClub الأونلاين الرسمية منذ مارس 2020. البطولة معتمدة عبر تسجيل الأزمنة والنقاط محلياً أوفلاين فقط.'
  },
  {
    id: 'Call of Duty',
    label: 'Call of Duty',
    categoryAr: 'أكشن وتصويب',
    categoryType: 'SHOOTER',
    scoreUnitLabel: 'نقطة',
    defaultRule: 'نظام المواجهة المخصص (فردي 1 ضد 1 أو فرق)',
    defaultDuration: 15,
    supportedFormats: [
      TournamentFormat.DIRECT_KNOCKOUT,
      TournamentFormat.GROUPS_KNOCKOUT,
      TournamentFormat.LEAGUE_KNOCKOUT
    ],
    defaultFormat: TournamentFormat.DIRECT_KNOCKOUT,
    supportedPlayModes: [PlayMode.SOLO_1V1, PlayMode.TEAMS],
    defaultPlayMode: PlayMode.SOLO_1V1,
    supportsTeamSize: true,
    defaultTeamSize: 4,
    supportsBestOf: true,
    defaultBestOf: 3,
    supportsCustomRacePoints: false,
    onlineStatus: OnlineCompatibilityStatus.VERIFY_REQUIRED,
    onlineStatusLabelAr: 'يتطلب تحقق المنظم من خوادم الإصدار / LAN / Crossplay قبل الاعتماد',
    compatibilityNoteAr:
      'يُعرض Call of Duty كخيار موحد؛ على المنظم تحديد قواعد المواجهة والتحقق من توافق الإصدار وخوادم اللعب (أونلاين أو LAN) قبل انطلاق البطولة.'
  }
];

