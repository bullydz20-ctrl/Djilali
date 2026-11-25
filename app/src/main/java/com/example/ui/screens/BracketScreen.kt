package com.example.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.model.MatchStage
import com.example.data.model.RaceStage
import com.example.security.AdminPermission
import com.example.security.hasPermission
import com.example.ui.components.BracketConnectorCanvas
import com.example.ui.components.BracketMatchNode
import com.example.ui.components.BracketMatchWinnerDialog
import com.example.ui.components.BracketStagePillsBar
import com.example.ui.components.ChampionPedestalNode
import com.example.ui.components.EmptyStatePanel
import com.example.ui.components.PlayerAvatar
import com.example.ui.components.drawChampionConnectorLine
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.ElevatedNavy
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentUiState

@Composable
fun BracketScreen(
    uiState: TournamentUiState,
    onEditMatch: (MatchEntity) -> Unit,
    onSelectWinner: (match: MatchEntity, winnerPlayerId: Long?) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    val tournament = uiState.tournament
    val knockoutMatches = uiState.knockoutMatches
    val playersById = uiState.players.associateBy { it.id }
    val canEditScores = uiState.currentAdmin?.hasPermission(AdminPermission.EDIT_SCORES) == true

    if (tournament?.format?.isRacing == true) {
        val finalRaces = uiState.races.filter { it.stage == RaceStage.FINAL }
        if (uiState.races.isEmpty() && uiState.racingStandings.isEmpty()) {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                EmptyStatePanel(
                    icon = Icons.Default.EmojiEvents,
                    title = "منصة التتويج والسباق النهائي",
                    subtitle = "هذه البطولة بنظام السباقات؛ ستظهر منصة التتويج والسباق النهائي هنا بمجرد إضافة السباقات وتسجيل المراكز من تبويب السباقات."
                )
            }
            return
        }

        LazyColumn(
            modifier = modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                    border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.6f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = ChampionshipGold)
                            Column {
                                Text(
                                    text = "منصة التتويج والسباق النهائي",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ChampionshipGold,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "${tournament.gameTitle} • ${tournament.format.labelAr}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = CyberSky
                                )
                            }
                        }
                        if (uiState.championPlayer != null) {
                            ChampionPedestalNode(
                                champion = uiState.championPlayer,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(160.dp)
                            )
                        }
                    }
                }
            }

            if (finalRaces.isNotEmpty()) {
                items(finalRaces, key = { "final_race_${it.id}" }) { finalRace ->
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.7f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Icon(Icons.Default.Flag, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(18.dp))
                                    Text(
                                        text = finalRace.title.ifBlank { "السباق النهائي" },
                                        style = MaterialTheme.typography.titleSmall,
                                        color = ChampionshipGold,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(
                                    text = if (finalRace.isCompleted) "مكتمل" else "بانتظار النتائج",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (finalRace.isCompleted) EmeraldWin else CyberSky
                                )
                            }
                            if (finalRace.trackName.isNotBlank()) {
                                Text("الحلبة: ${finalRace.trackName}", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            }
                            if (finalRace.results.isEmpty()) {
                                Text("لم تُسجل مراكز السباق النهائي بعد.", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            } else {
                                finalRace.results.sortedWith(
                                    compareBy<com.example.api.RaceResultEntry> { it.dnf }
                                        .thenBy { it.position ?: Int.MAX_VALUE }
                                ).forEach { res ->
                                    val p = playersById[res.playerId]
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${if (res.dnf) "DNF" else "#${res.position ?: "-"} "} ${p?.name ?: "متسابق #${res.playerId}"}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = if (res.dnf) CrimsonLoss else TextPrimary
                                        )
                                        Text(
                                            text = "+${res.pointsAwarded} ن",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = ChampionshipGold,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (uiState.racingStandings.isNotEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                        border = BorderStroke(1.dp, CardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "ترتيب المتسابقين النهائي (${uiState.racingStandings.size})",
                                style = MaterialTheme.typography.titleMedium,
                                color = CyberSky,
                                fontWeight = FontWeight.Bold
                            )
                            uiState.racingStandings.forEachIndexed { idx, row ->
                                if (idx > 0) HorizontalDivider(color = CardBorder.copy(alpha = 0.4f))
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text(
                                            text = "#${row.rank}",
                                            style = MaterialTheme.typography.labelLarge,
                                            color = if (row.rank == 1) ChampionshipGold else CyberSky,
                                            fontWeight = FontWeight.Bold
                                        )
                                        PlayerAvatar(row.player.avatarUri, row.player.name, size = 30.dp)
                                        Column {
                                            Text(
                                                text = row.player.name,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = TextPrimary,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Text(
                                                text = "سباقات: ${row.racesEntered} • فوز: ${row.wins} • منصة: ${row.podiums}" +
                                                    if (row.isQualified) " • متأهل" else "",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = if (row.isQualified) EmeraldWin else TextSecondary
                                            )
                                        }
                                    }
                                    Surface(
                                        color = ElevatedNavy,
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.4f))
                                    ) {
                                        Text(
                                            text = "${row.totalPoints} ن",
                                            style = MaterialTheme.typography.labelLarge,
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
            }
        }
        return
    }

    if (knockoutMatches.isEmpty()) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            EmptyStatePanel(
                icon = Icons.Default.AccountTree,
                title = "مخطط الأدوار الإقصائية غير جاهز بعد",
                subtitle = "عند بدء الأدوار الإقصائية أو تأهيل المتصدرين من لوحة المشرف، سيظهر المخطط التفاعلي هنا من دور الـ 16 حتى النهائي."
            )
        }
        return
    }

    val matchesByStage = remember(knockoutMatches) {
        knockoutMatches.groupBy { it.stage }
            .mapValues { (_, list) -> list.sortedBy { it.bracketIndex } }
    }

    val rounds = remember(matchesByStage) {
        matchesByStage
            .filterKeys { it != MatchStage.THIRD_PLACE }
            .toList()
            .sortedBy { it.first.order }
    }
    val thirdPlaceMatches = remember(matchesByStage) {
        matchesByStage[MatchStage.THIRD_PLACE].orEmpty()
    }

    var selectedStage by remember(knockoutMatches.size) { mutableStateOf<MatchStage?>(null) }
    var activeWinnerDialogMatch by remember { mutableStateOf<MatchEntity?>(null) }

    val completedCount = knockoutMatches.count { it.isCompleted }
    val totalCount = knockoutMatches.size
    val finalMatch = matchesByStage[MatchStage.FINAL]?.firstOrNull()
    val championPlayer = uiState.championPlayer ?: finalMatch?.winnerId?.let { playersById[it] }

    Column(modifier = modifier.fillMaxSize()) {
        // Interactive Bracket Header & Progress
        Surface(
            color = MidnightSurface,
            tonalElevation = 2.dp,
            border = BorderStroke(1.dp, CardBorder.copy(alpha = 0.6f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(
                            imageVector = Icons.Default.AccountTree,
                            contentDescription = null,
                            tint = ChampionshipGold,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            val boTag = if ((tournament?.bestOf ?: 1) > 1) " • Best of ${tournament?.bestOf}" else ""
                            Text(
                                text = "مخطط الأدوار الإقصائية التفاعلي$boTag",
                                style = MaterialTheme.typography.titleMedium,
                                color = ChampionshipGold,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (canEditScores) {
                                    "اضغط على أي مواجهة لتحديث الفائز أو تسجيل النتيجة"
                                } else {
                                    "اسحب للتنقل أو اختر المرحلة من الشريط أدناه"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = CyberSky
                            )
                        }
                    }

                    Surface(
                        color = ElectricCobalt.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ElectricCobalt.copy(alpha = 0.55f))
                    ) {
                        Text(
                            text = "$completedCount / $totalCount",
                            style = MaterialTheme.typography.labelMedium,
                            color = CyberSky,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                LinearProgressIndicator(
                    progress = {
                        if (totalCount > 0) completedCount.toFloat() / totalCount.toFloat() else 0f
                    },
                    color = ChampionshipGold,
                    trackColor = ElevatedNavy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                )

                BracketStagePillsBar(
                    selectedStage = selectedStage,
                    matchesByStage = matchesByStage,
                    onSelectStage = { stage ->
                        selectedStage = if (selectedStage == stage && stage != null) null else stage
                    }
                )
            }
        }

        AnimatedContent(
            targetState = selectedStage,
            label = "bracket_view_mode",
            modifier = Modifier.fillMaxSize()
        ) { focusedStage ->
            if (focusedStage == null) {
                FullKnockoutTreeCanvas(
                    rounds = rounds,
                    thirdPlaceMatches = thirdPlaceMatches,
                    playersById = playersById,
                    championPlayer = championPlayer,
                    canEditScores = canEditScores,
                    onMatchClick = { match ->
                        if (canEditScores) {
                            activeWinnerDialogMatch = match
                        }
                    }
                )
            } else {
                FocusedStageMatchesList(
                    stage = focusedStage,
                    matches = matchesByStage[focusedStage].orEmpty(),
                    playersById = playersById,
                    championPlayer = if (focusedStage == MatchStage.FINAL) championPlayer else null,
                    canEditScores = canEditScores,
                    onMatchClick = { match ->
                        if (canEditScores) {
                            activeWinnerDialogMatch = match
                        }
                    }
                )
            }
        }
    }

    activeWinnerDialogMatch?.let { targetMatch ->
        val latestMatch = knockoutMatches.find { it.id == targetMatch.id } ?: targetMatch
        val p1 = latestMatch.player1Id?.let { playersById[it] }
        val p2 = latestMatch.player2Id?.let { playersById[it] }
        if (p1 != null && p2 != null) {
            BracketMatchWinnerDialog(
                match = latestMatch,
                player1 = p1,
                player2 = p2,
                onDismiss = { activeWinnerDialogMatch = null },
                onSelectWinner = { winnerId ->
                    onSelectWinner(latestMatch, winnerId)
                    activeWinnerDialogMatch = null
                },
                onOpenScoreEditor = {
                    activeWinnerDialogMatch = null
                    onEditMatch(latestMatch)
                }
            )
        }
    }
}

@Composable
private fun FullKnockoutTreeCanvas(
    rounds: List<Pair<MatchStage, List<MatchEntity>>>,
    thirdPlaceMatches: List<MatchEntity>,
    playersById: Map<Long, PlayerEntity>,
    championPlayer: PlayerEntity?,
    canEditScores: Boolean,
    onMatchClick: (MatchEntity) -> Unit
) {
    val cardWidth = 232.dp
    val cardHeight = 108.dp
    val baseSlotHeight = 128.dp
    val connectorWidth = 42.dp
    val headerHeight = 44.dp
    val championColumnWidth = 176.dp
    val championCardHeight = 166.dp

    val firstRoundCount = rounds.firstOrNull()?.second?.size?.coerceAtLeast(1) ?: 1
    val totalBracketHeight = baseSlotHeight * firstRoundCount

    val hScroll = rememberScrollState()
    val vScroll = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .drawBehind {
                drawCircle(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            ChampionshipGold.copy(alpha = 0.08f),
                            ElectricCobalt.copy(alpha = 0.04f),
                            Color.Transparent
                        ),
                        center = Offset(size.width * 0.2f, size.height * 0.35f),
                        radius = size.maxDimension * 0.55f
                    )
                )
            }
            .horizontalScroll(hScroll)
            .verticalScroll(vScroll)
            .padding(16.dp)
            .testTag("bracket_full_tree")
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Row(verticalAlignment = Alignment.Top) {
            rounds.forEachIndexed { roundIdx, (stage, sortedMatches) ->
                val multiplier = 1 shl roundIdx
                val slotHeight = baseSlotHeight * multiplier
                val isFinalRound = (stage == MatchStage.FINAL)

                // Round Column
                Column(
                    modifier = Modifier.width(cardWidth),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        color = if (isFinalRound) ChampionshipGold.copy(alpha = 0.22f) else ElevatedNavy,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(
                            1.dp,
                            if (isFinalRound) ChampionshipGold else ElectricCobalt.copy(alpha = 0.6f)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(36.dp)
                            .testTag("bracket_round_header_${stage.name}")
                    ) {
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            if (isFinalRound) {
                                Icon(
                                    imageVector = Icons.Default.EmojiEvents,
                                    contentDescription = null,
                                    tint = ChampionshipGold,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                            }
                            Text(
                                text = stage.labelAr,
                                style = MaterialTheme.typography.labelLarge,
                                color = if (isFinalRound) ChampionshipGold else TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Box(
                        modifier = Modifier
                            .width(cardWidth)
                            .height(totalBracketHeight)
                    ) {
                        sortedMatches.forEachIndexed { idx, match ->
                            val centerY = slotHeight * idx + slotHeight / 2f
                            val topOffset = centerY - cardHeight / 2f
                            BracketMatchNode(
                                match = match,
                                player1 = match.player1Id?.let { playersById[it] },
                                player2 = match.player2Id?.let { playersById[it] },
                                isFinal = isFinalRound,
                                canEdit = canEditScores,
                                onClick = { onMatchClick(match) },
                                modifier = Modifier
                                    .offset(y = topOffset)
                                    .width(cardWidth)
                                    .height(cardHeight)
                            )
                        }
                    }
                }

                // Connector between rounds
                if (roundIdx < rounds.lastIndex) {
                    val nextMatchCount = rounds[roundIdx + 1].second.size
                    val nextSlotHeight = baseSlotHeight * (1 shl (roundIdx + 1))

                    BracketConnectorCanvas(
                        matchesInRound = sortedMatches,
                        nextMatchCount = nextMatchCount,
                        slotHeight = slotHeight,
                        nextSlotHeight = nextSlotHeight,
                        connectorWidth = connectorWidth,
                        totalBracketHeight = totalBracketHeight,
                        headerTopOffset = headerHeight
                    )
                }
            }

            // Connector from Final to Champion Pedestal
            Canvas(
                modifier = Modifier
                    .padding(top = headerHeight)
                    .width(34.dp)
                    .height(totalBracketHeight)
            ) {
                drawChampionConnectorLine(
                    drawScope = this,
                    hasChampion = championPlayer != null
                )
            }

            // Champion Pedestal Column
            Column(
                modifier = Modifier.width(championColumnWidth),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Surface(
                    color = ChampionshipGold.copy(alpha = 0.18f),
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, ChampionshipGold),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(36.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = "التتويج باللقب",
                            style = MaterialTheme.typography.labelLarge,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Box(
                    modifier = Modifier
                        .width(championColumnWidth)
                        .height(totalBracketHeight),
                    contentAlignment = Alignment.Center
                ) {
                        ChampionPedestalNode(
                            champion = championPlayer,
                            modifier = Modifier
                                .width(championColumnWidth)
                                .height(championCardHeight)
                        )
                    }
                }
            }

            if (thirdPlaceMatches.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(
                        color = ElevatedNavy,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = "مباراة تحديد المركز الثالث 🥉",
                            style = MaterialTheme.typography.labelLarge,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        thirdPlaceMatches.forEach { m ->
                            BracketMatchNode(
                                match = m,
                                player1 = m.player1Id?.let { playersById[it] },
                                player2 = m.player2Id?.let { playersById[it] },
                                isFinal = false,
                                canEdit = canEditScores,
                                onClick = { onMatchClick(m) },
                                modifier = Modifier
                                    .width(cardWidth)
                                    .height(cardHeight)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FocusedStageMatchesList(
    stage: MatchStage,
    matches: List<MatchEntity>,
    playersById: Map<Long, PlayerEntity>,
    championPlayer: PlayerEntity?,
    canEditScores: Boolean,
    onMatchClick: (MatchEntity) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .testTag("bracket_focused_stage_${stage.name}"),
        contentAlignment = Alignment.TopCenter
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = 600.dp),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "مواجهات ${stage.labelAr} (${matches.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = ChampionshipGold,
                    fontWeight = FontWeight.Bold
                )
            }

            items(matches, key = { it.id }) { match ->
                BracketMatchNode(
                    match = match,
                    player1 = match.player1Id?.let { playersById[it] },
                    player2 = match.player2Id?.let { playersById[it] },
                    isFinal = stage == MatchStage.FINAL,
                    canEdit = canEditScores,
                    onClick = { onMatchClick(match) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(114.dp)
                )
            }

            if (stage == MatchStage.FINAL) {
                item {
                    Spacer(modifier = Modifier.height(4.dp))
                    ChampionPedestalNode(
                        champion = championPlayer,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(168.dp)
                    )
                }
            }
        }
    }
}
