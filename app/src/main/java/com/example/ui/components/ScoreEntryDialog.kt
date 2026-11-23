package com.example.ui.components

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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Gavel
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
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
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun ScoreEntryDialog(
    match: MatchEntity,
    player1: PlayerEntity,
    player2: PlayerEntity,
    onDismiss: () -> Unit,
    onSave: (leg1S1: Int?, leg1S2: Int?, leg2S1: Int?, leg2S2: Int?, pen1: Int?, pen2: Int?) -> Unit,
    onWalkover: ((winnerSlot: Int, reason: String) -> Unit)? = null,
    onResolveDispute: ((String?) -> Unit)? = null
) {
    var l1s1 by remember(match.id) { mutableStateOf(match.leg1Score1?.toString() ?: "") }
    var l1s2 by remember(match.id) { mutableStateOf(match.leg1Score2?.toString() ?: "") }
    var l2s1 by remember(match.id) { mutableStateOf(match.leg2Score1?.toString() ?: "") }
    var l2s2 by remember(match.id) { mutableStateOf(match.leg2Score2?.toString() ?: "") }
    var p1 by remember(match.id) { mutableStateOf(match.penaltyScore1?.toString() ?: "") }
    var p2 by remember(match.id) { mutableStateOf(match.penaltyScore2?.toString() ?: "") }
    var walkoverReason by remember(match.id) { mutableStateOf(match.walkoverReason) }
    var showWalkoverSection by remember(match.id) { mutableStateOf(false) }

    val isKnockout = match.stage != MatchStage.GROUP && match.stage != MatchStage.LEAGUE

    val s1Int = l1s1.toIntOrNull()
    val s2Int = l1s2.toIntOrNull()
    val l2s1Int = l2s1.toIntOrNull()
    val l2s2Int = l2s2.toIntOrNull()

    val isTiedForKnockout = if (!isKnockout) {
        false
    } else if (match.isTwoLegged) {
        s1Int != null && s2Int != null && l2s1Int != null && l2s2Int != null && (s1Int + l2s1Int == s2Int + l2s2Int)
    } else {
        s1Int != null && s2Int != null && s1Int == s2Int
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Column {
                Text(
                    text = "تسجيل / تعديل النتيجة",
                    style = MaterialTheme.typography.titleLarge,
                    color = ChampionshipGold
                )
                Text(
                    text = "${match.stage.labelAr} • ${player1.name} ضد ${player2.name}",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (match.disputeStatus == "OPEN") {
                    Surface(
                        color = CrimsonLoss.copy(alpha = 0.14f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, CrimsonLoss.copy(alpha = 0.7f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Flag, contentDescription = null, tint = CrimsonLoss, modifier = Modifier.size(16.dp))
                                Text(
                                    text = "بلاغ / اعتراض مفتوح (${match.disputeSubmittedBy.ifBlank { "مشارك" }})",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = CrimsonLoss
                                )
                            }
                            if (match.disputeNote.isNotBlank()) {
                                Text(
                                    text = match.disputeNote,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = TextPrimary
                                )
                            }
                            if (!match.disputeScreenshotUrl.isNullOrBlank()) {
                                AsyncImage(
                                    model = match.disputeScreenshotUrl,
                                    contentDescription = "صورة إثبات النتيجة",
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(120.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(ElevatedNavy),
                                    contentScale = ContentScale.Crop
                                )
                            }
                            if (onResolveDispute != null) {
                                Button(
                                    onClick = { onResolveDispute("تم اعتماد القرار من لوحة تعديل النتيجة") },
                                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldWin),
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .testTag("score_dialog_resolve_dispute")
                                ) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MidnightSurface, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("إغلاق وحل البلاغ", color = MidnightSurface)
                                }
                            }
                        }
                    }
                }

                Text(
                    text = if (match.isTwoLegged) "مباراة الذهاب" else "النتيجة النهائية",
                    style = MaterialTheme.typography.labelLarge,
                    color = CyberSky
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = l1s1,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) l1s1 = it },
                        label = { Text(player1.name, maxLines = 1) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("score_leg1_p1")
                    )
                    OutlinedTextField(
                        value = l1s2,
                        onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) l1s2 = it },
                        label = { Text(player2.name, maxLines = 1) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier
                            .weight(1f)
                            .testTag("score_leg1_p2")
                    )
                }

                if (match.isTwoLegged) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "مباراة الإياب",
                        style = MaterialTheme.typography.labelLarge,
                        color = CyberSky
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = l2s1,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) l2s1 = it },
                            label = { Text(player1.name, maxLines = 1) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("score_leg2_p1")
                        )
                        OutlinedTextField(
                            value = l2s2,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) l2s2 = it },
                            label = { Text(player2.name, maxLines = 1) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("score_leg2_p2")
                        )
                    }
                }

                if (isTiedForKnockout) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "تعادل — ركلات الترجيح مطلوبة لحسم المتأهل",
                        style = MaterialTheme.typography.labelLarge,
                        color = ChampionshipGold
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = p1,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) p1 = it },
                            label = { Text("ترجيح ${player1.name}", maxLines = 1) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("score_pen_p1")
                        )
                        OutlinedTextField(
                            value = p2,
                            onValueChange = { if (it.all { c -> c.isDigit() } && it.length <= 2) p2 = it },
                            label = { Text("ترجيح ${player2.name}", maxLines = 1) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("score_pen_p2")
                        )
                    }
                }

                if (onWalkover != null) {
                    HorizontalDivider(color = CardBorder.copy(alpha = 0.6f))
                    OutlinedButton(
                        onClick = { showWalkoverSection = !showWalkoverSection },
                        border = BorderStroke(1.dp, AmberDraw.copy(alpha = 0.6f)),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("walkover_toggle_button")
                    ) {
                        Icon(Icons.Default.Gavel, contentDescription = null, tint = AmberDraw, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (showWalkoverSection) "إخفاء خيارات الانسحاب (3-0)" else "حسم بالانسحاب الإداري (3-0)",
                            color = AmberDraw
                        )
                    }

                    if (showWalkoverSection) {
                        Surface(
                            color = ElevatedNavy.copy(alpha = 0.7f),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, AmberDraw.copy(alpha = 0.45f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(10.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedTextField(
                                    value = walkoverReason,
                                    onValueChange = { walkoverReason = it },
                                    label = { Text("سبب الانسحاب (اختياري)") },
                                    placeholder = { Text("مثال: عدم حضور المنافس بعد المهلة") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = { onWalkover(1, walkoverReason.trim()) },
                                        colors = ButtonDefaults.buttonColors(containerColor = AmberDraw),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("walkover_p1_button")
                                    ) {
                                        Text(
                                            text = "فوز ${player1.name} (3-0)",
                                            color = MidnightSurface,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            style = MaterialTheme.typography.labelMedium
                                        )
                                    }
                                    Button(
                                        onClick = { onWalkover(2, walkoverReason.trim()) },
                                        colors = ButtonDefaults.buttonColors(containerColor = AmberDraw),
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier
                                            .weight(1f)
                                            .testTag("walkover_p2_button")
                                    ) {
                                        Text(
                                            text = "فوز ${player2.name} (3-0)",
                                            color = MidnightSurface,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            style = MaterialTheme.typography.labelMedium
                                        )
                                    }
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
                    onSave(
                        l1s1.toIntOrNull(),
                        l1s2.toIntOrNull(),
                        l2s1.toIntOrNull(),
                        l2s2.toIntOrNull(),
                        if (isTiedForKnockout) p1.toIntOrNull() else null,
                        if (isTiedForKnockout) p2.toIntOrNull() else null
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier.testTag("save_score_button")
            ) {
                Text("حفظ النتيجة", color = TextPrimary)
            }
        },
        dismissButton = {
            Row {
                if (match.leg1Score1 != null) {
                    TextButton(
                        onClick = { onSave(null, null, null, null, null, null) },
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Text("مسح", color = CrimsonLoss)
                    }
                }
                TextButton(onClick = onDismiss) {
                    Text("إلغاء", color = TextSecondary)
                }
            }
        }
    )
}
