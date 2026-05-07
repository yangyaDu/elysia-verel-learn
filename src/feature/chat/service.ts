import { generateText, streamText } from 'ai'
import { errCodeEnum, type ErrCodeT } from '../../define/errDefine'
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

export type ChatResponseType = ChatResult | null
export type ChatStreamResponseType = AsyncIterable<string> | null

const DEFAULT_SYSTEM_PROMPT = 'You are a professional writer.You write simple, clear and concise content.'

export class DeepSeekChatService {
  async chat(prompt: string): Promise<[ErrCodeT, ChatResponseType]> {
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

      return [errCodeEnum.ERR_SUCCESS.code, {
        text: result.text,
        model: modelId,
        usage,
      }]
    } catch (err) {
      console.error('[chatService/chat]', err)
      return [errCodeEnum.ERR_THIRDPARTY_ERROR.code, null]
    }
  }

  chatStream(prompt: string): Promise<[ErrCodeT, ChatStreamResponseType]> {
    const configured = getDeepSeekChatModel()
    if (!configured) {
      return Promise.resolve([errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null])
    }

    const { model } = configured

    try {
      const generator = streamText({
        model,
        system: DEFAULT_SYSTEM_PROMPT,
        prompt,
      })
      return Promise.resolve([errCodeEnum.ERR_SUCCESS.code, generator.textStream])
    } catch (err) {
      console.error('[chatService/chatStream]', err)
      return Promise.resolve([errCodeEnum.ERR_THIRDPARTY_ERROR.code, null])
    }
  }
}

export const deepSeekChatService = new DeepSeekChatService()

