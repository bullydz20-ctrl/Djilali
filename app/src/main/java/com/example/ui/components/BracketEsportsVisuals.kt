package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.ViewColumn
import androidx.compose.material.icons.filled.ViewStream
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.CompositionLocalProvider
import com.example.ui.theme.CardBorder
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CyberSky
import com.example.ui.theme.DeepCrimsonSurface
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.ElectricRed
import com.example.ui.theme.ElevatedNavy
import com.example.ui.theme.GoldMuted
import com.example.ui.theme.MidnightSurface
import com.example.ui.theme.NeonCrimson
import com.example.ui.theme.ObsidianVoid
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

enum class BracketViewMode {
    HORIZONTAL,
    VERTICAL
}

enum class BracketWingSide {
    LEFT_BLUE,
    RIGHT_RED,
    FINAL_GOLD
}

private val ChamferHexShape = GenericShape { size, _ ->
    val cut = (size.height * 0.34f).coerceAtMost(size.width * 0.14f)
    moveTo(cut, 0f)
    lineTo(size.width - cut, 0f)
    lineTo(size.width, size.height * 0.5f)
    lineTo(size.width - cut, size.height)
    lineTo(cut, size.height)
    lineTo(0f, size.height * 0.5f)
    close()
}

@Composable
fun EsportsCrownCanvas(
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val crownPath = Path().apply {
            moveTo(w * 0.10f, h * 0.78f)
            lineTo(w * 0.04f, h * 0.24f)
            lineTo(w * 0.29f, h * 0.48f)
            lineTo(w * 0.50f, h * 0.08f)
            lineTo(w * 0.71f, h * 0.48f)
            lineTo(w * 0.96f, h * 0.24f)
            lineTo(w * 0.90f, h * 0.78f)
            close()
        }
        val goldBrush = Brush.verticalGradient(
            listOf(Color(0xFFFEF08A), ChampionshipGold, GoldMuted)
        )
        drawPath(crownPath, brush = goldBrush)
        drawPath(
            crownPath,
            color = Color(0xFFFEF3C7),
            style = Stroke(width = 1.2.dp.toPx(), join = StrokeJoin.Round)
        )
        drawRoundRect(
            brush = goldBrush,
            topLeft = Offset(w * 0.12f, h * 0.82f),
            size = Size(w * 0.76f, h * 0.13f),
            cornerRadius = CornerRadius(4f, 4f)
        )
        drawCircle(Color(0xFFFEF9C3), radius = 2.dp.toPx(), center = Offset(w * 0.50f, h * 0.08f))
        drawCircle(Color(0xFFFEF9C3), radius = 1.6.dp.toPx(), center = Offset(w * 0.04f, h * 0.24f))
        drawCircle(Color(0xFFFEF9C3), radius = 1.6.dp.toPx(), center = Offset(w * 0.96f, h * 0.24f))
    }
}

