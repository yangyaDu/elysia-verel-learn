import { randomUUID } from 'node:crypto'
import { Elysia, t } from 'elysia'
import { BusinessError, errCodeEnum } from '../../define/errDefine'
import { db } from '../../db/client'
import { authMiddleware, contextAuth } from '../../middlewares/authMiddleware'
import { chatToolAuditRequestMiddleware } from '../../middlewares/chatToolAuditRequestMiddleware'
import { expectAuthenticated } from '../../types/auth'
import { buildResponseBody, bulidSseResponse, createApiResponseType } from '../../utils/msgWrapper'
import { createConversationRow } from './repo'
import { deepSeekChatService, ensureConversationAccess } from './service'
import {
  chatBodySchema,
  chatDataSchema,
  createConversationBodySchema,
  createConversationResponseSchema,
  echoBodySchema,
} from './model'

export const chatController = new Elysia()
  .use(authMiddleware)
  .use(chatToolAuditRequestMiddleware)
  .post(
    '/chat',
    async (ctx) => {
      const user = expectAuthenticated(contextAuth(ctx))
      const { body, request } = ctx
      if (body.conversationId) {
        await ensureConversationAccess(body.conversationId, user)
      }
      const [err, data] = await deepSeekChatService.chat(body, { request, auth: user })
      return buildResponseBody(err, data)
    },
    {
      body: chatBodySchema,
      response: {
        200: createApiResponseType(chatDataSchema),
      },
      detail: {
        tags: ['chat'],
        description:
          '可选 `thinking: true` 启用深度思考（须登录）。若带 `conversationId` 须 `Authorization: Bearer`，且会话属于当前用户。',
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .post(
    '/chat/stream',
    async (ctx) => {
      const user = expectAuthenticated(contextAuth(ctx))
      const { body, request } = ctx
      if (body.conversationId) {
        await ensureConversationAccess(body.conversationId, user)
      }
      const streamIterable = deepSeekChatService.chatStream(body, { request, auth: user })
      return bulidSseResponse(streamIterable)
    },
    {
      body: chatBodySchema,
      response: {
        200: t.String(),
      },
      detail: {
        tags: ['chat'],
        description:
          '流式聊天（须登录）。若带 `conversationId` 须 Bearer 且会话属于当前用户。',
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .post(
    '/chat/conversations',
    async (ctx) => {
      const user = expectAuthenticated(contextAuth(ctx))
      const { body } = ctx
      if (!db) {
        throw new BusinessError(errCodeEnum.ERR_SERVER_INTERNAL_ERROR, 'Database not configured')
      }
      const id = randomUUID()
      await createConversationRow(db, {
        id,
        userId: user.userId,
        title: body.title,
        docNames: body.docNames,
        modelId: body.modelId,
      })
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, { id })
    },
    {
      body: createConversationBodySchema,
      response: {
        200: createApiResponseType(createConversationResponseSchema),
      },
      detail: {
        tags: ['chat'],
        summary: '创建聊天会话',
        security: [{ bearerAuth: [] }],
      },
    }
  )
  .post(
    '/echo',
    (ctx) => {
      expectAuthenticated(contextAuth(ctx))
      const { body } = ctx
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, body)
    },
    {
      body: echoBodySchema,
      response: {
        200: createApiResponseType(echoBodySchema),
      },
      detail: {
        tags: ['echo'],
        security: [{ bearerAuth: [] }],
      },
    }
  )
