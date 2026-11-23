export const TournamentFormat = {
  GROUPS_KNOCKOUT: 'GROUPS_KNOCKOUT',
  LEAGUE_KNOCKOUT: 'LEAGUE_KNOCKOUT',
  DIRECT_KNOCKOUT: 'DIRECT_KNOCKOUT'
};

export const TOURNAMENT_FORMAT_META = {
  GROUPS_KNOCKOUT: {
    labelAr: 'مجموعات + أدوار إقصائية',
    descriptionAr: 'توزيع على مجموعات ثم تأهل المتصدرين للأدوار الإقصائية'
  },
  LEAGUE_KNOCKOUT: {
    labelAr: 'دوري + أدوار إقصائية',
    descriptionAr: 'مواجهات بنظام الدوري ثم تأهل أفضل اللاعبين للإقصائيات'
  },
  DIRECT_KNOCKOUT: {
    labelAr: 'خروج مباشر (إقصائيات فقط)',
    descriptionAr: 'مواجهات إقصائية مباشرة من الدور الأول حتى النهائي'
  }
};

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
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINAL: 'QUARTER_FINAL',
  SEMI_FINAL: 'SEMI_FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
  FINAL: 'FINAL'
};

export const MATCH_STAGE_META = {
  GROUP: { labelAr: 'دور المجموعات', order: 1 },
  LEAGUE: { labelAr: 'مرحلة الدوري', order: 1 },
  ROUND_OF_16: { labelAr: 'دور الـ 16', order: 2 },
  QUARTER_FINAL: { labelAr: 'ربع النهائي', order: 3 },
  SEMI_FINAL: { labelAr: 'نصف النهائي', order: 4 },
  THIRD_PLACE: { labelAr: 'المركز الثالث والرابع', order: 5 },
  FINAL: { labelAr: 'المباراة النهائية', order: 6 }
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
  GROUP_STAGE: { labelAr: 'مرحلة المجموعات / الدوري' },
  KNOCKOUT_STAGE: { labelAr: 'الأدوار الإقصائية' },
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
    descriptionAr: 'توزيع المجموعات وتوليد جداول المباريات والإقصائيات'
  },
  {
    key: AdminPermission.EDIT_SCORES,
    field: 'canEditScores',
    titleAr: 'تسجيل النتائج',
    descriptionAr: 'إدخال وتعديل نتائج المباريات والحسم الإضافي'
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
  { id: 'FIFA 22', label: 'FIFA 22', categoryAr: 'كرة قدم', scoreUnitLabel: 'هدف', defaultRule: 'المباراة الكاملة (6 دقائق لكل شوط)', defaultDuration: 12 },
  { id: 'EA SPORTS FC 25', label: 'EA SPORTS FC 25', categoryAr: 'كرة قدم', scoreUnitLabel: 'هدف', defaultRule: 'المباراة الكاملة (6 دقائق لكل شوط)', defaultDuration: 12 },
  { id: 'eFootball PES', label: 'eFootball PES', categoryAr: 'كرة قدم', scoreUnitLabel: 'هدف', defaultRule: 'مباراة كاملة 10 دقائق + إضافي عند الإقصائيات', defaultDuration: 10 },
  { id: 'Tekken 8', label: 'Tekken 8', categoryAr: 'ألعاب قتال', scoreUnitLabel: 'جولة', defaultRule: 'الأفضل من 3 مجموعات (First to 3)', defaultDuration: 8 },
  { id: 'Mortal Kombat 1', label: 'Mortal Kombat 1', categoryAr: 'ألعاب قتال', scoreUnitLabel: 'جولة', defaultRule: 'الأفضل من 3 مواجهات (FT3)', defaultDuration: 8 },
  { id: 'Street Fighter 6', label: 'Street Fighter 6', categoryAr: 'ألعاب قتال', scoreUnitLabel: 'جولة', defaultRule: 'الأفضل من 3 مواجهات (FT3)', defaultDuration: 8 },
  { id: 'Call of Duty', label: 'Call of Duty', categoryAr: 'تصويب', scoreUnitLabel: 'نقطة', defaultRule: 'نظام المواجهة 1 ضد 1 أو البحث والتدمير (Best of 5)', defaultDuration: 15 },
  { id: 'Rocket League', label: 'Rocket League', categoryAr: 'رياضة مركبات', scoreUnitLabel: 'هدف', defaultRule: 'مباراة 5 دقائق + هدف ذهبي', defaultDuration: 7 },
  { id: 'NBA 2K', label: 'NBA 2K', categoryAr: 'كرة سلة', scoreUnitLabel: 'نقطة', defaultRule: '4 أرباع × 5 دقائق', defaultDuration: 20 },
  { id: 'Fortnite', label: 'Fortnite', categoryAr: 'باتل رويال', scoreUnitLabel: 'نقطة', defaultRule: 'نظام البوكس فايت / النقاط المجمعة', defaultDuration: 15 },
  { id: 'PUBG', label: 'PUBG', categoryAr: 'باتل رويال', scoreUnitLabel: 'نقطة', defaultRule: 'مواجهات النقاط والإقصاء المباشر', defaultDuration: 20 }
];
