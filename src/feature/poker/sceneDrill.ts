import { errCodeEnum, type ErrCodeT } from '../../define/errDefine'
import { plgJsonLog } from '../../utils/plgLog'
import {
  getNodeApiPokerEngine,
  type SceneDimensionFilter,
  type SceneDimensionType,
  type SceneDimensionValue,
} from './adapter'
import type { SceneAggregateOption, SceneDrillRecommendation } from './model'

const POSITION_NAMES_BY_PLAYER_COUNT: Record<number, readonly string[]> = {
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'],
  10: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'UTG3', 'LJ', 'HJ', 'CO'],
}

const STREET_VALUES = {
  preflop: 'PREFLOP',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
} as const

const POT_FAMILY_VALUES = {
  limped_pot: 'LIMPED',
  srp: 'SRP',
  '3bp': '3BP',
  '4bp+': '4BP_PLUS',
} as const

const HERO_INITIATIVE_VALUES = {
  aggressor: 'AGGRESSOR',
  caller_or_checker: 'CALLER_OR_CHECKER',
} as const

const POSITION_RELATION_VALUES = {
  ip: 'IP',
  oop: 'OOP',
  sandwiched: 'SANDWICHED',
} as const

const PREFLOP_SPOT_TYPES = new Set([
  'preflop_rfi',
  'preflop_vs_limp',
  'preflop_vs_raise',
  'preflop_vs_threebet',
  'preflop_vs_fourbet',
])

const POSTFLOP_SPOT_TYPES = new Set([
  'postflop_fta',
  'postflop_vs_check',
  'postflop_vs_bet',
  'postflop_vs_raise',
])

const DIMENSION_ORDER: readonly SceneDimensionType[] = [
  'STREET',
  'SPOT_TYPE',
  'PLAYERS_IN_POT',
  'HERO_POSITION',
  'OPPONENT_POSITION',
  'POT_FAMILY',
  'HERO_INITIATIVE',
  'POSITION_RELATION',
]

const SCENE_AGGREGATE_OPTION_KEYS = new Set([
  'strategy',
  'player_count',
  'depth_bb',
  'street',
  'spot_type',
  'hero_position',
  'opponent_position',
  'position_relation',
  'players_in_pot',
  'pot_family',
  'hero_initiative',
  'hole_cards',
])

function dimension(
  dimensionType: SceneDimensionType,
  value: SceneDimensionValue
): SceneDimensionFilter {
  return { dimensionType, value }
}

function positionOffset(playerCount: number, position: string): number | undefined {
  const normalized = position.trim().toUpperCase()
  const offset = POSITION_NAMES_BY_PLAYER_COUNT[playerCount]?.indexOf(normalized) ?? -1
  return offset >= 0 ? offset : undefined
}

function buildPositionValue(
  playerCount: number,
  position: string
): SceneDimensionValue | undefined {
  const offset = positionOffset(playerCount, position)
  if (offset === undefined) {
    return undefined
  }
  return { position: { seatOffsetFromButton: offset } }
}

function isSpotTypeApplicable(
  street: SceneAggregateOption['street'],
  spotType: NonNullable<SceneAggregateOption['spot_type']>
): boolean {
  return street === 'preflop' ? PREFLOP_SPOT_TYPES.has(spotType) : POSTFLOP_SPOT_TYPES.has(spotType)
}

