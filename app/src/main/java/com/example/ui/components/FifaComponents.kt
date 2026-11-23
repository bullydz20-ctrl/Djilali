package com.example.ui.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.HowToReg
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SportsEsports
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.example.R
import com.example.data.local.AdminAccountEntity
import com.example.data.local.MatchEntity
import com.example.data.local.PlayerEntity
import com.example.data.local.TournamentEntity
import com.example.data.model.PlayerLevel
import com.example.data.model.TournamentStatus
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
import com.example.ui.theme.OvrBadgeStyle
import com.example.ui.theme.RoyalViolet
import com.example.ui.theme.ScoreDisplayStyle
import com.example.ui.theme.TextPrimary
import com.example.ui.theme.TextSecondary

@Composable
fun CommunityTopHeader(
    currentAdmin: AdminAccountEntity?,
    tournaments: List<TournamentEntity> = emptyList(),
    activeTournamentId: Long? = null,
    onSelectTournament: (Long) -> Unit = {},
    onOpenAdmin: () -> Unit,
    onOpenExportShare: () -> Unit = {},
    onOpenWebPortal: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MidnightSurface.copy(alpha = 0.96f),
        tonalElevation = 4.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(
                    WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
                )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_community_logo),
                    contentDescription = stringResource(R.string.cd_community_logo),
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .border(1.5.dp, ChampionshipGold, CircleShape),
                    contentScale = ContentScale.Crop
                )
                Spacer(modifier = Modifier.width(8.dp))
                Column {
                    Text(
                        text = stringResource(R.string.community_name),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = ChampionshipGold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = stringResource(R.string.community_subtitle),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(modifier = Modifier.width(4.dp))

            IconButton(
                onClick = onOpenWebPortal,
                modifier = Modifier
                    .minimumInteractiveComponentSize()
                    .testTag("header_open_web_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = stringResource(R.string.action_open_web),
                    tint = ChampionshipGold
                )
            }

            IconButton(
                onClick = onOpenExportShare,
                modifier = Modifier
                    .minimumInteractiveComponentSize()
                    .testTag("header_share_export_button")
            ) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = "تصدير ومشاركة نتائج البطولة",
                    tint = CyberSky
                )
            }

            Spacer(modifier = Modifier.width(2.dp))

            Surface(
                modifier = Modifier
                    .testTag("header_admin_button")
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClick = onOpenAdmin),
                color = if (currentAdmin != null) {
                    ChampionshipGold.copy(alpha = 0.16f)
                } else {
                    ElectricCobalt.copy(alpha = 0.2f)
                },
                border = BorderStroke(
                    1.dp,
                    if (currentAdmin != null) ChampionshipGold else ElectricCobalt
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (currentAdmin != null) Icons.Default.VerifiedUser else Icons.Default.AdminPanelSettings,
                        contentDescription = null,
                        tint = if (currentAdmin != null) ChampionshipGold else CyberSky,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = currentAdmin?.displayName ?: stringResource(R.string.action_admin_login),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (currentAdmin != null) ChampionshipGold else TextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }

        if (tournaments.isNotEmpty()) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(tournaments, key = { it.id }) { tItem ->
                    val isSelected = tItem.id == activeTournamentId
                    FilterChip(
                        selected = isSelected,
                        onClick = { onSelectTournament(tItem.id) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.SportsEsports,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                        },
                        label = {
                            Text(
                                text = "${tItem.gameTitle}: ${tItem.name}",
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = ElectricCobalt,
                            selectedLabelColor = TextPrimary,
                            selectedLeadingIconColor = ChampionshipGold
                        ),
                        modifier = Modifier.testTag("tournament_switch_${tItem.id}")
                    )
                }
            }
        }
        }
    }
}

