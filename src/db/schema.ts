/**
 * One-to-many links (e.g. document → snapshots, conversation → messages) are
 * enforced in application code, not with MySQL FOREIGN KEY constraints.
 */
import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

const ts = (name: string) =>
  datetime(name, { mode: 'string', fsp: 3 })
    .notNull()
    .default(sql`(UTC_TIMESTAMP(3))`)

const tsNullable = (name: string) => datetime(name, { mode: 'string', fsp: 3 })

export const documents = mysqlTable(
  'documents',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    pageindexDocId: varchar('pageindex_doc_id', { length: 512 }).notNull(),
    s3Key: varchar('s3_key', { length: 1024 }).notNull(),
    originalFilename: text('original_filename').notNull(),
    contentType: varchar('content_type', { length: 255 }),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    status: varchar('status', { length: 255 }).notNull().default(''),
    folderId: varchar('folder_id', { length: 255 }),
    pageindexCreatedAt: tsNullable('pageindex_created_at'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (table) => [
    uniqueIndex('documents_pageindex_doc_id_uidx').on(table.pageindexDocId),
    uniqueIndex('documents_s3_key_uidx').on(table.s3Key),
    index('documents_created_at_idx').on(table.createdAt),
  ]
)

export type TreeResultNode = {
  title: string
  node_id: string
  start_index: number
  end_index: number
  summary: string
  text: string
}

export const documentTreeSnapshots = mysqlTable(
  'document_tree_snapshots',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    documentId: varchar('document_id', { length: 36 }).notNull(),
    pageindexStatus: varchar('pageindex_status', { length: 255 }).notNull(),
    treeResult: json('tree_result').$type<TreeResultNode[]>().notNull(),
    fetchedAt: ts('fetched_at'),
  },
  (table) => [uniqueIndex('document_tree_snapshots_document_id_uidx').on(table.documentId)]
)

export const documentsRelations = relations(documents, ({ many }) => ({
  treeSnapshots: many(documentTreeSnapshots),
}))

export const documentTreeSnapshotsRelations = relations(documentTreeSnapshots, ({ one }) => ({
  document: one(documents, {
    fields: [documentTreeSnapshots.documentId],
    references: [documents.id],
  }),
}))

export const conversations = mysqlTable('conversations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  title: text('title'),
  docNamesJson: json('doc_names_json').$type<string[] | null>(),
  modelId: varchar('model_id', { length: 255 }),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
})

export const chatMessages = mysqlTable(
  'chat_messages',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    conversationId: varchar('conversation_id', { length: 36 }).notNull(),
    sequenceNo: int('sequence_no').notNull(),
    role: varchar('role', { length: 32 }).notNull(),
    content: text('content').notNull(),
    name: varchar('name', { length: 255 }),
    toolCallId: varchar('tool_call_id', { length: 255 }),
    thinking: text('thinking'),
    usageJson: json('usage_json').$type<Record<string, unknown> | null>(),
    toolCallsJson: json('tool_calls_json').$type<unknown[] | null>(),
    toolResultsJson: json('tool_results_json').$type<unknown[] | null>(),
    toolErrorsJson: json('tool_errors_json').$type<unknown[] | null>(),
    createdAt: ts('created_at'),
  },
  (table) => [uniqueIndex('chat_messages_conv_seq_uidx').on(table.conversationId, table.sequenceNo)]
)

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(chatMessages),
}))

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [chatMessages.conversationId],
    references: [conversations.id],
  }),
}))
