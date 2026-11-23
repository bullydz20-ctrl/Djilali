package com.example.ui.components

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.api.SeasonLeaderboardEntry
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.domain.PlayerStats
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
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun PlayerProfileDialog(
    player: PlayerEntity,
    currentStats: PlayerStats?,
    seasonEntry: SeasonLeaderboardEntry?,
    playerMatches: List<MatchEntity>,
    playersById: Map<Long, PlayerEntity>,
    scoreUnitLabel: String,
    isChampion: Boolean,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                PlayerAvatar(
                    avatarUri = player.avatarUri,
                    playerName = player.name,
                    size = 54.dp,
                    borderColor = if (isChampion) ChampionshipGold else ElectricCobalt
                )
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = player.name,
                            style = MaterialTheme.typography.titleLarge,
                            color = ChampionshipGold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (isChampion) {
                            Icon(
                                imageVector = Icons.Default.EmojiEvents,
                                contentDescription = "بطل البطولة",
                                tint = ChampionshipGold,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                    Text(
                        text = "ElysiumNet/ XeMoNat: ${player.elysiumNetId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = CyberSky
                    )
                    val sub = buildString {
                        append("OVR ${player.ovrRating} • ${player.level.labelAr}")
                        if (player.clubName.isNotBlank()) append(" • ${player.clubName}")
                    }
                    Text(
                        text = sub,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Season Career Stats across all tournaments
                if (seasonEntry != null) {
                    Surface(
                        color = ElevatedNavy,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.5f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "إحصائيات المسيرة الشاملة (كل البطولات)",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = ChampionshipGold
                                )
                                Text(
                                    text = "المركز #${seasonEntry.rank} • ${seasonEntry.seasonPoints} ن",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = CyberSky,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                ProfileStatBox("البطولات", seasonEntry.tournamentsCount.toString(), TextPrimary)
                                ProfileStatBox("الألقاب 🥇", seasonEntry.titles.toString(), ChampionshipGold)
                                ProfileStatBox("الوصافة 🥈", seasonEntry.runnerUps.toString(), CyberSky)
                                ProfileStatBox("نسبة الفوز", "${seasonEntry.winRatePercent}%", EmeraldWin)
                            }
                        }
                    }
                }

                // Current tournament stats
                Surface(
                    color = ObsidianVoid.copy(alpha = 0.55f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, CardBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "أرقام البطولة الحالية",
                            style = MaterialTheme.typography.labelLarge,
                            color = CyberSky
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            ProfileStatBox("لعب", (currentStats?.matchesPlayed ?: 0).toString(), TextPrimary)
                            ProfileStatBox("فوز", (currentStats?.wins ?: 0).toString(), EmeraldWin)
                            ProfileStatBox("تعادل", (currentStats?.draws ?: 0).toString(), AmberDraw)
                            ProfileStatBox("خسارة", (currentStats?.losses ?: 0).toString(), CrimsonLoss)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            ProfileStatBox("له ($scoreUnitLabel)", (currentStats?.goalsScored ?: 0).toString(), ChampionshipGold)
                            ProfileStatBox("عليه", (currentStats?.goalsConceded ?: 0).toString(), TextSecondary)
                            ProfileStatBox("شباك نظيفة", (currentStats?.cleanSheets ?: 0).toString(), EmeraldWin)
                        }
                    }
                }

                HorizontalDivider(color = CardBorder.copy(alpha = 0.5f))

                Text(
                    text = "سجل المباريات (${playerMatches.size})",
                    style = MaterialTheme.typography.titleSmall,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )

                if (playerMatches.isEmpty()) {
                    Text(
                        text = "لم يلعب أي مباراة مسجلة في هذه البطولة حتى الآن.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        playerMatches.forEach { m ->
                            val isP1 = m.player1Id == player.id
                            val opponentId = if (isP1) m.player2Id else m.player1Id
                            val opponentName = opponentId?.let { playersById[it]?.name } ?: "بانتظار المتأهل"
                            val myGoals = if (isP1) {
                                m.leg1Score1?.let { it + (if (m.isTwoLegged) m.leg2Score1 ?: 0 else 0) }
                            } else {
                                m.leg1Score2?.let { it + (if (m.isTwoLegged) m.leg2Score2 ?: 0 else 0) }
                            }
                            val oppGoals = if (isP1) {
                                m.leg1Score2?.let { it + (if (m.isTwoLegged) m.leg2Score2 ?: 0 else 0) }
                            } else {
                                m.leg1Score1?.let { it + (if (m.isTwoLegged) m.leg2Score1 ?: 0 else 0) }
                            }
                            val resultBadge = when {
                                !m.isCompleted -> "مجدولة" to CyberSky
                                m.winnerId == player.id -> "فوز" to EmeraldWin
                                m.winnerId == null -> "تعادل" to AmberDraw
                                else -> "خسارة" to CrimsonLoss
                            }

                            Surface(
                                color = ElevatedNavy.copy(alpha = 0.7f),
                                shape = RoundedCornerShape(10.dp),
                                border = BorderStroke(1.dp, CardBorder.copy(alpha = 0.6f)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 10.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "ضد $opponentName",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = TextPrimary,
                                            fontWeight = FontWeight.SemiBold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            text = m.stage.labelAr + if (m.isWalkover) " • انسحاب" else "",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = TextSecondary
                                        )
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (myGoals != null && oppGoals != null) {
                                            Text(
                                                text = "$myGoals - $oppGoals",
                                                style = MaterialTheme.typography.titleSmall,
                                                color = ChampionshipGold,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                        Surface(
                                            color = resultBadge.second.copy(alpha = 0.16f),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = resultBadge.first,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = resultBadge.second,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إغلاق", color = CyberSky)
            }
        }
    )
}

@Composable
private fun ProfileStatBox(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            color = valueColor,
            fontWeight = FontWeight.Bold
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary
        )
    }
}

@Composable
fun DisputeMatchDialog(
    match: MatchEntity,
    player1: PlayerEntity,
    player2: PlayerEntity,
    canResolveDispute: Boolean,
    onDismiss: () -> Unit,
    onImportProofImage: (Uri, (String) -> Unit) -> Unit,
    onSubmitDispute: (submittedBy: String, note: String, screenshotUrl: String?) -> Unit,
    onResolveDispute: (resolutionNote: String?) -> Unit
) {
    var submittedBy by remember(match.id) { mutableStateOf(match.disputeSubmittedBy.ifBlank { player1.name }) }
    var note by remember(match.id) { mutableStateOf(match.disputeNote) }
    var screenshotUrl by remember(match.id) { mutableStateOf(match.disputeScreenshotUrl) }
    var resolutionNote by remember(match.id) { mutableStateOf("") }

    val proofPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            onImportProofImage(uri) { url -> screenshotUrl = url }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.Flag, contentDescription = null, tint = AmberDraw)
                Column {
                    Text(
                        text = "بلاغ / إثبات نتيجة المباراة",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold
                    )
                    Text(
                        text = "${player1.name} ضد ${player2.name}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (match.disputeStatus != "NONE") {
                    val isOpen = match.disputeStatus == "OPEN"
                    Surface(
                        color = (if (isOpen) CrimsonLoss else EmeraldWin).copy(alpha = 0.14f),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (isOpen) CrimsonLoss else EmeraldWin),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                text = if (isOpen) "حالة الاعتراض: مفتوح للمراجعة" else "حالة الاعتراض: تم الحل والإغلاق",
                                style = MaterialTheme.typography.labelLarge,
                                color = if (isOpen) CrimsonLoss else EmeraldWin
                            )
                            if (match.disputeSubmittedBy.isNotBlank()) {
                                Text(
                                    text = "مقدّم البلاغ: ${match.disputeSubmittedBy}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = TextPrimary
                                )
                            }
                            if (match.disputeNote.isNotBlank()) {
                                Text(
                                    text = match.disputeNote,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                }

                if (!screenshotUrl.isNullOrBlank()) {
                    AsyncImage(
                        model = screenshotUrl,
                        contentDescription = "صورة إثبات النتيجة",
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(160.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(ElevatedNavy),
                        contentScale = ContentScale.Crop
                    )
                }

                OutlinedButton(
                    onClick = {
                        proofPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    },
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("dispute_pick_screenshot_button")
                ) {
                    Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (screenshotUrl == null) "إرفاق صورة إثبات النتيجة (لقطة شاشة)" else "تغيير صورة الإثبات")
                }

                OutlinedTextField(
                    value = submittedBy,
                    onValueChange = { submittedBy = it },
                    label = { Text("اسم مُرسل الإثبات / اللاعب *") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("dispute_submitter_input")
                )

                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("النتيجة الفعلية أو سبب الاعتراض *") },
                    minLines = 2,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("dispute_note_input")
                )

                if (canResolveDispute && match.disputeStatus == "OPEN") {
                    HorizontalDivider(color = CardBorder)
                    Text(
                        text = "إجراء المشرف لحل الاعتراض",
                        style = MaterialTheme.typography.labelLarge,
                        color = EmeraldWin
                    )
                    OutlinedTextField(
                        value = resolutionNote,
                        onValueChange = { resolutionNote = it },
                        label = { Text("ملاحظة قرار المشرف (اختياري)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = { onResolveDispute(resolutionNote.trim().ifBlank { null }) },
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldWin),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("dispute_resolve_button")
                    ) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MidnightSurface, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("إغلاق وحل الاعتراض الآن", color = MidnightSurface)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSubmitDispute(submittedBy.trim(), note.trim(), screenshotUrl) },
                enabled = submittedBy.isNotBlank() && note.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier.testTag("dispute_submit_button")
            ) {
                Text("إرسال البلاغ والإثبات")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء", color = TextSecondary)
            }
        }
    )
}
