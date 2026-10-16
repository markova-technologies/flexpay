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

    try {
      await this.db
        .insertInto('refresh_tokens')
        .values({
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
        })
        .execute();
    } catch (err) {
      // In case table or connection has an issue, throw clean error
      throw new Error(`Failed to create refresh token: ${err.message}`);
    }

    return rawToken;
  }

  async findAndRotateRefreshToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const record = await this.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('expires_at', '>', new Date())
      .where('revoked_at', 'is', null)
      .executeTakeFirst();

    if (!record) return null;

    // Immediately revoke old token to prevent replay attacks
    await this.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', record.id)
      .execute();

    return record;
  }

  async revokeAllForUser(userId) {
    if (!userId) return;
    await this.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
  }
}

module.exports = { SessionRepository };
