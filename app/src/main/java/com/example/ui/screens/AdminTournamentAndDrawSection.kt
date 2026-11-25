package com.example.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.data.local.TournamentEntity
import com.example.data.model.DEFAULT_RACING_POINTS
import com.example.data.model.DEFAULT_RACING_POINTS_JSON
import com.example.data.model.DrawMode
import com.example.data.model.GAME_CATALOG
import com.example.data.model.KnockoutTieRule
import com.example.data.model.PlayMode
import com.example.data.model.TournamentFormat
import com.example.data.model.TournamentStatus
import com.example.data.model.findApprovedGamePreset
import com.example.data.model.formatRacingPointsConfig
import com.example.data.model.parseRacingPointsConfig
import com.example.domain.TournamentEngine
import com.example.ui.components.OnlineCompatibilityBanner
import com.example.ui.theme.AmberDraw
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.RoyalViolet
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary
import com.example.ui.viewmodel.TournamentUiState

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdminTournamentSettingsTab(
    tournament: TournamentEntity?,
    onImportBanner: (Uri, (String) -> Unit) -> Unit,
    onSaveSettings: (TournamentEntity) -> Unit,
    onCreateFresh: (TournamentEntity) -> Unit,
    onDeleteTournament: () -> Unit
) {
    val tid = tournament?.id
    val defaultPreset = remember { GAME_CATALOG.first() }
    val initialPreset = remember(tid, tournament?.gameTitle) {
        findApprovedGamePreset(tournament?.gameTitle)
    }
    val isExistingLegacy = tournament != null && initialPreset == null

    var name by remember(tid, tournament?.name) {
        mutableStateOf(tournament?.name ?: "بطولة ${defaultPreset.label} — CP4 ARENA")
    }
    var gameTitle by remember(tid, tournament?.gameTitle) {
        mutableStateOf(tournament?.gameTitle ?: defaultPreset.label)
    }
    var gameCategory by remember(tid, tournament?.gameCategory) {
        mutableStateOf(tournament?.gameCategory ?: defaultPreset.categoryAr)
    }
    var scoreUnitLabel by remember(tid, tournament?.scoreUnitLabel) {
        mutableStateOf(tournament?.scoreUnitLabel ?: defaultPreset.scoreUnitLabel)
    }
    var description by remember(tid, tournament?.description) {
        mutableStateOf(tournament?.description ?: "البطولة الرسمية لمجتمع CP4 ARENA • قوانين مخصصة حسب اللعبة المختارة.")
    }
    var bannerUri by remember(tid, tournament?.bannerUri) { mutableStateOf(tournament?.bannerUri) }
    var startDateTime by remember(tid, tournament?.startDateTime) {
        mutableStateOf(tournament?.startDateTime ?: "يُحدد لاحقاً")
    }
    var maxParticipants by remember(tid, tournament?.maxParticipants) {
        mutableStateOf((tournament?.maxParticipants ?: 16).toString())
    }
    var format by remember(tid, tournament?.format) {
        mutableStateOf(tournament?.format ?: defaultPreset.defaultFormat)
    }
    var playMode by remember(tid, tournament?.playMode) {
        mutableStateOf(tournament?.playMode ?: defaultPreset.defaultPlayMode)
    }
    var teamSize by remember(tid, tournament?.teamSize) {
        mutableStateOf((tournament?.teamSize ?: defaultPreset.defaultTeamSize).toString())
    }
    var bestOf by remember(tid, tournament?.bestOf) {
        mutableIntStateOf(tournament?.bestOf ?: defaultPreset.defaultBestOf)
    }
    var racingPointsText by remember(tid, tournament?.racingPointsConfig) {
        val list = parseRacingPointsConfig(tournament?.racingPointsConfig ?: DEFAULT_RACING_POINTS_JSON)
        mutableStateOf(list.joinToString(", "))
    }
    var groupCount by remember(tid, tournament?.groupCount) {
        mutableStateOf((tournament?.groupCount ?: 4).toString())
    }
    var qualifiersPerGroup by remember(tid, tournament?.qualifiersPerGroup) {
        mutableStateOf((tournament?.qualifiersPerGroup ?: 2).toString())
    }
    var drawMode by remember(tid, tournament?.drawMode) {
        mutableStateOf(tournament?.drawMode ?: DrawMode.RANDOM)
    }
    var tieRule by remember(tid, tournament?.knockoutTieRule) {
        mutableStateOf(tournament?.knockoutTieRule ?: KnockoutTieRule.SINGLE_MATCH_PENALTIES)
    }
    var matchDuration by remember(tid, tournament?.matchDurationMinutes) {
        mutableStateOf((tournament?.matchDurationMinutes ?: defaultPreset.defaultDurationMinutes).toString())
    }
    var targetGoalsRule by remember(tid, tournament?.targetGoalsRule) {
        mutableStateOf(tournament?.targetGoalsRule ?: defaultPreset.defaultRule)
    }
    var manualClosed by remember(tid, tournament?.isRegistrationClosedManual) {
        mutableStateOf(tournament?.isRegistrationClosedManual ?: false)
    }
    var isThirdPlaceEnabled by remember(tid, tournament?.isThirdPlaceEnabled) {
        mutableStateOf(tournament?.isThirdPlaceEnabled ?: true)
    }
    var showDeleteConfirm by remember(tid) { mutableStateOf(false) }

    val selectedPreset = findApprovedGamePreset(gameTitle)
    val activePlayModes = selectedPreset?.supportedPlayModes ?: PlayMode.entries
    val activeFormats = remember(selectedPreset, format) {
        if (selectedPreset != null) {
            selectedPreset.supportedFormats
        } else {
            listOf(
                TournamentFormat.GROUPS_KNOCKOUT,
                TournamentFormat.LEAGUE_KNOCKOUT,
                TournamentFormat.DIRECT_KNOCKOUT,
                TournamentFormat.RACE_POINTS,
                TournamentFormat.RACE_QUALIFIERS_FINAL
            )
        }
    }
    val supportsTeamSize = playMode == PlayMode.TEAMS && (selectedPreset?.supportsTeamSize ?: true)
    val supportsBestOf = selectedPreset?.supportsBestOf ?: (bestOf > 1)
    val isRacingMode = format.isRacing || selectedPreset?.supportsCustomRacePoints == true

    val bannerPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            onImportBanner(uri) { saved -> bannerUri = saved }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (tournament == null) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = ElectricCobalt.copy(alpha = 0.16f)),
                border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.6f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.SportsEsports, contentDescription = null, tint = ChampionshipGold)
                    Column {
                        Text(
                            text = "لا توجد بطولة نشطة حالياً",
                            style = MaterialTheme.typography.titleSmall,
                            color = ChampionshipGold
                        )
                        Text(
                            text = "اختر إحدى الألعاب الـ 7 المعتمدة ليضبط النظام القواعد المناسبة لها تلقائياً، ثم اضغط «إنشاء البطولة الجديدة».",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                }
            }
        }

        // Approved 7-Game Catalog Selector + Online Compatibility Verification
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.SportsEsports, contentDescription = null, tint = ChampionshipGold)
                    Text("قائمة الألعاب المعتمدة (7 ألعاب)", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)
                }
                Text(
                    text = "يتكيف نموذج البطولة والقواعد تلقائياً حسب نوع اللعبة المختارة:",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    GAME_CATALOG.forEach { item ->
                        val selected = gameTitle.trim().equals(item.label, ignoreCase = true)
                        FilterChip(
                            selected = selected,
                            onClick = {
                                val prevDefaultName = "بطولة $gameTitle — CP4 ARENA"
                                gameTitle = item.label
                                gameCategory = item.categoryAr
                                scoreUnitLabel = item.scoreUnitLabel
                                targetGoalsRule = item.defaultRule
                                matchDuration = item.defaultDurationMinutes.toString()
                                if (format !in item.supportedFormats) {
                                    format = item.defaultFormat
                                }
                                if (playMode !in item.supportedPlayModes) {
                                    playMode = item.defaultPlayMode
                                }
                                teamSize = if (playMode == PlayMode.TEAMS) {
                                    item.defaultTeamSize.coerceAtLeast(2).toString()
                                } else {
                                    "1"
                                }
                                bestOf = if (item.supportsBestOf) item.defaultBestOf else 1
                                if (item.supportsCustomRacePoints && racingPointsText.isBlank()) {
                                    racingPointsText = DEFAULT_RACING_POINTS.joinToString(", ")
                                }
                                if (tournament == null || name.startsWith("بطولة النخبة") || name.startsWith("بطولة جديدة") || name == prevDefaultName) {
                                    name = "بطولة ${item.label} — CP4 ARENA"
                                }
                            },
                            label = { Text("${item.label} (${item.categoryAr})", style = MaterialTheme.typography.labelSmall) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ElectricCobalt,
                                selectedLabelColor = ChampionshipGold
                            ),
                            modifier = Modifier.testTag("admin_game_preset_${item.id}")
                        )
                    }
                }

                if (selectedPreset != null) {
                    OnlineCompatibilityBanner(preset = selectedPreset)
                } else if (isExistingLegacy) {
                    Surface(
                        color = AmberDraw.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, AmberDraw.copy(alpha = 0.55f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = AmberDraw, modifier = Modifier.size(18.dp))
                            Text(
                                text = "بطولة سابقة محفوظة للعبة «$gameTitle». جميع نتائجها ومشاركوها محفوظون، ويمكنك الاستمرار بإدارتها أو اختيار لعبة من القائمة المعتمدة.",
                                style = MaterialTheme.typography.bodySmall,
                                color = TextPrimary
                            )
                        }
                    }
                }
            }
        }

        // Basic Details Card
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("تفاصيل البطولة الأساسية", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("اسم البطولة") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("admin_tournament_name")
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("وصف البطولة والقوانين العامة") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = startDateTime,
                    onValueChange = { startDateTime = it },
                    label = { Text("موعد البداية (مثال: الجمعة 9:00 مساءً)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = {
                            bannerPicker.launch(
                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                            )
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (bannerUri == null) "تغيير صورة الغلاف" else "تحديث صورة الغلاف")
                    }
                    if (bannerUri != null) {
                        TextButton(onClick = { bannerUri = null }) {
                            Text("استعادة الافتراضية", color = TextSecondary)
                        }
                    }
                }
            }
        }

        // Dynamic Game-Specific System & Rules Card
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "نظام البطولة وإعدادات ${selectedPreset?.label ?: gameTitle}",
                    style = MaterialTheme.typography.titleMedium,
                    color = CyberSky
                )

                // Play Mode (e.g., FIFA 22 Teams/1v1, COD 1v1/Teams, Fighting locked 1v1, Racing Race Points)
                if (activePlayModes.size > 1) {
                    Text("نمط المشاركة", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        activePlayModes.forEach { pm ->
                            FilterChip(
                                selected = playMode == pm,
                                onClick = {
                                    playMode = pm
                                    if (pm == PlayMode.TEAMS && (teamSize.toIntOrNull() ?: 1) < 2) {
                                        teamSize = (selectedPreset?.defaultTeamSize ?: 2).coerceAtLeast(2).toString()
                                    } else if (pm != PlayMode.TEAMS) {
                                        teamSize = "1"
                                    }
                                },
                                label = { Text(pm.labelAr) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = ElectricCobalt,
                                    selectedLabelColor = ChampionshipGold
                                ),
                                modifier = Modifier.testTag("admin_play_mode_${pm.name}")
                            )
                        }
                    }
                } else {
                    Surface(
                        color = ElectricCobalt.copy(alpha = 0.14f),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.45f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "نمط اللعب المعتمد: ${playMode.labelAr}",
                            style = MaterialTheme.typography.labelLarge,
                            color = CyberSky,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }

                // Team Size (only when TEAMS mode is selected and supported)
                if (supportsTeamSize) {
                    Text("عدد اللاعبين في كل فريق", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(2, 3, 4, 5, 6, 11).forEach { sz ->
                            FilterChip(
                                selected = teamSize.toIntOrNull() == sz,
                                onClick = { teamSize = sz.toString() },
                                label = { Text("$sz لاعبين") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = RoyalViolet,
                                    selectedLabelColor = ChampionshipGold
                                )
                            )
                        }
                    }
                    OutlinedTextField(
                        value = teamSize,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) teamSize = it },
                        label = { Text("تحديد عدد اللاعبين يدوياً (2 - 16)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("admin_team_size_input")
                    )
                }

                // Game-filtered Tournament Formats
                Text("نظام البطولة المتاح للعبة", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    activeFormats.forEach { fmt ->
                        FilterChip(
                            selected = format == fmt,
                            onClick = { format = fmt },
                            label = {
                                Column(modifier = Modifier.padding(vertical = 2.dp)) {
                                    Text(fmt.labelAr, style = MaterialTheme.typography.labelLarge)
                                    Text(fmt.descriptionAr, style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                                }
                            },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = ElectricCobalt,
                                selectedLabelColor = TextPrimary
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("admin_format_${fmt.name}")
                        )
                    }
                }

                // Best-of (Fighting + Call of Duty)
                if (supportsBestOf) {
                    Text("عدد الجولات / الحسم (Best of)", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(1, 3, 5).forEach { bo ->
                            FilterChip(
                                selected = bestOf == bo,
                                onClick = {
                                    bestOf = bo
                                    targetGoalsRule = "نظام ${playMode.labelAr} — Best of $bo"
                                },
                                label = { Text("Best of $bo") },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = RoyalViolet,
                                    selectedLabelColor = ChampionshipGold
                                ),
                                modifier = Modifier.testTag("admin_best_of_$bo")
                            )
                        }
                    }
                }

                // Participants + Groups / Qualifiers
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = maxParticipants,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 3) maxParticipants = it },
                        label = { Text("عدد المشاركين") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f).testTag("admin_max_participants")
                    )
                    if (format == TournamentFormat.GROUPS_KNOCKOUT) {
                        OutlinedTextField(
                            value = groupCount,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) groupCount = it },
                            label = { Text("عدد المجموعات") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                if (format == TournamentFormat.GROUPS_KNOCKOUT ||
                    format == TournamentFormat.LEAGUE_KNOCKOUT ||
                    format == TournamentFormat.RACE_QUALIFIERS_FINAL
                ) {
                    OutlinedTextField(
                        value = qualifiersPerGroup,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) qualifiersPerGroup = it },
                        label = {
                            Text(
                                when (format) {
                                    TournamentFormat.GROUPS_KNOCKOUT -> "المتأهلون من كل مجموعة"
                                    TournamentFormat.LEAGUE_KNOCKOUT -> "عدد المتأهلين من الدوري للإقصائيات"
                                    TournamentFormat.RACE_QUALIFIERS_FINAL -> "عدد المتأهلين للسباق النهائي"
                                    else -> "عدد المتأهلين"
                                }
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("admin_qualifiers_input")
                    )
                }

                // Racing Placement Points Customization (RIDE 4 / DriveClub)
                if (isRacingMode) {
                    Text("تخصيص نقاط المراكز للسباقات (من المركز 1 إلى الأخير)", style = MaterialTheme.typography.labelLarge, color = ChampionshipGold)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        FilterChip(
                            selected = false,
                            onClick = { racingPointsText = "25, 18, 15, 12, 10, 8, 6, 4, 2, 1" },
                            label = { Text("قياسي (25-18-15...)") }
                        )
                        FilterChip(
                            selected = false,
                            onClick = { racingPointsText = "10, 8, 6, 5, 4, 3, 2, 1" },
                            label = { Text("مختصر (10-8-6...)") }
                        )
                        FilterChip(
                            selected = false,
                            onClick = { racingPointsText = "15, 12, 10, 8, 6, 4, 2, 1" },
                            label = { Text("متوازن (15-12-10...)") }
                        )
                    }
                    OutlinedTextField(
                        value = racingPointsText,
                        onValueChange = { racingPointsText = it },
                        label = { Text("نقاط كل مركز مفصولة بفاصلة") },
                        placeholder = { Text("25, 18, 15, 12, 10, 8, 6, 4, 2, 1") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("admin_racing_points_input")
                    )
                }

                // Match/Knockout/Draw controls (only for non-racing tournaments)
                if (!isRacingMode) {
                    Text("نظام القرعة", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DrawMode.entries.forEach { dm ->
                            FilterChip(
                                selected = drawMode == dm,
                                onClick = { drawMode = dm },
                                label = { Text(dm.labelAr) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = RoyalViolet,
                                    selectedLabelColor = TextPrimary
                                )
                            )
                        }
                    }

                    Text("قواعد الأدوار الإقصائية", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        KnockoutTieRule.entries.forEach { rule ->
                            FilterChip(
                                selected = tieRule == rule,
                                onClick = { tieRule = rule },
                                label = { Text(rule.labelAr) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = ElectricCobalt,
                                    selectedLabelColor = TextPrimary
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = matchDuration,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) matchDuration = it },
                            label = { Text("مدة المباراة (دقيقة)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = targetGoalsRule,
                            onValueChange = { targetGoalsRule = it },
                            label = { Text("قاعدة الحسم / الجولات") },
                            singleLine = true,
                            modifier = Modifier.weight(1.4f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("مباراة تحديد المركز الثالث والرابع", style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                            Text("تأهيل خاسري نصف النهائي تلقائياً للعب على البرونزية", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                        }
                        Switch(
                            checked = isThirdPlaceEnabled,
                            onCheckedChange = { isThirdPlaceEnabled = it },
                            modifier = Modifier.testTag("admin_third_place_switch")
                        )
                    }
                } else {
                    OutlinedTextField(
                        value = targetGoalsRule,
                        onValueChange = { targetGoalsRule = it },
                        label = { Text("قواعد السباق والحلبات") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("إغلاق التسجيل يدوياً", style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                        Text("يُغلق تلقائياً أيضاً عند اكتمال العدد", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    }
                    Switch(checked = manualClosed, onCheckedChange = { manualClosed = it })
                }

                val cleanGameTitle = selectedPreset?.label ?: gameTitle.trim().ifBlank { defaultPreset.label }
                val cleanGameCategory = selectedPreset?.categoryAr ?: gameCategory.trim().ifBlank { defaultPreset.categoryAr }
                val cleanScoreUnit = selectedPreset?.scoreUnitLabel ?: scoreUnitLabel.trim().ifBlank { "نقطة" }
                val cleanTeamSize = if (playMode == PlayMode.TEAMS) (teamSize.toIntOrNull() ?: 2).coerceIn(2, 16) else 1
                val cleanBestOf = if (supportsBestOf) bestOf.takeIf { it in listOf(1, 3, 5) } ?: 3 else 1
                val cleanRacingPointsJson = formatRacingPointsConfig(parseRacingPointsConfig(racingPointsText))

                if (tournament != null) {
                    Button(
                        onClick = {
                            onSaveSettings(
                                tournament.copy(
                                    name = name.trim().ifBlank { "بطولة $cleanGameTitle — CP4 ARENA" },
                                    gameTitle = cleanGameTitle,
                                    gameCategory = cleanGameCategory,
                                    scoreUnitLabel = cleanScoreUnit,
                                    description = description,
                                    bannerUri = bannerUri,
                                    startDateTime = startDateTime,
                                    maxParticipants = (maxParticipants.toIntOrNull() ?: 16).coerceIn(2, 64),
                                    format = format,
                                    playMode = playMode,
                                    teamSize = cleanTeamSize,
                                    bestOf = cleanBestOf,
                                    racingPointsConfig = cleanRacingPointsJson,
                                    groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                    qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                    drawMode = drawMode,
                                    knockoutTieRule = tieRule,
                                    matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                    targetGoalsRule = targetGoalsRule,
                                    isThirdPlaceEnabled = if (isRacingMode) false else isThirdPlaceEnabled,
                                    isRegistrationClosedManual = manualClosed,
                                    status = if (manualClosed && tournament.status == TournamentStatus.REGISTRATION_OPEN) {
                                        TournamentStatus.REGISTRATION_CLOSED
                                    } else if (!manualClosed && tournament.status == TournamentStatus.REGISTRATION_CLOSED) {
                                        TournamentStatus.REGISTRATION_OPEN
                                    } else tournament.status
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_save_tournament")
                    ) {
                        Icon(Icons.Default.Save, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("حفظ إعدادات البطولة")
                    }
                } else {
                    Button(
                        onClick = {
                            onCreateFresh(
                                TournamentEntity(
                                    name = name.trim().ifBlank { "بطولة $cleanGameTitle — CP4 ARENA" },
                                    gameTitle = cleanGameTitle,
                                    gameCategory = cleanGameCategory,
                                    scoreUnitLabel = cleanScoreUnit,
                                    description = description.trim().ifBlank { "بطولة $cleanGameTitle لمجتمع CP4 ARENA." },
                                    bannerUri = bannerUri,
                                    startDateTime = startDateTime.trim().ifBlank { "يُحدد لاحقاً" },
                                    maxParticipants = (maxParticipants.toIntOrNull() ?: 16).coerceIn(2, 64),
                                    format = format,
                                    playMode = playMode,
                                    teamSize = cleanTeamSize,
                                    bestOf = cleanBestOf,
                                    racingPointsConfig = cleanRacingPointsJson,
                                    groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                    qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                    drawMode = drawMode,
                                    knockoutTieRule = tieRule,
                                    matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                    targetGoalsRule = targetGoalsRule,
                                    isThirdPlaceEnabled = if (isRacingMode) false else isThirdPlaceEnabled,
                                    isRegistrationClosedManual = manualClosed,
                                    status = if (manualClosed) TournamentStatus.REGISTRATION_CLOSED else TournamentStatus.REGISTRATION_OPEN
                                )
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_create_first_tournament")
                    ) {
                        Icon(Icons.Default.AddCircle, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("إنشاء البطولة الجديدة")
                    }
                }
            }
        }

        if (tournament != null) {
            val cleanGameTitle = selectedPreset?.label ?: gameTitle.trim().ifBlank { defaultPreset.label }
            val cleanGameCategory = selectedPreset?.categoryAr ?: gameCategory.trim().ifBlank { defaultPreset.categoryAr }
            val cleanScoreUnit = selectedPreset?.scoreUnitLabel ?: scoreUnitLabel.trim().ifBlank { "نقطة" }
            val cleanTeamSize = if (playMode == PlayMode.TEAMS) (teamSize.toIntOrNull() ?: 2).coerceIn(2, 16) else 1
            val cleanBestOf = if (supportsBestOf) bestOf.takeIf { it in listOf(1, 3, 5) } ?: 3 else 1
            val cleanRacingPointsJson = formatRacingPointsConfig(parseRacingPointsConfig(racingPointsText))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = {
                        onCreateFresh(
                            TournamentEntity(
                                name = "بطولة $cleanGameTitle — CP4 ARENA",
                                gameTitle = cleanGameTitle,
                                gameCategory = cleanGameCategory,
                                scoreUnitLabel = cleanScoreUnit,
                                description = "بطولة $cleanGameTitle جديدة لمجتمع CP4 ARENA.",
                                startDateTime = "يُحدد لاحقاً",
                                maxParticipants = (maxParticipants.toIntOrNull() ?: 16).coerceIn(2, 64),
                                format = format,
                                playMode = playMode,
                                teamSize = cleanTeamSize,
                                bestOf = cleanBestOf,
                                racingPointsConfig = cleanRacingPointsJson,
                                groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                drawMode = drawMode,
                                knockoutTieRule = tieRule,
                                matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                targetGoalsRule = targetGoalsRule,
                                isThirdPlaceEnabled = if (isRacingMode) false else isThirdPlaceEnabled
                            )
                        )
                    },
                    modifier = Modifier.weight(1f).testTag("admin_create_new_tournament_button"),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("بطولة جديدة")
                }

                OutlinedButton(
                    onClick = { showDeleteConfirm = true },
                    border = BorderStroke(1.dp, CrimsonLoss),
                    modifier = Modifier.weight(1f).testTag("admin_delete_tournament_button"),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.DeleteForever, contentDescription = null, tint = CrimsonLoss, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("حذف البطولة", color = CrimsonLoss)
                }
            }
        }
    }

    if (showDeleteConfirm && tournament != null) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            containerColor = MidnightSurface,
            title = { Text("تأكيد حذف البطولة", color = CrimsonLoss) },
            text = {
                Text(
                    "سيتم حذف بطولة «${tournament.name}» (${tournament.gameTitle}) وجميع اللاعبين والمجموعات والمباريات الخاصة بها بشكل نهائي.",
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteConfirm = false
                        onDeleteTournament()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonLoss),
                    modifier = Modifier.testTag("confirm_delete_tournament_button")
                ) { Text("حذف نهائي") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("إلغاء") }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdminDrawTab(
    uiState: TournamentUiState,
    onRunDraw: (manualGroups: Map<Long, Int>, manualKnockoutOrder: List<Long>) -> Unit,
    onGenerateKnockoutFromStandings: () -> Unit,
    onGenerateFinalRace: () -> Unit = {}
) {
    val tournament = uiState.tournament ?: return
    val approved = uiState.approvedPlayers

    if (tournament.format.isRacing) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.6f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("إدارة السباقات والتأهل (${tournament.format.labelAr})", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)
                    Text(
                        text = "المتسابقون المعتمدون: ${approved.size} • السباقات المسجلة: ${uiState.races.size}. في ألعاب السباق يمكنك إضافة الجولات وتسجيل المراكز مباشرة من تبويب «السباقات» ليتم تحديث الترتيب العام تلقائياً.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                    if (tournament.format == TournamentFormat.RACE_QUALIFIERS_FINAL && uiState.racingStandings.isNotEmpty()) {
                        Button(
                            onClick = onGenerateFinalRace,
                            colors = ButtonDefaults.buttonColors(containerColor = RoyalViolet),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                                .testTag("admin_draw_generate_final_race_button")
                        ) {
                            Icon(Icons.Default.Flag, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("توليد السباق النهائي (أفضل ${tournament.qualifiersPerGroup} متسابقين)")
                        }
                    }
                }
            }
        }
        return
    }

    val groupAssignments = remember(approved, tournament.groupCount) {
        mutableStateMapOf<Long, Int>().apply {
            approved.forEachIndexed { idx, p ->
                this[p.id] = idx % tournament.groupCount.coerceAtLeast(1)
            }
        }
    }
    var manualOrder by remember(approved) { mutableStateOf(approved.map { it.id }) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("استوديو القرعة (${tournament.drawMode.labelAr})", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)
                Text(
                    text = "اللاعبون المعتمدون الجاهزون للقرعة: ${approved.size} • النظام: ${tournament.format.labelAr}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                if (tournament.drawMode == DrawMode.MANUAL && approved.isNotEmpty()) {
                    if (tournament.format == TournamentFormat.GROUPS_KNOCKOUT) {
                        Text("وزّع اللاعبين يدوياً على المجموعات:", style = MaterialTheme.typography.labelLarge, color = CyberSky)
                        val gCount = tournament.groupCount.coerceIn(1, approved.size.coerceAtLeast(1))
                        approved.forEach { player ->
                            val currentG = groupAssignments[player.id] ?: 0
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Text(player.name, style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    for (gIdx in 0 until gCount) {
                                        FilterChip(
                                            selected = currentG == gIdx,
                                            onClick = { groupAssignments[player.id] = gIdx },
                                            label = { Text(TournamentEngine.groupDisplayName(gIdx)) },
                                            colors = FilterChipDefaults.filterChipColors(
                                                selectedContainerColor = ElectricCobalt,
                                                selectedLabelColor = TextPrimary
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        Text("رتّب اللاعبين يدوياً للمواجهات (كل متجاورين يتواجهان):", style = MaterialTheme.typography.labelLarge, color = CyberSky)
                        val playersById = approved.associateBy { it.id }
                        manualOrder.forEachIndexed { idx, pId ->
                            val p = playersById[pId]
                            if (p != null) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("${idx + 1}. ${p.name}", style = MaterialTheme.typography.bodyMedium, color = TextPrimary)
                                    Row {
                                        IconButton(
                                            enabled = idx > 0,
                                            onClick = {
                                                val mutable = manualOrder.toMutableList()
                                                val prev = mutable[idx - 1]
                                                mutable[idx - 1] = mutable[idx]
                                                mutable[idx] = prev
                                                manualOrder = mutable
                                            }
                                        ) {
                                            Icon(Icons.Default.ArrowUpward, contentDescription = "أعلى")
                                        }
                                        IconButton(
                                            enabled = idx < manualOrder.lastIndex,
                                            onClick = {
                                                val mutable = manualOrder.toMutableList()
                                                val next = mutable[idx + 1]
                                                mutable[idx + 1] = mutable[idx]
                                                mutable[idx] = next
                                                manualOrder = mutable
                                            }
                                        ) {
                                            Icon(Icons.Default.ArrowDownward, contentDescription = "أسفل")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Button(
                    onClick = { onRunDraw(groupAssignments.toMap(), manualOrder) },
                    enabled = approved.size >= 2,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("admin_run_draw_button")
                ) {
                    Icon(Icons.Default.Casino, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        if (tournament.drawMode == DrawMode.RANDOM) "إجراء القرعة العشوائية وتوليد المباريات"
                        else "اعتماد القرعة اليدوية وتوليد المباريات"
                    )
                }
            }
        }

        if (tournament.format != TournamentFormat.DIRECT_KNOCKOUT &&
            (uiState.groupsWithStandings.isNotEmpty() || uiState.leagueStandings.isNotEmpty())
        ) {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MidnightSurface),
                border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.6f))
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("الانتقال للأدوار الإقصائية", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)
                    Text(
                        text = "يقوم النظام بأخذ المتأهلين تلقائياً حسب الترتيب الحالي وبناء مخطط دور الـ 16 أو ربع النهائي أو نصف النهائي مع ربط كل مباراة بالتالية.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                    Button(
                        onClick = onGenerateKnockoutFromStandings,
                        colors = ButtonDefaults.buttonColors(containerColor = RoyalViolet),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("admin_generate_knockout_button")
                    ) {
                        Icon(Icons.Default.AccountTree, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("تأهيل المتصدرين وبناء المخطط الإقصائي")
                    }
                }
            }
        }
    }
}
