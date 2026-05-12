import { randomUUID } from 'node:crypto'
import { db } from '../../db/client'
import {
  findConversationById,
  getMaxSequenceNo,
  insertChatMessage,
  touchConversation,
} from './chatRepo'
import type { ChatBody, ChatResult } from './model'

function serializeUserTurn(params: ChatBody): string {
  return JSON.stringify({
    prompt: params.prompt ?? null,
    messages: params.messages ?? null,
    docNames: params.docNames ?? null,
  })
}

export async function persistChatCompletion(params: ChatBody, data: ChatResult): Promise<void> {
  if (!params.conversationId || !data) {
    return
  }
  if (!db) {
    return
  }
  const conv = await findConversationById(db, params.conversationId)
  if (!conv) {
    console.warn('[persistChat] conversation not found:', params.conversationId)
    return
  }

  let seq = await getMaxSequenceNo(db, params.conversationId)
  seq += 1
  await insertChatMessage(db, {
    id: randomUUID(),
    conversationId: params.conversationId,
    sequenceNo: seq,
    role: 'user',
    content: serializeUserTurn(params),
  })

  seq += 1
  await insertChatMessage(db, {
    id: randomUUID(),
    conversationId: params.conversationId,
    sequenceNo: seq,
    role: 'assistant',
    content: data.text,
    thinking: data.thinking ?? null,
    usageJson: data.usage ?? null,
    toolCallsJson: data.toolCalls ?? null,
    toolResultsJson: data.toolResults ?? null,
    toolErrorsJson: data.toolErrors ?? null,
  })

  await touchConversation(db, params.conversationId)
}

export async function persistChatStreamCompletion(
  params: ChatBody,
  payload: { text: string; thinking: string }
): Promise<void> {
  if (!params.conversationId) {
    return
  }
  if (!db) {
    return
  }
  const conv = await findConversationById(db, params.conversationId)
  if (!conv) {
    console.warn('[persistChatStream] conversation not found:', params.conversationId)
    return
  }

  let seq = await getMaxSequenceNo(db, params.conversationId)
  seq += 1
  await insertChatMessage(db, {
    id: randomUUID(),
    conversationId: params.conversationId,
    sequenceNo: seq,
    role: 'user',
    content: serializeUserTurn(params),
  })

  seq += 1
  const thinking = payload.thinking.length > 0 ? payload.thinking : null
  await insertChatMessage(db, {
    id: randomUUID(),
    conversationId: params.conversationId,
    sequenceNo: seq,
    role: 'assistant',
    content: payload.text.length > 0 ? payload.text : ' ',
    thinking,
    usageJson: null,
    toolCallsJson: null,
    toolResultsJson: null,
    toolErrorsJson: null,
  })

  await touchConversation(db, params.conversationId)
}
