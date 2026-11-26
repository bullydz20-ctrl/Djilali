package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.requiredWidthIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.TouchApp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.model.MatchStage
import com.example.ui.theme.AmberDraw
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
import com.example.ui.theme.TextMuted
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

val KNOCKOUT_ROADMAP_STAGES = listOf(
    MatchStage.ROUND_OF_16,
    MatchStage.QUARTER_FINAL,
    MatchStage.SEMI_FINAL,
    MatchStage.FINAL
)

enum class BracketWingFilter(val labelAr: String) {
    ALL("الشجرة الكاملة"),
    RIGHT_WING("المسار الأيمن"),
    LEFT_WING("المسار الأيسر")
}

enum class BracketFlowDirection {
    LEFT_TO_RIGHT,
    RIGHT_TO_LEFT
}

data class SymmetricalBracketModel(
    val preFinalStages: List<MatchStage>,
    val rightWingByStage: Map<MatchStage, Map<Int, MatchEntity>>,
    val leftWingByStage: Map<MatchStage, Map<Int, MatchEntity>>,
    val finalMatch: MatchEntity?,
    val thirdPlaceMatches: List<MatchEntity>,
    val matchNumbersById: Map<Long, Int>,
    val sideBaseSlots: Int
)

fun buildSymmetricalBracketModel(knockoutMatches: List<MatchEntity>): SymmetricalBracketModel {
    val ordered = knockoutMatches.sortedWith(
        compareBy<MatchEntity> { it.stage.order }.thenBy { it.bracketIndex }.thenBy { it.id }
    )
    val matchNumbersById = buildMap {
        var seq = 1
        ordered.forEach { put(it.id, seq++) }
    }

    val byStage = ordered.groupBy { it.stage }
    val preFinalStages = listOf(
        MatchStage.ROUND_OF_16,
        MatchStage.QUARTER_FINAL,
        MatchStage.SEMI_FINAL
    ).filter { !byStage[it].isNullOrEmpty() }

    val finalMatch = byStage[MatchStage.FINAL]?.firstOrNull()
    val thirdPlaceMatches = byStage[MatchStage.THIRD_PLACE].orEmpty()
    val byId = ordered.associateBy { it.id }

    fun expectedStageCapacity(stage: MatchStage): Int = when (stage) {
        MatchStage.ROUND_OF_16 -> 8
        MatchStage.QUARTER_FINAL -> 4
        MatchStage.SEMI_FINAL -> 2
        else -> 1
    }

    fun resolveWingForMatch(match: MatchEntity): Boolean {
        // Returns true for RIGHT wing (Slot 1 into Final), false for LEFT wing (Slot 2 into Final)
        var curr: MatchEntity? = match
        var visited = 0
        while (curr != null && visited < 8) {
            val nextId = curr.nextMatchId
            if (nextId != null) {
                val parent = byId[nextId]
                if (parent?.stage == MatchStage.FINAL) {
                    return curr.nextMatchSlot != 2
                }
                curr = parent
                visited++
            } else {
                break
            }
        }
        val halfCap = (expectedStageCapacity(match.stage) / 2).coerceAtLeast(1)
        return match.bracketIndex < halfCap
    }

    val rightWing = mutableMapOf<MatchStage, MutableMap<Int, MatchEntity>>()
    val leftWing = mutableMapOf<MatchStage, MutableMap<Int, MatchEntity>>()

    preFinalStages.forEach { stage ->
        val halfCap = (expectedStageCapacity(stage) / 2).coerceAtLeast(1)
        val stageMatches = byStage[stage].orEmpty().sortedBy { it.bracketIndex }
        val rMap = mutableMapOf<Int, MatchEntity>()
        val lMap = mutableMapOf<Int, MatchEntity>()
        stageMatches.forEach { match ->
            val isRight = resolveWingForMatch(match)
            val localIdx = if (isRight) {
                match.bracketIndex.coerceIn(0, halfCap - 1)
            } else {
                (match.bracketIndex - halfCap).coerceIn(0, halfCap - 1)
            }
            if (isRight) {
                if (!rMap.containsKey(localIdx)) rMap[localIdx] = match
                else rMap[rMap.size] = match
            } else {
                if (!lMap.containsKey(localIdx)) lMap[localIdx] = match
                else lMap[lMap.size] = match
            }
        }
        rightWing[stage] = rMap
        leftWing[stage] = lMap
    }

    val sideBaseSlots = if (preFinalStages.isEmpty()) 1 else (1 shl (preFinalStages.size - 1))
    return SymmetricalBracketModel(
        preFinalStages = preFinalStages,
        rightWingByStage = rightWing,
        leftWingByStage = leftWing,
        finalMatch = finalMatch,
        thirdPlaceMatches = thirdPlaceMatches,
        matchNumbersById = matchNumbersById,
        sideBaseSlots = sideBaseSlots
    )
}

