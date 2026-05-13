import { eq, max, sql } from 'drizzle-orm'
import type { DbClient } from '../../db/client'
import { chatMessages, conversations } from '../../db/schema'

export async function createConversationRow(
  db: DbClient,
  row: {
    id: string
    userId: bigint
    title?: string | null
    docNames?: string[] | null
    modelId?: string | null
  }
) {
  await db.insert(conversations).values({
    id: row.id,
    userId: row.userId,
    title: row.title ?? null,
    docNamesJson: row.docNames ?? null,
    modelId: row.modelId ?? null,
    updatedAt: sql`(UTC_TIMESTAMP(3))`,
  })
}

export async function findConversationById(db: DbClient, id: string) {
  return db.query.conversations.findFirst({
    where: (c, { eq: eqFn }) => eqFn(c.id, id),
  })
}

export async function findConversationForUser(db: DbClient, id: string, userId: bigint) {
  return db.query.conversations.findFirst({
    where: (c, { and: andFn, eq: eqFn }) => andFn(eqFn(c.id, id), eqFn(c.userId, userId)),
  })
}

export async function touchConversation(db: DbClient, id: string) {
  await db
    .update(conversations)
    .set({ updatedAt: sql`(UTC_TIMESTAMP(3))` })
    .where(eq(conversations.id, id))
}

export async function getMaxSequenceNo(db: DbClient, conversationId: string): Promise<number> {
  const rows = await db
    .select({ mx: max(chatMessages.sequenceNo) })
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
  const v = rows[0]?.mx
  return v != null ? Number(v) : 0
}

export async function insertChatMessage(
  db: DbClient,
  row: {
    id: string
    conversationId: string
    sequenceNo: number
    role: string
    content: string
    name?: string | null
    toolCallId?: string | null
    thinking?: string | null
    usageJson?: Record<string, unknown> | null
    toolCallsJson?: unknown[] | null
    toolResultsJson?: unknown[] | null
    toolErrorsJson?: unknown[] | null
  }
) {
  await db.insert(chatMessages).values({
    id: row.id,
    conversationId: row.conversationId,
    sequenceNo: row.sequenceNo,
    role: row.role,
    content: row.content,
    name: row.name ?? null,
    toolCallId: row.toolCallId ?? null,
    thinking: row.thinking ?? null,
    usageJson: row.usageJson ?? null,
    toolCallsJson: row.toolCallsJson ?? null,
    toolResultsJson: row.toolResultsJson ?? null,
    toolErrorsJson: row.toolErrorsJson ?? null,
  })
}
