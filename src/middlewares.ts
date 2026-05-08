import { Elysia } from 'elysia'
import { errCodeEnum } from './define/errDefine'
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

export const errorMiddleware = new Elysia({ name: 'error-handler' }).onError(({ code, error, set }) => {
  const errorMessage = error instanceof Error ? error.message : String(error)
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
})
