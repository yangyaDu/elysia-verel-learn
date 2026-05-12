import { randomUUID } from 'node:crypto'
import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { db } from '../../db/client'
import { createConversationRow } from './chatRepo'
import { buildResponseBody, bulidSseResponse, createApiResponseType } from '../../utils/msgWrapper'
import {
  chatBodySchema,
  chatDataSchema,
  createConversationBodySchema,
  createConversationResponseSchema,
  echoBodySchema,
} from './model'
import { deepSeekChatService } from './service'

export const chatController = new Elysia()
  .post(
    '/echo',
    ({ body }) => {
      return buildResponseBody(errCodeEnum.ERR_SUCCESS, body)
    },
    {
      body: echoBodySchema,
      response: {
        200: createApiResponseType(echoBodySchema),
      },
      detail: {
        tags: ['echo'],
      },
    }
  )
  .post(
    '/chat/conversations',
    async ({ body }) => {
      if (!db) {
        return buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null)
      }
      const id = randomUUID()
      try {
        await createConversationRow(db, {
          id,
          title: body.title,
          docNames: body.docNames ?? null,
          modelId: body.modelId ?? null,
        })
        return buildResponseBody(errCodeEnum.ERR_SUCCESS, { id })
      } catch (err) {
        console.error('[chat/conversations]', err)
        return buildResponseBody(errCodeEnum.ERR_THIRDPARTY_ERROR, null)
      }
    },
    {
      body: createConversationBodySchema,
      response: {
        200: createApiResponseType(createConversationResponseSchema),
      },
      detail: {
        tags: ['chat'],
        summary: '创建会话（用于 MySQL 中持久化后续 /chat 与 /chat/stream）',
      },
    }
  )
  .post(
    '/chat',
    async ({ body }) => {
      const [err, data] = await deepSeekChatService.chat(body)
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
          '可选 `thinking: true` 启用深度思考（需模型与上游 API 支持）；成功时可能在 `data.thinking` 中返回推理过程文本。',
      },
    }
  )
  .post(
    '/chat/stream',
    ({ body }) => {
      const streamIterable = deepSeekChatService.chatStream(body)
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
          '默认仅 `data:` 正文流；`thinking: true` 时并行发送 `event: thinking` 承载推理增量，结束仍为 `event: done`。',
      },
    }
  )
