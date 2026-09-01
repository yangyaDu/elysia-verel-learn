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

export const sceneSpotTypeValues = [
  'preflop_rfi',
  'preflop_vs_limp',
  'preflop_vs_raise',
  'preflop_vs_threebet',
  'preflop_vs_fourbet',
  'postflop_fta',
  'postflop_vs_check',
  'postflop_vs_bet',
  'postflop_vs_raise',
] as const

export type SceneSpotType = (typeof sceneSpotTypeValues)[number]

export const sceneAggregateOptionSchema = t.Object(
  {
    strategy: t.Optional(t.String({ minLength: 1, maxLength: 100, default: 'default' })),
    player_count: t.Optional(t.Integer({ minimum: 3, maximum: 10, default: 6 })),
    depth_bb: t.Optional(t.Integer({ minimum: 1, maximum: 10000, default: 100 })),
    street: t.Union([
      t.Literal('preflop'),
      t.Literal('flop'),
      t.Literal('turn'),
      t.Literal('river'),
    ]),
    spot_type: t.Optional(
      t.Union([
        t.Literal('preflop_rfi'),
        t.Literal('preflop_vs_limp'),
        t.Literal('preflop_vs_raise'),
        t.Literal('preflop_vs_threebet'),
        t.Literal('preflop_vs_fourbet'),
        t.Literal('postflop_fta'),
        t.Literal('postflop_vs_check'),
        t.Literal('postflop_vs_bet'),
        t.Literal('postflop_vs_raise'),
      ])
    ),
    hero_position: t.Optional(t.String({ minLength: 2, maxLength: 5 })),
    opponent_position: t.Optional(t.String({ minLength: 2, maxLength: 5 })),
    position_relation: t.Optional(
      t.Union([t.Literal('ip'), t.Literal('oop'), t.Literal('sandwiched')])
    ),
    players_in_pot: t.Optional(t.Integer({ minimum: 2, maximum: 10 })),
    pot_family: t.Optional(
      t.Union([t.Literal('limped_pot'), t.Literal('srp'), t.Literal('3bp'), t.Literal('4bp+')])
    ),
    hero_initiative: t.Optional(t.Union([t.Literal('aggressor'), t.Literal('caller_or_checker')])),
    hole_cards: t.Optional(t.Array(t.String({ minLength: 2, maxLength: 4 }), { maxItems: 2 })),
  },
  // Elysia 会在 additionalProperties=false 时静默清理未知字段；未知字段由
  // convertSceneAggregateOption 显式校验并返回参数错误，因此这里保留原始 body。
  { additionalProperties: true }
)

export type SceneAggregateOption = typeof sceneAggregateOptionSchema.static

export const sceneDrillRecommendationSchema = t.Object({
  drillTitle: t.String(),
  drillDescription: t.String(),
  config: t.Object({
    strategy: t.String(),
    playerCount: t.Integer(),
    depthBb: t.Integer(),
    street: t.String(),
    actionLines: t.Array(t.String()),
    holeCards: t.Optional(t.Array(t.String())),
  }),
})

export type SceneDrillRecommendation = typeof sceneDrillRecommendationSchema.static
