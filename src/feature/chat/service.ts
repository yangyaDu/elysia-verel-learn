import { generateText, stepCountIs, streamText, type ModelMessage } from 'ai'
import { errCodeEnum, type ErrInfo } from '../../define/errDefine'
import { ragTools } from '../../tools/documentTool'
import { getDeepSeekChatModel } from '../../utils/deepseekClient'
import type { ChatSseChunk } from '../../utils/msgWrapper'
import type {
  ChatBody,
  ChatResult,
  ChatToolCall,
  ChatToolError,
  ChatToolResult,
  ChatUsage,
} from './model'
import { persistChatCompletion, persistChatStreamCompletion } from './persistChat'

type DocSource = { docName: string; docId?: string; pages?: string }

const BASE_SYSTEM_PROMPT =
  'You are a professional writer. You write simple, clear and concise content. ' +
  'You can use tools to search and read documents to provide accurate information.'

/**
 * DeepSeek V4 / Pro 在 API 默认开启 thinking 时，多步工具调用要求把上一轮的 `reasoning_content`
 * 原样带回；未显式 `thinking: true` 时关闭 thinking，避免 400 且与当前 SSE 行为一致。
 */
function deepseekProviderOptionsForRequest(thinking?: boolean) {
  if (thinking === true) {
    return undefined
  }
  return { deepseek: { thinking: { type: 'disabled' as const } } }
}

/**
 * 动态构建 system prompt。
 * 若用户已选定文档，明确告知 LLM 文档名称，避免它先盲目搜索。
 */
const buildSystemPrompt = (docNames?: string[]): string => {
  if (!docNames || docNames.length === 0) {
    return BASE_SYSTEM_PROMPT
  }

  const list = docNames.map((n) => `- ${n}`).join('\n')
  return (
    BASE_SYSTEM_PROMPT +
    `\n\nThe user has pre-selected the following document(s) for this conversation:\n${list}\n` +
    'You MUST answer based on these documents. Use getDocumentStructure or getPageContent with the ' +
    'exact document name(s) listed above. Do NOT call findRelevantDocuments unless the user ' +
    'explicitly asks to search for other documents.'
  )
}

/** 辅助方法：将 ChatMessage 转换为 AI SDK 所需的 ModelMessage */
function toModelMessages(params: ChatBody): ModelMessage[] {
  if (params.messages && params.messages.length > 0) {
    return params.messages.map((message) => {
      if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') {
        return { role: message.role, content: message.content }
      }

      // Tool messages from clients are folded back as user-visible context.
      return { role: 'user', content: message.content }
    })
  }
  return [{ role: 'user', content: params.prompt ?? DEFAULT_CHAT_PROMPT }]
}

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

// ---------------------------------------------------------------------------
// Source extraction helpers
// ---------------------------------------------------------------------------

/**
 * 从工具调用结果中提取文档来源引用，按 docName 去重合并到 map 中。
 * 支持 findRelevantDocuments / getPageContent / getDocument / getDocumentStructure。
 */
