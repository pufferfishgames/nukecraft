import { meetsPoW } from './pow.js'
import { getMapLabel } from './events.js'

export function buildPublishMessage(event) {
  return JSON.stringify(['EVENT', event])
}

export function buildSubscribeMessage(subscriptionId) {
  return JSON.stringify([
    'REQ',
    subscriptionId,
    { kinds: [30078], '#d': ['pufferfishgames/nukecraft'] },
  ])
}

export function parseRelayMessage(raw) {
  const msg = JSON.parse(raw)
  switch (msg[0]) {
    case 'EVENT':
      return { type: 'EVENT', subscriptionId: msg[1], event: msg[2] }
    case 'EOSE':
      return { type: 'EOSE', subscriptionId: msg[1] }
    case 'NOTICE':
      return { type: 'NOTICE', message: msg[1] }
    case 'OK':
      return { type: 'OK', eventId: msg[1], accepted: msg[2], message: msg[3] }
    default:
      return { type: msg[0] }
  }
}

export function filterByPoW(events, difficulty) {
  return events.filter((e) => meetsPoW(e.id, difficulty))
}

export function withMapLabel(event) {
  return { ...event, label: getMapLabel(event) }
}

export async function publishMap(relayUrl, event) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl)
    ws.onopen = () => ws.send(buildPublishMessage(event))
    ws.onmessage = (e) => {
      ws.close()
      resolve(parseRelayMessage(e.data))
    }
    ws.onerror = (err) => reject(err)
    ws.onclose = (e) => { if (!e.wasClean) reject(new Error('ws closed unexpectedly')) }
  })
}

export async function fetchMaps(relayUrl, difficulty = MIN_POW_DIFFICULTY) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl)
    const events = []
    const subId = Math.random().toString(36).slice(2)

    ws.onopen = () => ws.send(buildSubscribeMessage(subId))
    ws.onmessage = (e) => {
      const msg = parseRelayMessage(e.data)
      if (msg.type === 'EVENT' && meetsPoW(msg.event.id, difficulty)) {
        events.push(withMapLabel(msg.event))
      } else if (msg.type === 'EOSE') {
        ws.close()
        resolve(events)
      }
    }
    ws.onerror = (err) => reject(err)
  })
}
