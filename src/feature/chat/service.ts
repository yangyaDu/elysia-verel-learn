import { generateText, streamText } from 'ai'
import { getDeepSeekChatModel } from '../../deepseekClient'

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

export class ChatServiceError extends Error {
  readonly kind: 'NOT_CONFIGURED' | 'THIRDPARTY'

  constructor(kind: ChatServiceError['kind'], message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

const DEFAULT_SYSTEM_PROMPT = 'You are a professional writer.You write simple, clear and concise content.'

export class DeepSeekChatService {
  async chat(prompt: string): Promise<ChatResult> {
    const configured = getDeepSeekChatModel()
    if (!configured) {
      throw new ChatServiceError('NOT_CONFIGURED')
    }

    const { model, modelId } = configured

    try {
      const result = await generateText({
        model,
        system: DEFAULT_SYSTEM_PROMPT,
        prompt,
      })

      const usage =
        result.usage !== undefined
          ? {
              inputTokens: result.usage.inputTokens ?? 0,
              outputTokens: result.usage.outputTokens ?? 0,
              totalTokens: result.usage.totalTokens ?? 0,
            }
          : undefined

      return {
        text: result.text,
        model: modelId,
        usage,
      }
    } catch (err) {
      throw new ChatServiceError('THIRDPARTY', err instanceof Error ? err.message : undefined)
    }
  }

  chatStream(prompt: string): AsyncIterable<string> {
    const configured = getDeepSeekChatModel()
    if (!configured) {
      throw new ChatServiceError('NOT_CONFIGURED')
    }

    const { model } = configured

    try {
      const generator = streamText({
        model,
        system: DEFAULT_SYSTEM_PROMPT,
        prompt,
      })
      return generator.textStream
    } catch (err) {
      throw new ChatServiceError('THIRDPARTY', err instanceof Error ? err.message : undefined)
    }
  }
}

export const deepSeekChatService = new DeepSeekChatService()

