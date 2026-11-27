package com.example.data.model

import org.json.JSONArray

enum class TournamentFormat(val labelAr: String, val descriptionAr: String) {
    GROUPS_KNOCKOUT(
        "مجموعات ثم إقصائيات",
        "توزيع على مجموعات ثم تأهل المتصدرين للأدوار الإقصائية"
    ),
    LEAGUE_KNOCKOUT(
        "نظام المجموعات والنقاط (دوري + إقصائيات)",
        "مواجهات نقاط وترتيب ثم تأهل أفضل اللاعبين للإقصائيات"
    ),
    DIRECT_KNOCKOUT(
        "خروج مباشر (إقصائيات فقط)",
        "مواجهات إقصائية مباشرة من الدور الأول حتى النهائي"
    ),
    RACE_POINTS(
        "نقاط وترتيب بعد السباقات",
        "تجميع نقاط المراكز وتحديث ترتيب المتسابقين تلقائياً بعد كل سباق"
    ),
    RACE_QUALIFIERS_FINAL(
        "تصفيات ثم نهائي (سباقات)",
        "جولات تصفيات بنقاط المراكز ثم تأهل المتصدرين للسباق النهائي"
    );

    val isRacing: Boolean
        get() = this == RACE_POINTS || this == RACE_QUALIFIERS_FINAL
}

enum class PlayMode(val labelAr: String) {
    SOLO_1V1("فردي (1 ضد 1)"),
    TEAMS("نظام الفرق"),
    RACE_POINTS("سباقات وترتيب نقاط")
}

enum class RaceStage(val labelAr: String) {
    REGULAR("سباق جولة"),
    QUALIFIER("سباق تصفيات"),
    FINAL("السباق النهائي")
}

enum class OnlineCompatibilityStatus {
    OFFICIAL_ONLINE,
    LOCAL_OR_LAN_ONLY,
    VERIFY_REQUIRED
}

enum class GameCategoryType {
    FOOTBALL,
    FIGHTING,
    RACING,
    SHOOTER
}

val DEFAULT_RACING_POINTS: List<Int> = listOf(25, 18, 15, 12, 10, 8, 6, 4, 2, 1)
const val DEFAULT_RACING_POINTS_JSON: String = "[25,18,15,12,10,8,6,4,2,1]"

fun parseRacingPointsConfig(raw: String?): List<Int> {
    if (raw.isNullOrBlank()) return DEFAULT_RACING_POINTS
    val parsed = runCatching {
        val arr = JSONArray(raw.trim())
        buildList {
            for (i in 0 until arr.length()) {
                val n = arr.optInt(i, -1)
                if (n >= 0) add(n)
            }
        }
    }.getOrElse {
        raw.split(",", "،", " ")
            .mapNotNull { it.trim().toIntOrNull()?.takeIf { n -> n >= 0 } }
    }
    return parsed.takeIf { it.isNotEmpty() }?.take(24) ?: DEFAULT_RACING_POINTS
}

fun formatRacingPointsConfig(points: List<Int>): String {
    val clean = points.filter { it >= 0 }.take(24).ifEmpty { DEFAULT_RACING_POINTS }
    val arr = JSONArray()
    clean.forEach { arr.put(it) }
    return arr.toString()
}

enum class DrawMode(val labelAr: String) {
    RANDOM("قرعة عشوائية تلقائية"),
    MANUAL("قرعة يدوية مخصصة")
}

enum class KnockoutTieRule(val labelAr: String, val shortAr: String) {
    SINGLE_MATCH_PENALTIES(
        "مباراة واحدة (مع حسم إضافي عند التعادل)",
        "مباراة واحدة"
    ),
    TWO_LEGS_FINAL_SINGLE(
        "ذهاب وإياب حتى نصف النهائي + نهائي من مباراة واحدة",
        "ذهاب وإياب"
    )
}

enum class PlayerStatus(val labelAr: String) {
    PENDING("بانتظار الموافقة"),
    APPROVED("معتمد"),
    REJECTED("مرفوض")
}

