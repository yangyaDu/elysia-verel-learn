import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined

/** 与 `db` 同步创建；未配置 `DATABASE_URL` 时为 `null`。 */
export const mysqlPool: mysql.Pool | null = databaseUrl ? mysql.createPool(databaseUrl) : null

/** Drizzle 客户端；未配置数据库时为 `null`，调用方需先判断。 */
export const db = mysqlPool ? drizzle(mysqlPool, { schema, mode: 'default' }) : null

export type DbClient = NonNullable<typeof db>

export function isDatabaseConfigured(): boolean {
  return db !== null
}
