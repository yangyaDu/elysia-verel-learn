import { createOpenAI } from '@ai-sdk/openai'
import { extractReasoningMiddleware, wrapLanguageModel, type LanguageModel } from 'ai'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'

/**
 * 从环境变量读取 DeepSeek（OpenAI 兼容）配置。
 * Bun `dev:bun` 会自动加载 `.env`；`vercel dev` / 生产环境由平台注入变量。
 */
type DeepSeekChatModel = { model: LanguageModel; modelId: string }

class DeepSeekClientSingleton {
  private static instance: DeepSeekChatModel | null | undefined

  static getInstance() {
    if (DeepSeekClientSingleton.instance !== undefined) {
      return DeepSeekClientSingleton.instance
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) {
      DeepSeekClientSingleton.instance = null
      return DeepSeekClientSingleton.instance
    }

    const baseURL = (process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
    const modelId = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL

    const provider = createOpenAI({
      apiKey,
      baseURL,
      name: 'deepseek',
    })

    DeepSeekClientSingleton.instance = {
      model: wrapLanguageModel({
        model: provider.chat(modelId),
        middleware: extractReasoningMiddleware({
          tagName: 'think',
          startWithReasoning: true,
        }),
      }),
      modelId,
    }
    return DeepSeekClientSingleton.instance
  }
}

export function getDeepSeekChatModel() {
  return DeepSeekClientSingleton.getInstance()
}
