const errCodeEnum = {
  // 成功
  ERR_SUCCESS: { code: 0, message: 'success' },
  // 无效的错误码
  ERR_CODE_INVALID: { code: -1, message: 'invalid err code' },
  // 内部错误
  ERR_SERVER_INTERNAL_ERROR: { code: -2, message: 'server internal error' },
  // 三方接口异常
  ERR_THIRDPARTY_ERROR: { code: -3, message: 'third party error' },

  // 资源不存在
  ERR_NOT_FOUND: { code: 404, message: 'resource not found' },
  // 认证与权限
  ERR_UNAUTHORIZED: { code: 401, message: 'unauthorized' },
  ERR_FORBIDDEN: { code: 403, message: 'forbidden' },
  // 状态冲突错误码
  ERR_CONFLICT: { code: 409, message: 'conflict' },
  // 请求太频繁
  ERR_TOO_FREQUENTLY: { code: 429, message: 'too frequently' },

  // 参数错误
  ERR_PARAMS_ERROR: { code: 1000, message: 'validation error' },

  // 认证业务错误 (1100-1199)
  ERR_AUTH_EMAIL_EXISTS: { code: 1101, message: 'email already registered' },
  ERR_AUTH_INVALID_CREDENTIALS: { code: 1102, message: 'invalid email or password' },
  ADMIN_ERR_NO_PERMISSION: {
    code: 1103,
    message: 'no permission',
  },
  ADMIN_ERR_ALREADY_EXISTS: {
    code: 1104,
    message: 'already exists',
  },
  ADMIN_ERR_NOT_EXISTS: {
    code: 1105,
    message: 'not exists',
  },
  ADMIN_ERR_ALREADY_PUBLISHED: {
    code: 1106,
    message: 'already published',
  },
  ADMIN_ERR_VIDEO_UPLOAD_ING: {
    code: 1107,
    message: 'video upload ing',
  },
  ADMIN_ERR_VIDEO_READY_ING: {
    code: 1108,
    message: 'video ready ing',
  },
  ADMIN_ERR_NOT_UNPUBLISHED: {
    code: 1109,
    message: 'not published yet',
  },

  // 挑战模块(1200-1299)
  ERR_CHALLENGE_INVALID: { code: 1200, message: 'challenge invalid' },
  ERR_CHALLENGE_LOAD_QUESTIONS_NOT_ALLOWED: {
    code: 1201,
    message: 'load questions not allowed during settle',
  },

  // 游戏业务错误 (1300-1399)
  ERR_GAME_MAX_HANDS_REACHED: { code: 1300, message: 'max hands reached' },
  ERR_GAME_TABLE_DESTROYED: { code: 1301, message: 'table destroyed' },
  ERR_GAME_TABLE_NOT_FOUND: { code: 1302, message: 'table not found' },
  // 筹码不是步进值的整数倍
  ERR_GAME_CHIPS_NOT_MULTIPLE_OF_STEP: { code: 1303, message: 'chips not multiple of step' },
  // 筹码小于最小补码单位
  ERR_GAME_CHIPS_LESS_THAN_MIN_ADD_CHIPS_BB_NUM: {
    code: 1304,
    message: 'chips less than min add chips bb num',
  },
  // 剩余筹码超过最大限制
  ERR_GAME_REMAIN_CHIPS_MAX_LIMIT_REACHED: {
    code: 1305,
    message: 'remain chips max limit reached',
  },
  // 补充后筹码是否超过最大限制
  ERR_GAME_CHIPS_OVER_MAX_CHIPS: { code: 1306, message: 'chips over max chips' },
  // 当前筹码量+前面已经累计的补充+本次补充后是否超过最大限制
  ERR_GAME_CHIPS_OVER_MAX_CHIPS_AFTER_ADD: {
    code: 1308,
    message: 'chips over max chips after add',
  },
  // Drill 模式：本局尚未结束，无法执行 next_game
  ERR_GAME_DRILL_HAND_NOT_END: {
    code: 1309,
    message: 'drill hand not ended, cannot next game',
  },
  // Drill 模式：快照不存在，无法执行重玩
  ERR_GAME_DRILL_SNAPSHOT_NOT_FOUND: {
    code: 1310,
    message: 'drill hand snapshot not found, cannot replay',
  },
  // Drill 模式：spot模式无“重玩这一手”
  ERR_GAME_DRILL_SPOT_MODE_NO_REPLAY: {
    code: 1311,
    message: 'spot mode no replay',
  },
  // Drill 模式：Hero 操作选项不合法
  ERR_GAME_DRILL_HERO_ACTION_INVALID: {
    code: 1312,
    message: 'drill hero action invalid',
  },
  // Drill 模式：不能补充筹码
  ERR_GAME_DRILL_CANNOT_ADD_CHIPS: {
    code: 1313,
    message: 'drill cannot add chips',
  },
} as const

export type ErrCodeObjectT = typeof errCodeEnum
export type ErrCodeKeyT = keyof typeof errCodeEnum
export type ErrCodeT = (typeof errCodeEnum)[keyof typeof errCodeEnum]['code']

function getErrInfoFromKey(key: ErrCodeKeyT): { readonly code: number; readonly message: string } {
  console.log(key)
  const errInfo = errCodeEnum[key]
  console.log(errInfo)
  if (!errInfo) {
    throw new Error(`Error code key '${key}' does not exist`)
  }
  return errInfo
}

function getErrInfoFromCode(code: ErrCodeT): { readonly code: number; readonly message: string } {
  // 查找对应的错误码信息
  for (const key in errCodeEnum) {
    const errInfo = errCodeEnum[key as ErrCodeKeyT]
    if (errInfo.code === code) {
      return errInfo
    }
  }

  // 如果找不到，返回默认错误
  console.warn(`Error code ${code} not found, using default error`)
  return errCodeEnum.ERR_CODE_INVALID
}

export { errCodeEnum, getErrInfoFromCode, getErrInfoFromKey };

