import { t } from 'elysia'

export const echoBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
  }),
})

export const chatBodySchema = t.Object({
  prompt: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 16000,
    })
  ),
})

export const chatDataSchema = t.Object({
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

export type ChatUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ChatResult = {
  text: string
  model: string
  usage?: ChatUsage
}

export type EchoBody = typeof echoBodySchema.static
export type ChatBody = typeof chatBodySchema.static
export type ChatData = typeof chatDataSchema.static
