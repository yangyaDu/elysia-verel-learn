import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const SQLITE_DIMENSION_KEYS = [
  '6:100',
  '6:200',
  '6:300',
  '8:100',
  '8:200',
  '8:300',
  '9:100',
  '9:200',
  '9:300',
] as const

export type SqliteDimensionKey = (typeof SQLITE_DIMENSION_KEYS)[number]

function rangeDataTable(name: string) {
  return sqliteTable(name, {
    id: integer('id').primaryKey(),
    concreteLineId: integer('concrete_line_id').notNull(),
    holeCards: text('hole_cards').notNull(),
    actionName: text('action_name').notNull(),
    actionSize: real('action_size').notNull(),
    amountBb: real('amount_bb').notNull(),
    frequency: real('frequency').notNull(),
    handEv: real('hand_ev'),
  })
}

function concreteLinesTable(name: string) {
  return sqliteTable(name, {
    id: integer('id').primaryKey(),
    abstractLine: text('abstract_line').notNull(),
    concreteLine: text('concrete_line').notNull(),
  })
}

export const rangeDataTables: Record<SqliteDimensionKey, ReturnType<typeof rangeDataTable>> = {
  '6:100': rangeDataTable('range_data_default_6max_100BB'),
  '6:200': rangeDataTable('range_data_default_6max_200BB'),
  '6:300': rangeDataTable('range_data_default_6max_300BB'),
  '8:100': rangeDataTable('range_data_default_8max_100BB'),
  '8:200': rangeDataTable('range_data_default_8max_200BB'),
  '8:300': rangeDataTable('range_data_default_8max_300BB'),
  '9:100': rangeDataTable('range_data_default_9max_100BB'),
  '9:200': rangeDataTable('range_data_default_9max_200BB'),
  '9:300': rangeDataTable('range_data_default_9max_300BB'),
}

export const concreteLinesTables: Record<
  SqliteDimensionKey,
  ReturnType<typeof concreteLinesTable>
> = {
  '6:100': concreteLinesTable('concrete_lines_default_6max_100BB'),
  '6:200': concreteLinesTable('concrete_lines_default_6max_200BB'),
  '6:300': concreteLinesTable('concrete_lines_default_6max_300BB'),
  '8:100': concreteLinesTable('concrete_lines_default_8max_100BB'),
  '8:200': concreteLinesTable('concrete_lines_default_8max_200BB'),
  '8:300': concreteLinesTable('concrete_lines_default_8max_300BB'),
  '9:100': concreteLinesTable('concrete_lines_default_9max_100BB'),
  '9:200': concreteLinesTable('concrete_lines_default_9max_200BB'),
  '9:300': concreteLinesTable('concrete_lines_default_9max_300BB'),
}

export const drillScenarioLinesDefault = sqliteTable('drill_scenario_lines_default', {
  id: integer('id').primaryKey(),
  drillName: text('drill_name').notNull(),
  abstractLine: text('abstract_line').notNull(),
  playerCount: integer('player_count').notNull(),
  depth: integer('depth').notNull(),
})

export function sqliteDimensionKey(
  playerCount: number,
  depthBb: number
): SqliteDimensionKey | undefined {
  const key = `${playerCount}:${depthBb}`
  return SQLITE_DIMENSION_KEYS.includes(key as SqliteDimensionKey)
    ? (key as SqliteDimensionKey)
    : undefined
}