@Composable
fun EsportsTrophyCrest(
    hasChampion: Boolean,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val cx = w * 0.5f
            val cy = h * 0.48f

            // Radiant golden stadium aura
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        ChampionshipGold.copy(alpha = if (hasChampion) 0.50f else 0.30f),
                        ChampionshipGold.copy(alpha = 0.12f),
                        Color.Transparent
                    ),
                    center = Offset(cx, cy),
                    radius = minOf(w, h) * 0.48f
                ),
                center = Offset(cx, cy),
                radius = minOf(w, h) * 0.48f
            )

            // Golden laurel wreaths on both sides
            val wreathLeafAngles = listOf(-32f, -18f, -4f, 12f, 28f)
            val wreathOffsetsY = listOf(0.68f, 0.56f, 0.44f, 0.32f, 0.21f)
            val wreathOffsetsXLeft = listOf(0.24f, 0.19f, 0.18f, 0.21f, 0.27f)
            wreathOffsetsY.forEachIndexed { idx, yFrac ->
                val lx = w * wreathOffsetsXLeft[idx]
                val rx = w * (1f - wreathOffsetsXLeft[idx])
                val ly = h * yFrac
                rotate(wreathLeafAngles[idx], pivot = Offset(lx, ly)) {
                    drawOval(
                        color = Color(0xFFFDE68A).copy(alpha = 0.85f),
                        topLeft = Offset(lx - 5.dp.toPx(), ly - 2.3.dp.toPx()),
                        size = Size(10.dp.toPx(), 4.6.dp.toPx())
                    )
                }
                rotate(-wreathLeafAngles[idx], pivot = Offset(rx, ly)) {
                    drawOval(
                        color = Color(0xFFFDE68A).copy(alpha = 0.85f),
                        topLeft = Offset(rx - 5.dp.toPx(), ly - 2.3.dp.toPx()),
                        size = Size(10.dp.toPx(), 4.6.dp.toPx())
                    )
                }
            }

            val goldBrush = Brush.linearGradient(
                colors = listOf(Color(0xFFFEF08A), ChampionshipGold, GoldMuted),
                start = Offset(w * 0.3f, h * 0.15f),
                end = Offset(w * 0.7f, h * 0.85f)
            )

            // Handles
            val leftHandle = Path().apply {
                moveTo(w * 0.34f, h * 0.24f)
                cubicTo(w * 0.23f, h * 0.24f, w * 0.22f, h * 0.42f, w * 0.36f, h * 0.49f)
            }
            val rightHandle = Path().apply {
                moveTo(w * 0.66f, h * 0.24f)
                cubicTo(w * 0.77f, h * 0.24f, w * 0.78f, h * 0.42f, w * 0.64f, h * 0.49f)
            }
            drawPath(leftHandle, brush = goldBrush, style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round))
            drawPath(rightHandle, brush = goldBrush, style = Stroke(width = 3.5.dp.toPx(), cap = StrokeCap.Round))

            // Cup Body
            val cupPath = Path().apply {
                moveTo(w * 0.32f, h * 0.16f)
                lineTo(w * 0.68f, h * 0.16f)
                lineTo(w * 0.64f, h * 0.48f)
                cubicTo(w * 0.61f, h * 0.60f, w * 0.55f, h * 0.66f, cx, h * 0.67f)
                cubicTo(w * 0.45f, h * 0.66f, w * 0.39f, h * 0.60f, w * 0.36f, h * 0.48f)
                close()
            }
            drawPath(cupPath, brush = goldBrush)
            drawPath(cupPath, color = Color(0xFFFEF3C7), style = Stroke(width = 1.3.dp.toPx(), join = StrokeJoin.Round))

            // Stem & Base
            drawRect(
                brush = goldBrush,
                topLeft = Offset(cx - 4.5.dp.toPx(), h * 0.66f),
                size = Size(9.dp.toPx(), h * 0.12f)
            )
            val basePath = Path().apply {
                moveTo(w * 0.37f, h * 0.78f)
                lineTo(w * 0.63f, h * 0.78f)
                lineTo(w * 0.67f, h * 0.87f)
                lineTo(w * 0.33f, h * 0.87f)
                close()
            }
            drawPath(basePath, brush = goldBrush)
            drawRoundRect(
                color = GoldMuted,
                topLeft = Offset(w * 0.29f, h * 0.87f),
                size = Size(w * 0.42f, h * 0.06f),
                cornerRadius = CornerRadius(3.dp.toPx(), 3.dp.toPx())
            )
        }
    }
}

@Composable
fun EsportsHexStageHeader(
    title: String,
    wingSide: BracketWingSide,
    modifier: Modifier = Modifier,
    height: Dp = 38.dp
) {
    val bgBrush = when (wingSide) {
        BracketWingSide.FINAL_GOLD -> Brush.verticalGradient(
            listOf(Color(0xFFFDE68A), ChampionshipGold, Color(0xFFB4780D))
        )
        BracketWingSide.RIGHT_RED -> Brush.verticalGradient(
            listOf(ElectricRed.copy(alpha = 0.42f), DeepCrimsonSurface)
        )
        BracketWingSide.LEFT_BLUE -> Brush.verticalGradient(
            listOf(ElectricCobalt.copy(alpha = 0.45f), MidnightSurface)
        )
    }
    val borderColor = when (wingSide) {
        BracketWingSide.FINAL_GOLD -> Color(0xFFFEF3C7)
        BracketWingSide.RIGHT_RED -> NeonCrimson.copy(alpha = 0.75f)
        BracketWingSide.LEFT_BLUE -> CyberSky.copy(alpha = 0.75f)
    }
    val textColor = if (wingSide == BracketWingSide.FINAL_GOLD) Color(0xFF161004) else TextPrimary

    Box(modifier = modifier, contentAlignment = Alignment.TopCenter) {
        Surface(
            shape = ChamferHexShape,
            color = Color.Transparent,
            border = BorderStroke(if (wingSide == BracketWingSide.FINAL_GOLD) 1.6.dp else 1.2.dp, borderColor),
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .clip(ChamferHexShape)
                .background(bgBrush)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (wingSide == BracketWingSide.FINAL_GOLD) {
                    EsportsCrownCanvas(modifier = Modifier.size(width = 18.dp, height = 13.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                }
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    color = textColor,
                    fontWeight = FontWeight.ExtraBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun EsportsArenaTopBar(
    viewMode: BracketViewMode,
    onChangeViewMode: (BracketViewMode) -> Unit,
    isCompactWidth: Boolean,
    isFullscreen: Boolean,
    onToggleFullscreen: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = Color.Transparent,
        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.28f)),
        modifier = modifier
            .fillMaxWidth()
            .drawBehind {
                drawRect(
                    brush = Brush.horizontalGradient(
                        colors = listOf(
                            ElectricCobalt.copy(alpha = 0.22f),
                            MidnightSurface.copy(alpha = 0.96f),
                            ObsidianVoid.copy(alpha = 0.98f),
                            MidnightSurface.copy(alpha = 0.96f),
                            ElectricRed.copy(alpha = 0.22f)
                        )
                    )
                )
            }
    ) {
        if (isCompactWidth) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                EsportsBrandLockup()
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    EsportsViewModeCapsule(
                        viewMode = viewMode,
                        onChangeViewMode = onChangeViewMode
                    )
                    EsportsFullscreenButton(
                        isFullscreen = isFullscreen,
                        onToggleFullscreen = onToggleFullscreen
                    )
                }
            }
        } else {
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    EsportsViewModeCapsule(
                        viewMode = viewMode,
                        onChangeViewMode = onChangeViewMode
                    )
                    EsportsBrandLockup()
                    EsportsFullscreenButton(
                        isFullscreen = isFullscreen,
                        onToggleFullscreen = onToggleFullscreen
                    )
                }
            }
        }
    }
}

