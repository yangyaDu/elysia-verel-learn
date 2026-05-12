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

export const chatMessageSchema = t.Object({
  role: t.Union([t.Literal('system'), t.Literal('user'), t.Literal('assistant'), t.Literal('tool')]),
  content: t.String(),
  name: t.Optional(t.String()),
  toolCallId: t.Optional(t.String()),
})

export type ChatMessage = typeof chatMessageSchema.static

export const chatBodySchema = t.Object({
  /** 传入时将会话写入 MySQL（需先 `POST /chat/conversations` 创建会话）。 */
  conversationId: t.Optional(t.String({ minLength: 36, maxLength: 36 })),
  prompt: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 16000,
    })
  ),
  messages: t.Optional(t.Array(chatMessageSchema)),
  /** 为 true 时在支持「思考/推理」展示的模型上启用（如 DeepSeek thinking 模式）；不支持的模型请忽略或勿传。 */
  thinking: t.Optional(t.Boolean()),
  /**
   * 用户已选定的文档名称列表（PageIndex 文档名）。
   * 传入后 LLM 将直接针对这些文档作答，无需先搜索。
   */
  docNames: t.Optional(t.Array(t.String({ minLength: 1 }))),
  /** 调试用：是否输出工具调用/结果/错误事件。默认 false，避免前端把工具 JSON 拼进正文。 */
  includeToolEvents: t.Optional(t.Boolean()),
  /** 调试用：为 true 时整步缓冲后再输出，便于把工具步正文标成 `step-text`；默认 false，正文 token 立即 SSE 以降低首字延迟。 */
  includeStepText: t.Optional(t.Boolean()),
})

export class ChatBody {
  prompt?: string
  messages?: ChatMessage[]
  thinking?: boolean
  docNames?: string[]
  includeToolEvents?: boolean
  includeStepText?: boolean
  conversationId?: string
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

/** 一条文档来源引用，由 stream 结束前的 `sources` 事件携带。 */
export type DocSource = {
  /** PageIndex 文档名称 */
  docName: string
  /** PageIndex 文档 ID（findRelevantDocuments / getDocument 工具可提供） */
  docId?: string
  /** 实际读取的页面范围，如 "3,5-7"（getPageContent 工具可提供） */
  pages?: string
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

export const createConversationBodySchema = t.Object({
  title: t.Optional(t.String({ maxLength: 500 })),
  docNames: t.Optional(t.Array(t.String({ minLength: 1 }))),
  modelId: t.Optional(t.String({ maxLength: 255 })),
})

export const createConversationResponseSchema = t.Object({
  id: t.String(),
})
