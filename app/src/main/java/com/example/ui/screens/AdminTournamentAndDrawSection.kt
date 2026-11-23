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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.example.data.model.DrawMode
import com.example.data.model.GAME_CATALOG
import com.example.data.model.KnockoutTieRule
import com.example.data.model.TournamentFormat
import com.example.data.model.TournamentStatus
import com.example.domain.TournamentEngine
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
    var name by remember(tid, tournament?.name) {
        mutableStateOf(tournament?.name ?: "بطولة النخبة — CP4 ARENA")
    }
    var gameTitle by remember(tid, tournament?.gameTitle) {
        mutableStateOf(tournament?.gameTitle ?: "FIFA 22")
    }
    var gameCategory by remember(tid, tournament?.gameCategory) {
        mutableStateOf(tournament?.gameCategory ?: "كرة قدم")
    }
    var scoreUnitLabel by remember(tid, tournament?.scoreUnitLabel) {
        mutableStateOf(tournament?.scoreUnitLabel ?: "هدف")
    }
    var description by remember(tid, tournament?.description) {
        mutableStateOf(tournament?.description ?: "البطولة الرسمية لمجتمع CP4 ARENA • جميع الألعاب مدعومة.")
    }
    var bannerUri by remember(tid, tournament?.bannerUri) { mutableStateOf(tournament?.bannerUri) }
    var startDateTime by remember(tid, tournament?.startDateTime) {
        mutableStateOf(tournament?.startDateTime ?: "يُحدد لاحقاً")
    }
    var maxParticipants by remember(tid, tournament?.maxParticipants) {
        mutableStateOf((tournament?.maxParticipants ?: 16).toString())
    }
    var format by remember(tid, tournament?.format) {
        mutableStateOf(tournament?.format ?: TournamentFormat.GROUPS_KNOCKOUT)
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
        mutableStateOf((tournament?.matchDurationMinutes ?: 12).toString())
    }
    var targetGoalsRule by remember(tid, tournament?.targetGoalsRule) {
        mutableStateOf(tournament?.targetGoalsRule ?: "شوطان • 6 دقائق للشوط")
    }
    var manualClosed by remember(tid, tournament?.isRegistrationClosedManual) {
        mutableStateOf(tournament?.isRegistrationClosedManual ?: false)
    }
    var showDeleteConfirm by remember(tid) { mutableStateOf(false) }

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
                            text = "اختر اللعبة من القائمة أو اكتب اسم أي لعبة مخصصة ثم اضغط «إنشاء البطولة الجديدة».",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                }
            }
        }

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
                    Text("اختيار اللعبة (دعم جميع الألعاب)", style = MaterialTheme.typography.titleMedium, color = ChampionshipGold)
                }
                Text(
                    text = "اختر لعبة جاهزة أو اكتب أي لعبة مخصصة (كرة قدم، قتال، شوتر، سباقات...):",
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
                                gameTitle = item.label
                                gameCategory = item.categoryAr
                                scoreUnitLabel = item.scoreUnitLabel
                                targetGoalsRule = item.defaultRule
                                matchDuration = item.defaultDurationMinutes.toString()
                                if (tournament == null || name.startsWith("بطولة النخبة") || name.startsWith("بطولة جديدة")) {
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

                OutlinedTextField(
                    value = gameTitle,
                    onValueChange = { gameTitle = it },
                    label = { Text("اسم اللعبة المخصصة *") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("admin_game_title_input")
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = gameCategory,
                        onValueChange = { gameCategory = it },
                        label = { Text("التصنيف") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = scoreUnitLabel,
                        onValueChange = { scoreUnitLabel = it },
                        label = { Text("وحدة النتيجة (هدف/جولة/نقطة)") },
                        singleLine = true,
                        modifier = Modifier.weight(1.2f).testTag("admin_score_unit_input")
                    )
                }
            }
        }

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

        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MidnightSurface),
            border = BorderStroke(1.dp, CardBorder)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("النظام والقواعد المخصصة", style = MaterialTheme.typography.titleMedium, color = CyberSky)

                Text("نظام البطولة", style = MaterialTheme.typography.labelLarge, color = TextPrimary)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    TournamentFormat.entries.forEach { fmt ->
                        FilterChip(
                            selected = format == fmt,
                            onClick = { format = fmt },
                            label = { Text(fmt.labelAr) },
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

                if (format != TournamentFormat.DIRECT_KNOCKOUT) {
                    OutlinedTextField(
                        value = qualifiersPerGroup,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) qualifiersPerGroup = it },
                        label = {
                            Text(
                                if (format == TournamentFormat.GROUPS_KNOCKOUT) "المتأهلون من كل مجموعة"
                                else "عدد المتأهلين من الدوري للإقصائيات"
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

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
                        label = { Text("قاعدة الأهداف / الأشواط") },
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
                        Text("إغلاق التسجيل يدوياً", style = MaterialTheme.typography.titleSmall, color = TextPrimary)
                        Text("يُغلق تلقائياً أيضاً عند اكتمال العدد", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                    }
                    Switch(checked = manualClosed, onCheckedChange = { manualClosed = it })
                }

                val cleanGameTitle = gameTitle.trim().ifBlank { "FIFA 22" }
                val cleanGameCategory = gameCategory.trim().ifBlank { "ألعاب إلكترونية" }
                val cleanScoreUnit = scoreUnitLabel.trim().ifBlank { "نقطة" }

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
                                    groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                    qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                    drawMode = drawMode,
                                    knockoutTieRule = tieRule,
                                    matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                    targetGoalsRule = targetGoalsRule,
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
                                    groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                    qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                    drawMode = drawMode,
                                    knockoutTieRule = tieRule,
                                    matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                    targetGoalsRule = targetGoalsRule,
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
            val cleanGameTitle = gameTitle.trim().ifBlank { "FIFA 22" }
            val cleanGameCategory = gameCategory.trim().ifBlank { "ألعاب إلكترونية" }
            val cleanScoreUnit = scoreUnitLabel.trim().ifBlank { "نقطة" }
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
                                groupCount = (groupCount.toIntOrNull() ?: 4).coerceIn(1, 8),
                                qualifiersPerGroup = (qualifiersPerGroup.toIntOrNull() ?: 2).coerceIn(1, 16),
                                drawMode = drawMode,
                                knockoutTieRule = tieRule,
                                matchDurationMinutes = (matchDuration.toIntOrNull() ?: 12).coerceIn(1, 90),
                                targetGoalsRule = targetGoalsRule
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
    onGenerateKnockoutFromStandings: () -> Unit
) {
    val tournament = uiState.tournament ?: return
    val approved = uiState.approvedPlayers
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
