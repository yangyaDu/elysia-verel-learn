import { errCodeEnum, type ErrInfo } from '../../define/errDefine'
import {
  configuredPokerEngine,
  getFfiPokerEngine,
  getNodeApiPokerEngine,
  getSqlitePokerEngine,
  storeErrorCode,
  type PokerEngine,
  type PokerOperation,
} from './adapter'
import type {
  PokerCompareRequest,
  PokerCompareResponse,
  PokerQuery,
  PokerQueryResponse,
} from './model'

const NOT_FOUND_CODES = new Set([
  'DIMENSION_NOT_FOUND',
  'DATA_FILE_NOT_FOUND',
  'DRILL_SCENARIO_NOT_FOUND',
  'ABSTRACT_LINE_NOT_FOUND',
  'CONCRETE_LINE_NOT_FOUND',
  'HAND_STRATEGY_NOT_FOUND',
  'ACTION_NOT_FOUND',
  'HANDS_NOT_FOUND',
])

type LatencySummary = PokerCompareResponse['nodeApi']

// Proto V3 stores strategy frequencies and EV values at four decimal places.
// SQLite keeps the unquantized source REAL values, so cross-engine comparison
// must use the format's representable precision rather than JSON equality.
const FLOAT_TOLERANCE = 1e-4

function errorInfoFromStoreError(error: unknown): ErrInfo {
  const code = storeErrorCode(error)
  if (code === 'INVALID_ARGUMENT' || code === 'UNKNOWN_HAND') {
    return errCodeEnum.ERR_PARAMS_ERROR
  }
  if (code !== undefined && NOT_FOUND_CODES.has(code)) {
    return errCodeEnum.ERR_NOT_FOUND
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return errCodeEnum.ERR_THIRDPARTY_ERROR
  }
  return errCodeEnum.ERR_SERVER_INTERNAL_ERROR
}

function summarize(samples: number[]): LatencySummary {
  const sorted = [...samples].sort((left, right) => left - right)
  const percentile = (fraction: number) => sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0
  return {
    iterations: samples.length,
    averageMs: samples.reduce((total, value) => total + value, 0) / samples.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
  }
}

function runBenchmark(
  engine: PokerEngine,
  request: PokerQuery,
  warmupIterations: number,
  measuredIterations: number
): { response: PokerQueryResponse; latency: LatencySummary } {
  for (let index = 0; index < warmupIterations; index += 1) {
    engine.queryHandStrategy(request)
  }

  const samples: number[] = []
  let response: PokerQueryResponse | undefined
  for (let index = 0; index < measuredIterations; index += 1) {
    const startedAt = performance.now()
    response = engine.queryHandStrategy(request) as PokerQueryResponse
    samples.push(performance.now() - startedAt)
  }
  if (!response) {
    throw new Error('benchmark did not produce a query response')
  }
  return { response, latency: summarize(samples) }
}

function numbersMatch(left: number | undefined, right: number | undefined): boolean {
  return (
    left === right ||
    (left !== undefined && right !== undefined && Math.abs(left - right) <= FLOAT_TOLERANCE)
  )
}

function strategiesMatch(left: PokerQueryResponse, right: PokerQueryResponse): boolean {
  return (
    left.actions.length === right.actions.length &&
    left.actions.every((action, index) => {
      const other = right.actions[index]
      return (
        other !== undefined &&
        action.actionName === other.actionName &&
        numbersMatch(action.actionSize, other.actionSize) &&
        numbersMatch(action.amountBb, other.amountBb) &&
        numbersMatch(action.frequency, other.frequency) &&
        numbersMatch(action.handEv, other.handEv)
      )
    })
  )
}

export class PokerService {
  async execute(operation: PokerOperation, params: unknown): Promise<[ErrInfo, unknown]> {
    try {
      const engineName = configuredPokerEngine()
      const engine =
        engineName === 'node-api'
          ? await getNodeApiPokerEngine()
          : engineName === 'ffi'
            ? await getFfiPokerEngine()
            : await getSqlitePokerEngine()
      return [errCodeEnum.ERR_SUCCESS, engine[operation](params)]
    } catch (error) {
      console.error(`[pokerService/${operation}]`, error)
      return [errorInfoFromStoreError(error), null]
    }
  }

  async queryHandStrategy(params: PokerQuery): Promise<[ErrInfo, PokerQueryResponse | null]> {
    const [err, data] = await this.execute('queryHandStrategy', params)
    return [err, data as PokerQueryResponse | null]
  }

  async compare(params: PokerCompareRequest): Promise<[ErrInfo, PokerCompareResponse | null]> {
    if (process.env.POKER_COMPARE_ENABLED !== '1') {
      return [errCodeEnum.ERR_FORBIDDEN, null]
    }

    try {
      const [nodeApi, ffi, sqlite] = await Promise.all([
        getNodeApiPokerEngine(),
        getFfiPokerEngine(),
        getSqlitePokerEngine(),
      ])
      const warmupIterations = params.warmupIterations ?? 10
      const measuredIterations = params.measuredIterations ?? 100
      const nodeApiResult = runBenchmark(nodeApi, params, warmupIterations, measuredIterations)
      const ffiResult = runBenchmark(ffi, params, warmupIterations, measuredIterations)
      const sqliteResult = runBenchmark(sqlite, params, warmupIterations, measuredIterations)
      return [
        errCodeEnum.ERR_SUCCESS,
        {
          consistent:
            strategiesMatch(nodeApiResult.response, ffiResult.response) &&
            strategiesMatch(nodeApiResult.response, sqliteResult.response),
          nodeApi: nodeApiResult.latency,
          ffi: ffiResult.latency,
          sqlite: sqliteResult.latency,
        },
      ]
    } catch (error) {
      console.error('[pokerService/compare]', error)
      return [errorInfoFromStoreError(error), null]
    }
  }
}

export const pokerService = new PokerService()