@Composable
fun BracketStagePillsBar(
    selectedStage: MatchStage?,
    matchesByStage: Map<MatchStage, List<MatchEntity>>,
    onSelectStage: (MatchStage?) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            FilterChip(
                selected = selectedStage == null,
                onClick = { onSelectStage(null) },
                label = { Text("الشجرة الكاملة") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ChampionshipGold,
                    selectedLabelColor = MidnightSurface
                ),
                modifier = Modifier.testTag("bracket_stage_filter_all")
            )
        }

        items(KNOCKOUT_ROADMAP_STAGES, key = { it.name }) { stage ->
            val stageMatches = matchesByStage[stage].orEmpty()
            val completed = stageMatches.count { it.isCompleted }
            val total = stageMatches.size
            val isPresent = total > 0
            val badgeText = if (isPresent) "${stage.labelAr} ($completed/$total)" else "${stage.labelAr} (—)"

            FilterChip(
                selected = selectedStage == stage,
                enabled = isPresent,
                onClick = { onSelectStage(stage) },
                label = { Text(badgeText) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = ElectricCobalt,
                    selectedLabelColor = TextPrimary
                ),
                modifier = Modifier.testTag("bracket_stage_filter_${stage.name}")
            )
        }

        val thirdPlaceMatches = matchesByStage[MatchStage.THIRD_PLACE].orEmpty()
        if (thirdPlaceMatches.isNotEmpty()) {
            item(key = MatchStage.THIRD_PLACE.name) {
                val completed = thirdPlaceMatches.count { it.isCompleted }
                FilterChip(
                    selected = selectedStage == MatchStage.THIRD_PLACE,
                    onClick = { onSelectStage(MatchStage.THIRD_PLACE) },
                    label = { Text("${MatchStage.THIRD_PLACE.labelAr} ($completed/${thirdPlaceMatches.size})") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = ChampionshipGold.copy(alpha = 0.25f),
                        selectedLabelColor = ChampionshipGold
                    ),
                    modifier = Modifier.testTag("bracket_stage_filter_${MatchStage.THIRD_PLACE.name}")
                )
            }
        }
    }
}

