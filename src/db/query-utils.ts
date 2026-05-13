import type { InferInsertModel, InferSelectModel, SQL } from 'drizzle-orm'
import { and, asc, desc, eq, getTableColumns } from 'drizzle-orm'
import type { AnyMySqlColumn, MySqlTable } from 'drizzle-orm/mysql-core'
import type { DbClient } from './client'

/** 类型层面：从实体类型中仅保留部分字段（等价于 `Pick`） */
export type PickEntity<T, K extends keyof T> = Pick<T, K>

/** 类型层面：从实体类型中排除部分字段（等价于 `Omit`） */
export type OmitEntity<T, K extends keyof T> = Omit<T, K>

/**
 * 从普通对象中按 key 列表浅拷贝选取字段（运行时的 `Pick`）。
 * 仅拷贝对象自身上存在的键。
 */
export function pickFields<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k]
    }
  }
  return out
}

/**
 * 从普通对象中排除若干字段（运行时的 `Omit`），浅拷贝其余属性。
 */
export function omitFields<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const out = { ...obj } as Omit<T, K>
  for (const k of keys) {
    delete (out as Record<string, unknown>)[k as string]
  }
  return out
}

/** `findManyDynamic` 的可选参数：过滤、投影、排序、分组、分页等 */
export type FindManyDynamicArgs<TTable extends MySqlTable> = {
  /** 等值过滤：`WHERE col = val`；`undefined` / `null` / `''` 不参与条件 */
  filters?: Partial<InferSelectModel<TTable>>
  /** 指定返回列；不传或空数组表示 `SELECT *` */
  selectFields?: ReadonlyArray<keyof InferSelectModel<TTable> & string>
  limit?: number
  offset?: number
  orderBy?: ReadonlyArray<{
    field: keyof InferSelectModel<TTable> & string
    direction: 'asc' | 'desc'
  }>
  groupBy?: ReadonlyArray<keyof InferSelectModel<TTable> & string>
  /** 需与 `groupBy` 等配合使用；原始 SQL 片段 */
  having?: SQL
}

function buildAndFromFilters<TTable extends MySqlTable>(
  table: TTable,
  filters: Partial<InferSelectModel<TTable>> | undefined
): SQL | undefined {
  if (!filters) {
    return undefined
  }
  type TEntity = InferSelectModel<TTable>
  const cols = getTableColumns(table)
  const conditions: SQL[] = []
  for (const key of Object.keys(filters) as (keyof TEntity & string)[]) {
    const value = filters[key]
    if (value === undefined || value === null || value === '') {
      continue
    }
    const column = cols[key]
    if (!column) {
      continue
    }
    conditions.push(eq(column, value))
  }
  return conditions.length > 0 ? and(...conditions) : undefined
}

/**
 * 从普通对象中筛出「表上真实存在」的列键值对；`undefined` 不写入（插入/更新时交给数据库默认或不改列）。
 * `null` 会保留，用于显式写入 `NULL` / `SET col = NULL`。
 */
function buildInsertableSubset<TTable extends MySqlTable>(
  table: TTable,
  record: Partial<InferInsertModel<TTable>>
): Partial<InferInsertModel<TTable>> {
  type TInsert = InferInsertModel<TTable>
  const cols = getTableColumns(table)
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(record) as (keyof TInsert & string)[]) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue
    }
    const value = record[key as keyof typeof record]
    if (value === undefined) {
      continue
    }
    if (!cols[key]) {
      continue
    }
    out[key] = value
  }
  return out as Partial<TInsert>
}

function applyListClauseChain<TTable extends MySqlTable>(
  baseQuery: {
    where: (w: SQL) => unknown
    groupBy: (...columns: AnyMySqlColumn[]) => unknown
    having: (h: SQL) => unknown
    orderBy: (...columns: SQL[]) => unknown
    limit: (n: number) => unknown
    offset: (n: number) => unknown
  },
  table: TTable,
  args: FindManyDynamicArgs<TTable>
): unknown {
  const cols = getTableColumns(table)
  let q: unknown = baseQuery
  const whereClause = buildAndFromFilters(table, args.filters)
  if (whereClause) {
    q = (q as { where: (w: SQL) => unknown }).where(whereClause)
  }
  if (args.groupBy?.length) {
    const gCols = args.groupBy.map((f) => cols[f]).filter(Boolean) as AnyMySqlColumn[]
    if (gCols.length > 0) {
      q = (q as { groupBy: (...c: AnyMySqlColumn[]) => unknown }).groupBy(...gCols)
    }
  }
  if (args.having) {
    q = (q as { having: (h: SQL) => unknown }).having(args.having)
  }
  if (args.orderBy?.length) {
    const orderParts: SQL[] = []
    for (const o of args.orderBy) {
      const c = cols[o.field]
      if (!c) {
        continue
      }
      orderParts.push(o.direction === 'desc' ? desc(c) : asc(c))
    }
    if (orderParts.length > 0) {
      q = (q as { orderBy: (...items: SQL[]) => unknown }).orderBy(...orderParts)
    }
  }
  if (args.limit !== undefined) {
    q = (q as { limit: (n: number) => unknown }).limit(args.limit)
  }
  if (args.offset !== undefined) {
    q = (q as { offset: (n: number) => unknown }).offset(args.offset)
  }
  return q
}

