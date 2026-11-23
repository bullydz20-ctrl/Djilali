package com.example.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

enum class GameThemeKey {
    FOOTBALL,
    FIGHTING,
    ARCADE
}

data class GameThemeAccent(
    val key: GameThemeKey,
    val primary: Color,
    val secondary: Color,
    val backgroundTop: Color
)

val LocalGameThemeAccent = staticCompositionLocalOf {
    GameThemeAccent(
        key = GameThemeKey.ARCADE,
        primary = ElectricCobalt,
        secondary = CyberSky,
        backgroundTop = ObsidianVoid
    )
}

fun resolveGameThemeKey(gameTitle: String?): GameThemeKey {
    val g = gameTitle.orEmpty().lowercase()
    return when {
        g.contains("fifa") || g.contains("fc ") || g.contains("ea fc") || g.contains("pes") || g.contains("efootball") -> GameThemeKey.FOOTBALL
        g.contains("tekken") || g.contains("mortal") || g.contains("street fighter") || g.contains("kombat") -> GameThemeKey.FIGHTING
        else -> GameThemeKey.ARCADE
    }
}

private val FifaDarkColorScheme = darkColorScheme(
    primary = ElectricCobalt,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF17367A),
    onPrimaryContainer = Color(0xFFD8E6FF),
    secondary = RoyalViolet,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFF3E1C78),
    onSecondaryContainer = Color(0xFFEDE4FF),
    tertiary = ChampionshipGold,
    onTertiary = ObsidianVoid,
    tertiaryContainer = Color(0xFF3D2C05),
    onTertiaryContainer = Color(0xFFFFE08A),
    background = ObsidianVoid,
    onBackground = TextPrimary,
    surface = MidnightSurface,
    onSurface = TextPrimary,
    surfaceVariant = ElevatedNavy,
    onSurfaceVariant = TextSecondary,
    surfaceContainerLowest = ObsidianVoid,
    surfaceContainerLow = Color(0xFF0B1020),
    surfaceContainer = MidnightSurface,
    surfaceContainerHigh = ElevatedNavy,
    surfaceContainerHighest = Color(0xFF1E294D),
    outline = CardBorder,
    outlineVariant = Color(0xFF1C2647),
    error = CrimsonLoss,
    onError = Color.White
)

private val FootballDarkColorScheme = FifaDarkColorScheme.copy(
    primary = FootballPitchEmerald,
    primaryContainer = Color(0xFF0B4635),
    onPrimaryContainer = Color(0xFFCFFAEA),
    secondary = ChampionshipGold,
    onSecondary = ObsidianVoid,
    background = Color(0xFF06110E),
    surfaceContainerLowest = Color(0xFF06110E),
    surfaceContainerLow = Color(0xFF091A16),
    surface = Color(0xFF0C1E19),
    surfaceContainer = Color(0xFF0C1E19),
    surfaceContainerHigh = Color(0xFF122C24),
    surfaceVariant = Color(0xFF122C24),
    outline = Color(0xFF1F4D3F)
)

private val FightingDarkColorScheme = FifaDarkColorScheme.copy(
    primary = FightingCrimson,
    primaryContainer = Color(0xFF5A1624),
    onPrimaryContainer = Color(0xFFFFDADF),
    secondary = NeonViolet,
    secondaryContainer = Color(0xFF421968),
    background = Color(0xFF12070C),
    surfaceContainerLowest = Color(0xFF12070C),
    surfaceContainerLow = Color(0xFF1A0B12),
    surface = Color(0xFF1D0D15),
    surfaceContainer = Color(0xFF1D0D15),
    surfaceContainerHigh = Color(0xFF2B1420),
    surfaceVariant = Color(0xFF2B1420),
    outline = Color(0xFF4B2135)
)

private val FifaShapes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(26.dp)
)

@Composable
fun FifaTournamentTheme(
    gameTitle: String? = null,
    content: @Composable () -> Unit
) {
    val themeKey = resolveGameThemeKey(gameTitle)
    val colorScheme = when (themeKey) {
        GameThemeKey.FOOTBALL -> FootballDarkColorScheme
        GameThemeKey.FIGHTING -> FightingDarkColorScheme
        GameThemeKey.ARCADE -> FifaDarkColorScheme
    }
    val accent = when (themeKey) {
        GameThemeKey.FOOTBALL -> GameThemeAccent(GameThemeKey.FOOTBALL, FootballPitchEmerald, ChampionshipGold, FootballPitchDeep)
        GameThemeKey.FIGHTING -> GameThemeAccent(GameThemeKey.FIGHTING, FightingCrimson, NeonViolet, FightingArenaDeep)
        GameThemeKey.ARCADE -> GameThemeAccent(GameThemeKey.ARCADE, ElectricCobalt, CyberSky, ObsidianVoid)
    }

    CompositionLocalProvider(
        LocalLayoutDirection provides LayoutDirection.Rtl,
        LocalGameThemeAccent provides accent
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            shapes = FifaShapes,
            content = content
        )
    }
}
