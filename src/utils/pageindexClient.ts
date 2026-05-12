import { PageIndexClient } from '@pageindex/sdk'

/**
 * 从环境变量读取 PageIndex 配置。
 */
class PageIndexClientSingleton {
  private static instance: PageIndexClient | null | undefined

  static getInstance() {
    if (PageIndexClientSingleton.instance !== undefined) {
      return PageIndexClientSingleton.instance
    }

    const apiKey = (process.env.PAGEINDEX_API_KEY || '9499faa2f01e447b91ce0c5d71d2d600').trim()
    const baseUrl = (process.env.PAGEINDEX_BASE_URL || 'http://localhost:9090').trim()

    PageIndexClientSingleton.instance = new PageIndexClient({
      apiKey,
      apiUrl: baseUrl,
    })
    return PageIndexClientSingleton.instance
  }
}

export function getPageIndexClient() {
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
    throw new Error('PageIndex Client not configured (missing PAGEINDEX_API_KEY)')
  }
  if (!client.isConnected()) {
    await client.connect()
  }
  return client
}
