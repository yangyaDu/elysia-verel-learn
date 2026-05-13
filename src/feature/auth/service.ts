import { BusinessError, errCodeEnum } from '../../define/errDefine'
import { db } from '../../db/client'
import { getRedis } from '../../lib/redis'
import { nextSnowflakeId } from '../../lib/snowflake'
import { signAccessToken } from '../../lib/jwt'
import { AUTH_SESSION_TTL_SEC, authSessionRedisKey, authUserJtisRedisKey } from '../../lib/redisKeys'
import type { AuthContext } from '../../types/auth'
import { findUserByEmail, insertUser } from './repo'

function requireDb() {
  if (!db) {
    throw new BusinessError(errCodeEnum.ERR_SERVER_INTERNAL_ERROR, 'Database not configured')
  }
  return db
}

function requireRedis() {
  const redis = getRedis()
  if (!redis) {
    throw new BusinessError(errCodeEnum.ERR_SERVER_INTERNAL_ERROR, 'REDIS_URL not configured')
  }
  return redis
}

export const authService = {
  async register(email: string, password: string): Promise<{ userId: bigint }> {
    const d = requireDb()
    const normalized = email.trim().toLowerCase()
    const existing = await findUserByEmail(d, normalized)
    if (existing) {
      throw new BusinessError(errCodeEnum.ERR_AUTH_EMAIL_EXISTS)
    }
    const passwordHash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 })
    const id = nextSnowflakeId()
    try {
      await insertUser(d, { id, email: normalized, passwordHash })
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (code === 'ER_DUP_ENTRY') {
        throw new BusinessError(errCodeEnum.ERR_AUTH_EMAIL_EXISTS)
      }
      throw e
    }
    return { userId: id }
  },

  async login(email: string, password: string): Promise<{ token: string; expiresInSec: number }> {
    const d = requireDb()
    const redis = requireRedis()
    const normalized = email.trim().toLowerCase()
    const user = await findUserByEmail(d, normalized)
    if (!user) {
      throw new BusinessError(errCodeEnum.ERR_AUTH_INVALID_CREDENTIALS)
    }
    const ok = await Bun.password.verify(password, user.passwordHash)
    if (!ok) {
      throw new BusinessError(errCodeEnum.ERR_AUTH_INVALID_CREDENTIALS)
    }
    const jti = String(nextSnowflakeId())
    const sub = String(user.id)
    const payload = JSON.stringify({ userId: sub })
    const ttl = AUTH_SESSION_TTL_SEC
    const pipe = redis.multi()
    pipe.set(authSessionRedisKey(jti), payload, 'EX', ttl)
    pipe.sadd(authUserJtisRedisKey(sub), jti)
    pipe.expire(authUserJtisRedisKey(sub), ttl)
    await pipe.exec()
    const token = await signAccessToken({ sub, jti, ttlSec: ttl })
    return { token, expiresInSec: ttl }
  },

  async logout(auth: AuthContext): Promise<void> {
    const redis = getRedis()
    if (!redis) {
      return
    }
    const sub = String(auth.userId)
    await redis.del(authSessionRedisKey(auth.jti))
    await redis.srem(authUserJtisRedisKey(sub), auth.jti)
  },
}
