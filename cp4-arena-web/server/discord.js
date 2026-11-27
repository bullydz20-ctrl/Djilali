import crypto from 'node:crypto';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const DISCORD_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeDiscordUserId(rawId) {
  if (rawId === null || rawId === undefined) return '';
  return String(rawId).trim();
}

export function isValidDiscordUserId(rawId) {
  const clean = normalizeDiscordUserId(rawId);
  return /^\d{17,22}$/.test(clean);
}

export function isValidDiscordChannelId(rawId) {
  const clean = normalizeDiscordUserId(rawId);
  return /^\d{17,22}$/.test(clean);
}

export function formatDiscordMention(discordUserId) {
  const clean = normalizeDiscordUserId(discordUserId);
  return isValidDiscordUserId(clean) ? `<@${clean}>` : '';
}

export function buildAllowedMentions(discordUserId) {
  const clean = normalizeDiscordUserId(discordUserId);
  return isValidDiscordUserId(clean) ? { parse: [], users: [clean] } : { parse: [] };
}

export function buildAdminAccountLinkedNotification({
  discordUserId,
  name,
  cp4Id,
  elysiumNetId = '',
  xeMoNetId = '',
  source = 'OAUTH'
} = {}) {
  const mention = formatDiscordMention(discordUserId);
  const lines = [
    source === 'ADMIN_LINK'
      ? '🔗 **تم ربط ملف لاعب بحساب Discord في CP4 ARENA**'
      : '🆕 **تم ربط حساب Discord جديد في CP4 ARENA**',
    mention ? `👤 **العضو:** ${mention} (${name || 'لاعب'})` : `👤 **اللاعب:** ${name || 'لاعب'}`,
    cp4Id ? `🆔 **رقم اللاعب:** \`${cp4Id}\`` : null,
    elysiumNetId ? `🎮 **ElysiumNet:** \`${elysiumNetId}\`` : null,
    xeMoNetId ? `🎮 **XeMoNet:** \`${xeMoNetId}\`` : null
  ].filter(Boolean);

  return {
    content: lines.join('\n'),
    allowedMentions: buildAllowedMentions(discordUserId)
  };
}

export function buildAdminRegistrationNotification({
  discordUserId,
  name,
  cp4Id,
  tournamentName,
  gameTitle,
  elysiumNetId,
  xeMoNetId = ''
} = {}) {
  const mention = formatDiscordMention(discordUserId);
  const lines = [
    '📝 **طلب تسجيل جديد في بطولة CP4 ARENA**',
    mention ? `👤 **اللاعب:** ${mention} (${name || 'لاعب'})` : `👤 **اللاعب:** ${name || 'لاعب'}`,
    cp4Id ? `🆔 **رقم اللاعب:** \`${cp4Id}\`` : null,
    tournamentName ? `🏆 **البطولة:** ${tournamentName}${gameTitle ? ` (${gameTitle})` : ''}` : null,
    `🎮 **معرف ElysiumNet:** \`${elysiumNetId || 'غير محدد'}\``,
    `🎮 **معرف XeMoNet:** \`${xeMoNetId || 'غير محدد'}\``,
    '⏳ **الحالة:** بانتظار موافقة المشرف'
  ].filter(Boolean);

  return {
    content: lines.join('\n'),
    allowedMentions: buildAllowedMentions(discordUserId)
  };
}

export function buildPublicApprovalNotification({
  discordUserId,
  name,
  cp4Id,
  tournamentName,
  gameTitle,
  elysiumNetId,
  xeMoNetId = ''
} = {}) {
  const mention = formatDiscordMention(discordUserId);
  const lines = [
    '✅ **تم قبول واعتماد مشاركة لاعب في البطولة!**',
    mention ? `🔥 **البطل:** ${mention} (${name || 'لاعب'})` : `🔥 **اللاعب:** ${name || 'لاعب'}`,
    cp4Id ? `🆔 **رقم اللاعب:** \`${cp4Id}\`` : null,
    tournamentName ? `🏆 **البطولة:** ${tournamentName}${gameTitle ? ` (${gameTitle})` : ''}` : null,
    elysiumNetId ? `🎮 **ElysiumNet:** \`${elysiumNetId}\`` : null,
    xeMoNetId ? `🎮 **XeMoNet:** \`${xeMoNetId}\`` : null
  ].filter(Boolean);

  return {
    content: lines.join('\n'),
    allowedMentions: buildAllowedMentions(discordUserId)
  };
}

