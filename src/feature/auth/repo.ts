import type { DbClient } from '../../db/client'
import { users } from '../../db/schema'

export async function insertUser(
  db: DbClient,
  row: { id: bigint; email: string; passwordHash: string }
): Promise<void> {
  await db.insert(users).values({
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    updatedAt: undefined,
  })
}

export async function findUserByEmail(db: DbClient, email: string) {
  return db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.email, email),
  })
}

export async function findUserById(db: DbClient, id: bigint) {
  return db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, id),
  })
}
