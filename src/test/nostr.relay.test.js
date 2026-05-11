// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  buildPublishMessage,
  buildSubscribeMessage,
  parseRelayMessage,
  filterByPoW,
} from '../nostr/relay.js'

describe('buildPublishMessage', () => {
  it('wraps event in ["EVENT", event]', () => {
    const event = { id: 'abc', kind: 30078, content: '[]' }
    expect(JSON.parse(buildPublishMessage(event))).toEqual(['EVENT', event])
  })
})

describe('buildSubscribeMessage', () => {
  it('starts with REQ and the given subscription id', () => {
    const msg = JSON.parse(buildSubscribeMessage('sub42'))
    expect(msg[0]).toBe('REQ')
    expect(msg[1]).toBe('sub42')
  })

  it('filter requests kind 30078', () => {
    const msg = JSON.parse(buildSubscribeMessage('x'))
    expect(msg[2].kinds).toContain(30078)
  })

  it('filter has #d tag for pufferfishgames/nukecraft', () => {
    const msg = JSON.parse(buildSubscribeMessage('x'))
    expect(msg[2]['#d']).toContain('pufferfishgames/nukecraft')
  })
})

describe('parseRelayMessage', () => {
  it('parses EVENT message', () => {
    const event = { id: 'abc', kind: 30078, content: '[]' }
    const raw = JSON.stringify(['EVENT', 'sub1', event])
    expect(parseRelayMessage(raw)).toEqual({ type: 'EVENT', subscriptionId: 'sub1', event })
  })

  it('parses EOSE message', () => {
    const raw = JSON.stringify(['EOSE', 'sub1'])
    expect(parseRelayMessage(raw)).toEqual({ type: 'EOSE', subscriptionId: 'sub1' })
  })

  it('parses NOTICE message', () => {
    const raw = JSON.stringify(['NOTICE', 'hello'])
    expect(parseRelayMessage(raw)).toEqual({ type: 'NOTICE', message: 'hello' })
  })

  it('parses OK message', () => {
    const raw = JSON.stringify(['OK', 'abc123', true, ''])
    const result = parseRelayMessage(raw)
    expect(result.type).toBe('OK')
    expect(result.eventId).toBe('abc123')
    expect(result.accepted).toBe(true)
  })
})

describe('filterByPoW', () => {
  it('keeps events whose id meets difficulty', () => {
    const goodId = '00' + 'f'.repeat(62)
    const events = [{ id: goodId }]
    expect(filterByPoW(events, 8)).toHaveLength(1)
  })

  it('drops events whose id does not meet difficulty', () => {
    const badId = 'ff' + '0'.repeat(62)
    const events = [{ id: badId }]
    expect(filterByPoW(events, 8)).toHaveLength(0)
  })

  it('filters mixed set correctly', () => {
    const goodId = '00' + 'f'.repeat(62)
    const badId = 'ff' + '0'.repeat(62)
    const events = [{ id: goodId }, { id: badId }, { id: goodId }]
    expect(filterByPoW(events, 8)).toHaveLength(2)
  })

  it('difficulty 0 passes everything', () => {
    const events = [{ id: 'ff'.repeat(32) }]
    expect(filterByPoW(events, 0)).toHaveLength(1)
  })
})
