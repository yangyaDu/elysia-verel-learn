/** Twitter snowflake epoch (ms). */
const EPOCH_MS = 1288834974657n

/**
 * 41-bit time | 5-bit worker | 12-bit sequence (per worker per ms).
 * `workerId` must be unique per process in a cluster (0–31).
 */
export function createSnowflakeGenerator(workerId: number): () => bigint {
  const wid = BigInt(workerId & 0x1f)
  let lastMs = -1n
  let seq = 0n
  return (): bigint => {
    let ms = BigInt(Date.now())
    if (ms === lastMs) {
      seq = (seq + 1n) & 0xfffn
      if (seq === 0n) {
        while (BigInt(Date.now()) <= ms) {
          /* spin until next ms */
        }
        ms = BigInt(Date.now())
      }
    } else {
      seq = 0n
    }
    lastMs = ms
    const delta = (ms - EPOCH_MS) & 0x1ffffffffffn
    return (delta << 22n) | (wid << 12n) | seq
  }
}

function parseWorkerId(): number {
  const raw = process.env.SNOWFLAKE_WORKER_ID?.trim()
  if (!raw) {
    return 0
  }
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 31) {
    throw new Error('SNOWFLAKE_WORKER_ID must be an integer 0–31')
  }
  return n
}

let nextId: (() => bigint) | null = null

export function nextSnowflakeId(): bigint {
  if (!nextId) {
    nextId = createSnowflakeGenerator(parseWorkerId())
  }
  return nextId()
}
