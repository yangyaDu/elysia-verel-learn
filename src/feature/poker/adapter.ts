import { pathToFileURL } from 'node:url'
import { createSqlitePokerEngine } from './sqliteAdapter'

type StoreError = {
  code?: unknown
}

export const POKER_OPERATIONS = [
  'getConcreteLines',
  'getAbstractLines',
  'handsByActions',
  'queryHandStrategy',
  'queryBatch',
  'prewarm',
  'stats',
] as const

export type PokerOperation = (typeof POKER_OPERATIONS)[number]

export function isPokerOperation(value: string): value is PokerOperation {
  return (POKER_OPERATIONS as readonly string[]).includes(value)
}

type NodeApiStore = {
  [operation in PokerOperation]: (request?: unknown) => unknown
}

export type SceneDimensionType =
  | 'STREET'
  | 'SPOT_TYPE'
  | 'PLAYERS_IN_POT'
  | 'HERO_POSITION'
  | 'OPPONENT_POSITION'
  | 'POT_FAMILY'
  | 'HERO_INITIATIVE'
  | 'POSITION_RELATION'

export type SceneDimensionValue =
  | { street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' }
  | {
      spotType:
        | 'preflop_rfi'
        | 'preflop_vs_limp'
        | 'preflop_vs_raise'
        | 'preflop_vs_threebet'
        | 'preflop_vs_fourbet'
        | 'postflop_fta'
        | 'postflop_vs_check'
        | 'postflop_vs_bet'
        | 'postflop_vs_raise'
    }
  | { playersInPot: number }
  | { position: { seatOffsetFromButton: number } }
  | { potFamily: 'LIMPED' | 'SRP' | '3BP' | '4BP_PLUS' }
  | { heroInitiative: 'AGGRESSOR' | 'CALLER_OR_CHECKER' }
  | { positionRelation: 'IP' | 'OOP' | 'SANDWICHED' }

export type SceneDimensionFilter = {
  dimensionType: SceneDimensionType
  values: readonly SceneDimensionValue[]
}

export type SceneLineMatchResult = {
  actionLines: Array<{ drillName: string; abstractLine: string[] }>
  matchedDimensions: SceneDimensionType[]
  ignoredDimensions: SceneDimensionType[]
}

export type NodeApiSceneStore = NodeApiStore & {
  getAbstractLinesByDimensionFilters: (request: {
    strategy?: string
    playerCount: number
    depthBb: number
    filters: readonly SceneDimensionFilter[]
  }) => SceneLineMatchResult | null
}

type NodeApiModule = {
  PokerHandsRange: new (options: { dataDir: string; maxOpenHandles?: number }) => NodeApiStore
}

type FfiStore = NodeApiStore

type FfiModule = {
  ProtoHandRangeFfi: new (options: {
    libraryPath: string
    dataDir: string
    maxOpenHandles?: number
  }) => FfiStore
}

export type PokerEngineName = 'node-api' | 'ffi' | 'sqlite'

export type PokerEngine = {
  [operation in PokerOperation]: (request?: unknown) => unknown
}

export type NodeApiPokerEngine = PokerEngine &
  Pick<NodeApiSceneStore, 'getAbstractLinesByDimensionFilters'>

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function importFromPath<T>(modulePath: string): Promise<T> {
  return (await import(pathToFileURL(modulePath).href)) as T
}

let nodeApiEnginePromise: Promise<NodeApiPokerEngine> | undefined

export function getNodeApiPokerEngine(): Promise<NodeApiPokerEngine> {
  nodeApiEnginePromise ??= (async () => {
    const dataDir = requiredEnv('PROTO_POKER_RANGE_DATA_DIR')
    const nativeModule = (await import('@proto-poker-range/bun-node-api')) as NodeApiModule
    const store = new nativeModule.PokerHandsRange({ dataDir, maxOpenHandles: 2 })
    return store
  })()
  return nodeApiEnginePromise
}

let ffiEnginePromise: Promise<PokerEngine> | undefined

export function getFfiPokerEngine(): Promise<PokerEngine> {
  ffiEnginePromise ??= (async () => {
    const modulePath = requiredEnv('PROTO_POKER_RANGE_FFI_MODULE')
    const dataDir = requiredEnv('PROTO_POKER_RANGE_DATA_DIR')
    const libraryPath = requiredEnv('PROTO_POKER_RANGE_FFI_LIBRARY')
    const ffiModule = await importFromPath<FfiModule>(modulePath)
    const store = new ffiModule.ProtoHandRangeFfi({
      libraryPath,
      dataDir,
      maxOpenHandles: 2,
    })
    return store
  })()
  return ffiEnginePromise
}

let sqliteEnginePromise: Promise<PokerEngine> | undefined

export function getSqlitePokerEngine(): Promise<PokerEngine> {
  sqliteEnginePromise ??= Promise.resolve().then(() => {
    const sqlitePath = requiredEnv('PROTO_POKER_RANGE_SQLITE_DB')
    return createSqlitePokerEngine(sqlitePath)
  })
  return sqliteEnginePromise
}

export function configuredPokerEngine(): PokerEngineName {
  const configured = process.env.PROTO_POKER_RANGE_ENGINE ?? 'node-api'
  if (configured === 'node-api' || configured === 'ffi' || configured === 'sqlite') {
    return configured
  }
  throw new Error('PROTO_POKER_RANGE_ENGINE must be node-api, ffi, or sqlite')
}

export function storeErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object') {
    const code = (error as StoreError).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