@Composable
fun TournamentHeroBanner(
    tournament: TournamentEntity,
    approvedCount: Int,
    pendingCount: Int,
    isRegistrationOpen: Boolean,
    onRegisterClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .animateContentSize(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, CardBorder)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp)
            ) {
                if (!tournament.bannerUri.isNullOrBlank()) {
                    AsyncImage(
                        model = tournament.bannerUri,
                        contentDescription = stringResource(R.string.cd_tournament_banner),
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Image(
                        painter = painterResource(id = R.drawable.img_tournament_banner),
                        contentDescription = stringResource(R.string.cd_tournament_banner),
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    ObsidianVoid.copy(alpha = 0.2f),
                                    ObsidianVoid.copy(alpha = 0.72f),
                                    MidnightSurface
                                )
                            )
                        )
                )

                // Status badge & Game pill
                StatusPill(
                    text = tournament.status.labelAr,
                    color = when (tournament.status) {
                        TournamentStatus.REGISTRATION_OPEN -> EmeraldWin
                        TournamentStatus.REGISTRATION_CLOSED -> ChampionshipGold
                        TournamentStatus.GROUP_STAGE, TournamentStatus.KNOCKOUT_STAGE -> CyberSky
                        TournamentStatus.COMPLETED -> ChampionshipGold
                    },
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(14.dp)
                )

                StatusPill(
                    text = "🎮 ${tournament.gameTitle} • ${tournament.gameCategory}",
                    color = CyberSky,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(14.dp)
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    Text(
                        text = tournament.name,
                        style = MaterialTheme.typography.headlineSmall,
                        color = TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = tournament.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Capacity & Schedule row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Groups,
                            contentDescription = null,
                            tint = CyberSky,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "المشاركون المعتمدون: $approvedCount / ${tournament.maxParticipants}",
                            style = MaterialTheme.typography.labelLarge,
                            color = TextPrimary
                        )
                    }
                    if (pendingCount > 0) {
                        Text(
                            text = "$pendingCount قيد المراجعة",
                            style = MaterialTheme.typography.labelMedium,
                            color = ChampionshipGold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))
                val progress = if (tournament.maxParticipants > 0) {
                    (approvedCount.toFloat() / tournament.maxParticipants.toFloat()).coerceIn(0f, 1f)
                } else 0f
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(7.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = if (progress >= 1f) ChampionshipGold else ElectricCobalt,
                    trackColor = ElevatedNavy
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    InfoChip(
                        icon = Icons.Default.Schedule,
                        label = tournament.startDateTime.ifBlank { "يُحدد لاحقاً" },
                        modifier = Modifier.weight(1f)
                    )
                    InfoChip(
                        icon = Icons.Default.SportsEsports,
                        label = tournament.format.labelAr,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (isRegistrationOpen) {
                    Button(
                        onClick = onRegisterClick,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("hero_register_button"),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = ElectricCobalt,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Icon(Icons.Default.HowToReg, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "سجّل في البطولة الآن",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                } else {
                    OutlinedButton(
                        onClick = {},
                        enabled = false,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("hero_registration_closed_button"),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, CardBorder)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = ChampionshipGold)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = if (approvedCount >= tournament.maxParticipants) {
                                "التسجيل مغلق لاكتمال العدد"
                            } else {
                                "التسجيل مغلق حالياً"
                            },
                            color = ChampionshipGold,
                            style = MaterialTheme.typography.titleSmall
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun InfoChip(
    icon: ImageVector,
    label: String,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = ElevatedNavy,
        shape = RoundedCornerShape(10.dp),
        border = BorderStroke(1.dp, CardBorder)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(icon, contentDescription = null, tint = CyberSky, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = TextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun StatusPill(
    text: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = ObsidianVoid.copy(alpha = 0.85f),
        shape = RoundedCornerShape(50),
        border = BorderStroke(1.dp, color)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = color,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
        )
    }
}

@Composable
fun PlayerAvatar(
    avatarUri: String?,
    playerName: String,
    size: Dp = 44.dp,
    borderColor: Color = ElectricCobalt
) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(
                Brush.linearGradient(listOf(ElectricCobalt.copy(alpha = 0.35f), RoyalViolet.copy(alpha = 0.45f)))
            )
            .border(1.5.dp, borderColor, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        if (!avatarUri.isNullOrBlank()) {
            AsyncImage(
                model = avatarUri,
                contentDescription = stringResource(R.string.cd_player_avatar),
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        } else {
            val initial = playerName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "؟"
            if (initial == "؟") {
                Icon(Icons.Default.Person, contentDescription = null, tint = TextSecondary)
            } else {
                Text(
                    text = initial,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun FifaPlayerCard(
    player: PlayerEntity,
    stats: PlayerStats?,
    scoreUnitLabel: String = "هدف",
    isChampion: Boolean = false,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val accent = when {
        isChampion -> ChampionshipGold
        player.level == PlayerLevel.LEGEND -> ChampionshipGold
        player.level == PlayerLevel.PRO -> RoyalViolet
        player.level == PlayerLevel.INTERMEDIATE -> ElectricCobalt
        else -> CyberSky
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.2.dp, accent.copy(alpha = 0.7f))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.linearGradient(
                        listOf(
                            accent.copy(alpha = 0.18f),
                            MidnightSurface,
                            ElevatedNavy.copy(alpha = 0.9f)
                        )
                    )
                )
                .padding(14.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // OVR & Level column
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = player.ovrRating.toString(),
                            style = OvrBadgeStyle,
                            color = accent
                        )
                        Text(
                            text = "OVR",
                            style = MaterialTheme.typography.labelSmall,
                            color = TextSecondary
                        )
                    }

                    PlayerAvatar(
                        avatarUri = player.avatarUri,
                        playerName = player.name,
                        size = 56.dp,
                        borderColor = accent
                    )

                    Surface(
                        color = accent.copy(alpha = 0.16f),
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, accent.copy(alpha = 0.5f))
                    ) {
                        Text(
                            text = if (isChampion) "البطل" else player.level.labelAr,
                            style = MaterialTheme.typography.labelSmall,
                            color = accent,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = player.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Shield,
                        contentDescription = null,
                        tint = CyberSky,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "ElysiumNet: ${player.elysiumNetId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = CyberSky,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                if (player.clubName.isNotBlank()) {
                    Text(
                        text = "الفريق: ${player.clubName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(ObsidianVoid.copy(alpha = 0.55f))
                        .padding(vertical = 6.dp, horizontal = 8.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    MiniStat("لعب", stats?.matchesPlayed ?: 0)
                    MiniStat("فوز", stats?.wins ?: 0)
                    MiniStat(scoreUnitLabel.ifBlank { "نقطة" }, stats?.goalsScored ?: 0)
                }
            }
        }
    }
}

@Composable
private fun MiniStat(label: String, value: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value.toString(),
            style = MaterialTheme.typography.titleSmall,
            color = TextPrimary,
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
fun ChampionShowcaseCard(
    champion: PlayerEntity,
    onCelebrate: (() -> Unit)? = null,
    onPlayerClick: ((PlayerEntity) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (onPlayerClick != null) Modifier.clickable { onPlayerClick(champion) } else Modifier
            ),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.5.dp, ChampionshipGold),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            ChampionshipGold.copy(alpha = 0.25f),
                            RoyalViolet.copy(alpha = 0.22f),
                            ElectricCobalt.copy(alpha = 0.2f)
                        )
                    )
                )
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(ChampionshipGold.copy(alpha = 0.2f))
                        .border(1.5.dp, ChampionshipGold, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.EmojiEvents,
                        contentDescription = stringResource(R.string.cd_champion_trophy),
                        tint = ChampionshipGold,
                        modifier = Modifier.size(32.dp)
                    )
                }
                Spacer(modifier = Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "بطل البطولة المتوّج",
                        style = MaterialTheme.typography.labelLarge,
                        color = ChampionshipGold
                    )
                    Text(
                        text = champion.name,
                        style = MaterialTheme.typography.headlineSmall,
                        color = TextPrimary
                    )
                    Text(
                        text = "ElysiumNet/ XeMoNat: ${champion.elysiumNetId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = CyberSky
                    )
                }
                if (onCelebrate != null) {
                    IconButton(
                        onClick = onCelebrate,
                        modifier = Modifier
                            .minimumInteractiveComponentSize()
                            .testTag("champion_celebrate_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Celebration,
                            contentDescription = "احتفال بتتويج البطل",
                            tint = ChampionshipGold
                        )
                    }
                }
                PlayerAvatar(
                    avatarUri = champion.avatarUri,
                    playerName = champion.name,
                    size = 58.dp,
                    borderColor = ChampionshipGold
                )
            }
        }
    }
}

