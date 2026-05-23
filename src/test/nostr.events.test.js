// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  MAP_LABEL_LENGTH,
  createMapEvent,
  getEventId,
  getMapLabel,
  normalizeMapLabel,
  serializeEvent,
  signEvent,
} from '../nostr/events.js'
import { passphraseToPrivkey, privkeyToPubkey } from '../nostr/identity.js'

const privkey = passphraseToPrivkey('test passphrase')
const pubkey = privkeyToPubkey(privkey)
const content = JSON.stringify([{ x: 0, y: 0, z: 0, type: 1 }, { x: 1, y: 0, z: 0, type: 2 }])

describe('createMapEvent', () => {
  it('kind is 30078', () => {
    expect(createMapEvent(pubkey, content).kind).toBe(30078)
  })

  it('pubkey matches', () => {
    expect(createMapEvent(pubkey, content).pubkey).toBe(pubkey)
  })

  it('has d-tag pufferfishgames/nukecraft', () => {
    const event = createMapEvent(pubkey, content)
    expect(event.tags).toContainEqual(['d', 'pufferfishgames/nukecraft'])
  })

  it('adds a 20 character label tag to every map event', () => {
    const event = createMapEvent(pubkey, content, { label: 'Desert Run' })
    const label = event.tags.find((tag) => tag[0] === 'label')?.[1]
    expect(label).toBe(normalizeMapLabel('Desert Run'))
    expect(label).toHaveLength(MAP_LABEL_LENGTH)
  })

  it('stores content string as-is', () => {
    const event = createMapEvent(pubkey, content)
    expect(event.content).toBe(content)
  })

  it('created_at is a recent unix timestamp', () => {
    const before = Math.floor(Date.now() / 1000) - 1
    const event = createMapEvent(pubkey, content)
    expect(event.created_at).toBeGreaterThan(before)
  })
})

describe('map labels', () => {
  it('normalizes labels to exactly 20 characters', () => {
    expect(normalizeMapLabel('  a   tracked   map  ')).toBe('a tracked map       ')
    expect(normalizeMapLabel('12345678901234567890xyz')).toBe('12345678901234567890')
    expect(normalizeMapLabel('')).toHaveLength(MAP_LABEL_LENGTH)
  })

  it('reads label, title, and name tags as map labels', () => {
    expect(getMapLabel({ tags: [['label', 'Maya B747']] })).toBe(normalizeMapLabel('Maya B747'))
    expect(getMapLabel({ tags: [['title', 'Sky city']] })).toBe(normalizeMapLabel('Sky city'))
    expect(getMapLabel({ tags: [['name', 'Village']] })).toBe(normalizeMapLabel('Village'))
  })

  it('creates a 20 character fallback for unlabeled legacy maps', () => {
    const id = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    expect(getMapLabel({ id, tags: [] })).toBe('Map 0123456789abcdef')
    expect(getMapLabel({ id, tags: [] })).toHaveLength(MAP_LABEL_LENGTH)
  })
})

describe('serializeEvent', () => {
  it('produces valid JSON', () => {
    const event = createMapEvent(pubkey, content)
    expect(() => JSON.parse(serializeEvent(event))).not.toThrow()
  })

  it('serializes as [0, pubkey, created_at, kind, tags, content]', () => {
    const event = createMapEvent(pubkey, content)
    const arr = JSON.parse(serializeEvent(event))
    expect(arr[0]).toBe(0)
    expect(arr[1]).toBe(event.pubkey)
    expect(arr[2]).toBe(event.created_at)
    expect(arr[3]).toBe(event.kind)
    expect(arr[4]).toEqual(event.tags)
    expect(arr[5]).toBe(event.content)
  })
})

describe('getEventId', () => {
  it('returns 64-char hex', () => {
    expect(getEventId(createMapEvent(pubkey, content))).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for same event fields', () => {
    const event = { kind: 30078, pubkey, created_at: 1000000000, tags: [['d', 'pufferfishgames/nukecraft']], content: '[]' }
    expect(getEventId(event)).toBe(getEventId(event))
  })

  it('changes when content changes', () => {
    const a = { kind: 30078, pubkey, created_at: 1000000000, tags: [['d', 'pufferfishgames/nukecraft']], content: '[]' }
    const b = { ...a, content: '[{"x":1}]' }
    expect(getEventId(a)).not.toBe(getEventId(b))
  })
})

describe('signEvent', () => {
  it('returns event with id field', () => {
    const event = createMapEvent(pubkey, content)
    expect(signEvent(event, privkey).id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns event with sig field (128-char hex)', () => {
    const event = createMapEvent(pubkey, content)
    expect(signEvent(event, privkey).sig).toMatch(/^[0-9a-f]{128}$/)
  })

  it('id in signed event matches getEventId', () => {
    const event = createMapEvent(pubkey, content)
    const signed = signEvent(event, privkey)
    expect(signed.id).toBe(getEventId(event))
  })

  it('pubkey is preserved', () => {
    const event = createMapEvent(pubkey, content)
    expect(signEvent(event, privkey).pubkey).toBe(pubkey)
  })
})
