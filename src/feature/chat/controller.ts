import { randomUUID } from 'node:crypto'
import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { chatToolAuditRequestMiddleware } from '../../middlewares/chatToolAuditRequestMiddleware'
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
    '/chat',
    async ({ body, request }) => {
      const [err, data] = await deepSeekChatService.chat(body, { request })
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
    ({ body, request }) => {
      const streamIterable = deepSeekChatService.chatStream(body, { request })
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
