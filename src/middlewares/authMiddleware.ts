import { Elysia } from 'elysia'
import { BusinessError, errCodeEnum } from '../define/errDefine'
import { verifyAccessToken } from '../lib/jwt'
import { authSessionRedisKey } from '../lib/redisKeys'
import type { AuthContext } from '../types/auth'
import { getRedis } from '../lib/redis'

/** Elysia 跨插件合并时 TS 无法推断 `derive` 的 `auth`，用此从 handler 上下文读取。 */
export function contextAuth(ctx: object): AuthContext | null {
  if (!('auth' in ctx)) {
    return null
  }
  return (ctx as { auth: AuthContext | null }).auth
}

function pathname(request: Request): string {
  return new URL(request.url).pathname
}

function isPublicRoute(request: Request): boolean {
  const method = request.method
  const path = pathname(request)
  if (method === 'OPTIONS') {
    return true
  }
  if (path === '/swagger.json') {
    return true
  }
  if (path.startsWith('/swagger')) {
    return true
  }
  if (path === '/auth/login' || path === '/auth/register') {
    return true
  }
  return false
}

/**
 * 解析 `Authorization: Bearer`，校验 JWT 与 Redis 会话是否仍有效。
 */
export async function resolveRequestAuth(request: Request): Promise<AuthContext | null> {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) {
    return null
  }
  const token = header.slice(7).trim()
  if (!token) {
    return null
  }
  const verified = await verifyAccessToken(token)
  if (!verified) {
    return null
  }
  const redis = getRedis()
  if (!redis) {
    return null
  }
  const raw = await redis.get(authSessionRedisKey(verified.jti))
  if (!raw) {
    return null
  }
  let userIdStr: string
  try {
    const o = JSON.parse(raw) as { userId?: string }
    userIdStr = typeof o.userId === 'string' ? o.userId : ''
  } catch {
    return null
  }
  if (!userIdStr || userIdStr !== verified.sub) {
    return null
  }
  try {
    return { userId: BigInt(userIdStr), jti: verified.jti }
  } catch {
    return null
  }
}

/**
 * 全局鉴权：除白名单外必须携带有效 Bearer 且 Redis 会话存在。
 * 在 `cors` 之后挂载，以便正确处理 OPTIONS。
 */
export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .derive(async ({ request }) => ({
    auth: await resolveRequestAuth(request),
  }))
  .onBeforeHandle(({ request, auth }) => {
    if (isPublicRoute(request)) {
      return
    }
    if (!auth) {
      throw new BusinessError(errCodeEnum.ERR_UNAUTHORIZED)
    }
  })
