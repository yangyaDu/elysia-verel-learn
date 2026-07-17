import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import type { PokerEngine } from './adapter'
import {
  concreteLinesTables,
  drillScenarioLinesDefault,
  rangeDataTables,
  sqliteDimensionKey,
} from './sqliteSchema'

type RequestObject = Record<string, unknown>

export class SqlitePokerError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SqlitePokerError'
  }
}

function requestObject(value: unknown): RequestObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new SqlitePokerError('INVALID_ARGUMENT', 'request must be an object')
  }
  return value as RequestObject
}

function requiredInteger(request: RequestObject, field: string): number {
  const value = request[field]
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new SqlitePokerError('INVALID_ARGUMENT', `${field} must be an integer`)
  }
  return value
}

function requiredString(request: RequestObject, field: string): string {
  const value = request[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new SqlitePokerError('INVALID_ARGUMENT', `${field} must be a non-empty string`)
  }
  return value
}

function optionalString(request: RequestObject, field: string): string | undefined {
  const value = request[field]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new SqlitePokerError(
      'INVALID_ARGUMENT',
      `${field} must be a non-empty string when provided`
    )
  }
  return value
}

function optionalNumber(request: RequestObject, field: string): number | undefined {
  const value = request[field]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SqlitePokerError('INVALID_ARGUMENT', `${field} must be a finite number when provided`)
  }
  return value
}

function dimensionFromRequest(request: RequestObject) {
  const strategy = optionalString(request, 'strategy') ?? 'default'
  if (strategy !== 'default') {
    throw new SqlitePokerError('DIMENSION_NOT_FOUND', `Unsupported SQLite strategy: ${strategy}`)
  }
  const playerCount = requiredInteger(request, 'playerCount')
  const depthBb = requiredInteger(request, 'depthBb')
  const key = sqliteDimensionKey(playerCount, depthBb)
  if (!key) {
    throw new SqlitePokerError(
      'DIMENSION_NOT_FOUND',
      `No SQLite dimension for ${playerCount}max ${depthBb}BB`
    )
  }
  return { key, playerCount, depthBb }
}

function actionResult(row: {
  actionName: string
  actionSize: number
  amountBb: number
  frequency: number
  handEv: number | null
}) {
  return {
    actionName: row.actionName,
    actionSize: row.actionSize,
    amountBb: row.amountBb,
    frequency: row.frequency,
    ...(row.handEv === null ? {} : { handEv: row.handEv }),
  }
}