enum class PlayerLevel(val labelAr: String, val defaultOvr: Int) {
    BEGINNER("مبتدئ", 74),
    INTERMEDIATE("متوسط", 81),
    PRO("محترف", 88),
    LEGEND("أسطوري", 94)
}

enum class MatchStage(val labelAr: String, val order: Int, val shortLabelAr: String = labelAr) {
    GROUP("دور المجموعات", 1, "المجموعات"),
    LEAGUE("مرحلة الدوري", 1, "الدوري"),
    ROUND_OF_64("دور الـ 64", 2, "دور 64"),
    ROUND_OF_32("دور الـ 32", 3, "دور 32"),
    ROUND_OF_16("دور الـ 16", 4, "دور 16"),
    QUARTER_FINAL("ربع النهائي", 5, "ربع النهائي"),
    SEMI_FINAL("نصف النهائي", 6, "نصف النهائي"),
    THIRD_PLACE("تحديد المركز الثالث", 7, "المركز الثالث"),
    FINAL("المباراة النهائية", 8, "النهائي")
}

enum class AdminRole(val labelAr: String) {
    HEAD_ADMIN("المشرف الرئيسي"),
    SUB_ADMIN("مشرف مساعد")
}

enum class TournamentStatus(val labelAr: String) {
    REGISTRATION_OPEN("التسجيل مفتوح"),
    REGISTRATION_CLOSED("التسجيل مغلق"),
    GROUP_STAGE("مرحلة المجموعات / السباقات"),
    KNOCKOUT_STAGE("الأدوار الإقصائية / النهائي"),
    COMPLETED("انتهت البطولة")
}

data class GamePreset(
    val id: String,
    val label: String,
    val categoryAr: String,
    val categoryType: GameCategoryType,
    val scoreUnitLabel: String,
    val defaultRule: String,
    val defaultDurationMinutes: Int,
    val supportedFormats: List<TournamentFormat>,
    val defaultFormat: TournamentFormat,
    val supportedPlayModes: List<PlayMode>,
    val defaultPlayMode: PlayMode,
    val supportsTeamSize: Boolean,
    val defaultTeamSize: Int,
    val supportsBestOf: Boolean,
    val defaultBestOf: Int,
    val supportsCustomRacePoints: Boolean,
    val onlineStatus: OnlineCompatibilityStatus,
    val onlineStatusLabelAr: String,
    val compatibilityNoteAr: String
)

