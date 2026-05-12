// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  PLAYER_PRESENCE_KIND,
  PLAYER_PRESENCE_EXPIRATION_SECONDS,
  PLAYER_PRESENCE_TTL_SECONDS,
  buildPresenceSubscribeMessage,
  createContentMapRef,
  createMapRef,
  createPresenceEvent,
  latestPresenceByPubkey,
  parsePresenceEvent,
  presenceDTag,
} from '../nostr/presence.js'

const mapEvent = {
  kind: 30078,
  pubkey: 'a'.repeat(64),
  tags: [['d', 'pufferfishgames/nukecraft']],
  id: 'b'.repeat(64),
}

describe('createMapRef', () => {
  it('uses the addressable Nostr map coordinate as the room key', () => {
    expect(createMapRef(mapEvent)).toBe(`30078:${'a'.repeat(64)}:pufferfishgames/nukecraft`)
  })

  it('falls back to the event id when a d tag is unavailable', () => {
    expect(createMapRef({ id: 'c'.repeat(64) })).toBe(`event:${'c'.repeat(64)}`)
  })
})

describe('createContentMapRef', () => {
  it('creates stable map keys for imported file content', () => {
    expect(createContentMapRef('[{"x":1}]')).toBe(createContentMapRef('[{"x":1}]'))
    expect(createContentMapRef('[{"x":1}]')).not.toBe(createContentMapRef('[{"x":2}]'))
  })
})

describe('createPresenceEvent', () => {
  it('creates an addressable player presence event scoped to a map', () => {
    const event = createPresenceEvent('d'.repeat(64), createMapRef(mapEvent), {
      x: 1.25,
      y: 2.5,
      z: 3.75,
      yaw: 0.5,
      pitch: -0.25,
      name: 'player one',
    }, 1000)

    expect(event.kind).toBe(PLAYER_PRESENCE_KIND)
    expect(event.pubkey).toBe('d'.repeat(64))
    expect(event.created_at).toBe(1000)
    expect(event.tags).toContainEqual(['d', presenceDTag(createMapRef(mapEvent))])
    expect(event.tags).toContainEqual(['a', createMapRef(mapEvent)])
    expect(event.tags).toContainEqual(['expiration', String(1000 + PLAYER_PRESENCE_EXPIRATION_SECONDS)])
    expect(JSON.parse(event.content)).toMatchObject({
      x: 1.25,
      y: 2.5,
      z: 3.75,
      yaw: 0.5,
      pitch: -0.25,
      name: 'player one',
    })
  })
})

describe('buildPresenceSubscribeMessage', () => {
  it('subscribes to current-map player presence', () => {
    const msg = JSON.parse(buildPresenceSubscribeMessage('players', createMapRef(mapEvent), 900))
    expect(msg[0]).toBe('REQ')
    expect(msg[1]).toBe('players')
    expect(msg[2]).toMatchObject({
      kinds: [PLAYER_PRESENCE_KIND],
      '#d': [presenceDTag(createMapRef(mapEvent))],
      since: 900,
      limit: 100,
    })
  })
})

describe('parsePresenceEvent', () => {
  const mapRef = createMapRef(mapEvent)

  it('returns sanitized player state for a fresh matching event', () => {
    const event = createPresenceEvent('e'.repeat(64), mapRef, {
      x: 10.123,
      y: 20.5,
      z: 30.999,
      yaw: 1,
      pitch: 0.25,
      name: 'alice',
    }, 100)

    expect(parsePresenceEvent(event, mapRef, 105)).toMatchObject({
      pubkey: 'e'.repeat(64),
      x: 10.123,
      y: 20.5,
      z: 30.999,
      yaw: 1,
      pitch: 0.25,
      name: 'alice',
      seenAt: 100,
    })
  })

  it('rejects stale player events', () => {
    const event = createPresenceEvent('e'.repeat(64), mapRef, { x: 0, y: 0, z: 0 }, 100)
    expect(parsePresenceEvent(event, mapRef, 100 + PLAYER_PRESENCE_TTL_SECONDS + 1)).toBeNull()
  })

  it('rejects events for other maps', () => {
    const event = createPresenceEvent('e'.repeat(64), 'other-map', { x: 0, y: 0, z: 0 }, 100)
    expect(parsePresenceEvent(event, mapRef, 100)).toBeNull()
  })

  it('rejects malformed payloads', () => {
    const event = {
      ...createPresenceEvent('e'.repeat(64), mapRef, { x: 0, y: 0, z: 0 }, 100),
      content: '{"x":"bad"}',
    }
    expect(parsePresenceEvent(event, mapRef, 100)).toBeNull()
  })
})

describe('latestPresenceByPubkey', () => {
  it('keeps the newest valid player event per pubkey', () => {
    const mapRef = createMapRef(mapEvent)
    const older = { ...createPresenceEvent('f'.repeat(64), mapRef, { x: 1, y: 1, z: 1 }, 100), id: '2' }
    const newer = { ...createPresenceEvent('f'.repeat(64), mapRef, { x: 2, y: 2, z: 2 }, 110), id: '1' }
    const other = { ...createPresenceEvent('0'.repeat(64), mapRef, { x: 3, y: 3, z: 3 }, 105), id: '3' }

    expect(latestPresenceByPubkey([older, newer, other], mapRef, 111)).toEqual([
      expect.objectContaining({ pubkey: 'f'.repeat(64), x: 2 }),
      expect.objectContaining({ pubkey: '0'.repeat(64), x: 3 }),
    ])
  })

  it('omits the local player pubkey', () => {
    const mapRef = createMapRef(mapEvent)
    const local = createPresenceEvent('f'.repeat(64), mapRef, { x: 1, y: 1, z: 1 }, 100)
    expect(latestPresenceByPubkey([local], mapRef, 101, 'f'.repeat(64))).toEqual([])
  })
})
