import { PageIndexClient } from '@pageindex/sdk'

/**
 * 从环境变量读取 PageIndex 配置（密钥仅来自 `PAGEINDEX_API_KEY`，无内置默认值）。
 */
class PageIndexClientSingleton {
  private static instance: PageIndexClient | null | undefined

  static getInstance(): PageIndexClient | null {
    if (PageIndexClientSingleton.instance !== undefined) {
      return PageIndexClientSingleton.instance
    }

    const apiKey = process.env.PAGEINDEX_API_KEY?.trim()
    const baseUrl = (process.env.PAGEINDEX_BASE_URL?.trim() || 'http://localhost:9090').trim()

    if (!apiKey) {
      PageIndexClientSingleton.instance = null
      return null
    }

    PageIndexClientSingleton.instance = new PageIndexClient({
      apiKey,
      apiUrl: baseUrl,
    })
    return PageIndexClientSingleton.instance
  }
}

export function getPageIndexClient(): PageIndexClient | null {
  return PageIndexClientSingleton.getInstance()
}

/**
 * 返回已确保 MCP transport 连接的 PageIndex 客户端。
 *
 * PageIndexClient 底层使用 MCP 长连接，默认 60s 空闲后自动断开。
 * 每次工具调用前通过此函数检查并按需重连，避免空闲超时后首次调用失败。
 */
export async function getConnectedPageIndexClient(): Promise<PageIndexClient> {
  const client = getPageIndexClient()
  if (!client) {
    throw new Error('PageIndex Client not configured (set PAGEINDEX_API_KEY in .env)')
  }
  if (!client.isConnected()) {
    await client.connect()
  }
  return client
}