/** 将业务层场景选项转换为 Node-API 使用的规范化过滤条件。 */
export function buildDimensionFilters(
  option: SceneAggregateOption,
  playerCount: number
): SceneDimensionFilter[] | null {
  if (option.hero_position !== undefined && option.opponent_position !== undefined) {
    const heroPosition = option.hero_position.trim().toUpperCase()
    const opponentPosition = option.opponent_position.trim().toUpperCase()
    if (opponentPosition === heroPosition) {
      return null
    }
  }

  const street = dimension('STREET', { street: STREET_VALUES[option.street] })
  const filters: SceneDimensionFilter[] = [street]

  // SpotType 与 Street 是一一对应的；不适用的枚举直接丢弃，不交给 Rust 做无意义筛选。
  if (option.spot_type !== undefined && isSpotTypeApplicable(option.street, option.spot_type)) {
    filters.push(dimension('SPOT_TYPE', { spotType: option.spot_type }))
  }

  if (option.hero_position !== undefined) {
    const value = buildPositionValue(playerCount, option.hero_position)
    if (!value) {
      return null
    }
    filters.push(dimension('HERO_POSITION', value))
  }

  if (option.opponent_position !== undefined) {
    const offset = positionOffset(playerCount, option.opponent_position)
    if (offset === undefined) {
      return null
    }
    filters.push(dimension('OPPONENT_POSITION', { position: { seatOffsetFromButton: offset } }))
  }

  // PositionRelation 使用当前街仍 active 的行动顺序，翻前和翻后都适用。
  if (option.position_relation !== undefined) {
    filters.push(
      dimension('POSITION_RELATION', {
        positionRelation: POSITION_RELATION_VALUES[option.position_relation],
      })
    )
  }

  if (option.players_in_pot !== undefined) {
    filters.push(dimension('PLAYERS_IN_POT', { playersInPot: option.players_in_pot }))
  }

  // PotFamily 和 HeroInitiative 只在翻后有业务语义。
  if (option.street !== 'preflop' && option.pot_family !== undefined) {
    filters.push(dimension('POT_FAMILY', { potFamily: POT_FAMILY_VALUES[option.pot_family] }))
  }

  if (option.street !== 'preflop' && option.hero_initiative !== undefined) {
    filters.push(
      dimension('HERO_INITIATIVE', {
        heroInitiative: HERO_INITIATIVE_VALUES[option.hero_initiative],
      })
    )
  }

  return filters.sort(
    (left, right) =>
      DIMENSION_ORDER.indexOf(left.dimensionType) - DIMENSION_ORDER.indexOf(right.dimensionType)
  )
}

function recommendationFromMatches(
  option: SceneAggregateOption,
  strategy: string,
  playerCount: number,
  depthBb: number,
  actionLines: readonly string[]
): SceneDrillRecommendation {
  const uniqueActionLines = [...new Set(actionLines)]
  return {
    drillTitle: '场景抽象行动线',
    drillDescription: `匹配到 ${uniqueActionLines.length} 条抽象行动线。`,
    config: {
      strategy,
      playerCount,
      depthBb,
      street: option.street,
      actionLines: uniqueActionLines,
      holeCards: option.hole_cards,
    },
  }
}

/**
 * 3.3/3.9：一次 Node-API 调用完成场景到 Drill 的转换。
 * Bitmap 筛选、当前街最后一次加注者位置匹配、其它条件的空交集降级和页缓存都由 Rust Node-API 负责。
 */
export async function convertSceneAggregateOption(
  option: SceneAggregateOption
): Promise<[ErrCodeT, SceneDrillRecommendation | null]> {
  const unknownKeys = Object.keys(option).filter((key) => !SCENE_AGGREGATE_OPTION_KEYS.has(key))
  if (unknownKeys.length > 0) {
    return [errCodeEnum.ERR_PARAMS_ERROR.code, null]
  }

  const strategy = option.strategy?.trim() || process.env.PROTO_POKER_RANGE_STRATEGY || 'default'
  const playerCount = option.player_count ?? Number(process.env.PROTO_POKER_RANGE_PLAYER_COUNT || 6)
  const depthBb = option.depth_bb ?? Number(process.env.PROTO_POKER_RANGE_DEPTH_BB || 100)
  const filters = buildDimensionFilters(option, playerCount)

  if (!filters) {
    return [errCodeEnum.ERR_PARAMS_ERROR.code, null]
  }

  try {
    const range = await getNodeApiPokerEngine()
    const result = range.getAbstractLinesByDimensionFilters({
      strategy,
      playerCount,
      depthBb,
      filters,
    })

    if (!result) {
      plgJsonLog(
        {
          schema: 'scene_action_line_match.v1',
          street: option.street,
          matchedDimensions: [],
          ignoredDimensions: [],
          candidateCount: 0,
        },
        'info'
      )
      return [errCodeEnum.ERR_SCENE_DRILL_NOT_FOUND.code, null]
    }

    plgJsonLog(
      {
        schema: 'scene_action_line_match.v1',
        street: option.street,
        matchedDimensions: result.matchedDimensions,
        ignoredDimensions: result.ignoredDimensions,
        candidateCount: result.actionLines.length,
      },
      'info'
    )

    return [
      errCodeEnum.ERR_SUCCESS.code,
      recommendationFromMatches(option, strategy, playerCount, depthBb, result.actionLines),
    ]
  } catch (error) {
    console.error('[convertSceneAggregateOption]', error)
    return [errCodeEnum.ERR_SERVER_INTERNAL_ERROR.code, null]
  }
}
