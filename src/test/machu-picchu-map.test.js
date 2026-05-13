// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { decodeBlocks, encodeBlocks } from '../nostr/codec.js'
import { BlockType } from '../game/world.js'
import { FEATURE_AREAS, generateMap } from '../../scripts/generate-machu-picchu-map.js'

function inArea(block, area) {
  return block.x >= area.x0 && block.x <= area.x1 && block.z >= area.z0 && block.z <= area.z1
}

function areaBlocks(blocks, name) {
  return blocks.filter((block) => inArea(block, FEATURE_AREAS[name]))
}

function countType(blocks, type) {
  return blocks.filter((block) => block.type === type).length
}

function maxY(blocks) {
  return blocks.reduce((highest, block) => Math.max(highest, block.y), -Infinity)
}

describe('generateMap Machu Picchu adventure map', () => {
  const blocks = generateMap()

  it('contains no duplicate block positions', () => {
    const keys = blocks.map((block) => `${block.x},${block.y},${block.z}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses integer codec-safe coordinates and known block types', () => {
    const validTypes = new Set(Object.values(BlockType))
    expect(blocks.every((block) =>
      Number.isInteger(block.x) &&
      Number.isInteger(block.y) &&
      Number.isInteger(block.z) &&
      block.x >= 0 &&
      block.x <= 65_535 &&
      block.y >= 0 &&
      block.y <= 255 &&
      block.z >= 0 &&
      block.z <= 65_535 &&
      validTypes.has(block.type) &&
      block.type !== BlockType.AIR,
    )).toBe(true)
  })

  it('has Machu Picchu terraces and summit stonework', () => {
    const site = areaBlocks(blocks, 'machuPicchu')
    expect(countType(site, BlockType.GRAVEL)).toBeGreaterThan(10_000)
    expect(countType(site, BlockType.STONE)).toBeGreaterThan(500)
    expect(maxY(site)).toBeGreaterThanOrEqual(24)
  })

  it('has a long river crossing the map', () => {
    const river = areaBlocks(blocks, 'river')
    expect(countType(river, BlockType.WATER)).toBeGreaterThan(3_000)
    expect(new Set(river.filter((block) => block.type === BlockType.WATER).map((block) => block.x)).size)
      .toBeGreaterThan(180)
  })

  it('has a lakeside village built from wood and stone', () => {
    const village = areaBlocks(blocks, 'village')
    expect(countType(village, BlockType.WOOD)).toBeGreaterThan(250)
    expect(countType(village, BlockType.STONE_BRICK)).toBeGreaterThan(250)
    expect(maxY(village)).toBeGreaterThanOrEqual(8)
  })

  it('has a lake with a broad water surface', () => {
    const lake = areaBlocks(blocks, 'lake')
    expect(countType(lake, BlockType.WATER)).toBeGreaterThan(3_500)
    expect(countType(lake, BlockType.SAND)).toBeGreaterThan(500)
  })

  it('has a big city with skyscrapers', () => {
    const city = areaBlocks(blocks, 'bigCity')
    expect(countType(city, BlockType.CONCRETE)).toBeGreaterThan(12_000)
    expect(countType(city, BlockType.STONE_BRICK)).toBeGreaterThan(5_000)
    expect(maxY(city)).toBeGreaterThanOrEqual(64)
  })

  it('has a gold mine with sand ore seams under stone', () => {
    const mine = areaBlocks(blocks, 'goldMine')
    expect(countType(mine, BlockType.STONE)).toBeGreaterThan(2_000)
    expect(countType(mine, BlockType.SAND)).toBeGreaterThan(80)
    expect(mine.some((block) => block.type === BlockType.SAND && block.y <= 8)).toBe(true)
  })

  it('has a nuke mine with recoverable nuke blocks', () => {
    const mine = areaBlocks(blocks, 'nukeMine')
    expect(countType(mine, BlockType.NUKE)).toBeGreaterThan(40)
    expect(countType(mine, BlockType.GRAVEL)).toBeGreaterThan(500)
    expect(mine.some((block) => block.type === BlockType.NUKE && block.y <= 8)).toBe(true)
  })

  it('has a dense forest with trunks and canopies', () => {
    const forest = areaBlocks(blocks, 'forest')
    expect(countType(forest, BlockType.WOOD)).toBeGreaterThan(700)
    expect(countType(forest, BlockType.LEAVES)).toBeGreaterThan(3_000)
  })

  it('has a stone labyrinth with marked entrance and exit', () => {
    const labyrinth = areaBlocks(blocks, 'labyrinth')
    expect(countType(labyrinth, BlockType.STONE_BRICK)).toBeGreaterThan(3_000)
    expect(countType(labyrinth, BlockType.CONCRETE)).toBeGreaterThan(30)
  })

  it('round-trips through the Nostr v2 map codec', async () => {
    const encoded = await encodeBlocks(blocks)
    const decoded = await decodeBlocks(encoded)
    expect(decoded).toEqual([...blocks].sort((a, b) =>
      a.y !== b.y ? a.y - b.y : a.x !== b.x ? a.x - b.x : a.z - b.z,
    ))
  })
})
