import { sleep } from 'bun'
import { Elysia, t } from 'elysia'
import { errCodeEnum } from '../../define/errDefine'
import { buildResponseBody, bulidSseResponse, createApiResponseType } from '../../utils/msgWrapper'
import { chatBodySchema, chatDataSchema, echoBodySchema } from './model'
import { ChatServiceError, deepSeekChatService } from './service'

const DEFAULT_CHAT_PROMPT = '用不超过两句话解释：什么是 REST API？'

export const chatController = new Elysia()
  .post(
    '/echo',
    async ({ body }) => {
      await sleep(1000)
      return buildResponseBody(0, body)
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
    async ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const result = await deepSeekChatService.chat(prompt)
        return buildResponseBody(errCodeEnum.ERR_SUCCESS.code, result)
      } catch (err) {
        console.error('[chat]', err)
        if (err instanceof ChatServiceError && err.kind === 'NOT_CONFIGURED') {
          return buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null)
        }
        return buildResponseBody(errCodeEnum.ERR_THIRDPARTY_ERROR.code, null)
      }
    },
    {
      body: chatBodySchema,
      response: {
        200: createApiResponseType(chatDataSchema),
      },
      detail: {
        tags: ['chat'],
      },
    }
  )
  .post(
    '/chat/stream',
    ({ body }) => {
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const streamIterable = deepSeekChatService.chatStream(prompt)
        return bulidSseResponse(streamIterable)
      } catch (err) {
        console.error('[chat/stream]', err)
        if (err instanceof ChatServiceError && err.kind === 'NOT_CONFIGURED') {
          return Response.json(buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null), {
            status: 500,
          })
        }
        return Response.json(buildResponseBody(errCodeEnum.ERR_THIRDPARTY_ERROR.code, null), {
          status: 502,
        })
      }
    },
    {
      body: chatBodySchema,
      response: {
        200: t.String(),
      },
      detail: {
        tags: ['chat'],
      },
    }
  )
