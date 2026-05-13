import { BlockType } from '../game/world.js'
import { buildPublishMessage, parseRelayMessage } from './relay.js'

export const BLOCK_EDIT_KIND = 1078
export const BLOCK_EDIT_EXPIRATION_SECONDS = 3 * 24 * 60 * 60

const VALID_BLOCK_TYPES = new Set(Object.values(BlockType).filter((type) => type !== BlockType.AIR))

export function buildBlockEditSubscribeMessage(subscriptionId, mapRef, since = Math.floor(Date.now() / 1000) - BLOCK_EDIT_EXPIRATION_SECONDS) {
  return JSON.stringify([
    'REQ',
    subscriptionId,
    {
      kinds: [BLOCK_EDIT_KIND],
      '#a': [mapRef],
      since,
      limit: 1000,
    },
  ])
}

export function createBlockEditEvent(pubkey, mapRef, edits, createdAt = Math.floor(Date.now() / 1000), timestampMs = Date.now()) {
  const ops = (Array.isArray(edits) ? edits : [edits]).map(sanitizeOutgoingEdit)

  return {
    kind: BLOCK_EDIT_KIND,
    pubkey,
    created_at: createdAt,
    tags: [
      ['a', mapRef],
      ['expiration', String(createdAt + BLOCK_EDIT_EXPIRATION_SECONDS)],
    ],
    content: JSON.stringify({ v: 1, ts: Math.round(timestampMs), ops }),
  }
}

export function parseBlockEditEvent(event, mapRef, now = Math.floor(Date.now() / 1000)) {
  if (!event || event.kind !== BLOCK_EDIT_KIND) return []
  if (!event.tags?.some((tag) => tag[0] === 'a' && tag[1] === mapRef)) return []
  if (!Number.isFinite(event.created_at)) return []

  const expiresAt = Number(event.tags.find((tag) => tag[0] === 'expiration')?.[1] ?? 0)
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) return []

  let payload
  try {
    payload = JSON.parse(event.content)
  } catch {
    return []
  }

  const timestampMs = Number.isFinite(payload.ts) ? Math.round(payload.ts) : event.created_at * 1000
  const rawOps = Array.isArray(payload.ops) ? payload.ops : []
  const parsed = []
  for (let order = 0; order < rawOps.length; order++) {
    const op = sanitizeIncomingEdit(rawOps[order])
    if (!op) continue
    parsed.push({
      ...op,
      pubkey: event.pubkey,
      eventId: event.id,
      createdAt: event.created_at,
      timestampMs,
      order,
    })
  }
  return parsed
}

export function latestBlockEditsByPosition(events, mapRef, now = Math.floor(Date.now() / 1000)) {
  const latest = new Map()

  for (const event of events) {
    for (const edit of parseBlockEditEvent(event, mapRef, now)) {
      const key = blockPositionKey(edit)
      const current = latest.get(key)
      if (!current || isNewerEdit(edit, current)) latest.set(key, edit)
    }
  }

  return [...latest.values()].sort((a, b) =>
    a.x - b.x || a.y - b.y || a.z - b.z,
  )
}

export function publishBlockEdit(relayUrl, event, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (ok, val) => {
      if (!done) {
        done = true
        clearTimeout(timer)
        ok ? resolve(val) : reject(val)
      }
    }
    const timer = setTimeout(() => {
      ws.close()
      finish(false, new Error('block edit publish timeout'))
    }, timeoutMs)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildPublishMessage(event))
    ws.onmessage = (message) => {
      ws.close()
      finish(true, parseRelayMessage(message.data))
    }
    ws.onerror = () => finish(false, new Error(`websocket error from ${relayUrl}`))
    ws.onclose = () => {
      if (!done) finish(false, new Error('block edit relay closed unexpectedly'))
    }
  })
}

export function fetchBlockEdits(relayUrl, mapRef, {
  now = Math.floor(Date.now() / 1000),
  timeoutMs = 10_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const events = []
    const subId = `blocks-${Math.random().toString(36).slice(2)}`
    let done = false
    const finish = (ok, val) => {
      if (!done) {
        done = true
        clearTimeout(timer)
        ok ? resolve(val) : reject(val)
      }
    }
    const resolveLatest = () => latestBlockEditsByPosition(events, mapRef, Math.floor(Date.now() / 1000))
    const timer = setTimeout(() => {
      ws.close()
      finish(true, resolveLatest())
    }, timeoutMs)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildBlockEditSubscribeMessage(subId, mapRef, now - BLOCK_EDIT_EXPIRATION_SECONDS))
    ws.onmessage = (message) => {
      const parsed = parseRelayMessage(message.data)
      if (parsed.type === 'EVENT') events.push(parsed.event)
      if (parsed.type === 'EOSE') {
        ws.close()
        finish(true, resolveLatest())
      }
    }
    ws.onerror = () => finish(false, new Error(`websocket error from ${relayUrl}`))
    ws.onclose = () => {
      if (!done) finish(true, resolveLatest())
    }
  })
}

function blockPositionKey(edit) {
  return `${edit.x},${edit.y},${edit.z}`
}

function isNewerEdit(a, b) {
  if (a.timestampMs !== b.timestampMs) return a.timestampMs > b.timestampMs
  if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt
  if ((a.eventId ?? '') !== (b.eventId ?? '')) return (a.eventId ?? '') < (b.eventId ?? '')
  return a.order > b.order
}

function sanitizeOutgoingEdit(edit) {
  const sanitized = sanitizeIncomingEdit(edit)
  if (!sanitized) throw new Error('invalid block edit')
  return sanitized
}

function sanitizeIncomingEdit(edit) {
  if (!edit || !isCoord(edit.x) || !isCoord(edit.y, 255) || !isCoord(edit.z)) return null

  if (edit.op === 'remove') {
    return { op: 'remove', x: edit.x, y: edit.y, z: edit.z }
  }

  if (edit.op === 'add' && VALID_BLOCK_TYPES.has(edit.type)) {
    return { op: 'add', x: edit.x, y: edit.y, z: edit.z, type: edit.type }
  }

  return null
}

function isCoord(value, max = 65_535) {
  return Number.isInteger(value) && value >= 0 && value <= max
}
