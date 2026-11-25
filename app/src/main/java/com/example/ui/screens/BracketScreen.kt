package com.example.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CenterFocusStrong
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.FitScreen
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.model.MatchStage
import com.example.data.model.RaceStage
import com.example.security.AdminPermission
import com.example.security.hasPermission
import com.example.ui.components.BracketFlowDirection
import com.example.ui.components.BracketMatchNode
import com.example.ui.components.BracketMatchWinnerDialog
import com.example.ui.components.BracketPlaceholderNode
import com.example.ui.components.BracketStagePillsBar
import com.example.ui.components.BracketWingFilter
import com.example.ui.components.ChampionPedestalNode
import com.example.ui.components.EmptyStatePanel
import com.example.ui.components.PlayerAvatar
import com.example.ui.components.SemiToFinalConnectorCanvas
import com.example.ui.components.SymmetricalBracketModel
import com.example.ui.components.SymmetricalConnectorCanvas
import com.example.ui.components.buildSymmetricalBracketModel
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.ElevatedNavy
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.RoyalViolet
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentUiState
import kotlin.math.roundToInt

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
    val tournamentBestOf = tournament?.bestOf ?: 1

    if (tournament?.format?.isRacing == true && knockoutMatches.isEmpty()) {
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
    val model = remember(knockoutMatches) { buildSymmetricalBracketModel(knockoutMatches) }

    var selectedStage by remember(knockoutMatches.size) { mutableStateOf<MatchStage?>(null) }
    var selectedWing by remember(knockoutMatches.size) { mutableStateOf(BracketWingFilter.ALL) }
    var activeWinnerDialogMatch by remember { mutableStateOf<MatchEntity?>(null) }

    val completedCount = knockoutMatches.count { it.isCompleted }
    val totalCount = knockoutMatches.size
    val championPlayer = uiState.championPlayer ?: model.finalMatch?.winnerId?.let { playersById[it] }

    Column(modifier = modifier.fillMaxSize()) {
        // Header + Progress + Filter Pills
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
                            val boTag = if (tournamentBestOf > 1) " • Best of $tournamentBestOf" else ""
                            Text(
                                text = "شجرة الأدوار الإقصائية المتناظرة$boTag",
                                style = MaterialTheme.typography.titleMedium,
                                color = ChampionshipGold,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (canEditScores) {
                                    "مسار أيمن وأيسر يلتقيان في النهائي الكبير • اضغط على المواجهة للتحديث"
                                } else {
                                    "قرّب وحرّك الشجرة بحرية أو اختر مساراً محدداً من الأعلى"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = CyberSky,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
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
                        if (stage == null) selectedWing = BracketWingFilter.ALL
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
                SymmetricalBracketViewport(
                    model = model,
                    wingFilter = selectedWing,
                    onSelectWing = { wing -> selectedWing = wing },
                    playersById = playersById,
                    championPlayer = championPlayer,
                    bestOf = tournamentBestOf,
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
                    matchNumbersById = model.matchNumbersById,
                    bestOf = tournamentBestOf,
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
private fun SymmetricalBracketViewport(
    model: SymmetricalBracketModel,
    wingFilter: BracketWingFilter,
    onSelectWing: (BracketWingFilter) -> Unit,
    playersById: Map<Long, PlayerEntity>,
    championPlayer: PlayerEntity?,
    bestOf: Int,
    canEditScores: Boolean,
    onMatchClick: (MatchEntity) -> Unit
) {
    val cardWidth = 220.dp
    val finalCardWidth = 248.dp
    val cardHeight = 122.dp
    val finalCardHeight = 136.dp
    val baseSlotHeight = 142.dp
    val connectorWidth = 38.dp
    val headerHeight = 36.dp
    val headerGap = 10.dp
    val headerTopOffset = headerHeight + headerGap

    val stageCount = model.preFinalStages.size
    val sideWidthDp: Dp = if (stageCount == 0) 0.dp else (cardWidth * stageCount) + (connectorWidth * stageCount)
    val naturalTreeWidthDp: Dp = when (wingFilter) {
        BracketWingFilter.ALL -> if (stageCount == 0) finalCardWidth + 32.dp else (sideWidthDp * 2) + finalCardWidth + 32.dp
        BracketWingFilter.RIGHT_WING, BracketWingFilter.LEFT_WING -> sideWidthDp + finalCardWidth + 32.dp
    }

    val wingsHeightDp: Dp = if (stageCount == 0) {
        finalCardHeight + 16.dp
    } else {
        baseSlotHeight * model.sideBaseSlots
    }

    val finalCenterYDp = wingsHeightDp / 2f
    val finalBottomDp = finalCenterYDp + finalCardHeight / 2f
    val championStemHeight = 20.dp
    val championCardHeight = 160.dp
    val thirdPlaceExtraDp = if (model.thirdPlaceMatches.isNotEmpty()) 190.dp else 0.dp
    val centerTotalHeightDp = maxOf(
        wingsHeightDp,
        finalBottomDp + championStemHeight + championCardHeight + 12.dp
    )
    val naturalTreeHeightDp = headerTopOffset + centerTotalHeightDp + thirdPlaceExtraDp + 24.dp

    val density = LocalDensity.current
    val naturalWidthPx = with(density) { naturalTreeWidthDp.toPx() }
    val naturalHeightPx = with(density) { naturalTreeHeightDp.toPx() }

    Column(modifier = Modifier.fillMaxSize()) {
        if (stageCount > 0) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ObsidianVoid.copy(alpha = 0.65f))
                    .padding(horizontal = 12.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically
            ) {
                FilterChip(
                    selected = wingFilter == BracketWingFilter.RIGHT_WING,
                    onClick = {
                        onSelectWing(
                            if (wingFilter == BracketWingFilter.RIGHT_WING) BracketWingFilter.ALL
                            else BracketWingFilter.RIGHT_WING
                        )
                    },
                    label = { Text(BracketWingFilter.RIGHT_WING.labelAr) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = RoyalViolet,
                        selectedLabelColor = ChampionshipGold
                    ),
                    modifier = Modifier.testTag("bracket_wing_filter_right")
                )
                FilterChip(
                    selected = wingFilter == BracketWingFilter.ALL,
                    onClick = { onSelectWing(BracketWingFilter.ALL) },
                    label = { Text("الجهتين معاً") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ChampionshipGold.copy(alpha = 0.25f),
                        selectedLabelColor = ChampionshipGold
                    ),
                    modifier = Modifier.testTag("bracket_wing_filter_all")
                )
                FilterChip(
                    selected = wingFilter == BracketWingFilter.LEFT_WING,
                    onClick = {
                        onSelectWing(
                            if (wingFilter == BracketWingFilter.LEFT_WING) BracketWingFilter.ALL
                            else BracketWingFilter.LEFT_WING
                        )
                    },
                    label = { Text(BracketWingFilter.LEFT_WING.labelAr) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = RoyalViolet,
                        selectedLabelColor = ChampionshipGold
                    ),
                    modifier = Modifier.testTag("bracket_wing_filter_left")
                )
            }
        }

        BoxWithConstraints(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clipToBounds()
                .drawBehind {
                    drawCircle(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                ChampionshipGold.copy(alpha = 0.09f),
                                ElectricCobalt.copy(alpha = 0.06f),
                                Color.Transparent
                            ),
                            center = Offset(size.width * 0.5f, size.height * 0.34f),
                            radius = size.maxDimension * 0.65f
                        )
                    )
                }
                .testTag(
                    if (wingFilter == BracketWingFilter.ALL) "bracket_full_tree"
                    else "bracket_wing_focused_${wingFilter.name}"
                )
        ) {
            val viewportWPx = with(density) { maxWidth.toPx() }
            val viewportHPx = with(density) { maxHeight.toPx() }

            val exactFitScale = remember(viewportWPx, naturalWidthPx) {
                if (naturalWidthPx <= 0f) 1f
                else ((viewportWPx - 16f) / naturalWidthPx).coerceIn(0.24f, 1.0f)
            }
            val initialScale = remember(exactFitScale, maxWidth, stageCount, wingFilter) {
                if (maxWidth >= 600.dp || exactFitScale >= 0.44f || wingFilter != BracketWingFilter.ALL) {
                    exactFitScale
                } else {
                    // On narrow phones with deep 16-player trees, start slightly zoomed in around center Final + Semis
                    0.56f
                }
            }

            var scale by remember(wingFilter, model.preFinalStages.size, maxWidth) {
                mutableFloatStateOf(initialScale)
            }
            var offsetX by remember(wingFilter, model.preFinalStages.size) { mutableFloatStateOf(0f) }
            var offsetY by remember(wingFilter, model.preFinalStages.size) { mutableFloatStateOf(0f) }

            fun clampOffsets(targetScale: Float, x: Float, y: Float): Pair<Float, Float> {
                val scaledW = naturalWidthPx * targetScale
                val scaledH = naturalHeightPx * targetScale
                val maxPanX = ((scaledW - viewportWPx) / 2f + 48f).coerceAtLeast(0f)
                val minPanY = (-(scaledH - viewportHPx + 48f)).coerceAtMost(0f)
                return Pair(
                    x.coerceIn(-maxPanX, maxPanX),
                    y.coerceIn(minPanY, 24f)
                )
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(naturalWidthPx, naturalHeightPx, viewportWPx, viewportHPx) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            val nextScale = (scale * zoom).coerceIn(0.24f, 1.85f)
                            val (clampedX, clampedY) = clampOffsets(
                                nextScale,
                                offsetX + pan.x,
                                offsetY + pan.y
                            )
                            scale = nextScale
                            offsetX = clampedX
                            offsetY = clampedY
                        }
                    },
                contentAlignment = Alignment.TopCenter
            ) {
                Box(
                    modifier = Modifier
                        .wrapContentSize(align = Alignment.TopCenter, unbounded = true)
                        .requiredWidth(naturalTreeWidthDp)
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                            translationX = offsetX
                            translationY = offsetY
                            transformOrigin = TransformOrigin(0.5f, 0f)
                        }
                ) {
                    SymmetricalBracketTreeContent(
                        model = model,
                        wingFilter = wingFilter,
                        playersById = playersById,
                        championPlayer = championPlayer,
                        bestOf = bestOf,
                        canEditScores = canEditScores,
                        cardWidth = cardWidth,
                        finalCardWidth = finalCardWidth,
                        cardHeight = cardHeight,
                        finalCardHeight = finalCardHeight,
                        baseSlotHeight = baseSlotHeight,
                        connectorWidth = connectorWidth,
                        headerHeight = headerHeight,
                        headerGap = headerGap,
                        wingsHeight = wingsHeightDp,
                        centerTotalHeight = centerTotalHeightDp,
                        championStemHeight = championStemHeight,
                        championCardHeight = championCardHeight,
                        onMatchClick = onMatchClick
                    )
                }

                // Floating Zoom & Quick Center Toolbar
                Surface(
                    color = ObsidianVoid.copy(alpha = 0.88f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, CardBorder),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        IconButton(
                            onClick = {
                                val next = (scale - 0.16f).coerceIn(0.24f, 1.85f)
                                val (cx, cy) = clampOffsets(next, offsetX, offsetY)
                                scale = next
                                offsetX = cx
                                offsetY = cy
                            },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("bracket_zoom_out")
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = "تصغير الشجرة", tint = TextPrimary)
                        }

                        Text(
                            text = "${(scale * 100f).roundToInt()}%",
                            style = MaterialTheme.typography.labelMedium,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )

                        IconButton(
                            onClick = {
                                val next = (scale + 0.16f).coerceIn(0.24f, 1.85f)
                                val (cx, cy) = clampOffsets(next, offsetX, offsetY)
                                scale = next
                                offsetX = cx
                                offsetY = cy
                            },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("bracket_zoom_in")
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "تكبير الشجرة", tint = TextPrimary)
                        }

                        TextButton(
                            onClick = {
                                scale = exactFitScale
                                offsetX = 0f
                                offsetY = 0f
                            },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("bracket_zoom_fit")
                        ) {
                            Icon(
                                imageVector = Icons.Default.FitScreen,
                                contentDescription = null,
                                tint = CyberSky,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("عرض الكل", style = MaterialTheme.typography.labelSmall, color = CyberSky)
                        }

                        TextButton(
                            onClick = {
                                scale = 1f
                                offsetX = 0f
                                offsetY = 0f
                            },
                            modifier = Modifier
                                .minimumInteractiveComponentSize()
                                .testTag("bracket_zoom_reset")
                        ) {
                            Icon(
                                imageVector = Icons.Default.CenterFocusStrong,
                                contentDescription = null,
                                tint = ChampionshipGold,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("النهائي", style = MaterialTheme.typography.labelSmall, color = ChampionshipGold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SymmetricalBracketTreeContent(
    model: SymmetricalBracketModel,
    wingFilter: BracketWingFilter,
    playersById: Map<Long, PlayerEntity>,
    championPlayer: PlayerEntity?,
    bestOf: Int,
    canEditScores: Boolean,
    cardWidth: Dp,
    finalCardWidth: Dp,
    cardHeight: Dp,
    finalCardHeight: Dp,
    baseSlotHeight: Dp,
    connectorWidth: Dp,
    headerHeight: Dp,
    headerGap: Dp,
    wingsHeight: Dp,
    centerTotalHeight: Dp,
    championStemHeight: Dp,
    championCardHeight: Dp,
    onMatchClick: (MatchEntity) -> Unit
) {
    val headerTopOffset = headerHeight + headerGap
    val showLeftWing = (wingFilter == BracketWingFilter.ALL || wingFilter == BracketWingFilter.LEFT_WING) &&
        model.preFinalStages.isNotEmpty()
    val showRightWing = (wingFilter == BracketWingFilter.ALL || wingFilter == BracketWingFilter.RIGHT_WING) &&
        model.preFinalStages.isNotEmpty()

    Column(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        // Explicit LTR row for geometric symmetry: [Left Wing -> Center Final <- Right Wing]
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Row(verticalAlignment = Alignment.Top) {
                if (showLeftWing) {
                    model.preFinalStages.forEachIndexed { sIdx, stage ->
                        val sideCount = 1 shl (model.preFinalStages.size - 1 - sIdx)
                        val slotHeight = baseSlotHeight * (1 shl sIdx)
                        val wingMap = model.leftWingByStage[stage].orEmpty()

                        BracketWingColumn(
                            stage = stage,
                            wingBadge = "أيسر",
                            sideMatchCount = sideCount,
                            slotHeight = slotHeight,
                            wingsHeight = wingsHeight,
                            matchesByLocalSlot = wingMap,
                            matchNumbersById = model.matchNumbersById,
                            bestOf = bestOf,
                            playersById = playersById,
                            cardWidth = cardWidth,
                            cardHeight = cardHeight,
                            headerHeight = headerHeight,
                            headerGap = headerGap,
                            canEditScores = canEditScores,
                            onMatchClick = onMatchClick
                        )

                        if (sIdx < model.preFinalStages.lastIndex) {
                            val nextSideCount = 1 shl (model.preFinalStages.size - 1 - (sIdx + 1))
                            val nextSlotHeight = baseSlotHeight * (1 shl (sIdx + 1))
                            SymmetricalConnectorCanvas(
                                childMatchesByLocalSlot = wingMap,
                                nextSideMatchCount = nextSideCount,
                                childSlotHeight = slotHeight,
                                parentSlotHeight = nextSlotHeight,
                                connectorWidth = connectorWidth,
                                totalHeight = wingsHeight,
                                headerTopOffset = headerTopOffset,
                                flowDirection = BracketFlowDirection.LEFT_TO_RIGHT
                            )
                        } else {
                            SemiToFinalConnectorCanvas(
                                semiMatch = wingMap[0],
                                connectorWidth = connectorWidth,
                                totalHeight = wingsHeight,
                                headerTopOffset = headerTopOffset
                            )
                        }
                    }
                }

                // Center Championship Final + Champion Pedestal Column
                CenterFinalColumn(
                    finalMatch = model.finalMatch,
                    matchNumber = model.finalMatch?.let { model.matchNumbersById[it.id] },
                    bestOf = bestOf,
                    playersById = playersById,
                    championPlayer = championPlayer,
                    finalCardWidth = finalCardWidth,
                    finalCardHeight = finalCardHeight,
                    wingsHeight = wingsHeight,
                    centerTotalHeight = centerTotalHeight,
                    championStemHeight = championStemHeight,
                    championCardHeight = championCardHeight,
                    headerHeight = headerHeight,
                    headerGap = headerGap,
                    canEditScores = canEditScores,
                    onMatchClick = onMatchClick
                )

                if (showRightWing) {
                    val reversedStages = model.preFinalStages.asReversed()
                    reversedStages.forEachIndexed { revIdx, stage ->
                        val originalIdx = model.preFinalStages.lastIndex - revIdx
                        val sideCount = 1 shl (model.preFinalStages.size - 1 - originalIdx)
                        val slotHeight = baseSlotHeight * (1 shl originalIdx)
                        val wingMap = model.rightWingByStage[stage].orEmpty()

                        if (revIdx == 0) {
                            SemiToFinalConnectorCanvas(
                                semiMatch = wingMap[0],
                                connectorWidth = connectorWidth,
                                totalHeight = wingsHeight,
                                headerTopOffset = headerTopOffset
                            )
                        }

                        BracketWingColumn(
                            stage = stage,
                            wingBadge = "أيمن",
                            sideMatchCount = sideCount,
                            slotHeight = slotHeight,
                            wingsHeight = wingsHeight,
                            matchesByLocalSlot = wingMap,
                            matchNumbersById = model.matchNumbersById,
                            bestOf = bestOf,
                            playersById = playersById,
                            cardWidth = cardWidth,
                            cardHeight = cardHeight,
                            headerHeight = headerHeight,
                            headerGap = headerGap,
                            canEditScores = canEditScores,
                            onMatchClick = onMatchClick
                        )

                        if (revIdx < reversedStages.lastIndex) {
                            val childOriginalIdx = originalIdx - 1
                            val childStage = model.preFinalStages[childOriginalIdx]
                            val childWingMap = model.rightWingByStage[childStage].orEmpty()
                            val childSlotHeight = baseSlotHeight * (1 shl childOriginalIdx)
                            SymmetricalConnectorCanvas(
                                childMatchesByLocalSlot = childWingMap,
                                nextSideMatchCount = sideCount,
                                childSlotHeight = childSlotHeight,
                                parentSlotHeight = slotHeight,
                                connectorWidth = connectorWidth,
                                totalHeight = wingsHeight,
                                headerTopOffset = headerTopOffset,
                                flowDirection = BracketFlowDirection.RIGHT_TO_LEFT
                            )
                        }
                    }
                }
            }
        }

        // Third Place Match neatly centered underneath the Final
        if (model.thirdPlaceMatches.isNotEmpty() && wingFilter == BracketWingFilter.ALL) {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        color = ElevatedNavy,
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.55f))
                    ) {
                        Text(
                            text = "مباراة تحديد المركز الثالث والرابع",
                            style = MaterialTheme.typography.labelLarge,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        model.thirdPlaceMatches.forEach { m ->
                            BracketMatchNode(
                                match = m,
                                player1 = m.player1Id?.let { playersById[it] },
                                player2 = m.player2Id?.let { playersById[it] },
                                isFinal = false,
                                canEdit = canEditScores,
                                onClick = { onMatchClick(m) },
                                matchNumber = model.matchNumbersById[m.id],
                                bestOf = bestOf,
                                modifier = Modifier
                                    .width(finalCardWidth)
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
private fun BracketWingColumn(
    stage: MatchStage,
    wingBadge: String,
    sideMatchCount: Int,
    slotHeight: Dp,
    wingsHeight: Dp,
    matchesByLocalSlot: Map<Int, MatchEntity>,
    matchNumbersById: Map<Long, Int>,
    bestOf: Int,
    playersById: Map<Long, PlayerEntity>,
    cardWidth: Dp,
    cardHeight: Dp,
    headerHeight: Dp,
    headerGap: Dp,
    canEditScores: Boolean,
    onMatchClick: (MatchEntity) -> Unit
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Column(
            modifier = Modifier.width(cardWidth),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                color = ElevatedNavy,
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.dp, ElectricCobalt.copy(alpha = 0.65f)),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(headerHeight)
                    .testTag("bracket_round_header_${stage.name}_$wingBadge")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = stage.labelAr,
                        style = MaterialTheme.typography.labelLarge,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Surface(
                        color = RoyalViolet.copy(alpha = 0.28f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = wingBadge,
                            style = MaterialTheme.typography.labelSmall,
                            color = CyberSky,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(headerGap))

            Box(
                modifier = Modifier
                    .width(cardWidth)
                    .height(wingsHeight)
            ) {
                for (localIdx in 0 until sideMatchCount) {
                    val centerY = slotHeight * localIdx + slotHeight / 2f
                    val topOffset = centerY - cardHeight / 2f
                    val match = matchesByLocalSlot[localIdx]
                    if (match != null) {
                        BracketMatchNode(
                            match = match,
                            player1 = match.player1Id?.let { playersById[it] },
                            player2 = match.player2Id?.let { playersById[it] },
                            isFinal = false,
                            canEdit = canEditScores,
                            onClick = { onMatchClick(match) },
                            matchNumber = matchNumbersById[match.id],
                            bestOf = bestOf,
                            modifier = Modifier
                                .offset(y = topOffset)
                                .width(cardWidth)
                                .height(cardHeight)
                        )
                    } else {
                        BracketPlaceholderNode(
                            stage = stage,
                            slotNumber = localIdx + 1,
                            modifier = Modifier
                                .offset(y = topOffset)
                                .width(cardWidth)
                                .height(cardHeight)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CenterFinalColumn(
    finalMatch: MatchEntity?,
    matchNumber: Int?,
    bestOf: Int,
    playersById: Map<Long, PlayerEntity>,
    championPlayer: PlayerEntity?,
    finalCardWidth: Dp,
    finalCardHeight: Dp,
    wingsHeight: Dp,
    centerTotalHeight: Dp,
    championStemHeight: Dp,
    championCardHeight: Dp,
    headerHeight: Dp,
    headerGap: Dp,
    canEditScores: Boolean,
    onMatchClick: (MatchEntity) -> Unit
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        val finalTop = (wingsHeight / 2f) - (finalCardHeight / 2f)
        val stemTop = finalTop + finalCardHeight
        val pedestalTop = stemTop + championStemHeight

        Column(
            modifier = Modifier.width(finalCardWidth),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Surface(
                color = ChampionshipGold.copy(alpha = 0.22f),
                shape = RoundedCornerShape(10.dp),
                border = BorderStroke(1.5.dp, ChampionshipGold),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(headerHeight)
                    .testTag("bracket_round_header_FINAL")
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.EmojiEvents,
                        contentDescription = null,
                        tint = ChampionshipGold,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "النهائي الكبير",
                        style = MaterialTheme.typography.labelLarge,
                        color = ChampionshipGold,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(headerGap))

            Box(
                modifier = Modifier
                    .width(finalCardWidth)
                    .height(centerTotalHeight)
            ) {
                if (finalMatch != null) {
                    BracketMatchNode(
                        match = finalMatch,
                        player1 = finalMatch.player1Id?.let { playersById[it] },
                        player2 = finalMatch.player2Id?.let { playersById[it] },
                        isFinal = true,
                        canEdit = canEditScores,
                        onClick = { onMatchClick(finalMatch) },
                        matchNumber = matchNumber,
                        bestOf = bestOf,
                        modifier = Modifier
                            .offset(y = finalTop)
                            .width(finalCardWidth)
                            .height(finalCardHeight)
                    )
                } else {
                    BracketPlaceholderNode(
                        stage = MatchStage.FINAL,
                        slotNumber = 1,
                        modifier = Modifier
                            .offset(y = finalTop)
                            .width(finalCardWidth)
                            .height(finalCardHeight)
                    )
                }

                // Golden vertical stem down to Champion Pedestal
                Canvas(
                    modifier = Modifier
                        .offset(y = stemTop)
                        .width(finalCardWidth)
                        .height(championStemHeight)
                ) {
                    val cx = size.width / 2f
                    val hasChamp = championPlayer != null
                    if (hasChamp) {
                        drawLine(
                            color = ChampionshipGold.copy(alpha = 0.25f),
                            start = Offset(cx, 0f),
                            end = Offset(cx, size.height),
                            strokeWidth = 6.dp.toPx(),
                            cap = StrokeCap.Round
                        )
                    }
                    drawLine(
                        color = if (hasChamp) ChampionshipGold else CardBorder,
                        start = Offset(cx, 0f),
                        end = Offset(cx, size.height),
                        strokeWidth = 2.6.dp.toPx(),
                        cap = StrokeCap.Round
                    )
                }

                ChampionPedestalNode(
                    champion = championPlayer,
                    modifier = Modifier
                        .offset(y = pedestalTop)
                        .width(finalCardWidth)
                        .height(championCardHeight)
                )
            }
        }
    }
}

@Composable
private fun FocusedStageMatchesList(
    stage: MatchStage,
    matches: List<MatchEntity>,
    matchNumbersById: Map<Long, Int>,
    bestOf: Int,
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
                    matchNumber = matchNumbersById[match.id],
                    bestOf = bestOf,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(126.dp)
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
