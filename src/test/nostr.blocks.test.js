// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { BlockType } from '../game/world.js'
import {
  BLOCK_EDIT_EXPIRATION_SECONDS,
  BLOCK_EDIT_KIND,
  buildBlockEditSubscribeMessage,
  createBlockEditEvent,
  latestBlockEditsByPosition,
  parseBlockEditEvent,
} from '../nostr/blocks.js'

const pubkey = 'a'.repeat(64)
const mapRef = 'default'

describe('createBlockEditEvent', () => {
  it('creates a stored same-map block edit event with 3 day expiration', () => {
    const event = createBlockEditEvent(pubkey, mapRef, {
      op: 'add',
      x: 1,
      y: 2,
      z: 3,
      type: BlockType.STONE,
    }, 1000, 1000123)

    expect(event.kind).toBe(BLOCK_EDIT_KIND)
    expect(event.pubkey).toBe(pubkey)
    expect(event.created_at).toBe(1000)
    expect(event.tags).toContainEqual(['a', mapRef])
    expect(event.tags).toContainEqual(['expiration', String(1000 + BLOCK_EDIT_EXPIRATION_SECONDS)])
    expect(JSON.parse(event.content)).toEqual({
      v: 1,
      ts: 1000123,
      ops: [{ op: 'add', x: 1, y: 2, z: 3, type: BlockType.STONE }],
    })
  })

  it('can batch many remove operations into one event', () => {
    const event = createBlockEditEvent(pubkey, mapRef, [
      { op: 'remove', x: 1, y: 2, z: 3 },
      { op: 'remove', x: 4, y: 5, z: 6 },
    ], 1000, 1000123)

    expect(JSON.parse(event.content).ops).toHaveLength(2)
  })
})

describe('buildBlockEditSubscribeMessage', () => {
  it('subscribes to edits tagged with the current map', () => {
    const msg = JSON.parse(buildBlockEditSubscribeMessage('blocks', mapRef, 700))
    expect(msg[0]).toBe('REQ')
    expect(msg[1]).toBe('blocks')
    expect(msg[2]).toMatchObject({
      kinds: [BLOCK_EDIT_KIND],
      '#a': [mapRef],
      since: 700,
      limit: 1000,
    })
  })
})

describe('parseBlockEditEvent', () => {
  it('returns sanitized block edits for a matching event', () => {
    const event = createBlockEditEvent(pubkey, mapRef, [
      { op: 'add', x: 1, y: 2, z: 3, type: BlockType.GRASS },
      { op: 'remove', x: 4, y: 5, z: 6 },
    ], 1000, 1000123)

    expect(parseBlockEditEvent(event, mapRef, 1001)).toEqual([
      expect.objectContaining({ op: 'add', x: 1, y: 2, z: 3, type: BlockType.GRASS, timestampMs: 1000123, order: 0 }),
      expect.objectContaining({ op: 'remove', x: 4, y: 5, z: 6, timestampMs: 1000123, order: 1 }),
    ])
  })

  it('rejects edits for other maps', () => {
    const event = createBlockEditEvent(pubkey, 'other-map', { op: 'remove', x: 1, y: 2, z: 3 }, 1000, 1000123)
    expect(parseBlockEditEvent(event, mapRef, 1001)).toEqual([])
  })

  it('rejects expired edits', () => {
    const event = createBlockEditEvent(pubkey, mapRef, { op: 'remove', x: 1, y: 2, z: 3 }, 1000, 1000123)
    expect(parseBlockEditEvent(event, mapRef, 1000 + BLOCK_EDIT_EXPIRATION_SECONDS + 1)).toEqual([])
  })

  it('rejects malformed add payloads', () => {
    const event = createBlockEditEvent(pubkey, mapRef, { op: 'add', x: 1, y: 2, z: 3, type: BlockType.STONE }, 1000, 1000123)
    const malformed = { ...event, content: JSON.stringify({ v: 1, ops: [{ op: 'add', x: 1, y: 2, z: 3, type: 999 }] }) }
    expect(parseBlockEditEvent(malformed, mapRef, 1001)).toEqual([])
  })
})

describe('latestBlockEditsByPosition', () => {
  it('keeps the newest operation per block position', () => {
    const older = { ...createBlockEditEvent(pubkey, mapRef, { op: 'add', x: 1, y: 2, z: 3, type: BlockType.DIRT }, 1000, 1000100), id: '2' }
    const newer = { ...createBlockEditEvent(pubkey, mapRef, { op: 'remove', x: 1, y: 2, z: 3 }, 1001, 1001100), id: '1' }
    const other = { ...createBlockEditEvent(pubkey, mapRef, { op: 'add', x: 4, y: 5, z: 6, type: BlockType.WOOD }, 1000, 1000100), id: '3' }

    expect(latestBlockEditsByPosition([older, newer, other], mapRef, 1002)).toEqual([
      expect.objectContaining({ op: 'remove', x: 1, y: 2, z: 3 }),
      expect.objectContaining({ op: 'add', x: 4, y: 5, z: 6, type: BlockType.WOOD }),
    ])
  })

  it('uses batch order when two operations in one event touch the same position', () => {
    const event = createBlockEditEvent(pubkey, mapRef, [
      { op: 'remove', x: 1, y: 2, z: 3 },
      { op: 'add', x: 1, y: 2, z: 3, type: BlockType.STONE },
    ], 1000, 1000100)

    expect(latestBlockEditsByPosition([event], mapRef, 1001)).toEqual([
      expect.objectContaining({ op: 'add', x: 1, y: 2, z: 3, type: BlockType.STONE }),
    ])
  })
})