@Composable
fun BracketMatchNode(
    match: MatchEntity,
    player1: PlayerEntity?,
    player2: PlayerEntity?,
    isFinal: Boolean,
    canEdit: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    matchNumber: Int? = null,
    bestOf: Int = 1
) {
    val canTap = canEdit && player1 != null && player2 != null
    val isReady = player1 != null && player2 != null
    val p1Won = match.isCompleted && match.winnerId != null && match.winnerId == player1?.id
    val p2Won = match.isCompleted && match.winnerId != null && match.winnerId == player2?.id

    val score1Text = formatBracketScore(match, isPlayer1 = true)
    val score2Text = formatBracketScore(match, isPlayer1 = false)
    val displayNum = matchNumber ?: (match.bracketIndex + 1)

    val statusLabel = when {
        match.isWalkover -> "انسحاب"
        match.isCompleted -> "مكتملة"
        isReady -> "جاهزة"
        else -> "بانتظار"
    }
    val statusColor = when {
        match.isWalkover -> AmberDraw
        match.isCompleted -> EmeraldWin
        isReady -> CyberSky
        else -> TextMuted
    }

    Card(
        modifier = modifier
            .testTag("bracket_match_${match.id}")
            .then(
                if (canTap) {
                    Modifier
                        .minimumInteractiveComponentSize()
                        .clickable(onClick = onClick)
                } else {
                    Modifier
                }
            ),
        shape = RoundedCornerShape(if (isFinal) 18.dp else 14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isFinal) ElevatedNavy else MidnightSurface
        ),
        border = BorderStroke(
            width = when {
                isFinal -> 2.dp
                match.isCompleted -> 1.4.dp
                isReady -> 1.2.dp
                else -> 1.dp
            },
            color = when {
                isFinal -> ChampionshipGold
                match.isCompleted -> ChampionshipGold.copy(alpha = 0.72f)
                isReady -> ElectricCobalt.copy(alpha = 0.85f)
                else -> CardBorder
            }
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .then(
                    if (isFinal) {
                        Modifier.background(
                            Brush.verticalGradient(
                                listOf(
                                    ChampionshipGold.copy(alpha = 0.14f),
                                    ElevatedNavy,
                                    MidnightSurface
                                )
                            )
                        )
                    } else {
                        Modifier
                    }
                )
        ) {
            // Top metadata bar: Match # + Stage + Status + Edit pill
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        if (isFinal) ChampionshipGold.copy(alpha = 0.14f)
                        else ObsidianVoid.copy(alpha = 0.62f)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Surface(
                        color = if (isFinal) ChampionshipGold else ElevatedNavy,
                        shape = RoundedCornerShape(5.dp)
                    ) {
                        Text(
                            text = "#$displayNum",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isFinal) MidnightSurface else CyberSky,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                        )
                    }
                    val stageTitle = when {
                        isFinal -> "النهائي الكبير"
                        match.stage == MatchStage.THIRD_PLACE -> "المركز الثالث"
                        else -> match.stage.labelAr
                    }
                    Text(
                        text = stageTitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isFinal) ChampionshipGold else TextSecondary,
                        fontWeight = if (isFinal) FontWeight.Bold else FontWeight.Medium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (bestOf > 1 && match.stage != MatchStage.THIRD_PLACE) {
                        Text(
                            text = "Bo$bestOf",
                            style = MaterialTheme.typography.labelSmall,
                            color = CyberSky
                        )
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    if (match.penaltyScore1 != null && match.penaltyScore2 != null) {
                        Text(
                            text = "ر.ت ${match.penaltyScore1}-${match.penaltyScore2}",
                            style = MaterialTheme.typography.labelSmall,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Surface(
                        color = statusColor.copy(alpha = 0.16f),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = statusLabel,
                            style = MaterialTheme.typography.labelSmall,
                            color = statusColor,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                        )
                    }

                    if (canTap) {
                        Surface(
                            color = ElectricCobalt.copy(alpha = 0.28f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = if (match.winnerId != null) "تعديل النتيجة" else "تحديد الفائز",
                                tint = CyberSky,
                                modifier = Modifier
                                    .padding(3.dp)
                                    .size(11.dp)
                            )
                        }
                    }
                }
            }

            BracketSlotRow(
                player = player1,
                scoreText = score1Text,
                isWinner = p1Won,
                isEliminated = p2Won,
                isFinal = isFinal,
                modifier = Modifier.weight(1f)
            )
            HorizontalDivider(color = if (isFinal) ChampionshipGold.copy(alpha = 0.35f) else CardBorder.copy(alpha = 0.55f))
            BracketSlotRow(
                player = player2,
                scoreText = score2Text,
                isWinner = p2Won,
                isEliminated = p1Won,
                isFinal = isFinal,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
fun BracketPlaceholderNode(
    stage: MatchStage,
    slotNumber: Int,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = MidnightSurface.copy(alpha = 0.42f),
        border = BorderStroke(1.dp, CardBorder.copy(alpha = 0.45f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(10.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${stage.labelAr} #$slotNumber",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted
                )
                Text(
                    text = "بانتظار",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted
                )
            }
            Text(
                text = "مسار مفتوح / BYE",
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted
            )
            Text(
                text = "—",
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted
            )
        }
    }
}

@Composable
private fun BracketSlotRow(
    player: PlayerEntity?,
    scoreText: String,
    isWinner: Boolean,
    isEliminated: Boolean,
    isFinal: Boolean,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(
                when {
                    isWinner -> ChampionshipGold.copy(alpha = 0.16f)
                    isEliminated -> ObsidianVoid.copy(alpha = 0.38f)
                    else -> Color.Transparent
                }
            )
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .weight(1f)
                .padding(end = 6.dp)
        ) {
            PlayerAvatar(
                avatarUri = player?.avatarUri,
                playerName = player?.name ?: "؟",
                size = if (isFinal) 32.dp else 28.dp,
                borderColor = when {
                    isWinner -> ChampionshipGold
                    isEliminated -> CrimsonLoss.copy(alpha = 0.45f)
                    player != null -> CyberSky.copy(alpha = 0.65f)
                    else -> CardBorder.copy(alpha = 0.5f)
                }
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player?.name ?: "بانتظار المتأهل",
                    style = MaterialTheme.typography.bodyMedium,
                    color = when {
                        isWinner -> ChampionshipGold
                        isEliminated -> TextMuted
                        player != null -> TextPrimary
                        else -> TextMuted
                    },
                    fontWeight = if (isWinner) FontWeight.Bold else FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            if (isWinner) {
                Icon(
                    imageVector = if (isFinal) Icons.Default.EmojiEvents else Icons.Default.CheckCircle,
                    contentDescription = "فائز",
                    tint = ChampionshipGold,
                    modifier = Modifier.size(15.dp)
                )
            } else if (isEliminated) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "خاسر",
                    tint = CrimsonLoss.copy(alpha = 0.78f),
                    modifier = Modifier.size(13.dp)
                )
            }

            Surface(
                color = when {
                    isWinner -> ChampionshipGold.copy(alpha = 0.24f)
                    isEliminated -> ObsidianVoid.copy(alpha = 0.6f)
                    else -> ElevatedNavy
                },
                shape = RoundedCornerShape(7.dp),
                modifier = Modifier.requiredWidthIn(min = 32.dp)
            ) {
                Text(
                    text = scoreText,
                    style = MaterialTheme.typography.titleSmall,
                    color = when {
                        isWinner -> ChampionshipGold
                        isEliminated -> TextMuted
                        else -> TextPrimary
                    },
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
        }
    }
}

