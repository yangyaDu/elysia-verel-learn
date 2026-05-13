/**
 * Redis key 命名集中管理（纯函数/常量，便于检索与避免拼写漂移）。
 * 认证会话与 JWT 校验 TTL 对齐：30 天固定秒数。
 */
export const AUTH_SESSION_TTL_SEC = 30 * 24 * 3600

export function authSessionRedisKey(jti: string): string {
  return `auth:session:${jti}`
}

export function authUserJtisRedisKey(userIdStr: string): string {
  return `auth:user:${userIdStr}:jtis`
}
