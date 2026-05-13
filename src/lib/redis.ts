import Redis from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    return null
  }
  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }
  return client
}