@Composable
fun SymmetricalConnectorCanvas(
    childMatchesByLocalSlot: Map<Int, MatchEntity>,
    nextSideMatchCount: Int,
    childSlotHeight: Dp,
    parentSlotHeight: Dp,
    connectorWidth: Dp,
    totalHeight: Dp,
    headerTopOffset: Dp,
    flowDirection: BracketFlowDirection,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    Canvas(
        modifier = modifier
            .padding(top = headerTopOffset)
            .width(connectorWidth)
            .height(totalHeight)
    ) {
        val w = size.width
        val childX = if (flowDirection == BracketFlowDirection.LEFT_TO_RIGHT) 0f else w
        val parentX = if (flowDirection == BracketFlowDirection.LEFT_TO_RIGHT) w else 0f
        val midX = w / 2f

        val childSlotPx = with(density) { childSlotHeight.toPx() }
        val parentSlotPx = with(density) { parentSlotHeight.toPx() }
        val baseStroke = 2.8.dp.toPx()
        val goldStroke = 3.6.dp.toPx()
        val goldGlow = 7.5.dp.toPx()

        for (pairIdx in 0 until nextSideMatchCount) {
            val topChildY = childSlotPx * (pairIdx * 2) + childSlotPx / 2f
            val botChildY = childSlotPx * (pairIdx * 2 + 1) + childSlotPx / 2f
            val parentY = parentSlotPx * pairIdx + parentSlotPx / 2f

            val topMatch = childMatchesByLocalSlot[pairIdx * 2]
            val botMatch = childMatchesByLocalSlot[pairIdx * 2 + 1]

            drawBranchLine(
                childX = childX,
                childY = topChildY,
                midX = midX,
                parentX = parentX,
                parentY = parentY,
                match = topMatch,
                baseStroke = baseStroke,
                goldStroke = goldStroke,
                goldGlow = goldGlow,
                drawGold = false
            )
            drawBranchLine(
                childX = childX,
                childY = botChildY,
                midX = midX,
                parentX = parentX,
                parentY = parentY,
                match = botMatch,
                baseStroke = baseStroke,
                goldStroke = goldStroke,
                goldGlow = goldGlow,
                drawGold = false
            )
        }

        // Second pass so golden qualified tracks render cleanly above inactive lines
        for (pairIdx in 0 until nextSideMatchCount) {
            val topChildY = childSlotPx * (pairIdx * 2) + childSlotPx / 2f
            val botChildY = childSlotPx * (pairIdx * 2 + 1) + childSlotPx / 2f
            val parentY = parentSlotPx * pairIdx + parentSlotPx / 2f

            val topMatch = childMatchesByLocalSlot[pairIdx * 2]
            val botMatch = childMatchesByLocalSlot[pairIdx * 2 + 1]

            drawBranchLine(
                childX = childX,
                childY = topChildY,
                midX = midX,
                parentX = parentX,
                parentY = parentY,
                match = topMatch,
                baseStroke = baseStroke,
                goldStroke = goldStroke,
                goldGlow = goldGlow,
                drawGold = true
            )
            drawBranchLine(
                childX = childX,
                childY = botChildY,
                midX = midX,
                parentX = parentX,
                parentY = parentY,
                match = botMatch,
                baseStroke = baseStroke,
                goldStroke = goldStroke,
                goldGlow = goldGlow,
                drawGold = true
            )
        }
    }
}

