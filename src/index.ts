import swagger from '@elysiajs/swagger'
import { generateText, streamText } from 'ai'
import { sleep } from 'bun'
import { Elysia, t } from 'elysia'
import { getDeepSeekChatModel } from './deepseekClient'
import { errCodeEnum } from './define/errDefine'
import { buildResponseBody, createApiResponseType, createSseResponse } from './utils/msgWrapper'

const echoBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
  }),
})

const chatBodySchema = t.Object({
  prompt: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 16000,
    })
  ),
})

const chatDataSchema = t.Object({
  text: t.String(),
  model: t.String(),
  usage: t.Optional(
    t.Object({
      inputTokens: t.Number(),
      outputTokens: t.Number(),
      totalTokens: t.Number(),
    })
  ),
})

const DEFAULT_CHAT_PROMPT = '用不超过两句话解释：什么是 REST API？'

const app = new Elysia()
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
      const configured = getDeepSeekChatModel()
      if (!configured) {
        return buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null)
      }

      const { model, modelId } = configured
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const result = await generateText({
          model,
          system: 'You are a professional writer.' + 'You write simple, clear and concise content.',
          prompt,
        })
        console.log(JSON.stringify(result.steps, null, 2))
        const usage =
          result.usage !== undefined
            ? {
                inputTokens: result.usage.inputTokens ?? 0,
                outputTokens: result.usage.outputTokens ?? 0,
                totalTokens: result.usage.totalTokens ?? 0,
              }
            : undefined

        return buildResponseBody(errCodeEnum.ERR_SUCCESS.code, {
          text: result.text,
          model: modelId,
          usage,
        })
      } catch (err) {
        console.error('[chat]', err)
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
      const configured = getDeepSeekChatModel()
      if (!configured) {
        return Response.json(buildResponseBody(errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null), {
          status: 500,
        })
      }

      const { model } = configured
      const prompt = body.prompt ?? DEFAULT_CHAT_PROMPT

      try {
        const generator = streamText({
          model,
          system: 'You are a professional writer.' + 'You write simple, clear and concise content.',
          prompt,
        })

        return createSseResponse(generator.textStream)
      } catch (err) {
        console.error('[chat/stream]', err)
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

app.use(
  swagger({
    documentation: {
      info: {
        title: 'ZenithStrat - Backend API Endpoint',
        version: '1.0',
      },
    },
    specPath: '/swagger.json',
  })
)

export default app

// 本地可直接 `bun run dev:bun`；Vercel 生产环境仅使用上方的 default export。
if (import.meta.main) {
  const port = Number(process.env.PORT) || 3010
  app.listen(port)
  console.info(`Listening on http://localhost:${port}`)
}
