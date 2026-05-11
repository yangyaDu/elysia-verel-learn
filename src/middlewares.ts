import { Elysia } from 'elysia'
import { BusinessError, errCodeEnum } from './define/errDefine'
import { buildResponseBody } from './utils/msgWrapper'

export const loggerMiddleware = new Elysia({ name: 'logger' })
  .onRequest(({ set }) => {
    const requestId = crypto.randomUUID()
    set.headers['x-request-id'] = requestId
  })
  .derive(({ set }) => {
    return {
      startTime: Date.now(),
      requestId: set.headers['x-request-id'],
    }
  })
  .onAfterResponse(({ request, startTime, requestId, set }) => {
    const duration = Date.now() - startTime
    const { method, url } = request
    console.info(`[${requestId}] [${method}] ${url} - ${set.status || 200} (${duration}ms)`)
  })

export const errorMiddleware = new Elysia({ name: 'error-handler' }).onError(
  ({ code, error, set }) => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (error instanceof BusinessError) {
      // 业务逻辑错误，不打印完整的堆栈信息，仅记录关键信息
      console.warn(`[Business Error] code: ${error.errInfo.code}, message: ${errorMessage}`)

      // 根据错误码设置 HTTP 状态码
      const { code } = error.errInfo
      if (code === errCodeEnum.ERR_NOT_FOUND.code) {
        set.status = 404
      } else if (code === errCodeEnum.ERR_UNAUTHORIZED.code) {
        set.status = 401
      } else if (code === errCodeEnum.ERR_FORBIDDEN.code) {
        set.status = 403
      } else if (code >= 1000) {
        set.status = 400
      }

      return buildResponseBody(error.errInfo, null, errorMessage)
    }

    console.error(`[Global Error] code: ${code}, message: ${errorMessage}`, error)

    switch (code) {
      case 'VALIDATION':
        set.status = 400
        return buildResponseBody(errCodeEnum.ERR_PARAMS_ERROR.code, null)
      case 'NOT_FOUND':
        set.status = 404
        return buildResponseBody(errCodeEnum.ERR_NOT_FOUND.code, null)
      default:
        set.status = 500
        return buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null)
    }
  }
)