export function createSqlitePokerEngine(sqlitePath: string): PokerEngine {
  const sqlite = new Database(sqlitePath, { readonly: true })
  sqlite.exec('PRAGMA query_only = ON')
  const db = drizzle({ client: sqlite })

  const queryHandStrategy = (input: unknown) => {
    const request = requestObject(input)
    const { key } = dimensionFromRequest(request)
    const concreteLineId = requiredInteger(request, 'concreteLineId')
    const holeCards = requiredString(request, 'holeCards')
    const table = rangeDataTables[key]
    const rows = db
      .select({
        actionName: table.actionName,
        actionSize: table.actionSize,
        amountBb: table.amountBb,
        frequency: table.frequency,
        handEv: table.handEv,
      })
      .from(table)
      .where(and(eq(table.concreteLineId, concreteLineId), eq(table.holeCards, holeCards)))
      .orderBy(asc(table.id))
      .all()
    if (rows.length === 0) {
      throw new SqlitePokerError(
        'HAND_STRATEGY_NOT_FOUND',
        'No strategy rows match the requested hand'
      )
    }
    return { actions: rows.map(actionResult) }
  }

  return {
    queryHandStrategy,
    queryBatch: (input: unknown) => {
      const request = requestObject(input)
      const items = request.items
      if (!Array.isArray(items)) {
        throw new SqlitePokerError('INVALID_ARGUMENT', 'items must be an array')
      }
      const dimension = dimensionFromRequest(request)
      return {
        results: items.map((item) => {
          const itemRequest = requestObject(item)
          const result = queryHandStrategy({
            strategy: 'default',
            playerCount: dimension.playerCount,
            depthBb: dimension.depthBb,
            concreteLineId: requiredInteger(itemRequest, 'concreteLineId'),
            holeCards: requiredString(itemRequest, 'holeCards'),
          })
          return {
            concreteLineId: requiredInteger(itemRequest, 'concreteLineId'),
            holeCards: requiredString(itemRequest, 'holeCards'),
            actions: result.actions,
          }
        }),
      }
    },
    getConcreteLines: (input: unknown) => {
      const request = requestObject(input)
      const { key } = dimensionFromRequest(request)
      const abstractLine = optionalString(request, 'abstractLine')
      const concreteLine = optionalString(request, 'concreteLine')
      if (!abstractLine && !concreteLine) {
        throw new SqlitePokerError('INVALID_ARGUMENT', 'abstractLine or concreteLine is required')
      }
      const table = concreteLinesTables[key]
      const conditions = [
        ...(abstractLine ? [eq(table.abstractLine, abstractLine)] : []),
        ...(concreteLine ? [eq(table.concreteLine, concreteLine)] : []),
      ]
      const lines = db
        .select({
          concreteLineId: table.id,
          abstractLine: table.abstractLine,
          concreteLine: table.concreteLine,
        })
        .from(table)
        .where(and(...conditions))
        .orderBy(asc(table.id))
        .all()
      if (lines.length === 0) {
        throw new SqlitePokerError(
          'CONCRETE_LINE_NOT_FOUND',
          'No concrete lines match the requested filters'
        )
      }
      return { lines }
    },
    getAbstractLines: (input: unknown) => {
      const request = requestObject(input)
      const strategy = optionalString(request, 'strategy') ?? 'default'
      if (strategy !== 'default') {
        throw new SqlitePokerError(
          'DIMENSION_NOT_FOUND',
          `Unsupported SQLite strategy: ${strategy}`
        )
      }
      const drillName = optionalString(request, 'drillName') ?? 'rfi'
      const playerCount = requiredInteger(request, 'playerCount')
      const drillDepth = requiredInteger(request, 'drillDepth')
      const rows = db
        .select({ abstractLine: drillScenarioLinesDefault.abstractLine })
        .from(drillScenarioLinesDefault)
        .where(
          and(
            eq(drillScenarioLinesDefault.drillName, drillName),
            eq(drillScenarioLinesDefault.playerCount, playerCount),
            eq(drillScenarioLinesDefault.depth, drillDepth)
          )
        )
        .orderBy(asc(drillScenarioLinesDefault.id))
        .all()
      if (rows.length === 0) {
        throw new SqlitePokerError(
          'DRILL_SCENARIO_NOT_FOUND',
          'No abstract lines match the drill scenario'
        )
      }
      return { abstractLines: rows.map((row) => row.abstractLine) }
    },
    handsByActions: (input: unknown) => {
      const request = requestObject(input)
      const { key } = dimensionFromRequest(request)
      const concreteLineId = requiredInteger(request, 'concreteLineId')
      const actions = request.actions
      if (
        actions !== undefined &&
        (!Array.isArray(actions) || actions.some((action) => typeof action !== 'string'))
      ) {
        throw new SqlitePokerError('INVALID_ARGUMENT', 'actions must be an array of action names')
      }
      const frequency = optionalNumber(request, 'frequency')
      const table = rangeDataTables[key]
      const conditions = [
        eq(table.concreteLineId, concreteLineId),
        ...(Array.isArray(actions) && actions.length > 0
          ? [inArray(table.actionName, actions)]
          : []),
        ...(frequency === undefined ? [] : [gte(table.frequency, frequency)]),
      ]
      const rows = db
        .selectDistinct({ holeCards: table.holeCards })
        .from(table)
        .where(and(...conditions))
        .orderBy(asc(table.holeCards))
        .all()
      if (rows.length === 0) {
        throw new SqlitePokerError('HANDS_NOT_FOUND', 'No hands match the requested filters')
      }
      return { holeCards: rows.map((row) => row.holeCards) }
    },
    prewarm: (input: unknown) => {
      const request = requestObject(input)
      const { key } = dimensionFromRequest(request)
      const table = rangeDataTables[key]
      db.select({ id: table.id }).from(table).limit(1).all()
      return { openHandleCount: 1 }
    },
    stats: () => ({
      schemaCount: 19,
      openHandleCount: 1,
      knownDimensions: [
        'default:6max:100BB',
        'default:6max:200BB',
        'default:6max:300BB',
        'default:8max:100BB',
        'default:8max:200BB',
        'default:8max:300BB',
        'default:9max:100BB',
        'default:9max:200BB',
        'default:9max:300BB',
      ],
    }),
  }
}
