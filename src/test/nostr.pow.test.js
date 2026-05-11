// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { countLeadingZeroBits, meetsPoW, mineEvent, MIN_POW_DIFFICULTY } from '../nostr/pow.js'

describe('countLeadingZeroBits', () => {
  it('all f — zero leading bits', () => {
    expect(countLeadingZeroBits('f' + 'f'.repeat(63))).toBe(0)
  })

  it('leading 0-nibble counts 4 bits', () => {
    expect(countLeadingZeroBits('0f' + '0'.repeat(62))).toBe(4)
  })

  it('two leading zero nibbles counts 8 bits', () => {
    expect(countLeadingZeroBits('00' + 'f'.repeat(62))).toBe(8)
  })

  it('1xxx nibble counts 3 bits', () => {
    expect(countLeadingZeroBits('1' + 'f'.repeat(63))).toBe(3)
  })

  it('2xxx nibble counts 2 bits', () => {
    expect(countLeadingZeroBits('2' + 'f'.repeat(63))).toBe(2)
  })

  it('4xxx nibble counts 1 bit', () => {
    expect(countLeadingZeroBits('4' + 'f'.repeat(63))).toBe(1)
  })

  it('all zeros — 256 bits', () => {
    expect(countLeadingZeroBits('0'.repeat(64))).toBe(256)
  })
})

describe('meetsPoW', () => {
  it('accepts id with exactly enough leading zero bits', () => {
    expect(meetsPoW('00' + 'f'.repeat(62), 8)).toBe(true)
  })

  it('accepts id with more than enough leading zero bits', () => {
    expect(meetsPoW('0000' + 'f'.repeat(60), 8)).toBe(true)
  })

  it('rejects id with too few leading zero bits', () => {
    expect(meetsPoW('ff' + '0'.repeat(62), 8)).toBe(false)
  })

  it('difficulty 0 always passes', () => {
    expect(meetsPoW('ff'.repeat(32), 0)).toBe(true)
  })
})

describe('MIN_POW_DIFFICULTY', () => {
  it('is a positive number', () => {
    expect(typeof MIN_POW_DIFFICULTY).toBe('number')
    expect(MIN_POW_DIFFICULTY).toBeGreaterThan(0)
  })
})

describe('mineEvent', () => {
  const baseEvent = {
    kind: 30078,
    pubkey: '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
    created_at: 1000000000,
    tags: [['d', 'pufferfishgames/nukecraft']],
    content: '[]',
  }

  it('returns event with a nonce tag', () => {
    const mined = mineEvent(baseEvent, 4)
    expect(mined.tags.some((t) => t[0] === 'nonce')).toBe(true)
  })

  it('nonce tag records target difficulty', () => {
    const mined = mineEvent(baseEvent, 4)
    const nonce = mined.tags.find((t) => t[0] === 'nonce')
    expect(nonce[2]).toBe('4')
  })

  it('mined id meets the requested difficulty', () => {
    const mined = mineEvent(baseEvent, 4)
    expect(meetsPoW(mined.id, 4)).toBe(true)
  })

  it('preserves original tags alongside nonce', () => {
    const mined = mineEvent(baseEvent, 4)
    expect(mined.tags.some((t) => t[0] === 'd')).toBe(true)
  })

  it('does not mutate original event', () => {
    const original = { ...baseEvent, tags: [...baseEvent.tags] }
    mineEvent(baseEvent, 4)
    expect(baseEvent.tags).toEqual(original.tags)
  })
})
