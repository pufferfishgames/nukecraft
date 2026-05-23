// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { decodeBlocks, encodeBlocks } from '../nostr/codec.js'
import { BlockType } from '../game/world.js'
import { normalizeMapLabel } from '../nostr/events.js'
import { FEATURE_AREAS, MAP_LABEL, PASSPHRASE, generateMap } from '../../scripts/generate-maya-map.js'

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

function span(blocks, axis) {
  const values = blocks.map((block) => block[axis])
  return Math.max(...values) - Math.min(...values) + 1
}

describe('generateMap Maya b747 map', () => {
  const blocks = generateMap()

  it('publishes under the requested b747 passphrase', () => {
    expect(PASSPHRASE).toBe('b747')
  })

  it('has a 20 character Nostr map label', () => {
    expect(normalizeMapLabel(MAP_LABEL)).toHaveLength(20)
  })

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

  it('keeps prominent Mayan pyramid stonework', () => {
    const pyramid = areaBlocks(blocks, 'mayanPyramid')
    expect(countType(pyramid, BlockType.STONE_BRICK)).toBeGreaterThan(45_000)
    expect(countType(pyramid, BlockType.CONCRETE)).toBeGreaterThan(30)
    expect(maxY(pyramid)).toBeGreaterThanOrEqual(35)
  })

  it('adds a large Boeing 747 build with fuselage, wings, upper deck, tail, and engines', () => {
    const aircraft = areaBlocks(blocks, 'boeing747')
    expect(countType(aircraft, BlockType.CONCRETE)).toBeGreaterThan(3_000)
    expect(span(aircraft, 'x')).toBeGreaterThanOrEqual(92)
    expect(span(aircraft, 'z')).toBeGreaterThanOrEqual(82)
    expect(maxY(aircraft)).toBeGreaterThanOrEqual(18)

    const upperDeck = aircraft.filter((block) =>
      block.type === BlockType.STONE_BRICK &&
      block.x >= 174 &&
      block.x <= 196 &&
      block.y >= 14,
    )
    expect(upperDeck.length).toBeGreaterThan(80)

    const tail = aircraft.filter((block) =>
      block.type === BlockType.STONE_BRICK &&
      block.x >= 116 &&
      block.x <= 130 &&
      block.y >= 14,
    )
    expect(tail.length).toBeGreaterThan(60)

    const engineCenters = [
      [148, 124], [166, 132], [148, 188], [166, 180],
    ]
    for (const [cx, cz] of engineCenters) {
      const engine = aircraft.filter((block) =>
        block.type === BlockType.GRAVEL &&
        Math.abs(block.x - cx) <= 3 &&
        Math.abs(block.z - cz) <= 3 &&
        block.y >= 5 &&
        block.y <= 9,
      )
      expect(engine.length).toBeGreaterThan(12)
    }
  })

  it('has a runway beside the Mayan pyramids for moving around the aircraft', () => {
    const runway = areaBlocks(blocks, 'runway')
    expect(countType(runway, BlockType.CONCRETE)).toBeGreaterThan(4_000)
    expect(span(runway, 'x')).toBeGreaterThanOrEqual(170)
  })

  it('round-trips through the Nostr v2 map codec', async () => {
    const encoded = await encodeBlocks(blocks)
    const decoded = await decodeBlocks(encoded)
    expect(decoded).toEqual([...blocks].sort((a, b) =>
      a.y !== b.y ? a.y - b.y : a.x !== b.x ? a.x - b.x : a.z - b.z,
    ))
  })
})
