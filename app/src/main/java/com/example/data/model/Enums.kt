package com.example.data.model

enum class TournamentFormat(val labelAr: String, val descriptionAr: String) {
    GROUPS_KNOCKOUT("مجموعات + أدوار إقصائية", "توزيع على مجموعات ثم تأهل المتصدرين للأدوار الإقصائية"),
    LEAGUE_KNOCKOUT("دوري + أدوار إقصائية", "مواجهات بنظام الدوري ثم تأهل أفضل اللاعبين للإقصائيات"),
    DIRECT_KNOCKOUT("خروج مباشر (إقصائيات فقط)", "مواجهات إقصائية مباشرة من الدور الأول حتى النهائي")
}

enum class DrawMode(val labelAr: String) {
    RANDOM("قرعة عشوائية تلقائية"),
    MANUAL("قرعة يدوية مخصصة")
}

enum class KnockoutTieRule(val labelAr: String, val shortAr: String) {
    SINGLE_MATCH_PENALTIES(
        "مباراة واحدة (مع أشواط إضافية وركلات ترجيح عند التعادل)",
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

enum class MatchStage(val labelAr: String, val order: Int) {
    GROUP("دور المجموعات", 1),
    LEAGUE("مرحلة الدوري", 1),
    ROUND_OF_16("دور الـ 16", 2),
    QUARTER_FINAL("ربع النهائي", 3),
    SEMI_FINAL("نصف النهائي", 4),
    THIRD_PLACE("تحديد المركز الثالث", 5),
    FINAL("المباراة النهائية", 6)
}

enum class AdminRole(val labelAr: String) {
    HEAD_ADMIN("المشرف الرئيسي"),
    SUB_ADMIN("مشرف مساعد")
}

enum class TournamentStatus(val labelAr: String) {
    REGISTRATION_OPEN("التسجيل مفتوح"),
    REGISTRATION_CLOSED("التسجيل مغلق"),
    GROUP_STAGE("مرحلة المجموعات / الدوري"),
    KNOCKOUT_STAGE("الأدوار الإقصائية"),
    COMPLETED("انتهت البطولة")
}

data class GamePreset(
    val id: String,
    val label: String,
    val categoryAr: String,
    val scoreUnitLabel: String,
    val defaultRule: String,
    val defaultDurationMinutes: Int
)

val GAME_CATALOG: List<GamePreset> = listOf(
    GamePreset("FIFA 22", "FIFA 22", "كرة قدم", "هدف", "المباراة الكاملة (6 دقائق لكل شوط)", 12),
    GamePreset("EA SPORTS FC 25", "EA SPORTS FC 25", "كرة قدم", "هدف", "المباراة الكاملة (6 دقائق لكل شوط)", 12),
    GamePreset("eFootball PES", "eFootball PES", "كرة قدم", "هدف", "مباراة كاملة 10 دقائق + إضافي عند الإقصائيات", 10),
    GamePreset("Tekken 8", "Tekken 8", "ألعاب قتال", "جولة", "الأفضل من 3 جولات (FT3 / Bo5)", 8),
    GamePreset("Mortal Kombat 1", "Mortal Kombat 1", "ألعاب قتال", "جولة", "الأفضل من 3 جولات (FT3)", 8),
    GamePreset("Street Fighter 6", "Street Fighter 6", "ألعاب قتال", "جولة", "الأفضل من 3 جولات (FT2 / FT3)", 8),
    GamePreset("Call of Duty", "Call of Duty", "تصويب وأكشن", "نقطة", "نظام القتلات / السيطرة أو Search & Destroy", 15),
    GamePreset("Rocket League", "Rocket League", "رياضة مركبات", "هدف", "مباراة 5 دقائق + هدف ذهبي", 7),
    GamePreset("NBA 2K", "NBA 2K", "كرة سلة", "نقطة", "4 أرباع × 5 دقائق", 20),
    GamePreset("Fortnite", "Fortnite", "باتل رويال", "نقطة", "بناء حر / تصفية Box Fight من 5 جولات", 12),
    GamePreset("PUBG", "PUBG", "باتل رويال", "نقطة", "أعلى مجموع نقاط وتصفيات", 20)
)

