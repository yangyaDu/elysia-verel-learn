import { generateText, streamText } from 'ai'
import { errCodeEnum, type ErrCodeT } from '../../define/errDefine'
import { getDeepSeekChatModel } from '../../utils/deepseekClient'
import type { ChatResult } from './model'

export class ChatServiceError extends Error {
  readonly kind: 'NOT_CONFIGURED' | 'THIRDPARTY'

  constructor(kind: ChatServiceError['kind'], message?: string) {
    super(message ?? kind)
    this.kind = kind
  }
}

const DEFAULT_SYSTEM_PROMPT =
  'You are a professional writer.You write simple, clear and concise content.'

// 定义参数类
export class ChatParams {
  prompt!: string
}

export class ChatStreamParams {
  prompt!: string
}

export class DeepSeekChatService {
  async chat(params: ChatParams): Promise<[ErrCodeT, ChatResult | null]> {
    const { prompt } = params
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
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

      return [
        errCodeEnum.ERR_SUCCESS.code,
        {
          text: result.text,
          model: modelId,
          usage,
        },
      ]
    } catch (err) {
      console.error('[chat]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  chatStream(params: ChatStreamParams): AsyncIterable<string> {
    const { prompt } = params
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