val GAME_CATALOG: List<GamePreset> = listOf(
    GamePreset(
        id = "FIFA 22",
        label = "FIFA 22",
        categoryAr = "كرة قدم",
        categoryType = GameCategoryType.FOOTBALL,
        scoreUnitLabel = "هدف",
        defaultRule = "المباراة الكاملة (6 دقائق لكل شوط)",
        defaultDurationMinutes = 12,
        supportedFormats = listOf(
            TournamentFormat.GROUPS_KNOCKOUT,
            TournamentFormat.LEAGUE_KNOCKOUT,
            TournamentFormat.DIRECT_KNOCKOUT
        ),
        defaultFormat = TournamentFormat.GROUPS_KNOCKOUT,
        supportedPlayModes = listOf(PlayMode.TEAMS, PlayMode.SOLO_1V1),
        defaultPlayMode = PlayMode.TEAMS,
        supportsTeamSize = true,
        defaultTeamSize = 2,
        supportsBestOf = false,
        defaultBestOf = 1,
        supportsCustomRacePoints = false,
        onlineStatus = OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
        onlineStatusLabelAr = "محلي / تحقق مطلوب (خوادم EA الرسمية أُغلقت في نوفمبر 2024)",
        compatibilityNoteAr = "تم إغلاق خوادم EA الرسمية لـ FIFA 22. اللعب المعتمد حالياً محلي (حضوري) أو عبر Share Play / شبكة محلية بعد تحقق المنظم."
    ),
    GamePreset(
        id = "JUMP FORCE",
        label = "JUMP FORCE",
        categoryAr = "ألعاب قتال — 1 ضد 1",
        categoryType = GameCategoryType.FIGHTING,
        scoreUnitLabel = "جولة",
        defaultRule = "نظام 1 ضد 1 — Best of 3",
        defaultDurationMinutes = 8,
        supportedFormats = listOf(
            TournamentFormat.DIRECT_KNOCKOUT,
            TournamentFormat.GROUPS_KNOCKOUT
        ),
        defaultFormat = TournamentFormat.DIRECT_KNOCKOUT,
        supportedPlayModes = listOf(PlayMode.SOLO_1V1),
        defaultPlayMode = PlayMode.SOLO_1V1,
        supportsTeamSize = false,
        defaultTeamSize = 1,
        supportsBestOf = true,
        defaultBestOf = 3,
        supportsCustomRacePoints = false,
        onlineStatus = OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
        onlineStatusLabelAr = "محلي / غرف أصدقاء (خوادم التصنيف الرسمية أُغلقت في 2022)",
        compatibilityNoteAr = "خوادم الأونلاين والتصنيف الرسمية لـ JUMP FORCE مغلقة منذ أغسطس 2022. يجب التحقق من إمكانية اللعب المحلي أو غرف الأصدقاء قبل بدء البطولة."
    ),
    GamePreset(
        id = "Tekken 7",
        label = "Tekken 7",
        categoryAr = "ألعاب قتال — 1 ضد 1",
        categoryType = GameCategoryType.FIGHTING,
        scoreUnitLabel = "جولة",
        defaultRule = "نظام 1 ضد 1 — Best of 3",
        defaultDurationMinutes = 8,
        supportedFormats = listOf(
            TournamentFormat.DIRECT_KNOCKOUT,
            TournamentFormat.GROUPS_KNOCKOUT
        ),
        defaultFormat = TournamentFormat.DIRECT_KNOCKOUT,
        supportedPlayModes = listOf(PlayMode.SOLO_1V1),
        defaultPlayMode = PlayMode.SOLO_1V1,
        supportsTeamSize = false,
        defaultTeamSize = 1,
        supportsBestOf = true,
        defaultBestOf = 3,
        supportsCustomRacePoints = false,
        onlineStatus = OnlineCompatibilityStatus.VERIFY_REQUIRED,
        onlineStatusLabelAr = "يتطلب التحقق من توافق PSN والمنطقة قبل اللعب أونلاين",
        compatibilityNoteAr = "تدعم Tekken 7 اللعب المحلي وطور أونلاين P2P عبر PlayStation Network (يتطلب اشتراك PS Plus والتحقق من توافق الاتصال والمنطقة)."
    ),
    GamePreset(
        id = "Mortal Kombat 11",
        label = "Mortal Kombat 11",
        categoryAr = "ألعاب قتال — 1 ضد 1",
        categoryType = GameCategoryType.FIGHTING,
        scoreUnitLabel = "جولة",
        defaultRule = "نظام 1 ضد 1 — Best of 3",
        defaultDurationMinutes = 8,
        supportedFormats = listOf(
            TournamentFormat.DIRECT_KNOCKOUT,
            TournamentFormat.GROUPS_KNOCKOUT
        ),
        defaultFormat = TournamentFormat.DIRECT_KNOCKOUT,
        supportedPlayModes = listOf(PlayMode.SOLO_1V1),
        defaultPlayMode = PlayMode.SOLO_1V1,
        supportsTeamSize = false,
        defaultTeamSize = 1,
        supportsBestOf = true,
        defaultBestOf = 3,
        supportsCustomRacePoints = false,
        onlineStatus = OnlineCompatibilityStatus.VERIFY_REQUIRED,
        onlineStatusLabelAr = "يتطلب التحقق من توافق PSN والحساب قبل اللعب أونلاين",
        compatibilityNoteAr = "تدعم Mortal Kombat 11 اللعب المحلي 1 ضد 1 وغرف أونلاين عبر PSN (يتطلب اشتراك PS Plus والتحقق من تطابق الإصدار والتحديث)."
    ),
    GamePreset(
        id = "RIDE 4",
        label = "RIDE 4",
        categoryAr = "ألعاب سباق",
        categoryType = GameCategoryType.RACING,
        scoreUnitLabel = "نقطة",
        defaultRule = "نقاط وترتيب المراكز بعد كل سباق",
        defaultDurationMinutes = 10,
        supportedFormats = listOf(
            TournamentFormat.RACE_POINTS,
            TournamentFormat.RACE_QUALIFIERS_FINAL
        ),
        defaultFormat = TournamentFormat.RACE_POINTS,
        supportedPlayModes = listOf(PlayMode.RACE_POINTS),
        defaultPlayMode = PlayMode.RACE_POINTS,
        supportsTeamSize = false,
        defaultTeamSize = 1,
        supportsBestOf = false,
        defaultBestOf = 1,
        supportsCustomRacePoints = true,
        onlineStatus = OnlineCompatibilityStatus.VERIFY_REQUIRED,
        onlineStatusLabelAr = "يتطلب التحقق من غرف السباق أونلاين أو تحدي الأزمنة المحلي",
        compatibilityNoteAr = "تدعم RIDE 4 غرف السباق عبر PSN وتحديات الأزمنة الأوفلاين. يجب على المنظم التحقق من استقرار الغرفة وفئة الدراجات قبل الإعلان عن الأونلاين."
    ),
    GamePreset(
        id = "DriveClub",
        label = "DriveClub",
        categoryAr = "ألعاب سباق",
        categoryType = GameCategoryType.RACING,
        scoreUnitLabel = "نقطة",
        defaultRule = "نقاط المراكز / تحدي الأزمنة الفردي",
        defaultDurationMinutes = 10,
        supportedFormats = listOf(
            TournamentFormat.RACE_POINTS,
            TournamentFormat.RACE_QUALIFIERS_FINAL
        ),
        defaultFormat = TournamentFormat.RACE_POINTS,
        supportedPlayModes = listOf(PlayMode.RACE_POINTS),
        defaultPlayMode = PlayMode.RACE_POINTS,
        supportsTeamSize = false,
        defaultTeamSize = 1,
        supportsBestOf = false,
        defaultBestOf = 1,
        supportsCustomRacePoints = true,
        onlineStatus = OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY,
        onlineStatusLabelAr = "محلي / أوفلاين فقط (خوادم سوني الرسمية أُغلقت في مارس 2020)",
        compatibilityNoteAr = "تم إغلاق خوادم DriveClub الأونلاين الرسمية منذ مارس 2020. البطولة معتمدة عبر تسجيل الأزمنة والنقاط محلياً أوفلاين فقط."
    ),
    GamePreset(
        id = "Call of Duty",
        label = "Call of Duty",
        categoryAr = "أكشن وتصويب",
        categoryType = GameCategoryType.SHOOTER,
        scoreUnitLabel = "نقطة",
        defaultRule = "نظام المواجهة المخصص (فردي 1 ضد 1 أو فرق)",
        defaultDurationMinutes = 15,
        supportedFormats = listOf(
            TournamentFormat.DIRECT_KNOCKOUT,
            TournamentFormat.GROUPS_KNOCKOUT,
            TournamentFormat.LEAGUE_KNOCKOUT
        ),
        defaultFormat = TournamentFormat.DIRECT_KNOCKOUT,
        supportedPlayModes = listOf(PlayMode.SOLO_1V1, PlayMode.TEAMS),
        defaultPlayMode = PlayMode.SOLO_1V1,
        supportsTeamSize = true,
        defaultTeamSize = 4,
        supportsBestOf = true,
        defaultBestOf = 3,
        supportsCustomRacePoints = false,
        onlineStatus = OnlineCompatibilityStatus.VERIFY_REQUIRED,
        onlineStatusLabelAr = "يتطلب تحقق المنظم من خوادم الإصدار / LAN / Crossplay قبل الاعتماد",
        compatibilityNoteAr = "يُعرض Call of Duty كخيار موحد؛ على المنظم تحديد قواعد المواجهة والتحقق من توافق الإصدار وخوادم اللعب (أونلاين أو LAN) قبل انطلاق البطولة."
    )
)

fun findApprovedGamePreset(title: String?): GamePreset? {
    val clean = title?.trim().orEmpty()
    if (clean.isEmpty()) return null
    return GAME_CATALOG.firstOrNull {
        it.id.equals(clean, ignoreCase = true) || it.label.equals(clean, ignoreCase = true)
    }
}
