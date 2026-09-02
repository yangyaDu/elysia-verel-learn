import { describe, expect, test } from 'bun:test'
import type { SceneAggregateOption } from './model'
import { buildDimensionFilters } from './sceneDrill'

describe('buildDimensionFilters', () => {
  test('maps every PositionRelation value on every street', () => {
    const relations = [
      ['ip', 'IP'],
      ['oop', 'OOP'],
      ['sandwiched', 'SANDWICHED'],
    ] as const

    for (const street of ['preflop', 'flop', 'turn', 'river'] as const) {
      for (const [input, expected] of relations) {
        const option: SceneAggregateOption = {
          street,
          position_relation: input,
        }
        const filters = buildDimensionFilters(option, 6)

        expect(filters).not.toBeNull()
        expect(filters).toContainEqual({
          dimensionType: 'POSITION_RELATION',
          value: { positionRelation: expected },
        })
      }
    }
  })
})
