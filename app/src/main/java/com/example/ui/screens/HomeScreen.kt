package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Leaderboard
import androidx.compose.material.icons.filled.MilitaryTech
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.api.HallOfFameEntry
import com.example.api.RaceEntry
import com.example.api.SeasonLeaderboardEntry
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.model.PlayMode
import com.example.data.model.RaceStage
import com.example.data.model.TournamentFormat
import com.example.data.model.findApprovedGamePreset
import com.example.domain.PlayerStats
import com.example.security.AdminPermission
import com.example.security.hasPermission
import com.example.ui.components.ChampionShowcaseCard
import com.example.ui.components.EmptyStatePanel
import com.example.ui.components.MatchResultsTableCard
import com.example.ui.components.OnlineCompatibilityBanner
import com.example.ui.components.PlayerAvatar
import com.example.ui.components.RacingOverviewSection
import com.example.ui.components.ScheduledRemindersCard
import com.example.ui.components.TournamentExportShareCard
import com.example.ui.components.TournamentHeroBanner
import com.example.ui.components.WebPortalAccessCard
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.ElevatedNavy
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.RoyalViolet
import com.example.ui.theme.ScoreDisplayStyle
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentUiState

@Composable
fun HomeScreen(
    uiState: TournamentUiState,
    onOpenRegister: () -> Unit,
    onEditMatch: (MatchEntity) -> Unit,
    onQuickUpdateGoals: (MatchEntity, Int, Int) -> Unit = { _, _, _ -> },
    onOpenExportShare: () -> Unit = {},
    onOpenReminder: (MatchEntity) -> Unit = {},
    onCancelReminder: (Long) -> Unit = {},
    onOpenAdmin: () -> Unit = {},
    officialWebUrl: String = "",
    onOpenWebPortal: () -> Unit = {},
    onCopyWebUrl: () -> Unit = {},
    onRetryConnection: () -> Unit = {},
    onConfigureServerUrl: () -> Unit = {},
    onToggleCheckIn: (MatchEntity, Int) -> Unit = { _, _ -> },
    onVotePrediction: (MatchEntity, Int) -> Unit = { _, _ -> },
    onOpenDispute: ((MatchEntity) -> Unit)? = null,
    onPlayerClick: ((PlayerEntity) -> Unit)? = null,
    onCelebrateChampion: (() -> Unit)? = null,
    onCreateRace: (String, RaceStage, String) -> Unit = { _, _, _ -> },
    onEditRaceResults: (RaceEntry) -> Unit = {},
    onGenerateFinalRace: () -> Unit = {},
    onDeleteRace: (Long) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val tournament = uiState.tournament
    if (tournament == null) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically)
        ) {
            if (!uiState.isLoaded) {
                EmptyStatePanel(
                    icon = Icons.Default.SportsEsports,
                    title = "جاري اختبار الاتصال بخادم CP4 ARENA",
                    subtitle = "يتم التحقق من جاهزية الخادم المركزي ($officialWebUrl) وتحميل البطولات..."
                )
            } else if (uiState.connectionError != null) {
                ServerConnectionErrorBanner(
                    errorMessage = uiState.connectionError,
                    activeUrl = officialWebUrl,
                    onRetryConnection = onRetryConnection,
                    onConfigureServerUrl = onConfigureServerUrl
                )
            } else {
                EmptyStatePanel(
                    icon = Icons.Default.SportsEsports,
                    title = "لا توجد بطولة نشطة حالياً",
                    subtitle = "تم حذف البطولة أو لم يتم إنشاء بطولة بعد. يمكن للمشرف إنشاء بطولة جديدة لأي لعبة.",
                    actionLabel = "إنشاء بطولة من الإدارة",
                    onAction = onOpenAdmin
                )
            }
            WebPortalAccessCard(
                webUrl = officialWebUrl,
                onOpenWeb = onOpenWebPortal,
                onCopyWebUrl = onCopyWebUrl,
                isRealtimeConnected = uiState.isRealtimeConnected,
                onConfigureServerUrl = onConfigureServerUrl
            )
        }
        return
    }

    val scoreUnit = tournament.scoreUnitLabel.ifBlank { "نقطة" }
    val playersById = uiState.players.associateBy { it.id }
    val remindersByMatchId = uiState.matchReminders.associateBy { it.matchId }
    val canEditScores = uiState.currentAdmin?.hasPermission(AdminPermission.EDIT_SCORES) == true

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (!uiState.isServerReachable && uiState.connectionError != null) {
            item {
                ServerConnectionErrorBanner(
                    errorMessage = uiState.connectionError,
                    activeUrl = officialWebUrl,
                    onRetryConnection = onRetryConnection,
                    onConfigureServerUrl = onConfigureServerUrl
                )
            }
        }
        item {
            TournamentHeroBanner(
                tournament = tournament,
                approvedCount = uiState.approvedPlayers.size,
                pendingCount = uiState.pendingPlayers.size,
                isRegistrationOpen = uiState.isRegistrationOpenNow,
                onRegisterClick = onOpenRegister
            )
        }

        if (uiState.championPlayer != null) {
            item {
                ChampionShowcaseCard(
                    champion = uiState.championPlayer,
                    onCelebrate = onCelebrateChampion,
                    onPlayerClick = onPlayerClick
                )
            }
        }

        // Tournament rules card
        item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                    border = BorderStroke(1.dp, CardBorder)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "قوانين ونظام البطولة",
                            style = MaterialTheme.typography.titleMedium,
                            color = ChampionshipGold
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            RulePill(
                                icon = Icons.Default.Timer,
                                title = "مدة المباراة",
                                value = "${tournament.matchDurationMinutes} دقيقة",
                                modifier = Modifier.weight(1f)
                            )
                            RulePill(
                                icon = Icons.Default.SportsScore,
                                title = "اللعبة وقواعد اللعب",
                                value = "${tournament.gameTitle} • ${tournament.targetGoalsRule}",
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            RulePill(
                                icon = Icons.Default.EmojiEvents,
                                title = "حسم الإقصائيات",
                                value = tournament.knockoutTieRule.shortAr,
                                modifier = Modifier.weight(1f)
                            )
                        RulePill(
                            icon = Icons.Default.MilitaryTech,
                            title = "التأهل والنظام",
                            value = when (tournament.format) {
                                TournamentFormat.GROUPS_KNOCKOUT -> "${tournament.qualifiersPerGroup} من كل مجموعة"
                                TournamentFormat.LEAGUE_KNOCKOUT -> "أفضل ${tournament.qualifiersPerGroup} في الدوري"
                                TournamentFormat.DIRECT_KNOCKOUT -> "خروج مباشر"
                                TournamentFormat.RACE_POINTS -> "نقاط السباقات"
                                TournamentFormat.RACE_QUALIFIERS_FINAL -> "تصفيات ثم نهائي (${tournament.qualifiersPerGroup} متأهلين)"
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        val playModeLabel = if (tournament.playMode == PlayMode.TEAMS) {
                            "${tournament.playMode.labelAr} (${tournament.teamSize} لاعبين)"
                        } else {
                            tournament.playMode.labelAr
                        }
                        RulePill(
                            icon = Icons.Default.SportsEsports,
                            title = "نمط اللعب",
                            value = playModeLabel,
                            modifier = Modifier.weight(1f)
                        )
                        if (tournament.bestOf > 1 || tournament.format.isRacing) {
                            RulePill(
                                icon = Icons.Default.Star,
                                title = if (tournament.format.isRacing) "نظام الحسم" else "نظام السلسلة",
                                value = if (tournament.format.isRacing) "نقاط المراكز" else "Best of ${tournament.bestOf}",
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    findApprovedGamePreset(tournament.gameTitle)?.let { preset ->
                        OnlineCompatibilityBanner(preset = preset)
                    }
                }
            }
        }

        if (tournament.format.isRacing) {
            item {
                SectionTitle(title = "ترتيب المتسابقين والسباقات")
            }
            item {
                RacingOverviewSection(
                    tournament = tournament,
                    races = uiState.races,
                    standings = uiState.racingStandings,
                    playersById = playersById,
                    approvedPlayers = uiState.approvedPlayers,
                    canManageRaces = canEditScores,
                    onCreateRace = onCreateRace,
                    onEditRaceResults = onEditRaceResults,
                    onGenerateFinalRace = onGenerateFinalRace,
                    onDeleteRace = onDeleteRace,
                    onPlayerClick = onPlayerClick
                )
            }
        } else {
            // Tournament Statistics & Top Players
            item {
                SectionTitle(title = "إحصائيات البطولة وأفضل اللاعبين")
            }

            item {
                val stats = uiState.overviewStats
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        StatHighlightCard(
                            icon = Icons.Default.SportsScore,
                            label = if (scoreUnit == "هدف") "إجمالي الأهداف" else "إجمالي ($scoreUnit)",
                            value = stats.totalGoals.toString(),
                            subtext = "في ${stats.completedMatches} / ${stats.totalMatches} مباراة",
                            accent = CyberSky,
                            modifier = Modifier.weight(1f)
                        )
                        StatHighlightCard(
                            icon = Icons.Default.Star,
                            label = if (scoreUnit == "هدف") "هداف البطولة" else "الأعلى تسجيلاً",
                            value = stats.topScorer?.player?.name ?: "—",
                            subtext = stats.topScorer?.let { "${it.goalsScored} $scoreUnit" } ?: "بانتظار المباريات",
                            accent = ChampionshipGold,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        StatHighlightCard(
                            icon = Icons.Default.Shield,
                            label = "أقوى دفاع",
                            value = stats.bestDefense?.player?.name ?: "—",
                            subtext = stats.bestDefense?.let { "استقبل ${it.goalsConceded} • شباك نظيفة ${it.cleanSheets}" }
                                ?: "بانتظار المباريات",
                            accent = EmeraldWin,
                            modifier = Modifier.weight(1f)
                        )
                        StatHighlightCard(
                            icon = Icons.AutoMirrored.Filled.TrendingUp,
                            label = "أعلى نسبة فوز",
                            value = stats.highestWinRate?.player?.name ?: "—",
                            subtext = stats.highestWinRate?.let { "${it.winRatePercent}% (${it.wins} فوز)" }
                                ?: "بانتظار المباريات",
                            accent = RoyalViolet,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            val topPlayers = uiState.playerStats.filter { it.matchesPlayed > 0 }.take(5)
            if (topPlayers.isNotEmpty()) {
                items(topPlayers, key = { "top_${it.player.id}" }) { stat ->
                    TopPlayerRow(
                        stat = stat,
                        scoreUnitLabel = scoreUnit,
                        onClick = if (onPlayerClick != null) {
                            { onPlayerClick(stat.player) }
                        } else null
                    )
                }
            }

            // Live & Recent Matches
            item {
                SectionTitle(title = "جدول المباريات والنتائج المباشرة")
            }

            if (uiState.allMatches.isEmpty()) {
                item {
                    EmptyStatePanel(
                        icon = Icons.Default.SportsScore,
                        title = "لم تبدأ القرعة بعد",
                        subtitle = "عند اعتماد اللاعبين وإجراء القرعة من لوحة المشرف، ستظهر جميع المباريات والنتائج المباشرة هنا."
                    )
                }
            } else {
                val orderedMatches = uiState.allMatches.sortedWith(
                    compareBy<MatchEntity> { it.isCompleted }
                        .thenByDescending { it.stage.order }
                        .thenBy { it.roundNumber }
                )
                item {
                    MatchResultsTableCard(
                        matches = orderedMatches,
                        playersById = playersById,
                        canEdit = canEditScores,
                        onQuickUpdateGoals = onQuickUpdateGoals,
                        onOpenDetailedEditor = onEditMatch,
                        remindersByMatchId = remindersByMatchId,
                        onOpenReminder = onOpenReminder,
                        onToggleCheckIn = onToggleCheckIn,
                        onVotePrediction = onVotePrediction,
                        onOpenDispute = onOpenDispute,
                        onPlayerClick = onPlayerClick,
                        showFilters = true,
                        maxVisibleRows = 12
                    )
                }
            }
        }

        if (uiState.seasonLeaderboard.isNotEmpty()) {
            item {
                SeasonLeaderboardCard(
                    entries = uiState.seasonLeaderboard.take(10),
                    playersByElysiumId = uiState.players.associateBy { it.elysiumNetId.lowercase() },
                    onPlayerClick = onPlayerClick
                )
            }
        }

        if (uiState.hallOfFame.isNotEmpty()) {
            item {
                HallOfFameCard(entries = uiState.hallOfFame)
            }
        }

        if (uiState.allMatches.isNotEmpty() || uiState.matchReminders.isNotEmpty()) {
            item {
                ScheduledRemindersCard(
                    reminders = uiState.matchReminders,
                    onCancelReminder = onCancelReminder
                )
            }
        }

        item {
            TournamentExportShareCard(
                onOpenExportShare = onOpenExportShare,
                tag = "home_export_share_card"
            )
        }

        item {
            WebPortalAccessCard(
                webUrl = officialWebUrl,
                onOpenWeb = onOpenWebPortal,
                onCopyWebUrl = onCopyWebUrl,
                isRealtimeConnected = uiState.isRealtimeConnected,
                onConfigureServerUrl = onConfigureServerUrl
            )
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleLarge,
        color = TextPrimary,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun RulePill(
    icon: ImageVector,
    title: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = ElevatedNavy,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, CardBorder)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = CyberSky, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(title, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.labelLarge,
                color = TextPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun StatHighlightCard(
    icon: ImageVector,
    label: String,
    value: String,
    subtext: String,
    accent: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.45f))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(label, style = MaterialTheme.typography.labelMedium, color = TextSecondary)
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtext,
                style = MaterialTheme.typography.bodySmall,
                color = accent,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun TopPlayerRow(
    stat: PlayerStats,
    scoreUnitLabel: String,
    onClick: (() -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, CardBorder)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                PlayerAvatar(
                    avatarUri = stat.player.avatarUri,
                    playerName = stat.player.name,
                    size = 40.dp,
                    borderColor = ElectricCobalt
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = stat.player.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "${stat.wins} فوز • ${stat.draws} تعادل • ${stat.losses} خسارة",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${stat.goalsScored}",
                    style = ScoreDisplayStyle,
                    color = ChampionshipGold
                )
                Text(
                    text = scoreUnitLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = TextSecondary
                )
            }
        }
    }
}

@Composable
private fun SeasonLeaderboardCard(
    entries: List<SeasonLeaderboardEntry>,
    playersByElysiumId: Map<String, PlayerEntity>,
    onPlayerClick: ((PlayerEntity) -> Unit)?
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("home_season_leaderboard_card"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.55f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Leaderboard, contentDescription = null, tint = ChampionshipGold)
                Column {
                    Text(
                        text = "ترتيب الموسم الشامل (كل البطولات)",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "تقييم تراكمي للألقاب، الوصافة، الانتصارات والأهداف",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                }
            }

            entries.forEachIndexed { idx, entry ->
                if (idx > 0) HorizontalDivider(color = CardBorder.copy(alpha = 0.45f))
                val matchingPlayer = playersByElysiumId[entry.elysiumNetId.lowercase()]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .then(
                            if (matchingPlayer != null && onPlayerClick != null) {
                                Modifier.clickable { onPlayerClick(matchingPlayer) }
                            } else Modifier
                        )
                        .padding(vertical = 6.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(
                                    when (entry.rank) {
                                        1 -> ChampionshipGold.copy(alpha = 0.25f)
                                        2 -> CyberSky.copy(alpha = 0.2f)
                                        3 -> EmeraldWin.copy(alpha = 0.2f)
                                        else -> ElevatedNavy
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "#${entry.rank}",
                                style = MaterialTheme.typography.labelSmall,
                                color = when (entry.rank) {
                                    1 -> ChampionshipGold
                                    2 -> CyberSky
                                    3 -> EmeraldWin
                                    else -> TextSecondary
                                },
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        PlayerAvatar(
                            avatarUri = entry.avatarUrl,
                            playerName = entry.displayName,
                            size = 34.dp,
                            borderColor = if (entry.rank == 1) ChampionshipGold else CardBorder
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = entry.displayName,
                                style = MaterialTheme.typography.titleSmall,
                                color = TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "${entry.titles} 🥇 • ${entry.runnerUps} 🥈 • ${entry.wins} فوز (${entry.winRatePercent}%)",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Surface(
                        color = ElevatedNavy,
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.45f))
                    ) {
                        Text(
                            text = "${entry.seasonPoints} ن",
                            style = MaterialTheme.typography.labelMedium,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HallOfFameCard(entries: List<HallOfFameEntry>) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("home_hall_of_fame_card"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, RoyalViolet.copy(alpha = 0.55f))
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.WorkspacePremium, contentDescription = null, tint = ChampionshipGold)
                Text(
                    text = "قاعة الشرف وسجل الأبطال",
                    style = MaterialTheme.typography.titleMedium,
                    color = ChampionshipGold,
                    fontWeight = FontWeight.Bold
                )
            }

            entries.forEach { entry ->
                Surface(
                    color = ObsidianVoid.copy(alpha = 0.5f),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, CardBorder.copy(alpha = 0.65f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = entry.tournamentName,
                                style = MaterialTheme.typography.titleSmall,
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = entry.gameTitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = CyberSky
                            )
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            PlayerAvatar(
                                avatarUri = entry.championAvatarUrl,
                                playerName = entry.championName,
                                size = 36.dp,
                                borderColor = ChampionshipGold
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "🥇 البطل: ${entry.championName} (${entry.championElysiumNetId})",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ChampionshipGold,
                                    fontWeight = FontWeight.SemiBold
                                )
                                val podiumExtra = buildList {
                                    if (!entry.runnerUpName.isNullOrBlank()) add("🥈 الوصيف: ${entry.runnerUpName}")
                                    if (!entry.thirdPlaceName.isNullOrBlank()) add("🥉 الثالث: ${entry.thirdPlaceName}")
                                }.joinToString(" • ")
                                if (podiumExtra.isNotEmpty()) {
                                    Text(
                                        text = podiumExtra,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ServerConnectionErrorBanner(
    errorMessage: String,
    activeUrl: String,
    onRetryConnection: () -> Unit,
    onConfigureServerUrl: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("connection_error_banner"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF2B1218)),
        border = BorderStroke(1.2.dp, Color(0xFFEF4444).copy(alpha = 0.75f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.CloudOff,
                    contentDescription = null,
                    tint = Color(0xFFFCA5A5),
                    modifier = Modifier.size(26.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "تعذر الاتصال بالخادم المركزي",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color(0xFFFEE2E2),
                        fontWeight = FontWeight.Bold
                    )
                    if (activeUrl.isNotBlank()) {
                        Text(
                            text = activeUrl,
                            style = MaterialTheme.typography.labelSmall,
                            color = CyberSky,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            Text(
                text = errorMessage,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFFECACA)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onRetryConnection,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("error_retry_connection_button")
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("إعادة المحاولة")
                }

                OutlinedButton(
                    onClick = onConfigureServerUrl,
                    border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.7f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("error_configure_server_url_button")
                ) {
                    Icon(
                        Icons.Default.Edit,
                        contentDescription = null,
                        tint = ChampionshipGold,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("تغيير الرابط", color = ChampionshipGold)
                }
            }
        }
    }
}
