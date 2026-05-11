import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'

/**
 * 从环境变量读取 DeepSeek 配置。
 * Bun `dev:bun` 会自动加载 `.env`；`vercel dev` / 生产环境由平台注入变量。
 *
 * 使用 @ai-sdk/deepseek 原生 provider，正确处理 reasoning_content 的多轮透传，
 * 避免 thinking 模式下工具调用时 "reasoning_content must be passed back" 报错。
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

    const provider = createDeepSeek({ apiKey, baseURL })

    DeepSeekClientSingleton.instance = {
      model: provider(modelId),
      modelId,
    }
    return DeepSeekClientSingleton.instance
  }
}

export function getDeepSeekChatModel() {
  return DeepSeekClientSingleton.getInstance()
}