@Composable
private fun EsportsBrandLockup() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        EsportsCrownCanvas(modifier = Modifier.size(width = 24.dp, height = 16.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp)
        ) {
            Text(
                text = "CP4",
                color = Color(0xFFE2E8F0),
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic
            )
            Text(
                text = "ARENA",
                color = ChampionshipGold,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                fontStyle = FontStyle.Italic
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .width(20.dp)
                    .height(2.dp)
                    .background(Brush.horizontalGradient(listOf(Color.Transparent, ChampionshipGold)))
            )
            Text(
                text = "TOURNAMENT BRACKET",
                color = TextPrimary,
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp
            )
            Box(
                modifier = Modifier
                    .width(20.dp)
                    .height(2.dp)
                    .background(Brush.horizontalGradient(listOf(ChampionshipGold, Color.Transparent)))
            )
        }
    }
}

@Composable
private fun EsportsViewModeCapsule(
    viewMode: BracketViewMode,
    onChangeViewMode: (BracketViewMode) -> Unit
) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Surface(
            color = ObsidianVoid.copy(alpha = 0.92f),
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(1.2.dp, CyberSky.copy(alpha = 0.55f))
        ) {
            Row(
                modifier = Modifier.padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(2.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ModePillButton(
                    label = "أفقي",
                    icon = Icons.Default.ViewColumn,
                    selected = viewMode == BracketViewMode.HORIZONTAL,
                    onClick = { onChangeViewMode(BracketViewMode.HORIZONTAL) },
                    modifier = Modifier.testTag("bracket_mode_horizontal")
                )
                ModePillButton(
                    label = "عمودي",
                    icon = Icons.Default.ViewStream,
                    selected = viewMode == BracketViewMode.VERTICAL,
                    onClick = { onChangeViewMode(BracketViewMode.VERTICAL) },
                    modifier = Modifier.testTag("bracket_mode_vertical")
                )
            }
        }
    }
}

@Composable
private fun ModePillButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        color = if (selected) ChampionshipGold else Color.Transparent,
        shape = RoundedCornerShape(999.dp),
        modifier = modifier
            .minimumInteractiveComponentSize()
            .clip(RoundedCornerShape(999.dp))
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (selected) Color(0xFF161004) else TextSecondary,
                modifier = Modifier.size(15.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (selected) Color(0xFF161004) else TextPrimary,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}

@Composable
private fun EsportsFullscreenButton(
    isFullscreen: Boolean,
    onToggleFullscreen: () -> Unit
) {
    Surface(
        color = ObsidianVoid.copy(alpha = 0.9f),
        shape = RoundedCornerShape(999.dp),
        border = BorderStroke(1.2.dp, CyberSky.copy(alpha = 0.5f))
    ) {
        IconButton(
            onClick = onToggleFullscreen,
            modifier = Modifier
                .minimumInteractiveComponentSize()
                .testTag("bracket_fullscreen_toggle")
        ) {
            Icon(
                imageVector = if (isFullscreen) Icons.Default.FullscreenExit else Icons.Default.Fullscreen,
                contentDescription = if (isFullscreen) "إنهاء ملء الشاشة" else "ملء الشاشة",
                tint = ChampionshipGold
            )
        }
    }
}

@Composable
fun EsportsPodiumRings(
    modifier: Modifier = Modifier
) {
    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        drawOval(
            brush = Brush.horizontalGradient(
                listOf(
                    CyberSky.copy(alpha = 0.45f),
                    ChampionshipGold.copy(alpha = 0.72f),
                    NeonCrimson.copy(alpha = 0.45f)
                )
            ),
            topLeft = Offset(w * 0.04f, h * 0.25f),
            size = Size(w * 0.92f, h * 0.62f),
            style = Stroke(width = 2.dp.toPx())
        )
        drawOval(
            color = ChampionshipGold.copy(alpha = 0.25f),
            topLeft = Offset(w * 0.16f, h * 0.36f),
            size = Size(w * 0.68f, h * 0.38f)
        )
    }
}
