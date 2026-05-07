import { createOpenAI } from '@ai-sdk/openai'

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1'
const DEFAULT_MODEL = 'deepseek-chat'

/**
 * 从环境变量读取 DeepSeek（OpenAI 兼容）配置。
 * Bun `dev:bun` 会自动加载 `.env`；`vercel dev` / 生产环境由平台注入变量。
 */
export function getDeepSeekChatModel() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    return null
  }

  const baseURL = (process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '')
  const modelId = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL

  const provider = createOpenAI({
    apiKey,
    baseURL,
    name: 'deepseek',
  })

  return { model: provider.chat(modelId), modelId }
}
