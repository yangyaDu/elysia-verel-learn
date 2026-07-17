import { t } from 'elysia'

export const pokerQueryBodySchema = t.Object({
  strategy: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
  playerCount: t.Integer({ minimum: 2, maximum: 10 }),
  depthBb: t.Integer({ minimum: 1, maximum: 10000 }),
  concreteLineId: t.Integer({ minimum: 1 }),
  holeCards: t.String({ minLength: 2, maxLength: 4 }),
})

export type PokerQuery = typeof pokerQueryBodySchema.static

const pokerActionSchema = t.Object({
  actionName: t.String(),
  actionSize: t.Number(),
  amountBb: t.Number(),
  frequency: t.Number(),
  handEv: t.Optional(t.Number()),
})

export const pokerQueryResponseSchema = t.Object({
  actions: t.Array(pokerActionSchema),
})

export type PokerQueryResponse = typeof pokerQueryResponseSchema.static

export const pokerCompareBodySchema = t.Composite([
  pokerQueryBodySchema,
  t.Object({
    warmupIterations: t.Optional(t.Integer({ minimum: 0, maximum: 100 })),
    measuredIterations: t.Optional(t.Integer({ minimum: 1, maximum: 1000 })),
  }),
])

const latencySummarySchema = t.Object({
  iterations: t.Integer(),
  averageMs: t.Number(),
  p50Ms: t.Number(),
  p95Ms: t.Number(),
})

export const pokerCompareResponseSchema = t.Object({
  consistent: t.Boolean(),
  nodeApi: latencySummarySchema,
  ffi: latencySummarySchema,
  sqlite: latencySummarySchema,
})

export type PokerCompareRequest = typeof pokerCompareBodySchema.static
export type PokerCompareResponse = typeof pokerCompareResponseSchema.static
