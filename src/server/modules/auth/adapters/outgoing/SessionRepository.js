const { randomBytes, createHash } = require('node:crypto');
const { getDb } = require('../../../../infrastructure/database/client');

class SessionRepository {
  constructor(db) {
    this.db = db || getDb();
  }

  async createRefreshToken(userId, { ipAddress, userAgent, expiresInSeconds = 604800 } = {}) {
    const rawToken = randomBytes(32).toString('hex'); // 64 hex characters
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Sanitize ipAddress: INET type in PostgreSQL only accepts valid IPv4/IPv6, not comma lists
    let cleanIp = null;
    if (typeof ipAddress === 'string') {
      const firstIp = ipAddress.split(',')[0].trim();
      if (/^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/.test(firstIp)) {
        cleanIp = firstIp;
      }
    }

    try {
      await this.db
        .insertInto('refresh_tokens')
        .values({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          ip_address: cleanIp,
          user_agent: userAgent ? String(userAgent).substring(0, 500) : null,
        })
        .execute();
    } catch (err) {
      // In case table is missing audit columns (e.g. ip_address / user_agent) or INET fails, gracefully fallback
      if (err.message && (err.message.includes('ip_address') || err.message.includes('user_agent') || err.message.includes('inet'))) {
        try {
          await this.db
            .insertInto('refresh_tokens')
            .values({
              user_id: userId,
              token_hash: tokenHash,
              expires_at: expiresAt,
            })
            .execute();
          return rawToken;
        } catch (fallbackErr) {
          throw new Error(`Failed to create refresh token: ${fallbackErr.message}`);
        }
      }
      throw new Error(`Failed to create refresh token: ${err.message}`);
    }

    return rawToken;
  }

  async findAndRotateRefreshToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    let record = null;
    try {
      record = await this.db
        .selectFrom('refresh_tokens')
        .selectAll()
        .where('token_hash', '=', tokenHash)
        .where('expires_at', '>', new Date())
        .where('revoked_at', 'is', null)
        .executeTakeFirst();
    } catch (err) {
      if (err.message && err.message.includes('revoked_at')) {
        record = await this.db
          .selectFrom('refresh_tokens')
          .selectAll()
          .where('token_hash', '=', tokenHash)
          .where('expires_at', '>', new Date())
          .executeTakeFirst();
        if (record && record.revoked === true) return null;
      } else {
        throw err;
      }
    }

    if (!record) return null;
    if (record.revoked === true) return null;

    // Immediately revoke old token to prevent replay attacks
    try {
      await this.db
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('id', '=', record.id)
        .execute();
    } catch {
      try {
        await this.db
          .updateTable('refresh_tokens')
          .set({ revoked: true })
          .where('id', '=', record.id)
          .execute();
      } catch {}
    }

    return record;
  }

  async revokeAllForUser(userId) {
    if (!userId) return;
    try {
      await this.db
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', userId)
        .where('revoked_at', 'is', null)
        .execute();
    } catch {
      try {
        await this.db
          .updateTable('refresh_tokens')
          .set({ revoked: true })
          .where('user_id', '=', userId)
          .execute();
      } catch {}
    }
  }
}

module.exports = { SessionRepository };