export function sanitizeRelativeReturnTo(rawPath) {
  if (typeof rawPath !== 'string') return '';
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return '';
  return trimmed.slice(0, 200);
}

export function resolveDiscordAvatarUrl(user) {
  if (!user?.id || !user?.avatar) return null;
  const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(String(user.id))}/${encodeURIComponent(String(user.avatar))}.${ext}?size=256`;
}

export function createSignedOAuthState(secret, payload = {}) {
  const key = String(secret || '');
  if (!key) throw new Error('Missing state signing secret');
  const bodyObj = {
    nonce: crypto.randomBytes(12).toString('hex'),
    origin: typeof payload.origin === 'string' ? payload.origin : '',
    returnTo: sanitizeRelativeReturnTo(payload.returnTo),
    exp: Date.now() + OAUTH_STATE_TTL_MS
  };
  const body = Buffer.from(JSON.stringify(bodyObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignedOAuthState(secret, stateToken) {
  const key = String(secret || '');
  if (!key || typeof stateToken !== 'string' || !stateToken.includes('.')) return null;
  const parts = stateToken.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', key).update(body).digest('base64url');
  const actualBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Number(parsed.exp) <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createSignedDiscordSession(secret, { profileId, discordUserId }) {
  const key = String(secret || '');
  const cleanId = normalizeDiscordUserId(discordUserId);
  if (!key || !Number.isInteger(Number(profileId)) || !isValidDiscordUserId(cleanId)) {
    return null;
  }
  const body = Buffer.from(
    JSON.stringify({
      pid: Number(profileId),
      did: cleanId,
      exp: Date.now() + DISCORD_SESSION_TTL_MS
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', key).update(`dc:${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySignedDiscordSession(secret, token) {
  const key = String(secret || '');
  if (!key || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', key).update(`dc:${body}`).digest('base64url');
  const actualBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Number(parsed.exp) <= Date.now() ||
      !Number.isInteger(Number(parsed.pid)) ||
      !isValidDiscordUserId(parsed.did)
    ) {
      return null;
    }
    return {
      profileId: Number(parsed.pid),
      discordUserId: normalizeDiscordUserId(parsed.did)
    };
  } catch {
    return null;
  }
}

