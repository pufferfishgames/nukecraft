import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { schnorr } from '@noble/curves/secp256k1.js'

export const MAP_LABEL_LENGTH = 20
export const MAP_LABEL_TAG = 'label'

export function normalizeMapLabel(label, fallback = 'Untitled Nukecraft') {
  const clean = String(label ?? '').replace(/\s+/g, ' ').trim()
  const base = clean || fallback
  return base.slice(0, MAP_LABEL_LENGTH).padEnd(MAP_LABEL_LENGTH, ' ')
}

export function getMapLabel(event) {
  const labelTag = event.tags?.find((tag) =>
    tag[0] === MAP_LABEL_TAG ||
    tag[0] === 'title' ||
    tag[0] === 'name',
  )
  const fallbackId = event.id?.slice(0, 16) ?? event.pubkey?.slice(0, 16) ?? 'unknown'
  return normalizeMapLabel(labelTag?.[1], `Map ${fallbackId}`)
}

export function createMapEvent(pubkey, content, { label } = {}) {
  return {
    kind: 30078,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', 'pufferfishgames/nukecraft'],
      [MAP_LABEL_TAG, normalizeMapLabel(label)],
    ],
    content,
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