/**
 * 动态列表查询（MySQL + Drizzle）：按 `filters` 拼 `AND` 等值条件，可选字段投影、排序、分组、`HAVING`、分页。
 *
 * 说明：动态 `select` 在编译期无法完全推导，返回类型由泛型 `TSelect` 约束；运行时以 Drizzle 实际查询为准。
 */
export async function findManyDynamic<
  TTable extends MySqlTable,
  TSelect extends keyof InferSelectModel<TTable> = keyof InferSelectModel<TTable>,
>(
  db: DbClient,
  table: TTable,
  args: FindManyDynamicArgs<TTable> & { selectFields?: TSelect[] } = {}
): Promise<Pick<InferSelectModel<TTable>, TSelect>[]> {
  type TEntity = InferSelectModel<TTable>
  const cols = getTableColumns(table)
  const sf = args.selectFields
  const usePartial = sf !== undefined && sf.length > 0

  let rows: unknown[]
  if (usePartial && sf) {
    const dynamicSelect: Record<string, AnyMySqlColumn> = {}
    for (const field of sf as string[]) {
      const c = cols[field]
      if (c) {
        dynamicSelect[field] = c
      }
    }
    if (Object.keys(dynamicSelect).length === 0) {
      const base = db.select().from(table) as unknown as {
        where: (w: SQL) => unknown
        groupBy: (...columns: AnyMySqlColumn[]) => unknown
        having: (h: SQL) => unknown
        orderBy: (...columns: SQL[]) => unknown
        limit: (n: number) => unknown
        offset: (n: number) => unknown
      }
      const q = applyListClauseChain(base, table, args)
      rows = await (q as PromiseLike<unknown[]>)
    } else {
      const base = db.select(dynamicSelect as never).from(table) as unknown as {
        where: (w: SQL) => unknown
        groupBy: (...columns: AnyMySqlColumn[]) => unknown
        having: (h: SQL) => unknown
        orderBy: (...columns: SQL[]) => unknown
        limit: (n: number) => unknown
        offset: (n: number) => unknown
      }
      const q = applyListClauseChain(base, table, args)
      rows = await (q as PromiseLike<unknown[]>)
    }
  } else {
    const base = db.select().from(table) as unknown as {
      where: (w: SQL) => unknown
      groupBy: (...columns: AnyMySqlColumn[]) => unknown
      having: (h: SQL) => unknown
      orderBy: (...columns: SQL[]) => unknown
      limit: (n: number) => unknown
      offset: (n: number) => unknown
    }
    const q = applyListClauseChain(base, table, args)
    rows = await (q as PromiseLike<unknown[]>)
  }

  return rows as Pick<TEntity, TSelect>[]
}

/** `updateDynamic` 参数：`filters` 与列表查询相同语义；`patch` 为要更新的列（仅非 `undefined` 的键参与 `SET`） */
export type UpdateDynamicArgs<TTable extends MySqlTable> = {
  filters: Partial<InferSelectModel<TTable>>
  patch: Partial<InferInsertModel<TTable>>
}

/**
 * 动态插入一行：只写入 `values` 里在表上存在且值不为 `undefined` 的列（`null` 会写入 SQL `NULL`）。
 * 不负责校验「非空且无默认」列是否齐全，由调用方与数据库约束保证。
 */
export async function insertDynamic<TTable extends MySqlTable>(
  db: DbClient,
  table: TTable,
  values: Partial<InferInsertModel<TTable>>
): Promise<void> {
  const row = buildInsertableSubset(table, values)
  if (Object.keys(row).length === 0) {
    throw new Error('insertDynamic: no insertable columns after filtering undefined / unknown keys')
  }
  await db.insert(table).values(row as never)
}

/**
 * 动态更新：`WHERE` 由 `filters` 按等值 `AND` 拼接（`undefined` / `null` / `''` 不参与条件，与 `findManyDynamic` 一致）。
 * 若过滤后没有任何 `WHERE` 条件，会抛错，避免误更新全表。
 */
export async function updateDynamic<TTable extends MySqlTable>(
  db: DbClient,
  table: TTable,
  args: UpdateDynamicArgs<TTable>
): Promise<void> {
  const whereClause = buildAndFromFilters(table, args.filters)
  if (!whereClause) {
    throw new Error('updateDynamic: filters resolved to no WHERE clause (refusing full-table update)')
  }
  const setRow = buildInsertableSubset(table, args.patch)
  if (Object.keys(setRow).length === 0) {
    throw new Error('updateDynamic: patch has no settable columns after filtering undefined / unknown keys')
  }
  await db.update(table).set(setRow).where(whereClause)
}
