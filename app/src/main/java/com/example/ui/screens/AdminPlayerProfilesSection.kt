package com.example.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.automirrored.filled.MergeType
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.api.DiscordGuildMemberDto
import com.example.api.PlayerProfileDto
import com.example.ui.components.PlayerAvatar
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
import com.example.ui.viewmodel.TournamentUiState
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun UnifiedPlayerProfilesSection(
    uiState: TournamentUiState,
    onImportAvatar: (Uri, (String) -> Unit) -> Unit,
    onStartDiscordOAuth: () -> Unit,
    onLoadDiscordGuildMembers: () -> Unit,
    onCreatePlayerProfile: (
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onUpdatePlayerProfile: (
        id: Long,
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onMergePlayerProfiles: (
        sourceId: Long,
        targetId: Long,
        confirmIdentity: Boolean,
        onSuccess: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onAddProfileToTournament: ((PlayerProfileDto) -> Unit)? = null
) {
    val profiles = uiState.playerProfiles
    val discordStatus = uiState.discordStatus

    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedProfile by remember { mutableStateOf<PlayerProfileDto?>(null) }
    var showMergeDialog by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MidnightSurface),
        border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.45f)),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("unified_profiles_section")
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Badge, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(20.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "ملفات اللاعبين الموحدة (${profiles.size})",
                        style = MaterialTheme.typography.titleMedium,
                        color = ChampionshipGold
                    )
                    Text(
                        text = "ملف موحد برقم CP4 ثابت مع منع التكرار عبر Discord User ID",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onStartDiscordOAuth,
                    border = BorderStroke(1.dp, CyberSky.copy(alpha = 0.7f)),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.testTag("discord_oauth_start_button")
                ) {
                    Icon(Icons.Default.Link, contentDescription = null, tint = CyberSky, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("ربط تلقائي (Discord OAuth)", style = MaterialTheme.typography.labelMedium, color = CyberSky)
                }

                Button(
                    onClick = { showCreateDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.testTag("create_player_profile_button")
                ) {
                    Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("إنشاء / ربط ملف", style = MaterialTheme.typography.labelMedium)
                }

                if (profiles.size >= 2) {
                    OutlinedButton(
                        onClick = { showMergeDialog = true },
                        border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.7f)),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        modifier = Modifier.testTag("merge_profiles_button")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.MergeType, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("دمج ملفين", style = MaterialTheme.typography.labelMedium, color = ChampionshipGold)
                    }
                }
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Surface(
                    color = ObsidianVoid.copy(alpha = 0.65f),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, CardBorder)
                ) {
                    Text(
                        text = if (discordStatus.oauthConfigured) "Discord OAuth: مفعّل" else "Discord OAuth: يتطلب إعداد الخادم",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (discordStatus.oauthConfigured) EmeraldWin else TextSecondary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Surface(
                    color = ObsidianVoid.copy(alpha = 0.65f),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, CardBorder)
                ) {
                    val botReady = discordStatus.botConfigured && (discordStatus.guildIdConfigured || discordStatus.guildConfigured)
                    Text(
                        text = if (botReady) "قائمة أعضاء البوت: مفعّلة" else "قائمة أعضاء البوت: تتطلب توكن البوت والسيرفر",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (botReady) CyberSky else TextSecondary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            if (profiles.isEmpty()) {
                Text(
                    text = "لا توجد ملفات لاعبين موحدة بعد. أنشئ ملفاً يدوياً أو عبر قائمة البوت أو عبر Discord OAuth.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    profiles.forEach { profile ->
                        UnifiedPlayerProfileCard(
                            profile = profile,
                            canAddToTournament = uiState.tournament != null && onAddProfileToTournament != null,
                            onAddToTournament = { onAddProfileToTournament?.invoke(profile) },
                            onOpenProfile = { selectedProfile = profile }
                        )
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreatePlayerProfileDialog(
            guildMembers = uiState.discordGuildMembers,
            guildMembersLoading = uiState.guildMembersLoading,
            guildMembersError = uiState.guildMembersError,
            onDismiss = { showCreateDialog = false },
            onImportAvatar = onImportAvatar,
            onLoadGuildMembers = onLoadDiscordGuildMembers,
            onCreate = onCreatePlayerProfile,
            onCreated = { showCreateDialog = false },
            onOpenExisting = { existing ->
                showCreateDialog = false
                selectedProfile = existing
            }
        )
    }

    selectedProfile?.let { targetProfile ->
        PlayerProfileDetailEditDialog(
            profile = targetProfile,
            onDismiss = { selectedProfile = null },
            onImportAvatar = onImportAvatar,
            onSave = onUpdatePlayerProfile,
            onSaved = { selectedProfile = null },
            onOpenExisting = { existing -> selectedProfile = existing }
        )
    }

    if (showMergeDialog && profiles.size >= 2) {
        MergeProfilesDialog(
            profiles = profiles,
            onDismiss = { showMergeDialog = false },
            onMerge = onMergePlayerProfiles,
            onMerged = { showMergeDialog = false }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun UnifiedPlayerProfileCard(
    profile: PlayerProfileDto,
    canAddToTournament: Boolean,
    onAddToTournament: () -> Unit,
    onOpenProfile: () -> Unit
) {
    Surface(
        color = ElevatedNavy.copy(alpha = 0.85f),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, CardBorder),
        modifier = Modifier
            .fillMaxWidth()
            .testTag("profile_row_${profile.id}")
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                PlayerAvatar(
                    avatarUri = profile.avatarUrl,
                    playerName = profile.name,
                    size = 42.dp,
                    borderColor = ChampionshipGold
                )
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = profile.name,
                            style = MaterialTheme.typography.titleSmall,
                            color = TextPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                        Surface(
                            color = ChampionshipGold.copy(alpha = 0.16f),
                            shape = RoundedCornerShape(999.dp),
                            border = BorderStroke(1.dp, ChampionshipGold.copy(alpha = 0.45f))
                        ) {
                            Text(
                                text = profile.cp4Id,
                                style = MaterialTheme.typography.labelSmall,
                                color = ChampionshipGold,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                            )
                        }
                    }
                    val details = buildList {
                        if (profile.elysiumNetId.isNotBlank()) add("ElysiumNet: ${profile.elysiumNetId}")
                        if (profile.xeMoNetId.isNotBlank()) add("XeMoNet: ${profile.xeMoNetId}")
                        if (!profile.discordUserId.isNullOrBlank()) add("Discord: ${profile.discordUserId}")
                        add("${profile.tournamentsCount} بطولات")
                    }.joinToString(" • ")
                    Text(
                        text = details,
                        style = MaterialTheme.typography.bodySmall,
                        color = CyberSky,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (canAddToTournament) {
                    OutlinedButton(
                        onClick = onAddToTournament,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                        modifier = Modifier.testTag("profile_add_to_tournament_${profile.id}")
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(15.dp), tint = EmeraldWin)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("إضافة للبطولة", style = MaterialTheme.typography.labelMedium, color = EmeraldWin)
                    }
                }
                OutlinedButton(
                    onClick = onOpenProfile,
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                    modifier = Modifier.testTag("profile_open_button_${profile.id}")
                ) {
                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(15.dp), tint = ChampionshipGold)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("الملف", style = MaterialTheme.typography.labelMedium, color = ChampionshipGold)
                }
            }
        }
    }
}

@Composable
private fun CreatePlayerProfileDialog(
    guildMembers: List<DiscordGuildMemberDto>,
    guildMembersLoading: Boolean,
    guildMembersError: String?,
    onDismiss: () -> Unit,
    onImportAvatar: (Uri, (String) -> Unit) -> Unit,
    onLoadGuildMembers: () -> Unit,
    onCreate: (
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onCreated: (PlayerProfileDto) -> Unit,
    onOpenExisting: (PlayerProfileDto) -> Unit
) {
    var useBotList by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var discordUserId by remember { mutableStateOf("") }
    var elysiumNetId by remember { mutableStateOf("") }
    var xeMoNetId by remember { mutableStateOf("") }
    var avatarUri by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var conflictProfile by remember { mutableStateOf<PlayerProfileDto?>(null) }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            onImportAvatar(uri) { savedUrl -> avatarUri = savedUrl }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = { Text("إنشاء أو ربط ملف لاعب موحد", color = ChampionshipGold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                conflictProfile?.let { existing ->
                    Surface(
                        color = ChampionshipGold.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, ChampionshipGold),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("duplicate_discord_banner")
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(18.dp))
                                Text(
                                    text = "يوجد ملف مسجل مسبقاً لهذا Discord User ID (${existing.cp4Id})",
                                    style = MaterialTheme.typography.labelLarge,
                                    color = ChampionshipGold
                                )
                            }
                            Text("اللاعب: ${existing.name}", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                            Button(
                                onClick = { onOpenExisting(existing) },
                                colors = ButtonDefaults.buttonColors(containerColor = ChampionshipGold),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("open_existing_profile_button")
                            ) {
                                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = ObsidianVoid, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("فتح الملف الموجود", color = ObsidianVoid, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                if (!errorMsg.isNullOrBlank() && conflictProfile == null) {
                    Text(errorMsg!!, style = MaterialTheme.typography.bodySmall, color = CrimsonLoss)
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    FilterChip(
                        selected = !useBotList,
                        onClick = { useBotList = false },
                        label = { Text("إدخال يدوي", style = MaterialTheme.typography.labelMedium) },
                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp)) },
                        modifier = Modifier.testTag("profile_source_manual")
                    )
                    FilterChip(
                        selected = useBotList,
                        onClick = {
                            useBotList = true
                            if (guildMembers.isEmpty() && !guildMembersLoading) {
                                onLoadGuildMembers()
                            }
                        },
                        label = { Text("أعضاء البوت", style = MaterialTheme.typography.labelMedium) },
                        leadingIcon = { Icon(Icons.Default.SmartToy, contentDescription = null, modifier = Modifier.size(16.dp)) },
                        modifier = Modifier.testTag("profile_source_bot")
                    )
                }

                if (useBotList) {
                    Surface(
                        color = ElevatedNavy,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, CardBorder),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("أعضاء سيرفر Discord", style = MaterialTheme.typography.labelLarge, color = CyberSky)
                                IconButton(
                                    onClick = onLoadGuildMembers,
                                    enabled = !guildMembersLoading,
                                    modifier = Modifier.testTag("refresh_guild_members_button")
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = "تحديث أعضاء Discord", tint = CyberSky)
                                }
                            }
                            if (guildMembersLoading) {
                                CircularProgressIndicator(color = ChampionshipGold, modifier = Modifier.size(24.dp))
                            }
                            if (!guildMembersError.isNullOrBlank()) {
                                Text(guildMembersError, style = MaterialTheme.typography.bodySmall, color = CrimsonLoss)
                            }
                            if (!guildMembersLoading && guildMembersError.isNullOrBlank() && guildMembers.isEmpty()) {
                                Text("لم يتم العثور على أعضاء.", style = MaterialTheme.typography.bodySmall, color = TextSecondary)
                            }
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 200.dp)
                                    .verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                guildMembers.forEach { member ->
                                    Surface(
                                        color = ObsidianVoid.copy(alpha = 0.7f),
                                        shape = RoundedCornerShape(8.dp),
                                        border = BorderStroke(1.dp, CardBorder),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(8.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            PlayerAvatar(member.avatarUrl, member.displayName, size = 32.dp)
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text(
                                                    text = member.displayName,
                                                    style = MaterialTheme.typography.labelLarge,
                                                    color = TextPrimary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = "@${member.username} • ${member.discordUserId}",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = TextSecondary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                            if (member.linkedProfileId != null && !member.linkedCp4Id.isNullOrBlank()) {
                                                Text(
                                                    text = "مربوط (${member.linkedCp4Id})",
                                                    style = MaterialTheme.typography.labelSmall,
                                                    color = ChampionshipGold
                                                )
                                            } else {
                                                Button(
                                                    onClick = {
                                                        name = member.displayName.ifBlank { member.username }
                                                        discordUserId = member.discordUserId
                                                        if (!member.avatarUrl.isNullOrBlank()) {
                                                            avatarUri = member.avatarUrl
                                                        }
                                                        conflictProfile = null
                                                        errorMsg = null
                                                        useBotList = false
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                                    modifier = Modifier.testTag("select_guild_member_${member.discordUserId}")
                                                ) {
                                                    Text("اختيار", style = MaterialTheme.typography.labelSmall)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    PlayerAvatar(avatarUri = avatarUri, playerName = name.ifBlank { "P" }, size = 50.dp)
                    OutlinedButton(
                        onClick = {
                            photoPickerLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("profile_pick_avatar")
                    ) {
                        Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (avatarUri == null) "إضافة صورة" else "تغيير الصورة")
                    }
                    if (avatarUri != null) {
                        IconButton(onClick = { avatarUri = null }) {
                            Icon(Icons.Default.Close, contentDescription = "إزالة الصورة", tint = CrimsonLoss)
                        }
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("اسم اللاعب *") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_name_input")
                )
                OutlinedTextField(
                    value = discordUserId,
                    onValueChange = {
                        discordUserId = it
                        conflictProfile = null
                        errorMsg = null
                    },
                    label = { Text("Discord User ID (اختياري أو 17-22 رقماً)") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_discord_id_input")
                )
                OutlinedTextField(
                    value = elysiumNetId,
                    onValueChange = { elysiumNetId = it },
                    label = { Text("ElysiumNet ID (اختياري)") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_elysium_input")
                )
                OutlinedTextField(
                    value = xeMoNetId,
                    onValueChange = { xeMoNetId = it },
                    label = { Text("XeMoNet ID (اختياري)") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_xemonet_input")
                )

                Text(
                    text = "يتم توليد رقم CP4 ثابت تلقائياً (مثل CP4-000001) ولا يمكن تغييره أو تكراره.",
                    style = MaterialTheme.typography.labelSmall,
                    color = CyberSky
                )

                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    saving = true
                    errorMsg = null
                    conflictProfile = null
                    onCreate(
                        name.trim(),
                        avatarUri,
                        elysiumNetId.trim(),
                        xeMoNetId.trim(),
                        discordUserId.trim().ifBlank { null },
                        { created ->
                            saving = false
                            onCreated(created)
                        },
                        { existing ->
                            saving = false
                            conflictProfile = existing
                        },
                        { err ->
                            saving = false
                            errorMsg = err
                        }
                    )
                },
                enabled = !saving && name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier.testTag("profile_create_submit_button")
            ) {
                Text(if (saving) "جاري الحفظ..." else "إنشاء الملف الموحد")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء", color = TextSecondary) }
        }
    )
}

@Composable
private fun PlayerProfileDetailEditDialog(
    profile: PlayerProfileDto,
    onDismiss: () -> Unit,
    onImportAvatar: (Uri, (String) -> Unit) -> Unit,
    onSave: (
        id: Long,
        name: String,
        avatarUri: String?,
        elysiumNetId: String,
        xeMoNetId: String,
        discordUserId: String?,
        onSuccess: (PlayerProfileDto) -> Unit,
        onDuplicate: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onSaved: (PlayerProfileDto) -> Unit,
    onOpenExisting: (PlayerProfileDto) -> Unit
) {
    var name by remember(profile.id) { mutableStateOf(profile.name) }
    var elysiumNetId by remember(profile.id) { mutableStateOf(profile.elysiumNetId) }
    var xeMoNetId by remember(profile.id) { mutableStateOf(profile.xeMoNetId) }
    var discordUserId by remember(profile.id) { mutableStateOf(profile.discordUserId.orEmpty()) }
    var avatarUri by remember(profile.id) { mutableStateOf(profile.avatarUrl) }
    var saving by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }
    var conflictProfile by remember { mutableStateOf<PlayerProfileDto?>(null) }

    val createdDateLabel = remember(profile.createdAt) {
        if (profile.createdAt > 0L) {
            SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(profile.createdAt))
        } else {
            "—"
        }
    }

    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            onImportAvatar(uri) { savedUrl -> avatarUri = savedUrl }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = {
            Column {
                Text("ملف اللاعب الموحد", color = ChampionshipGold)
                Text(
                    text = "تاريخ الإنشاء: $createdDateLabel • ${profile.tournamentsCount} بطولات",
                    style = MaterialTheme.typography.bodySmall,
                    color = CyberSky
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
                    value = profile.cp4Id,
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text("رقم لاعب CP4 الثابت (غير قابل للتعديل)") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_detail_cp4_id")
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    PlayerAvatar(avatarUri = avatarUri, playerName = name.ifBlank { profile.name }, size = 50.dp)
                    OutlinedButton(
                        onClick = {
                            photoPickerLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.AddPhotoAlternate, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (avatarUri == null) "إضافة صورة" else "تغيير الصورة")
                    }
                    if (avatarUri != null) {
                        IconButton(onClick = { avatarUri = null }) {
                            Icon(Icons.Default.Close, contentDescription = "إزالة الصورة", tint = CrimsonLoss)
                        }
                    }
                }

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("اسم اللاعب *") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_detail_name_input")
                )
                OutlinedTextField(
                    value = elysiumNetId,
                    onValueChange = { elysiumNetId = it },
                    label = { Text("ElysiumNet ID") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_detail_elysium_input")
                )
                OutlinedTextField(
                    value = xeMoNetId,
                    onValueChange = { xeMoNetId = it },
                    label = { Text("XeMoNet ID") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_detail_xemonet_input")
                )
                OutlinedTextField(
                    value = discordUserId,
                    onValueChange = {
                        discordUserId = it
                        conflictProfile = null
                        errorMsg = null
                    },
                    label = { Text("Discord User ID") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("profile_detail_discord_input")
                )

                conflictProfile?.let { existing ->
                    Surface(
                        color = ChampionshipGold.copy(alpha = 0.12f),
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, ChampionshipGold),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "هذا المعرف مرتبط بملف آخر (${existing.cp4Id}) — ${existing.name}",
                                style = MaterialTheme.typography.bodySmall,
                                color = ChampionshipGold
                            )
                            Button(
                                onClick = { onOpenExisting(existing) },
                                colors = ButtonDefaults.buttonColors(containerColor = ChampionshipGold),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("فتح الملف الموجود", color = ObsidianVoid, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                if (!errorMsg.isNullOrBlank() && conflictProfile == null) {
                    Text(errorMsg!!, style = MaterialTheme.typography.bodySmall, color = CrimsonLoss)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    saving = true
                    errorMsg = null
                    conflictProfile = null
                    onSave(
                        profile.id,
                        name.trim(),
                        avatarUri,
                        elysiumNetId.trim(),
                        xeMoNetId.trim(),
                        discordUserId.trim().ifBlank { null },
                        { updated ->
                            saving = false
                            onSaved(updated)
                        },
                        { existing ->
                            saving = false
                            conflictProfile = existing
                        },
                        { err ->
                            saving = false
                            errorMsg = err
                        }
                    )
                },
                enabled = !saving && name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = ElectricCobalt),
                modifier = Modifier.testTag("profile_detail_save_button")
            ) {
                Text(if (saving) "جاري الحفظ..." else "حفظ التعديلات")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إغلاق", color = TextSecondary) }
        }
    )
}

@Composable
private fun MergeProfilesDialog(
    profiles: List<PlayerProfileDto>,
    onDismiss: () -> Unit,
    onMerge: (
        sourceId: Long,
        targetId: Long,
        confirmIdentity: Boolean,
        onSuccess: (PlayerProfileDto) -> Unit,
        onError: (String) -> Unit
    ) -> Unit,
    onMerged: (PlayerProfileDto) -> Unit
) {
    var targetId by remember(profiles) { mutableStateOf(profiles.firstOrNull()?.id ?: 0L) }
    var sourceId by remember(profiles) { mutableStateOf(profiles.getOrNull(1)?.id ?: 0L) }
    var confirmIdentity by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MidnightSurface,
        title = { Text("دمج ملفي لاعب يدوياً", color = ChampionshipGold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                Text(
                    text = "لا يتم دمج أي ملفات تلقائياً بتشابه الأسماء. عند التأكيد، تُنقل جميع البطولات والمباريات إلى الملف الأساسي مع الاحتفاظ برقمه الثابت CP4.",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                Text("الملف الأساسي (يحتفظ برقمه الثابت CP4):", style = MaterialTheme.typography.labelLarge, color = CyberSky)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    profiles.forEach { p ->
                        val selected = p.id == targetId
                        Surface(
                            color = if (selected) ElectricCobalt.copy(alpha = 0.28f) else ElevatedNavy,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, if (selected) ElectricCobalt else CardBorder),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { targetId = p.id }
                                .testTag("merge_target_${p.id}")
                        ) {
                            Row(
                                modifier = Modifier.padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("${p.cp4Id} — ${p.name}", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                                if (selected) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = ChampionshipGold, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }

                Text("الملف الثانوي (سيُدمج ويُزال):", style = MaterialTheme.typography.labelLarge, color = AmberDrawColor)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    profiles.forEach { p ->
                        val selected = p.id == sourceId
                        Surface(
                            color = if (selected) CrimsonLoss.copy(alpha = 0.22f) else ElevatedNavy,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, if (selected) CrimsonLoss else CardBorder),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { sourceId = p.id }
                                .testTag("merge_source_${p.id}")
                        ) {
                            Row(
                                modifier = Modifier.padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("${p.cp4Id} — ${p.name}", style = MaterialTheme.typography.bodySmall, color = TextPrimary)
                                if (selected) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = CrimsonLoss, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { confirmIdentity = !confirmIdentity }
                ) {
                    Checkbox(
                        checked = confirmIdentity,
                        onCheckedChange = { confirmIdentity = it },
                        modifier = Modifier.testTag("merge_confirm_checkbox")
                    )
                    Text(
                        text = "أؤكد أن الملفين يعودان لنفس اللاعب بعد التحقق يدوياً",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextPrimary
                    )
                }

                if (!errorMsg.isNullOrBlank()) {
                    Text(errorMsg!!, style = MaterialTheme.typography.bodySmall, color = CrimsonLoss)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    saving = true
                    errorMsg = null
                    onMerge(
                        sourceId,
                        targetId,
                        true,
                        { merged ->
                            saving = false
                            onMerged(merged)
                        },
                        { err ->
                            saving = false
                            errorMsg = err
                        }
                    )
                },
                enabled = !saving && confirmIdentity && targetId > 0L && sourceId > 0L && targetId != sourceId,
                colors = ButtonDefaults.buttonColors(containerColor = ChampionshipGold),
                modifier = Modifier.testTag("merge_confirm_button")
            ) {
                Text(if (saving) "جاري الدمج..." else "تأكيد الدمج اليدوي", color = ObsidianVoid, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("إلغاء", color = TextSecondary) }
        }
    )
}

private val AmberDrawColor = com.example.ui.theme.AmberDraw
