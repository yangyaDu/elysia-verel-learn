/**
 * 单行 JSON 日志，供 Promtail 采集 → Loki 存储 → Grafana 查询。
 * 在 Grafana Explore 中可用：`{service="elysia-api"} | json | schema="http_access.v1"`
 */
const service = (process.env.LOG_SERVICE_NAME ?? 'elysia-api').trim() || 'elysia-api'

export type PlgLogLevel = 'info' | 'warn' | 'error'

export function plgJsonLog(record: Record<string, unknown>, level: PlgLogLevel = 'info'): void {
  const line = JSON.stringify({ ...record, service, level },null, 2)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.info(line)
  }
}
