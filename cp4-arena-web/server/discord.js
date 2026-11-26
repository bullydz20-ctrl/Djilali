import crypto from 'node:crypto';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function normalizeDiscordUserId(rawId) {
  if (rawId === null || rawId === undefined) return '';
  return String(rawId).trim();
}

export function isValidDiscordUserId(rawId) {
  const clean = normalizeDiscordUserId(rawId);
  return /^\d{17,22}$/.test(clean);
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

export function createDefaultDiscordAdapter() {
  return {
    getStatus() {
      const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
      const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
      const redirectUri = String(process.env.DISCORD_REDIRECT_URI || '').trim();
      const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
      const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
      return {
        oauthConfigured: Boolean(clientId && clientSecret && redirectUri),
        botConfigured: Boolean(botToken),
        guildIdConfigured: Boolean(guildId),
        guildConfigured: Boolean(botToken && guildId)
      };
    },

    buildAuthorizeUrl({ state }) {
      const clientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
      const clientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
      const redirectUri = String(process.env.DISCORD_REDIRECT_URI || '').trim();
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
      const redirectUri = String(process.env.DISCORD_REDIRECT_URI || '').trim();
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
    }
  };
}
