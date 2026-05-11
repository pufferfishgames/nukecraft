import { describe, it, expect } from 'vitest'
import { generateTerrain, generateWorld, BlockType, CHUNK_SIZE } from '../game/world.js'

describe('generateTerrain', () => {
  it('returns blocks covering the full chunk footprint', () => {
    const blocks = generateTerrain(0, 0)
    const positions = new Set(blocks.map((b) => `${b.x},${b.z}`))
    expect(positions.size).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('every column has a grass block on top', () => {
    const blocks = generateTerrain(0, 0)
    const byXZ = {}
    for (const b of blocks) {
      const key = `${b.x},${b.z}`
      if (!byXZ[key] || b.y > byXZ[key].y) byXZ[key] = b
    }
    const tops = Object.values(byXZ)
    expect(tops.every((b) => b.type === BlockType.GRASS)).toBe(true)
  })

  it('stone blocks are below dirt and grass', () => {
    const blocks = generateTerrain(0, 0)
    const stone = blocks.filter((b) => b.type === BlockType.STONE)
    const grass = blocks.filter((b) => b.type === BlockType.GRASS)
    const maxStoneY = Math.max(...stone.map((b) => b.y))
    const minGrassY = Math.min(...grass.map((b) => b.y))
    expect(maxStoneY).toBeLessThan(minGrassY)
  })

  it('offsets blocks by chunk coordinates', () => {
    const chunk = generateTerrain(2, 3)
    const xs = chunk.map((b) => b.x)
    const zs = chunk.map((b) => b.z)
    expect(Math.min(...xs)).toBe(2 * CHUNK_SIZE)
    expect(Math.min(...zs)).toBe(3 * CHUNK_SIZE)
  })

  it('contains no AIR blocks (they are omitted)', () => {
    const blocks = generateTerrain(0, 0)
    expect(blocks.every((b) => b.type !== BlockType.AIR)).toBe(true)
  })
})

describe('generateWorld', () => {
  it('returns at least 1000 blocks', () => {
    const blocks = generateWorld()
    expect(blocks.length).toBeGreaterThanOrEqual(1000)
  })

  it('has no duplicate block positions', () => {
    const blocks = generateWorld()
    const keys = blocks.map((b) => `${b.x},${b.y},${b.z}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('contains desert sand blocks', () => {
    const blocks = generateWorld()
    expect(blocks.some((b) => b.type === BlockType.SAND)).toBe(true)
  })

  it('contains ocean water blocks', () => {
    const blocks = generateWorld()
    expect(blocks.some((b) => b.type === BlockType.WATER)).toBe(true)
  })

  it('contains forest wood blocks', () => {
    const blocks = generateWorld()
    expect(blocks.some((b) => b.type === BlockType.WOOD)).toBe(true)
  })

  it('contains city stone-brick blocks', () => {
    const blocks = generateWorld()
    expect(blocks.some((b) => b.type === BlockType.STONE_BRICK)).toBe(true)
  })

  it('all blocks have integer coordinates', () => {
    const blocks = generateWorld()
    expect(blocks.every((b) => Number.isInteger(b.x) && Number.isInteger(b.y) && Number.isInteger(b.z))).toBe(true)
  })
})
