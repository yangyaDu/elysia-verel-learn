import { generateText, stepCountIs, streamText } from 'ai'
import { errCodeEnum, type ErrInfo } from '../../define/errDefine'
import { documentTools } from '../../tools/documentTool'
import { getDeepSeekChatModel } from '../../utils/deepseekClient'
import type { ChatSseChunk } from '../../utils/msgWrapper'
import type { ChatBody, ChatResult, ChatToolCall, ChatToolError, ChatToolResult, ChatUsage } from './model'

const DEFAULT_SYSTEM_PROMPT =
  'You are a professional writer. You write simple, clear and concise content. ' +
  'You can use tools to search and read documents to provide accurate information.'

const DEFAULT_CHAT_PROMPT = '用不超过两句话解释：什么是 REST API？'

/** Minimal fields read from `generateText` for this endpoint. */
type DeepSeekGenerateSnapshot = {
  text: string
  reasoningText?: string
  toolCalls?: ChatToolCall[]
  toolResults?: ChatToolResult[]
  toolErrors?: ChatToolError[]
  usage?: {
    inputTokens?: number | null
    outputTokens?: number | null
    totalTokens?: number | null
  }
}

export class DeepSeekChatService {
  async chat(params: ChatBody): Promise<[ErrInfo, ChatResult | null]> {
    const prompt = params.prompt ?? DEFAULT_CHAT_PROMPT
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    const { model, modelId } = configured

    try {
      const result = (await generateText({
        model,
        system: DEFAULT_SYSTEM_PROMPT,
        prompt,
        tools: documentTools,
        stopWhen: stepCountIs(5),
      })) as DeepSeekGenerateSnapshot

      const data: ChatResult = {
        text: result.text,
        model: modelId,
      }

      if (params.thinking === true && result.reasoningText && result.reasoningText.length > 0) {
        data.thinking = result.reasoningText
      }

      if (result.toolCalls && result.toolCalls.length > 0) {
        data.toolCalls = result.toolCalls.map(toChatToolCall)
      }

      if (result.toolResults && result.toolResults.length > 0) {
        data.toolResults = result.toolResults.map(toChatToolResult)
      }

      if (result.toolErrors && result.toolErrors.length > 0) {
        data.toolErrors = result.toolErrors.map(toChatToolError)
      }

      if (result.usage) {
        const usage: ChatUsage = {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? 0,
        }
        data.usage = usage
      }

      return [errCodeEnum.ERR_SUCCESS, data]
    } catch (err) {
      console.error('[chat]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async *chatStream(params: ChatBody): AsyncGenerator<ChatSseChunk, void, unknown> {
    const prompt = params.prompt ?? DEFAULT_CHAT_PROMPT
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return
    }

    const { model } = configured

    try {
      const generator = streamText({
        model,
        system: DEFAULT_SYSTEM_PROMPT,
        prompt,
        tools: documentTools,
        stopWhen: stepCountIs(5),
      })
      for await (const part of generator.fullStream) {
        if (params.thinking === true && part.type === 'reasoning-delta') {
          yield { part: 'thinking', delta: part.text }
        } else if (part.type === 'text-delta') {
          yield { part: 'answer', delta: part.text }
        } else if (part.type === 'tool-call') {
          yield { part: 'tool-call', data: toChatToolCall(part) }
        } else if (part.type === 'tool-result') {
          yield { part: 'tool-result', data: toChatToolResult(part) }
        } else if (part.type === 'tool-error') {
          yield { part: 'tool-error', data: toChatToolError(part) }
        }
      }
    } catch (err) {
      console.error('[chatStream]', err)
    }
  }
}

const toChatToolCall = (toolCall: ChatToolCall): ChatToolCall => ({
  toolCallId: toolCall.toolCallId,
  toolName: toolCall.toolName,
  input: toolCall.input,
})

const toChatToolResult = (toolResult: ChatToolResult): ChatToolResult => ({
  ...toChatToolCall(toolResult),
  output: toolResult.output,
})

const toChatToolError = (toolError: ChatToolError): ChatToolError => ({
  ...toChatToolCall(toolError),
  error: toolError.error,
})

export const deepSeekChatService = new DeepSeekChatService()
