package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.example.ui.theme.ChampionshipGold
import com.example.ui.theme.CrimsonLoss
import com.example.ui.theme.CyberSky
import com.example.ui.theme.ElectricCobalt
import com.example.ui.theme.EmeraldWin
import com.example.ui.theme.NeonViolet
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.sin
import kotlin.random.Random

private data class ConfettiParticle(
    val xFraction: Float,
    val startYFraction: Float,
    val speedFactor: Float,
    val swayAmp: Float,
    val swayFreq: Float,
    val phase: Float,
    val widthDp: Float,
    val heightDp: Float,
    val rotationSpeed: Float,
    val color: Color,
    val isCircle: Boolean
)

@Composable
fun ConfettiOverlay(
    burstTrigger: Int,
    modifier: Modifier = Modifier
) {
    if (burstTrigger <= 0) return

    var isVisible by remember(burstTrigger) { mutableStateOf(true) }
    var targetProgress by remember(burstTrigger) { mutableStateOf(0f) }

    val progress by animateFloatAsState(
        targetValue = targetProgress,
        animationSpec = tween(durationMillis = 3200, easing = LinearEasing),
        label = "confetti_progress"
    )

    val particles = remember(burstTrigger) {
        val rng = Random(burstTrigger * 7919)
        val palette = listOf(
            ChampionshipGold,
            EmeraldWin,
            CyberSky,
            ElectricCobalt,
            NeonViolet,
            CrimsonLoss,
            Color.White
        )
        List(90) {
            ConfettiParticle(
                xFraction = rng.nextFloat(),
                startYFraction = -0.05f - rng.nextFloat() * 0.45f,
                speedFactor = 0.85f + rng.nextFloat() * 0.75f,
                swayAmp = 12f + rng.nextFloat() * 28f,
                swayFreq = 1.5f + rng.nextFloat() * 2.5f,
                phase = rng.nextFloat() * (2f * PI.toFloat()),
                widthDp = 6f + rng.nextFloat() * 7f,
                heightDp = 9f + rng.nextFloat() * 9f,
                rotationSpeed = (rng.nextFloat() - 0.5f) * 720f,
                color = palette[rng.nextInt(palette.size)],
                isCircle = rng.nextInt(5) == 0
            )
        }
    }

    LaunchedEffect(burstTrigger) {
        targetProgress = 1f
        delay(3350L)
        isVisible = false
    }

    if (!isVisible) return

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .testTag("champion_confetti_overlay")
    ) {
        val alphaFade = (1f - ((progress - 0.72f) / 0.28f).coerceIn(0f, 1f)).coerceIn(0f, 1f)
        for (p in particles) {
            val cy = (p.startYFraction + progress * 1.45f * p.speedFactor) * size.height
            if (cy < -40f || cy > size.height + 40f) continue
            val sway = sin((progress * p.swayFreq * 2f * PI.toFloat()) + p.phase) * p.swayAmp
            val cx = (p.xFraction * size.width) + sway
            val wPx = p.widthDp.dp.toPx()
            val hPx = p.heightDp.dp.toPx()
            val angle = p.rotationSpeed * progress
            val drawColor = p.color.copy(alpha = alphaFade * 0.92f)

            rotate(degrees = angle, pivot = Offset(cx, cy)) {
                if (p.isCircle) {
                    drawCircle(
                        color = drawColor,
                        radius = wPx * 0.5f,
                        center = Offset(cx, cy)
                    )
                } else {
                    drawRect(
                        color = drawColor,
                        topLeft = Offset(cx - wPx / 2f, cy - hPx / 2f),
                        size = Size(wPx, hPx)
                    )
                }
            }
        }
    }
}
