import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { buildPublishMessage, parseRelayMessage } from './relay.js'

export const PLAYER_PRESENCE_KIND = 30079
export const PLAYER_PRESENCE_TTL_SECONDS = 15
export const PLAYER_PRESENCE_EXPIRATION_SECONDS = 3 * 24 * 60 * 60
export const PLAYER_PRESENCE_DTAG_PREFIX = 'pufferfishgames/nukecraft/players'

export function createMapRef(event) {
  const dTag = event?.tags?.find((tag) => tag[0] === 'd')?.[1]
  if (event?.kind && event?.pubkey && dTag) return `${event.kind}:${event.pubkey}:${dTag}`
  if (event?.id) return `event:${event.id}`
  return 'builtin:default'
}

export function createContentMapRef(content) {
  const bytes = new TextEncoder().encode(String(content))
  return `content:${bytesToHex(sha256(bytes))}`
}

export function presenceDTag(mapRef) {
  return `${PLAYER_PRESENCE_DTAG_PREFIX}/${mapRef}`
}

export function buildPresenceSubscribeMessage(subscriptionId, mapRef, since = Math.floor(Date.now() / 1000) - PLAYER_PRESENCE_TTL_SECONDS) {
  return JSON.stringify([
    'REQ',
    subscriptionId,
    {
      kinds: [PLAYER_PRESENCE_KIND],
      '#d': [presenceDTag(mapRef)],
      since,
      limit: 100,
    },
  ])
}

export function createPresenceEvent(pubkey, mapRef, player, createdAt = Math.floor(Date.now() / 1000)) {
  const payload = {
    x: roundCoord(player.x),
    y: roundCoord(player.y),
    z: roundCoord(player.z),
    yaw: roundAngle(player.yaw ?? 0),
    pitch: roundAngle(player.pitch ?? 0),
    name: sanitizeName(player.name ?? pubkey.slice(0, 8)),
  }

  return {
    kind: PLAYER_PRESENCE_KIND,
    pubkey,
    created_at: createdAt,
    tags: [
      ['d', presenceDTag(mapRef)],
      ['a', mapRef],
      ['expiration', String(createdAt + PLAYER_PRESENCE_EXPIRATION_SECONDS)],
    ],
    content: JSON.stringify(payload),
  }
}

export function parsePresenceEvent(event, mapRef, now = Math.floor(Date.now() / 1000), selfPubkey = '') {
  if (!event || event.kind !== PLAYER_PRESENCE_KIND) return null
  if (selfPubkey && event.pubkey === selfPubkey) return null
  if (!event.tags?.some((tag) => tag[0] === 'd' && tag[1] === presenceDTag(mapRef))) return null
  if (!Number.isFinite(event.created_at) || now - event.created_at > PLAYER_PRESENCE_TTL_SECONDS) return null

  const expiresAt = Number(event.tags.find((tag) => tag[0] === 'expiration')?.[1] ?? 0)
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) return null

  let payload
  try {
    payload = JSON.parse(event.content)
  } catch {
    return null
  }

  if (!isFiniteNumber(payload.x) || !isFiniteNumber(payload.y) || !isFiniteNumber(payload.z)) return null

  return {
    pubkey: event.pubkey,
    eventId: event.id,
    x: payload.x,
    y: payload.y,
    z: payload.z,
    yaw: isFiniteNumber(payload.yaw) ? payload.yaw : 0,
    pitch: isFiniteNumber(payload.pitch) ? payload.pitch : 0,
    name: sanitizeName(payload.name ?? event.pubkey.slice(0, 8)),
    seenAt: event.created_at,
  }
}

export function latestPresenceByPubkey(events, mapRef, now = Math.floor(Date.now() / 1000), selfPubkey = '') {
  const latest = new Map()

  for (const event of events) {
    const player = parsePresenceEvent(event, mapRef, now, selfPubkey)
    if (!player) continue

    const current = latest.get(player.pubkey)
    const newer = !current ||
      player.seenAt > current.seenAt ||
      (player.seenAt === current.seenAt && (player.eventId ?? '') < (current.eventId ?? ''))
    if (newer) latest.set(player.pubkey, player)
  }

  return [...latest.values()].sort((a, b) => b.seenAt - a.seenAt || a.pubkey.localeCompare(b.pubkey))
}

export function publishPresence(relayUrl, event, { timeoutMs = 10_000 } = {}) {
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
      finish(false, new Error('presence publish timeout'))
    }, timeoutMs)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildPublishMessage(event))
    ws.onmessage = (message) => {
      ws.close()
      finish(true, parseRelayMessage(message.data))
    }
    ws.onerror = () => finish(false, new Error(`websocket error from ${relayUrl}`))
    ws.onclose = () => {
      if (!done) finish(false, new Error('presence relay closed unexpectedly'))
    }
  })
}

export function fetchPresence(relayUrl, mapRef, {
  now = Math.floor(Date.now() / 1000),
  selfPubkey = '',
  timeoutMs = 10_000,
} = {}) {
  return new Promise((resolve, reject) => {
    const events = []
    const subId = `players-${Math.random().toString(36).slice(2)}`
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
      finish(true, latestPresenceByPubkey(events, mapRef, Math.floor(Date.now() / 1000), selfPubkey))
    }, timeoutMs)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildPresenceSubscribeMessage(subId, mapRef, now - PLAYER_PRESENCE_TTL_SECONDS))
    ws.onmessage = (message) => {
      const parsed = parseRelayMessage(message.data)
      if (parsed.type === 'EVENT') events.push(parsed.event)
      if (parsed.type === 'EOSE') {
        ws.close()
        finish(true, latestPresenceByPubkey(events, mapRef, Math.floor(Date.now() / 1000), selfPubkey))
      }
    }
    ws.onerror = () => finish(false, new Error(`websocket error from ${relayUrl}`))
    ws.onclose = () => {
      if (!done) finish(true, latestPresenceByPubkey(events, mapRef, Math.floor(Date.now() / 1000), selfPubkey))
    }
  })
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function roundCoord(value) {
  return Math.round(Number(value) * 1000) / 1000
}

function roundAngle(value) {
  return Math.round(Number(value) * 10000) / 10000
}

function sanitizeName(value) {
  const name = String(value).trim().replace(/\s+/g, ' ').slice(0, 24)
  return name || 'player'
}
