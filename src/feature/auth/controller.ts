import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { authMiddleware, contextAuth } from '../../middlewares/authMiddleware'
import { buildResponseBody, createApiResponseType } from '../../utils/msgWrapper'
import { expectAuthenticated } from '../../types/auth'
import { authService } from './service'
import {
  credentialsBodySchema,
  loginResponseDataSchema,
  registerResponseDataSchema,
} from './model'

export const authController = new Elysia({ prefix: '/auth' })
  .use(authMiddleware)
  .post(
    '/register',
    async ({ body }) => {
      const { userId } = await authService.register(body.email, body.password)
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, { userId: userId.toString() })
    },
    {
      body: credentialsBodySchema,
      response: { 200: createApiResponseType(registerResponseDataSchema) },
      detail: {
        tags: ['auth'],
        summary: '注册',
      },
    }
  )
  .post(
    '/login',
    async ({ body }) => {
      const out = await authService.login(body.email, body.password)
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, out)
    },
    {
      body: credentialsBodySchema,
      response: { 200: createApiResponseType(loginResponseDataSchema) },
      detail: {
        tags: ['auth'],
        summary: '登录（JWT + Redis 会话，约 30 天）',
      },
    }
  )
  .post(
    '/logout',
    async (ctx) => {
      await authService.logout(expectAuthenticated(contextAuth(ctx)))
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, null)
    },
    {
      response: { 200: createApiResponseType(t.Null()) },
      detail: {
        tags: ['auth'],
        summary: '登出（撤销 Redis 会话）',
        security: [{ bearerAuth: [] }],
      },
    }
  )