function extractSources(toolName: string, output: unknown, map: Map<string, DocSource>): void {
  if (!output || typeof output !== 'object') {
    return
  }
  const o = output as Record<string, unknown>

  if (toolName === 'findRelevantDocuments') {
    const docs = (o.docs ?? []) as Array<{ id?: string; name?: string }>
    for (const doc of docs) {
      if (doc.name && !map.has(doc.name)) {
        map.set(doc.name, { docName: doc.name, docId: doc.id })
      }
    }
  } else if (toolName === 'getPageContent') {
    const docName = typeof o.doc_name === 'string' ? o.doc_name : undefined
    const pages = typeof o.requested_pages === 'string' ? o.requested_pages : undefined
    if (docName) {
      const existing = map.get(docName)
      if (existing) {
        if (pages && !existing.pages) {
          existing.pages = pages
        }
      } else {
        map.set(docName, { docName, pages })
      }
    }
  } else if (toolName === 'getDocument') {
    const name = typeof o.name === 'string' ? o.name : undefined
    const id = typeof o.id === 'string' ? o.id : undefined
    if (name) {
      const existing = map.get(name)
      if (existing) {
        if (!existing.docId) {
          existing.docId = id
        }
      } else {
        map.set(name, { docName: name, docId: id })
      }
    }
  } else if (toolName === 'getDocumentStructure') {
    const docName = typeof o.doc_name === 'string' ? o.doc_name : undefined
    if (docName && !map.has(docName)) {
      map.set(docName, { docName })
    }
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DeepSeekChatService {
  async chat(params: ChatBody): Promise<[ErrInfo, ChatResult | null]> {
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR, null]
    }

    const { model, modelId } = configured

    try {
      const result = (await generateText({
        model,
        system: buildSystemPrompt(params.docNames),
        messages: toModelMessages(params),
        tools: ragTools,
        stopWhen: stepCountIs(5),
        providerOptions: deepseekProviderOptionsForRequest(params.thinking),
      })) as DeepSeekGenerateSnapshot

      console.log('result', JSON.stringify(result, null, 2))

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

      await persistChatCompletion(params, data).catch((e) => {
        console.error('[chat] persist failed', e)
      })

      return [errCodeEnum.ERR_SUCCESS, data]
    } catch (err) {
      console.error('[chat]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR, null]
    }
  }

  async *chatStream(params: ChatBody): AsyncGenerator<ChatSseChunk, void, unknown> {
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return
    }

    const { model } = configured
    const sourcesMap = new Map<string, DocSource>()
    let streamAccumText = ''
    let streamAccumThinking = ''

    try {
      const generator = streamText({
        model,
        system: buildSystemPrompt(params.docNames),
        messages: toModelMessages(params),
        tools: ragTools,
        stopWhen: stepCountIs(5),
        providerOptions: deepseekProviderOptionsForRequest(params.thinking),
      })

      /**
       * When `includeStepText` is true, buffer the whole step so we can map "answer"
       * chunks to `step-text` vs final answer at `finish-step`. Otherwise stream
       * deltas immediately so the client does not wait until the step completes.
       */
      const bufferStep = params.includeStepText === true
      let stepBuffer: ChatSseChunk[] = []

      for await (const part of generator.fullStream) {
        if (part.type === 'start-step') {
          stepBuffer = []
        } else if (part.type === 'finish-step') {
          const fr = part.finishReason ?? 'stop'
          const isIntermediate = fr === 'tool-calls'

          for (const chunk of stepBuffer) {
            if (typeof chunk !== 'string' && chunk.part === 'answer') {
              if (isIntermediate) {
                if (params.includeStepText === true) {
                  yield { part: 'step-text', delta: chunk.delta }
                }
              } else {
                yield chunk
              }
            } else {
              yield chunk
            }
          }
          stepBuffer = []
        } else if (params.thinking === true && part.type === 'reasoning-delta') {
          const delta = (part as { type: 'reasoning-delta'; text: string }).text
          streamAccumThinking += delta
          if (bufferStep) {
            stepBuffer.push({ part: 'thinking', delta })
          } else {
            yield { part: 'thinking', delta }
          }
        } else if (part.type === 'text-delta') {
          streamAccumText += part.text
          const chunk: ChatSseChunk = { part: 'answer', delta: part.text }
          if (bufferStep) {
            stepBuffer.push(chunk)
          } else {
            yield chunk
          }
        } else if (part.type === 'tool-call') {
          if (params.includeToolEvents === true) {
            const chunk: ChatSseChunk = { part: 'tool-call', data: toChatToolCall(part) }
            if (bufferStep) {
              stepBuffer.push(chunk)
            } else {
              yield chunk
            }
          }
        } else if (part.type === 'tool-result') {
          const p = part as unknown as {
            toolName: string
            output: unknown
            toolCallId: string
            input: unknown
          }
          extractSources(p.toolName, p.output, sourcesMap)
          if (params.includeToolEvents === true) {
            const chunk: ChatSseChunk = { part: 'tool-result', data: toChatToolResult(part) }
            if (bufferStep) {
              stepBuffer.push(chunk)
            } else {
              yield chunk
            }
          }
        } else if (part.type === 'tool-error') {
          if (params.includeToolEvents === true) {
            const chunk: ChatSseChunk = { part: 'tool-error', data: toChatToolError(part) }
            if (bufferStep) {
              stepBuffer.push(chunk)
            } else {
              yield chunk
            }
          }
        }
      }

      // Flush any remaining buffer (guard for streams that don't emit step-finish)
      for (const chunk of stepBuffer) {
        yield chunk
      }

      // Emit aggregated document sources once, right before the done event
      if (sourcesMap.size > 0) {
        yield { part: 'sources', data: [...sourcesMap.values()] }
      }

      await persistChatStreamCompletion(params, {
        text: streamAccumText,
        thinking: streamAccumThinking,
      }).catch((e) => {
        console.error('[chatStream] persist failed', e)
      })
    } catch (err) {
      console.error('[chatStream]', err)
    }
  }
}

const DEFAULT_CHAT_PROMPT = '用不超过两句话解释：什么是 REST API？'

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