@Composable
fun MatchScoreCard(
    match: MatchEntity,
    player1: PlayerEntity?,
    player2: PlayerEntity?,
    canEdit: Boolean,
    onEditClick: () -> Unit,
    onToggleCheckIn: ((Int) -> Unit)? = null,
    onVotePrediction: ((Int) -> Unit)? = null,
    onOpenDispute: (() -> Unit)? = null,
    onPlayerClick: ((PlayerEntity) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val bothPlayersReady = player1 != null && player2 != null
    val isP1Winner = match.isCompleted && match.winnerId != null && match.winnerId == player1?.id
    val isP2Winner = match.isCompleted && match.winnerId != null && match.winnerId == player2?.id

    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (canEdit && bothPlayersReady) {
                    Modifier.clickable(onClick = onEditClick)
                } else Modifier
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(
            1.dp,
            if (match.isCompleted) ElectricCobalt.copy(alpha = 0.5f) else CardBorder
        )
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (match.scheduledLabel.isNotBlank()) "${match.stage.labelAr} • ${match.scheduledLabel}" else match.stage.labelAr,
                    style = MaterialTheme.typography.labelMedium,
                    color = CyberSky,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (match.disputeStatus != "NONE") {
                        val isOpen = match.disputeStatus == "OPEN"
                        Surface(
                            color = (if (isOpen) CrimsonLoss else EmeraldWin).copy(alpha = 0.16f),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text(
                                text = if (isOpen) "بلاغ مفتوح" else "تم الحل",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isOpen) CrimsonLoss else EmeraldWin,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                    Text(
                        text = when {
                            match.isWalkover -> "انسحاب 3-0"
                            match.isCompleted -> "مكتملة"
                            match.leg1Score1 != null -> "بانتظار الإياب"
                            else -> "لم تُلعب بعد"
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = when {
                            match.isWalkover -> AmberDraw
                            match.isCompleted -> EmeraldWin
                            else -> TextSecondary
                        }
                    )
                    if (onOpenDispute != null && bothPlayersReady) {
                        IconButton(
                            onClick = onOpenDispute,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Flag,
                                contentDescription = "بلاغ / إثبات نتيجة",
                                tint = if (match.disputeStatus == "OPEN") CrimsonLoss else AmberDraw,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                    if (canEdit && bothPlayersReady) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "تعديل النتيجة",
                            tint = ChampionshipGold,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Player 1
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .then(
                            if (player1 != null && onPlayerClick != null) {
                                Modifier.clip(RoundedCornerShape(8.dp)).clickable { onPlayerClick(player1) }
                            } else Modifier
                        ),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    PlayerAvatar(
                        avatarUri = player1?.avatarUri,
                        playerName = player1?.name ?: "؟",
                        size = 38.dp,
                        borderColor = if (isP1Winner) ChampionshipGold else CardBorder
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = player1?.name ?: "بانتظار المتأهل",
                            style = MaterialTheme.typography.titleSmall,
                            color = if (isP1Winner) ChampionshipGold else TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (player1 != null) {
                            Text(
                                text = player1.elysiumNetId,
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                // Center Score Box
                Surface(
                    color = ElevatedNavy,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, if (match.isCompleted) ChampionshipGold.copy(alpha = 0.5f) else CardBorder),
                    modifier = Modifier.padding(horizontal = 8.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        val s1 = if (match.isTwoLegged) {
                            if (match.leg1Score1 != null) (match.leg1Score1 + (match.leg2Score1 ?: 0)).toString() else "-"
                        } else {
                            match.leg1Score1?.toString() ?: "-"
                        }
                        val s2 = if (match.isTwoLegged) {
                            if (match.leg1Score2 != null) (match.leg1Score2 + (match.leg2Score2 ?: 0)).toString() else "-"
                        } else {
                            match.leg1Score2?.toString() ?: "-"
                        }
                        Text(
                            text = "$s1 : $s2",
                            style = ScoreDisplayStyle,
                            color = if (match.isCompleted) TextPrimary else TextSecondary
                        )
                        if (match.isTwoLegged && match.leg1Score1 != null) {
                            Text(
                                text = "ذهاب (${match.leg1Score1}-${match.leg1Score2}) • إياب (${match.leg2Score1 ?: "-"}-${match.leg2Score2 ?: "-"})",
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondary
                            )
                        }
                        if (match.penaltyScore1 != null && match.penaltyScore2 != null) {
                            Text(
                                text = "ترجيح: ${match.penaltyScore1} - ${match.penaltyScore2}",
                                style = MaterialTheme.typography.labelSmall,
                                color = ChampionshipGold
                            )
                        }
                    }
                }

                // Player 2
                Row(
                    modifier = Modifier
                        .weight(1f)
                        .then(
                            if (player2 != null && onPlayerClick != null) {
                                Modifier.clip(RoundedCornerShape(8.dp)).clickable { onPlayerClick(player2) }
                            } else Modifier
                        ),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.End
                ) {
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = player2?.name ?: "بانتظار المتأهل",
                            style = MaterialTheme.typography.titleSmall,
                            color = if (isP2Winner) ChampionshipGold else TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.End
                        )
                        if (player2 != null) {
                            Text(
                                text = player2.elysiumNetId,
                                style = MaterialTheme.typography.labelSmall,
                                color = TextSecondary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.End
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    PlayerAvatar(
                        avatarUri = player2?.avatarUri,
                        playerName = player2?.name ?: "؟",
                        size = 38.dp,
                        borderColor = if (isP2Winner) ChampionshipGold else CardBorder
                    )
                }
            }

            if (bothPlayersReady && !match.isCompleted && onToggleCheckIn != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MatchCheckInPill(
                        label = if (match.p1CheckedIn) "${player1.name}: جاهز ✓" else "جاهزية ${player1.name}",
                        checked = match.p1CheckedIn,
                        onClick = { onToggleCheckIn(1) },
                        modifier = Modifier.weight(1f)
                    )
                    MatchCheckInPill(
                        label = if (match.p2CheckedIn) "${player2.name}: جاهز ✓" else "جاهزية ${player2.name}",
                        checked = match.p2CheckedIn,
                        onClick = { onToggleCheckIn(2) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (bothPlayersReady && onVotePrediction != null) {
                MatchPredictionBar(
                    matchId = match.id,
                    player1Name = player1.name,
                    player2Name = player2.name,
                    votesP1 = match.votesP1,
                    votesP2 = match.votesP2,
                    isCompleted = match.isCompleted,
                    onVoteP1 = { onVotePrediction(1) },
                    onVoteP2 = { onVotePrediction(2) }
                )
            }
        }
    }
}

@Composable
fun EmptyStatePanel(
    icon: ImageVector,
    title: String,
    subtitle: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, CardBorder)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(ElectricCobalt.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = CyberSky, modifier = Modifier.size(30.dp))
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )
            if (actionLabel != null && onAction != null) {
                Spacer(modifier = Modifier.height(14.dp))
                Button(
                    onClick = onAction,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(actionLabel)
                }
            }
        }
    }
}

@Composable
fun WebPortalAccessCard(
    webUrl: String,
    onOpenWeb: () -> Unit,
    onCopyWebUrl: () -> Unit,
    isRealtimeConnected: Boolean = false,
    onConfigureServerUrl: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .testTag("home_open_web_card"),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.55f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(CyberSky.copy(alpha = 0.16f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = CyberSky
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "الدخول إلى صفحة الويب الرسمية (CP4 ARENA)",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "متصل بالخادم المركزي المشترك لتزامن البطولات والمشاركين والنتائج لحظياً بين الهاتف والويب.",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                if (webUrl.isNotBlank()) {
                    Text(
                        text = webUrl,
                        style = MaterialTheme.typography.labelSmall,
                        color = CyberSky,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Surface(
                    color = if (isRealtimeConnected) EmeraldWin.copy(alpha = 0.16f) else ElevatedNavy,
                    shape = RoundedCornerShape(50),
                    border = BorderStroke(
                        1.dp,
                        if (isRealtimeConnected) EmeraldWin.copy(alpha = 0.6f) else CardBorder
                    )
                ) {
                    Text(
                        text = if (isRealtimeConnected) "مزامنة لحظية نشطة" else "اتصال قياسي",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isRealtimeConnected) EmeraldWin else TextSecondary,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Button(
                    onClick = onOpenWeb,
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .testTag("home_open_web_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.OpenInNew,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("فتح صفحة الويب")
                }

                OutlinedButton(
                    onClick = onCopyWebUrl,
                    border = BorderStroke(1.dp, CardBorder),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.testTag("home_copy_web_url_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.ContentCopy,
                        contentDescription = "نسخ رابط صفحة الويب",
                        tint = CyberSky,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("نسخ الرابط", color = TextPrimary)
                }
            }

            if (onConfigureServerUrl != null) {
                OutlinedButton(
                    onClick = onConfigureServerUrl,
                    border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.55f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("home_configure_server_url_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Edit,
                        contentDescription = null,
                        tint = ChampionshipGold,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("تغيير رابط خادم Render / Base URL", color = ChampionshipGold)
                }
            }
        }
    }
}

@Composable
fun ServerBaseUrlDialog(
    currentUrl: String,
    defaultUrl: String,
    onDismiss: () -> Unit,
    onTestConnection: (String, (Boolean, String) -> Unit) -> Unit,
    onSaveUrl: (String, Boolean) -> Unit
) {
    var inputUrl by remember(currentUrl) { mutableStateOf(currentUrl) }
    var isTesting by remember { mutableStateOf(false) }
    var testFeedback by remember { mutableStateOf<Pair<Boolean, String>?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        titleContentColor = ChampionshipGold,
        textContentColor = TextPrimary,
        title = {
            Text(
                text = "رابط الخادم المركزي (Render Base URL)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "أدخل رابط موقع CP4 ARENA المنشور على Render (أو نطاقك المخصص) لربط التطبيق بنفس الخادم وقاعدة البيانات دون إعادة بناء APK:",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
                OutlinedTextField(
                    value = inputUrl,
                    onValueChange = {
                        inputUrl = it
                        testFeedback = null
                    },
                    label = { Text("عنوان الخادم (https://...)") },
                    placeholder = { Text(defaultUrl) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("server_base_url_input")
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            isTesting = true
                            testFeedback = null
                            onTestConnection(inputUrl) { ok, msg ->
                                isTesting = false
                                testFeedback = ok to msg
                            }
                        },
                        enabled = !isTesting && inputUrl.isNotBlank(),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("server_base_url_test_button")
                    ) {
                        if (isTesting) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(6.dp))
                        }
                        Text("اختبار الاتصال")
                    }
                    TextButton(
                        onClick = {
                            inputUrl = defaultUrl
                            testFeedback = null
                        },
                        modifier = Modifier.testTag("server_base_url_reset_button")
                    ) {
                        Text("الافتراضي", color = CyberSky)
                    }
                }
                testFeedback?.let { (ok, msg) ->
                    Surface(
                        color = if (ok) EmeraldWin.copy(alpha = 0.14f) else Color(0xFFEF4444).copy(alpha = 0.14f),
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, if (ok) EmeraldWin else Color(0xFFEF4444))
                    ) {
                        Text(
                            text = msg,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (ok) EmeraldWin else Color(0xFFFCA5A5),
                            modifier = Modifier.padding(10.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSaveUrl(inputUrl, false) },
                enabled = inputUrl.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier.testTag("server_base_url_save_button")
            ) {
                Text("حفظ والربط")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("إلغاء", color = TextSecondary)
            }
        }
    )
}