private fun DrawScope.drawBranchLine(
    childX: Float,
    childY: Float,
    midX: Float,
    parentX: Float,
    parentY: Float,
    match: MatchEntity?,
    baseStroke: Float,
    goldStroke: Float,
    goldGlow: Float,
    drawGold: Boolean
) {
    val hasWinner = match?.winnerId != null
    if (drawGold != hasWinner) return

    val path = Path().apply {
        moveTo(childX, childY)
        lineTo(midX, childY)
        lineTo(midX, parentY)
        lineTo(parentX, parentY)
    }

    if (hasWinner) {
        drawPath(
            path = path,
            color = ChampionshipGold.copy(alpha = 0.28f),
            style = Stroke(width = goldGlow, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
        drawPath(
            path = path,
            color = ChampionshipGold,
            style = Stroke(width = goldStroke, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
    } else {
        val isReady = match?.player1Id != null && match.player2Id != null
        drawPath(
            path = path,
            color = if (isReady) CyberSky.copy(alpha = 0.72f) else TextMuted.copy(alpha = 0.55f),
            style = Stroke(width = baseStroke, cap = StrokeCap.Round, join = StrokeJoin.Round)
        )
    }
}

@Composable
fun SemiToFinalConnectorCanvas(
    semiMatch: MatchEntity?,
    connectorWidth: Dp,
    totalHeight: Dp,
    headerTopOffset: Dp,
    modifier: Modifier = Modifier
) {
    Canvas(
        modifier = modifier
            .padding(top = headerTopOffset)
            .width(connectorWidth)
            .height(totalHeight)
    ) {
        val y = size.height / 2f
        val hasWinner = semiMatch?.winnerId != null
        val isReady = semiMatch?.player1Id != null && semiMatch.player2Id != null
        if (hasWinner) {
            drawLine(
                color = ChampionshipGold.copy(alpha = 0.28f),
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 7.5.dp.toPx(),
                cap = StrokeCap.Round
            )
            drawLine(
                color = ChampionshipGold,
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 3.6.dp.toPx(),
                cap = StrokeCap.Round
            )
        } else {
            drawLine(
                color = if (isReady) CyberSky.copy(alpha = 0.75f) else TextMuted.copy(alpha = 0.55f),
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 2.8.dp.toPx(),
                cap = StrokeCap.Round
            )
        }
    }
}

@Composable
fun ChampionPedestalNode(
    champion: PlayerEntity?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.testTag("bracket_champion_pedestal"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (champion != null) ElevatedNavy else MidnightSurface
        ),
        border = BorderStroke(
            width = if (champion != null) 2.dp else 1.dp,
            color = if (champion != null) ChampionshipGold else CardBorder
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = if (champion != null) {
                            listOf(
                                ChampionshipGold.copy(alpha = 0.24f),
                                RoyalViolet.copy(alpha = 0.14f),
                                MidnightSurface
                            )
                        } else {
                            listOf(MidnightSurface, ObsidianVoid.copy(alpha = 0.6f))
                        }
                    )
                )
                .padding(12.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(
                            if (champion != null) ChampionshipGold.copy(alpha = 0.24f)
                            else ElevatedNavy
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.EmojiEvents,
                        contentDescription = "كأس البطولة",
                        tint = if (champion != null) ChampionshipGold else TextMuted,
                        modifier = Modifier.size(21.dp)
                    )
                }

                Text(
                    text = "بطل البطولة",
                    style = MaterialTheme.typography.labelMedium,
                    color = ChampionshipGold,
                    fontWeight = FontWeight.Bold
                )

                if (champion != null) {
                    PlayerAvatar(
                        avatarUri = champion.avatarUri,
                        playerName = champion.name,
                        size = 38.dp,
                        borderColor = ChampionshipGold
                    )
                    Text(
                        text = champion.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )
                    if (champion.clubName.isNotBlank()) {
                        Text(
                            text = champion.clubName,
                            style = MaterialTheme.typography.labelSmall,
                            color = CyberSky,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                } else {
                    Text(
                        text = "يتحدد من النهائي",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun BracketMatchWinnerDialog(
    match: MatchEntity,
    player1: PlayerEntity,
    player2: PlayerEntity,
    onDismiss: () -> Unit,
    onSelectWinner: (winnerPlayerId: Long?) -> Unit,
    onOpenScoreEditor: () -> Unit
) {
    val isFinal = match.stage == MatchStage.FINAL
    val score1 = formatBracketScore(match, isPlayer1 = true)
    val score2 = formatBracketScore(match, isPlayer1 = false)

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = if (isFinal) Icons.Default.EmojiEvents else Icons.Default.TouchApp,
                    contentDescription = null,
                    tint = ChampionshipGold
                )
                Column {
                    Text(
                        text = "تحديث الفائز — ${match.stage.labelAr}",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold
                    )
                    Text(
                        text = if (isFinal) "اختر بطل البطولة أو سجّل النتيجة الكاملة"
                        else "اختر اللاعب المتأهل للدور التالي أو عدّل النتيجة",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                WinnerCandidateCard(
                    player = player1,
                    scoreText = score1,
                    isCurrentWinner = match.winnerId == player1.id,
                    actionLabel = if (isFinal) "تتويج بالبطولة" else "تأهيل للدور التالي",
                    onClick = { onSelectWinner(player1.id) },
                    testTag = "bracket_pick_winner_p1_${match.id}"
                )

                WinnerCandidateCard(
                    player = player2,
                    scoreText = score2,
                    isCurrentWinner = match.winnerId == player2.id,
                    actionLabel = if (isFinal) "تتويج بالبطولة" else "تأهيل للدور التالي",
                    onClick = { onSelectWinner(player2.id) },
                    testTag = "bracket_pick_winner_p2_${match.id}"
                )

                HorizontalDivider(color = CardBorder.copy(alpha = 0.6f))

                Button(
                    onClick = onOpenScoreEditor,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("bracket_open_score_dialog_${match.id}")
                ) {
                    Icon(Icons.Default.SportsSoccer, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("إدخال النتيجة التفصيلية")
                }

                if (match.winnerId != null) {
                    OutlinedButton(
                        onClick = { onSelectWinner(null) },
                        border = BorderStroke(1.dp, CrimsonLoss.copy(alpha = 0.7f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("bracket_clear_winner_${match.id}")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            tint = CrimsonLoss,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("إلغاء تحديد الفائز وإعادة الفتح", color = CrimsonLoss)
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إغلاق", color = TextSecondary)
            }
        }
    )
}

@Composable
private fun WinnerCandidateCard(
    player: PlayerEntity,
    scoreText: String,
    isCurrentWinner: Boolean,
    actionLabel: String,
    onClick: () -> Unit,
    testTag: String
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .minimumInteractiveComponentSize()
            .clickable(onClick = onClick)
            .testTag(testTag),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrentWinner) ChampionshipGold.copy(alpha = 0.14f) else ElevatedNavy
        ),
        border = BorderStroke(
            width = if (isCurrentWinner) 1.5.dp else 1.dp,
            color = if (isCurrentWinner) ChampionshipGold else CardBorder
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                PlayerAvatar(
                    avatarUri = player.avatarUri,
                    playerName = player.name,
                    size = 38.dp,
                    borderColor = if (isCurrentWinner) ChampionshipGold else CardBorder
                )
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = player.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = if (isCurrentWinner) ChampionshipGold else TextPrimary,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = buildString {
                            append(player.elysiumNetId)
                            if (player.clubName.isNotBlank()) append(" • ${player.clubName}")
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (scoreText != "-") {
                    Text(
                        text = "النتيجة: $scoreText",
                        style = MaterialTheme.typography.labelSmall,
                        color = CyberSky
                    )
                }
                Surface(
                    color = if (isCurrentWinner) ChampionshipGold else ElectricCobalt.copy(alpha = 0.25f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = if (isCurrentWinner) "الفائز الحالي ✓" else actionLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isCurrentWinner) MidnightSurface else CyberSky,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

private fun formatBracketScore(match: MatchEntity, isPlayer1: Boolean): String {
    val s1 = if (isPlayer1) match.leg1Score1 else match.leg1Score2
    val s2 = if (isPlayer1) match.leg2Score1 else match.leg2Score2
    return if (match.isTwoLegged) {
        if (s1 == null) "-" else (s1 + (s2 ?: 0)).toString()
    } else {
        s1?.toString() ?: "-"
    }
}
