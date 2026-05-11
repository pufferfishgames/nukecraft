// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createMapEvent, serializeEvent, getEventId, signEvent } from '../nostr/events.js'
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
