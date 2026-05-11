import { t } from 'elysia'

// --- Request Schemas & Classes ---

export const echoBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 100,
  }),
})

export class EchoBody {
  name!: string
}

export const chatBodySchema = t.Object({
  prompt: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 16000,
    })
  ),
  /** 为 true 时在支持「思考/推理」展示的模型上启用（如 DeepSeek thinking 模式）；不支持的模型请忽略或勿传。 */
  thinking: t.Optional(t.Boolean()),
})

export class ChatBody {
  prompt?: string
  thinking?: boolean
}

// --- Response Schemas & Classes ---

export type ChatUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ChatToolCall = {
  toolCallId: string
  toolName: string
  input: unknown
}

export type ChatToolResult = ChatToolCall & {
  output: unknown
}

export type ChatToolError = ChatToolCall & {
  error: unknown
}

export type ChatResult = {
  text: string
  model: string
  usage?: ChatUsage
  /** 模型返回的深度思考 / 推理过程文本（若无则为缺省） */
  thinking?: string
  toolCalls?: ChatToolCall[]
  toolResults?: ChatToolResult[]
  toolErrors?: ChatToolError[]
} | null

export const chatDataSchema = t.Object({
  text: t.String(),
  model: t.String(),
  thinking: t.Optional(t.String()),
  toolCalls: t.Optional(
    t.Array(
      t.Object({
        toolCallId: t.String(),
        toolName: t.String(),
        input: t.Any(),
      })
    )
  ),
  toolResults: t.Optional(
    t.Array(
      t.Object({
        toolCallId: t.String(),
        toolName: t.String(),
        input: t.Any(),
        output: t.Any(),
      })
    )
  ),
  toolErrors: t.Optional(
    t.Array(
      t.Object({
        toolCallId: t.String(),
        toolName: t.String(),
        input: t.Any(),
        error: t.Any(),
      })
    )
  ),
  usage: t.Optional(
    t.Object({
      inputTokens: t.Number(),
      outputTokens: t.Number(),
      totalTokens: t.Number(),
    })
  ),
})
