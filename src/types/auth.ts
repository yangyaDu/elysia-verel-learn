import { BusinessError, errCodeEnum } from '../define/errDefine'

/** 已通过 JWT 签名 + Redis 会话校验的登录态（由鉴权中间件注入）。 */
export type AuthContext = { userId: bigint; jti: string }

export function expectAuthenticated(auth: AuthContext | null): AuthContext {
  if (!auth) {
    throw new BusinessError(errCodeEnum.ERR_UNAUTHORIZED)
  }
  return auth
}
