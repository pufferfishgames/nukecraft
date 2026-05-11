// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { passphraseToPrivkey, privkeyToPubkey } from '../nostr/identity.js'

describe('passphraseToPrivkey', () => {
  it('returns 64-char lowercase hex', () => {
    expect(passphraseToPrivkey('hello')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same passphrase yields same key', () => {
    expect(passphraseToPrivkey('hello')).toBe(passphraseToPrivkey('hello'))
  })

  it('different passphrases yield different keys', () => {
    expect(passphraseToPrivkey('foo')).not.toBe(passphraseToPrivkey('bar'))
  })

  it('accepts long passphrase', () => {
    const long = 'a'.repeat(1000)
    expect(passphraseToPrivkey(long)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('known vector: SHA256("abc") starts with ba7816bf', () => {
    expect(passphraseToPrivkey('abc').startsWith('ba7816bf')).toBe(true)
  })
})

describe('privkeyToPubkey', () => {
  it('returns 64-char lowercase hex', () => {
    const privkey = passphraseToPrivkey('test')
    expect(privkeyToPubkey(privkey)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    const privkey = passphraseToPrivkey('test')
    expect(privkeyToPubkey(privkey)).toBe(privkeyToPubkey(privkey))
  })

  it('different privkeys yield different pubkeys', () => {
    const a = privkeyToPubkey(passphraseToPrivkey('alice'))
    const b = privkeyToPubkey(passphraseToPrivkey('bob'))
    expect(a).not.toBe(b)
  })
})
