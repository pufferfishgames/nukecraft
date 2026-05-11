import { describe, it, expect } from 'vitest'
import { removeBlock, placeBlock } from '../game/building.js'
import { BlockType } from '../game/world.js'

describe('removeBlock', () => {
  it('removes the block at the given position', () => {
    const blocks = [
      { x: 0, y: 0, z: 0, type: BlockType.GRASS },
      { x: 1, y: 0, z: 0, type: BlockType.STONE },
    ]
    const result = removeBlock(blocks, { x: 0, y: 0, z: 0 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ x: 1, y: 0, z: 0 })
  })

  it('returns the same array when position is not found', () => {
    const blocks = [{ x: 0, y: 0, z: 0, type: BlockType.GRASS }]
    const result = removeBlock(blocks, { x: 5, y: 5, z: 5 })
    expect(result).toHaveLength(1)
  })

  it('does not mutate the original array', () => {
    const blocks = [{ x: 0, y: 0, z: 0, type: BlockType.GRASS }]
    removeBlock(blocks, { x: 0, y: 0, z: 0 })
    expect(blocks).toHaveLength(1)
  })
})

describe('placeBlock', () => {
  it('adds a block adjacent to the hit face', () => {
    const blocks = [{ x: 0, y: 0, z: 0, type: BlockType.GRASS }]
    const result = placeBlock(blocks, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, BlockType.DIRT)
    expect(result.some((b) => b.x === 0 && b.y === 1 && b.z === 0 && b.type === BlockType.DIRT)).toBe(true)
  })

  it('does not place where a block already exists', () => {
    const blocks = [
      { x: 0, y: 0, z: 0, type: BlockType.GRASS },
      { x: 0, y: 1, z: 0, type: BlockType.DIRT },
    ]
    const result = placeBlock(blocks, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, BlockType.STONE)
    expect(result).toHaveLength(2)
  })

  it('does not mutate the original array', () => {
    const blocks = [{ x: 0, y: 0, z: 0, type: BlockType.GRASS }]
    placeBlock(blocks, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, BlockType.DIRT)
    expect(blocks).toHaveLength(1)
  })

  it('places on the correct face for each axis', () => {
    const base = { x: 5, y: 5, z: 5, type: BlockType.STONE }
    const cases = [
      [{ x: 1, y: 0, z: 0 }, { x: 6, y: 5, z: 5 }],
      [{ x: -1, y: 0, z: 0 }, { x: 4, y: 5, z: 5 }],
      [{ x: 0, y: 0, z: 1 }, { x: 5, y: 5, z: 6 }],
      [{ x: 0, y: 0, z: -1 }, { x: 5, y: 5, z: 4 }],
    ]
    for (const [normal, expected] of cases) {
      const result = placeBlock([base], base, normal, BlockType.DIRT)
      expect(result.some((b) => b.x === expected.x && b.y === expected.y && b.z === expected.z)).toBe(true)
    }
  })
})
