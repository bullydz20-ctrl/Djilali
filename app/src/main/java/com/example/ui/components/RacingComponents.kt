package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.api.RaceEntry
import com.example.api.RaceResultDraft
import com.example.api.RacingStandingRow
import com.example.data.local.PlayerEntity
import com.example.data.local.TournamentEntity
import com.example.data.model.GamePreset
import com.example.data.model.OnlineCompatibilityStatus
import com.example.data.model.RaceStage
import com.example.data.model.TournamentFormat
import com.example.data.model.parseRacingPointsConfig
import com.example.ui.theme.AmberDraw
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.ElevatedNavy
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.RoyalViolet
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun OnlineCompatibilityBanner(
    preset: GamePreset,
    modifier: Modifier = Modifier
) {
    val (accent, icon) = when (preset.onlineStatus) {
        OnlineCompatibilityStatus.OFFICIAL_ONLINE -> EmeraldWin to Icons.Default.VerifiedUser
        OnlineCompatibilityStatus.LOCAL_OR_LAN_ONLY -> AmberDraw to Icons.Default.Warning
        OnlineCompatibilityStatus.VERIFY_REQUIRED -> CyberSky to Icons.Default.Info
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .testTag("online_compatibility_banner"),
        color = accent.copy(alpha = 0.11f),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.55f))
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = icon,
                contentDescription = "حالة التوافق",
                tint = accent,
                modifier = Modifier.size(20.dp)
            )
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    text = "التحقق من اللعب أونلاين: ${preset.onlineStatusLabelAr}",
                    style = MaterialTheme.typography.labelLarge,
                    color = accent,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = preset.compatibilityNoteAr,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextPrimary
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RacingOverviewSection(
    tournament: TournamentEntity,
    races: List<RaceEntry>,
    standings: List<RacingStandingRow>,
    playersById: Map<Long, PlayerEntity>,
    approvedPlayers: List<PlayerEntity>,
    canManageRaces: Boolean,
    onCreateRace: (title: String, stage: RaceStage, trackName: String) -> Unit = { _, _, _ -> },
    onEditRaceResults: (RaceEntry) -> Unit = {},
    onGenerateFinalRace: () -> Unit = {},
    onDeleteRace: (Long) -> Unit = {},
    onPlayerClick: ((PlayerEntity) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val pointsConfig = remember(tournament.racingPointsConfig) {
        parseRacingPointsConfig(tournament.racingPointsConfig)
    }

    var newRaceTitle by remember(tournament.id, races.size) {
        mutableStateOf(
            if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL) {
                "جولة تصفيات ${races.size + 1}"
            } else {
                "السباق ${races.size + 1}"
            }
        )
    }
    var newRaceTrack by remember { mutableStateOf("") }
    var newRaceStage by remember(tournament.id, tournament.format) {
        mutableStateOf(
            if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL) RaceStage.QUALIFIER
            else RaceStage.REGULAR
        )
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Points distribution scheme card
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.45f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Speed, contentDescription = null, tint = ChampionshipGold)
                    Text(
                        text = "نظام نقاط المراكز المعتمد",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold,
                        fontWeight = FontWeight.Bold
                    )
                }
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    pointsConfig.forEachIndexed { idx, pts ->
                        Surface(
                            color = if (idx < 3) ChampionshipGold.copy(alpha = 0.16f) else ElevatedNavy,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(
                                1.dp,
                                if (idx < 3) ChampionshipGold.copy(alpha = 0.55f) else CardBorder
                            )
                        ) {
                            Text(
                                text = "مركز ${idx + 1}: $pts ن",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (idx < 3) ChampionshipGold else TextPrimary,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
                if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL) {
                    Text(
                        text = "نظام تصفيات ثم نهائي • يتأهل أفضل ${tournament.qualifiersPerGroup} متسابقين إلى السباق النهائي.",
                        style = MaterialTheme.typography.bodySmall,
                        color = CyberSky
                    )
                }
            }
        }

        // Racing Standings Leaderboard
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder),
            modifier = Modifier
                .fillMaxWidth()
                .testTag("racing_standings_card")
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(18.dp))
                        Text(
                            text = "الترتيب العام للمتسابقين",
                            style = MaterialTheme.typography.titleMedium,
                            color = ChampionshipGold,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL) {
                        Surface(
                            color = ChampionshipGold.copy(alpha = 0.14f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "الذهبي = متأهل للنهائي",
                                style = MaterialTheme.typography.labelSmall,
                                color = ChampionshipGold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                if (standings.isEmpty()) {
                    Text(
                        text = "لا يوجد متسابقون معتمدون في الترتيب حتى الآن.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(ElevatedNavy)
                            .padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("#", modifier = Modifier.width(24.dp), style = MaterialTheme.typography.labelSmall, color = TextSecondary, textAlign = TextAlign.Center)
                        Text("المتسابق", modifier = Modifier.weight(1f), style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text("سباق", modifier = Modifier.width(34.dp), style = MaterialTheme.typography.labelSmall, color = TextSecondary, textAlign = TextAlign.Center)
                        Text("فوز", modifier = Modifier.width(30.dp), style = MaterialTheme.typography.labelSmall, color = TextSecondary, textAlign = TextAlign.Center)
                        Text("منصة", modifier = Modifier.width(34.dp), style = MaterialTheme.typography.labelSmall, color = TextSecondary, textAlign = TextAlign.Center)
                        Text("النقاط", modifier = Modifier.width(42.dp), style = MaterialTheme.typography.labelSmall, color = ChampionshipGold, textAlign = TextAlign.Center)
                    }

                    standings.forEachIndexed { idx, row ->
                        if (idx > 0) HorizontalDivider(color = CardBorder.copy(alpha = 0.4f))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (row.isQualified) ChampionshipGold.copy(alpha = 0.08f)
                                    else MidnightSurface.copy(alpha = 0f)
                                )
                                .then(
                                    if (onPlayerClick != null) Modifier.clickable { onPlayerClick(row.player) }
                                    else Modifier
                                )
                                .padding(horizontal = 8.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = row.rank.toString(),
                                modifier = Modifier.width(24.dp),
                                style = MaterialTheme.typography.labelMedium,
                                color = if (row.rank == 1 || row.isQualified) ChampionshipGold else TextSecondary,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                            Row(
                                modifier = Modifier.weight(1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                PlayerAvatar(
                                    avatarUri = row.player.avatarUri,
                                    playerName = row.player.name,
                                    size = 26.dp,
                                    borderColor = if (row.isQualified || row.rank == 1) ChampionshipGold else CardBorder
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text(
                                        text = row.player.name,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (row.isQualified || row.rank == 1) TextPrimary else TextSecondary,
                                        fontWeight = if (row.rank <= 3 || row.isQualified) FontWeight.SemiBold else FontWeight.Normal,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    row.bestPosition?.let { best ->
                                        Text(
                                            text = "أفضل مركز #$best",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = CyberSky
                                        )
                                    }
                                }
                            }
                            Text(row.racesEntered.toString(), modifier = Modifier.width(34.dp), style = MaterialTheme.typography.labelMedium, color = TextPrimary, textAlign = TextAlign.Center)
                            Text(row.wins.toString(), modifier = Modifier.width(30.dp), style = MaterialTheme.typography.labelMedium, color = EmeraldWin, textAlign = TextAlign.Center)
                            Text(row.podiums.toString(), modifier = Modifier.width(34.dp), style = MaterialTheme.typography.labelMedium, color = CyberSky, textAlign = TextAlign.Center)
                            Text(
                                text = row.totalPoints.toString(),
                                modifier = Modifier.width(42.dp),
                                style = MaterialTheme.typography.titleSmall,
                                color = ChampionshipGold,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }

        // Admin race creation & qualifier->final generation controls
        if (canManageRaces) {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                border = BorderStroke(1.dp, ElectricCobalt.copy(alpha = 0.6f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.DirectionsCar, contentDescription = null, tint = CyberSky)
                        Text(
                            text = "إدارة جولات السباقات",
                            style = MaterialTheme.typography.titleMedium,
                            color = CyberSky,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    OutlinedTextField(
                        value = newRaceTitle,
                        onValueChange = { newRaceTitle = it },
                        label = { Text("عنوان السباق") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("racing_new_title_input")
                    )

                    OutlinedTextField(
                        value = newRaceTrack,
                        onValueChange = { newRaceTrack = it },
                        label = { Text("الحلبة / المسار (اختياري)") },
                        placeholder = { Text("مثال: Monza / Scotland") },
                        singleLine = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("racing_new_track_input")
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        RaceStage.entries.forEach { stageOpt ->
                            FilterChip(
                                selected = newRaceStage == stageOpt,
                                onClick = { newRaceStage = stageOpt },
                                label = { Text(stageOpt.labelAr, style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = ElectricCobalt,
                                    selectedLabelColor = ChampionshipGold
                                )
                            )
                        }
                    }

                    Button(
                        onClick = {
                            onCreateRace(
                                newRaceTitle.trim().ifBlank { "السباق ${races.size + 1}" },
                                newRaceStage,
                                newRaceTrack.trim()
                            )
                            newRaceTrack = ""
                        },
                        enabled = approvedPlayers.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("racing_add_race_button")
                    ) {
                        Icon(Icons.Default.AddCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("إضافة سباق جديد")
                    }

                    if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL && standings.isNotEmpty()) {
                        OutlinedButton(
                            onClick = onGenerateFinalRace,
                            border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.7f)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("racing_generate_final_button")
                        ) {
                            Icon(Icons.Default.Flag, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "توليد السباق النهائي (أفضل ${tournament.qualifiersPerGroup} متسابقين)",
                                color = ChampionshipGold
                            )
                        }
                    }
                }
            }
        }

        // Races List
        Text(
            text = "قائمة السباقات والنتائج (${races.size})",
            style = MaterialTheme.typography.titleMedium,
            color = TextPrimary,
            fontWeight = FontWeight.Bold
        )

        if (races.isEmpty()) {
            EmptyStatePanel(
                icon = Icons.Default.Flag,
                title = "لم يتم إنشاء سباقات بعد",
                subtitle = if (canManageRaces) {
                    "أضف أول سباق من النموذج أعلاه وسجّل مراكز المتسابقين ليتم تحديث الترتيب تلقائياً."
                } else {
                    "بانتظار قيام المنظم بإضافة السباقات وتسجيل المراكز."
                }
            )
        } else {
            races.forEach { race ->
                val isFinal = race.stage == RaceStage.FINAL
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                    border = BorderStroke(
                        1.dp,
                        when {
                            isFinal -> ChampionshipGold.copy(alpha = 0.75f)
                            race.isCompleted -> EmeraldWin.copy(alpha = 0.5f)
                            else -> CardBorder
                        }
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("race_card_${race.id}")
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
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = race.title.ifBlank { "السباق #${race.raceNumber}" },
                                    style = MaterialTheme.typography.titleSmall,
                                    color = if (isFinal) ChampionshipGold else TextPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                                val subtitle = buildString {
                                    append(race.stage.labelAr)
                                    if (race.trackName.isNotBlank()) {
                                        append(" • ")
                                        append(race.trackName)
                                    }
                                }
                                Text(
                                    text = subtitle,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = CyberSky
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Surface(
                                    color = if (race.isCompleted) EmeraldWin.copy(alpha = 0.16f) else AmberDraw.copy(alpha = 0.16f),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = if (race.isCompleted) "مكتمل" else "بانتظار النتائج",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (race.isCompleted) EmeraldWin else AmberDraw,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }
                                if (canManageRaces) {
                                    IconButton(
                                        onClick = { onDeleteRace(race.id) },
                                        modifier = Modifier
                                            .minimumInteractiveComponentSize()
                                            .testTag("delete_race_${race.id}")
                                    ) {
                                        Icon(Icons.Default.Delete, contentDescription = "حذف السباق", tint = CrimsonLoss)
                                    }
                                }
                            }
                        }

                        if (race.results.isNotEmpty()) {
                            val sortedResults = race.results.sortedWith(
                                compareBy<com.example.api.RaceResultEntry> { it.dnf }
                                    .thenBy { it.position ?: Int.MAX_VALUE }
                                    .thenByDescending { it.pointsAwarded }
                            )
                            sortedResults.forEachIndexed { idx, r ->
                                if (idx > 0) HorizontalDivider(color = CardBorder.copy(alpha = 0.35f))
                                val player = playersById[r.playerId]
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
                                        Surface(
                                            color = when {
                                                r.dnf -> CrimsonLoss.copy(alpha = 0.18f)
                                                r.position == 1 -> ChampionshipGold.copy(alpha = 0.22f)
                                                r.position in 2..3 -> CyberSky.copy(alpha = 0.18f)
                                                else -> ElevatedNavy
                                            },
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = if (r.dnf) "DNF" else "#${r.position ?: "-"}",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = when {
                                                    r.dnf -> CrimsonLoss
                                                    r.position == 1 -> ChampionshipGold
                                                    else -> TextPrimary
                                                },
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                            )
                                        }
                                        Text(
                                            text = player?.name ?: "متسابق #${r.playerId}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextPrimary,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        if (r.bestLapOrTime.isNotBlank()) {
                                            Text(
                                                text = "(${r.bestLapOrTime})",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = TextSecondary
                                            )
                                        }
                                    }
                                    Text(
                                        text = "+${r.pointsAwarded} ن",
                                        style = MaterialTheme.typography.labelLarge,
                                        color = if (r.pointsAwarded > 0) ChampionshipGold else TextSecondary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        if (canManageRaces) {
                            OutlinedButton(
                                onClick = { onEditRaceResults(race) },
                                border = BorderStroke(1.dp, ElectricCobalt),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(48.dp)
                                    .testTag("edit_race_results_${race.id}")
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null, tint = CyberSky, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = if (race.isCompleted) "تعديل مراكز السباق" else "تسجيل مراكز ونتائج السباق",
                                    color = CyberSky
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RaceResultsDialog(
    race: RaceEntry,
    tournament: TournamentEntity,
    approvedPlayers: List<PlayerEntity>,
    onDismiss: () -> Unit,
    onSave: (title: String, trackName: String, entries: List<RaceResultDraft>) -> Unit
) {
    val pointsConfig = remember(tournament.racingPointsConfig) {
        parseRacingPointsConfig(tournament.racingPointsConfig)
    }
    var title by remember(race.id) { mutableStateOf(race.title) }
    var trackName by remember(race.id) { mutableStateOf(race.trackName) }

    val existingByPlayer = remember(race.id, race.results) {
        race.results.associateBy { it.playerId }
    }
    val orderedPlayers = remember(race.id, approvedPlayers, race.results) {
        val fromRaceIds = race.results.map { it.playerId }.toSet()
        val inRace = race.results.mapNotNull { r -> approvedPlayers.find { it.id == r.playerId } }
        val others = approvedPlayers.filter { it.id !in fromRaceIds }
        inRace + others
    }

    val positionsMap = remember(race.id, orderedPlayers) {
        mutableStateMapOf<Long, String>().apply {
            orderedPlayers.forEachIndexed { idx, p ->
                val prev = existingByPlayer[p.id]
                this[p.id] = prev?.position?.toString() ?: (idx + 1).toString()
            }
        }
    }
    val timesMap = remember(race.id, orderedPlayers) {
        mutableStateMapOf<Long, String>().apply {
            orderedPlayers.forEach { p ->
                this[p.id] = existingByPlayer[p.id]?.bestLapOrTime.orEmpty()
            }
        }
    }
    val dnfMap = remember(race.id, orderedPlayers) {
        mutableStateMapOf<Long, Boolean>().apply {
            orderedPlayers.forEach { p ->
                this[p.id] = existingByPlayer[p.id]?.dnf ?: false
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Column {
                Text(
                    text = "تسجيل نتائج ${race.title.ifBlank { "السباق #${race.raceNumber}" }}",
                    style = MaterialTheme.typography.titleLarge,
                    color = ChampionshipGold
                )
                Text(
                    text = "${race.stage.labelAr} • أدخل مركز كل متسابق (1، 2، 3...) لحساب النقاط تلقائياً",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("اسم السباق") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = trackName,
                    onValueChange = { trackName = it },
                    label = { Text("الحلبة / المسار") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                HorizontalDivider(color = CardBorder)

                orderedPlayers.forEach { player ->
                    val posStr = positionsMap[player.id].orEmpty()
                    val posInt = posStr.toIntOrNull()
                    val isDnf = dnfMap[player.id] ?: false
                    val previewPts = if (!isDnf && posInt != null && posInt in 1..pointsConfig.size) {
                        pointsConfig[posInt - 1]
                    } else 0

                    Surface(
                        color = ElevatedNavy.copy(alpha = 0.7f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, CardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    PlayerAvatar(player.avatarUri, player.name, size = 28.dp)
                                    Text(
                                        text = player.name,
                                        style = MaterialTheme.typography.titleSmall,
                                        color = TextPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Surface(
                                    color = if (previewPts > 0) ChampionshipGold.copy(alpha = 0.2f) else MidnightSurface,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        text = if (isDnf) "0 ن (DNF)" else "+$previewPts ن",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = if (previewPts > 0) ChampionshipGold else TextSecondary,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                OutlinedTextField(
                                    value = posStr,
                                    onValueChange = { raw ->
                                        if (raw.all { it.isDigit() } && raw.length <= 2) {
                                            positionsMap[player.id] = raw
                                        }
                                    },
                                    enabled = !isDnf,
                                    label = { Text("المركز") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    singleLine = true,
                                    modifier = Modifier
                                        .width(86.dp)
                                        .testTag("race_pos_input_${player.id}")
                                )
                                OutlinedTextField(
                                    value = timesMap[player.id].orEmpty(),
                                    onValueChange = { timesMap[player.id] = it },
                                    label = { Text("أفضل لفة / زمن") },
                                    placeholder = { Text("1:42.5") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f)
                                )
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Checkbox(
                                        checked = isDnf,
                                        onCheckedChange = { checked -> dnfMap[player.id] = checked }
                                    )
                                    Text("DNF", style = MaterialTheme.typography.labelSmall, color = if (isDnf) CrimsonLoss else TextSecondary)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val drafts = orderedPlayers.map { p ->
                        val isDnf = dnfMap[p.id] ?: false
                        RaceResultDraft(
                            playerId = p.id,
                            position = if (isDnf) null else positionsMap[p.id]?.toIntOrNull()?.takeIf { it > 0 },
                            bestLapOrTime = timesMap[p.id].orEmpty().trim(),
                            dnf = isDnf
                        )
                    }
                    onSave(title.trim(), trackName.trim(), drafts)
                },
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier
                    .height(48.dp)
                    .testTag("race_results_dialog_save")
            ) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("حفظ النتائج وتحديث الترتيب")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء", color = TextSecondary)
            }
        }
    )
}
