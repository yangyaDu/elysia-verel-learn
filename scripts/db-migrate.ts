import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle')

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations')
  }
  const conn = await mysql.createConnection(url)
  const db = drizzle(conn)
  await migrate(db, { migrationsFolder })
  await conn.end()
  console.info('Migrations applied from', migrationsFolder)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