function resolveRedirectUri() {
  const explicit = String(process.env.DISCORD_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  const renderExternal = String(process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (renderExternal) return `${renderExternal}/api/discord/oauth/callback`;
  return '';
}

export function createDefaultDiscordAdapter() {
  return {
    getStatus() {
      const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
      const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
      const redirectUri = resolveRedirectUri();
      const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
      const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
      const adminChannelId = normalizeDiscordUserId(process.env.DISCORD_ADMIN_CHANNEL_ID);
      const publicChannelId = normalizeDiscordUserId(process.env.DISCORD_PUBLIC_CHANNEL_ID);
      return {
        oauthConfigured: Boolean(clientId && clientSecret && redirectUri),
        botConfigured: Boolean(botToken),
        guildIdConfigured: Boolean(guildId),
        guildConfigured: Boolean(botToken && guildId),
        adminChannelConfigured: Boolean(botToken && isValidDiscordChannelId(adminChannelId)),
        publicChannelConfigured: Boolean(botToken && isValidDiscordChannelId(publicChannelId))
      };
    },

    getNotificationChannelIds() {
      const adminChannelId = normalizeDiscordUserId(process.env.DISCORD_ADMIN_CHANNEL_ID);
      const publicChannelId = normalizeDiscordUserId(process.env.DISCORD_PUBLIC_CHANNEL_ID);
      return {
        adminChannelId: isValidDiscordChannelId(adminChannelId) ? adminChannelId : '',
        publicChannelId: isValidDiscordChannelId(publicChannelId) ? publicChannelId : ''
      };
    },

    buildAuthorizeUrl({ state }) {
      const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
      const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
      const redirectUri = resolveRedirectUri();
      if (!clientId || !clientSecret || !redirectUri) {
        return null;
      }
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'identify',
        redirect_uri: redirectUri,
        state: String(state || ''),
        prompt: 'consent'
      });
      return `https://discord.com/oauth2/authorize?${params.toString()}`;
    },

    async exchangeCodeForUser(code) {
      const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
      const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
      const redirectUri = resolveRedirectUri();
      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('DISCORD_OAUTH_UNCONFIGURED');
      }

      const tokenRes = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: String(code || ''),
          redirect_uri: redirectUri
        }).toString()
      });

      if (!tokenRes.ok) {
        throw new Error(`DISCORD_TOKEN_EXCHANGE_FAILED_${tokenRes.status}`);
      }
      const tokenData = await tokenRes.json();
      const accessToken = tokenData?.access_token;
      if (!accessToken) {
        throw new Error('DISCORD_ACCESS_TOKEN_MISSING');
      }

      const userRes = await fetch(`${DISCORD_API_BASE}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!userRes.ok) {
        throw new Error(`DISCORD_USER_FETCH_FAILED_${userRes.status}`);
      }
      const user = await userRes.json();
      const discordUserId = normalizeDiscordUserId(user?.id);
      if (!isValidDiscordUserId(discordUserId)) {
        throw new Error('DISCORD_USER_ID_INVALID');
      }

      return {
        discordUserId,
        username: String(user.username || ''),
        displayName: String(user.global_name || user.username || '').trim(),
        avatarUrl: resolveDiscordAvatarUrl(user)
      };
    },

    async fetchGuildMembers({ limit = 200 } = {}) {
      const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
      const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
      if (!botToken || !guildId) {
        throw new Error('DISCORD_BOT_UNCONFIGURED');
      }

      const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
      const res = await fetch(`${DISCORD_API_BASE}/guilds/${encodeURIComponent(guildId)}/members?limit=${safeLimit}`, {
        headers: {
          Authorization: `Bot ${botToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`DISCORD_GUILD_MEMBERS_FAILED_${res.status}`);
      }
      const rows = await res.json();
      if (!Array.isArray(rows)) return [];

      return rows
        .filter((m) => m?.user && !m.user.bot && isValidDiscordUserId(m.user.id))
        .map((m) => {
          const user = m.user;
          const displayName = String(m.nick || user.global_name || user.username || '').trim();
          return {
            discordUserId: normalizeDiscordUserId(user.id),
            username: String(user.username || ''),
            displayName: displayName || String(user.username || ''),
            avatarUrl: resolveDiscordAvatarUrl(user)
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
    },

    async sendChannelMessage({ channelId, content, embeds, allowedMentions } = {}) {
      const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
      const cleanChannelId = normalizeDiscordUserId(channelId);
      if (!botToken || !isValidDiscordChannelId(cleanChannelId) || !content) {
        return { ok: false, skipped: true };
      }

      try {
        const res = await fetch(`${DISCORD_API_BASE}/channels/${encodeURIComponent(cleanChannelId)}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: String(content),
            ...(Array.isArray(embeds) && embeds.length ? { embeds } : {}),
            allowed_mentions: allowedMentions || { parse: [] }
          })
        });
        if (!res.ok) {
          console.warn(`[CP4 Discord Bot] Failed to send message to channel ${cleanChannelId}: HTTP ${res.status}`);
          return { ok: false, status: res.status };
        }
        return { ok: true, status: res.status };
      } catch (err) {
        console.warn('[CP4 Discord Bot] Channel notification error:', err?.message || err);
        return { ok: false, error: err?.message || 'DISCORD_NOTIFY_FAILED' };
      }
    }
  };
}
