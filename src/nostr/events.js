import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { schnorr } from '@noble/curves/secp256k1.js'

export function createMapEvent(pubkey, blocks) {
  return {
    kind: 30078,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', 'pufferfishgames/nukecraft']],
    content: JSON.stringify(blocks),
  }
}

export function serializeEvent(event) {
  return JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content])
}

export function getEventId(event) {
  const hash = sha256(new TextEncoder().encode(serializeEvent(event)))
  return bytesToHex(hash)
}

export function signEvent(event, privkeyHex) {
  const id = getEventId(event)
  const sig = schnorr.sign(hexToBytes(id), hexToBytes(privkeyHex))
  return { ...event, id, sig: bytesToHex(sig) }
}
