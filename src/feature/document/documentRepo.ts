import { eq, sql } from 'drizzle-orm'
import type { DbClient } from '../../db/client'
import { documentTreeSnapshots, documents, type TreeResultNode } from '../../db/schema'

export async function insertDocumentRow(
  db: DbClient,
  row: {
    id: string
    pageindexDocId: string
    s3Key: string
    originalFilename: string
    contentType?: string
    fileSizeBytes?: number
    status: string
    folderId?: string | null
    pageindexCreatedAt?: string | null
  }
) {
  await db.insert(documents).values({
    id: row.id,
    pageindexDocId: row.pageindexDocId,
    s3Key: row.s3Key,
    originalFilename: row.originalFilename,
    contentType: row.contentType,
    fileSizeBytes: row.fileSizeBytes,
    status: row.status,
    folderId: row.folderId ?? null,
    pageindexCreatedAt: row.pageindexCreatedAt ?? null,
  })
}

export async function findDocumentByPageindexId(db: DbClient, pageindexDocId: string) {
  return db.query.documents.findFirst({
    where: (d, { eq }) => eq(d.pageindexDocId, pageindexDocId),
  })
}

export async function findDocumentByS3Key(db: DbClient, s3Key: string) {
  return db.query.documents.findFirst({
    where: (d, { eq }) => eq(d.s3Key, s3Key),
  })
}

export async function deleteDocumentRowByPageindexId(db: DbClient, pageindexDocId: string) {
  const doc = await db.query.documents.findFirst({
    where: (d, { eq }) => eq(d.pageindexDocId, pageindexDocId),
  })
  if (!doc) {
    return
  }
  await db.delete(documentTreeSnapshots).where(eq(documentTreeSnapshots.documentId, doc.id))
  await db.delete(documents).where(eq(documents.pageindexDocId, pageindexDocId))
}

export function listDocumentsFromDb(db: DbClient, limit: number, offset: number) {
  return db.query.documents.findMany({
    orderBy: (d, { desc }) => [desc(d.createdAt)],
    limit,
    offset,
  })
}

export async function getTreeSnapshotByDocumentId(db: DbClient, documentId: string) {
  return db.query.documentTreeSnapshots.findFirst({
    where: (s, { eq }) => eq(s.documentId, documentId),
  })
}

export async function upsertTreeSnapshot(
  db: DbClient,
  row: {
    id: string
    documentId: string
    pageindexStatus: string
    treeResult: TreeResultNode[]
  }
) {
  await db
    .insert(documentTreeSnapshots)
    .values({
      id: row.id,
      documentId: row.documentId,
      pageindexStatus: row.pageindexStatus,
      treeResult: row.treeResult,
      fetchedAt: sql`(UTC_TIMESTAMP(3))`,
    })
    .onDuplicateKeyUpdate({
      set: {
        pageindexStatus: row.pageindexStatus,
        treeResult: row.treeResult,
        fetchedAt: sql`(UTC_TIMESTAMP(3))`,
      },
    })
}
