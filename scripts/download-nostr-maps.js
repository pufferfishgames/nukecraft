#!/usr/bin/env node
// Downloads importable Nukecraft map JSON files from Nostr.
// Run: node scripts/download-nostr-maps.js
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { passphraseToPrivkey, privkeyToPubkey } from '../src/nostr/identity.js'
import { decodeBlocks } from '../src/nostr/codec.js'
import { MIN_POW_DIFFICULTY, meetsPoW } from '../src/nostr/pow.js'
import { parseRelayMessage } from '../src/nostr/relay.js'
import { PASSPHRASE, RELAYS as DEFAULT_RELAYS } from './generate-machu-picchu-map.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')

const D_TAG = 'pufferfishgames/nukecraft'
const DEFAULT_OUTPUT_DIR = 'maps'
const DEFAULT_COUNT = 2
const OWN_PUBKEY = privkeyToPubkey(passphraseToPrivkey(PASSPHRASE))

function buildSubscribeMessage(subscriptionId, limit = 50) {
  return JSON.stringify([
    'REQ',
    subscriptionId,
    { kinds: [30078], '#d': [D_TAG], limit },
  ])
}

export function fetchRelayMaps(relayUrl, { timeoutMs = 15_000, limit = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const events = []
    const subId = `download-${Math.random().toString(36).slice(2)}`
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
      finish(true, events)
    }, timeoutMs)
    const ws = new WebSocket(relayUrl)

    ws.onopen = () => ws.send(buildSubscribeMessage(subId, limit))
    ws.onmessage = (message) => {
      const parsed = parseRelayMessage(message.data)
      if (parsed.type === 'EVENT') events.push(parsed.event)
      if (parsed.type === 'EOSE') {
        ws.close()
        finish(true, events)
      }
    }
    ws.onerror = () => finish(false, new Error(`websocket error from ${relayUrl}`))
    ws.onclose = () => finish(true, events)
  })
}

export async function downloadNostrMaps({
  count = DEFAULT_COUNT,
  outputDir = resolve(repoRoot, DEFAULT_OUTPUT_DIR),
  relays = DEFAULT_RELAYS,
  excludePubkeys = [OWN_PUBKEY],
} = {}) {
  await mkdir(outputDir, { recursive: true })

  const byId = new Map()
  for (const relay of relays) {
    try {
      const events = await fetchRelayMaps(relay)
      for (const event of events) byId.set(event.id, { ...event, relay })
    } catch {
      // Continue with any other reachable relay.
    }
  }

  const candidates = [...byId.values()]
    .filter((event) => !excludePubkeys.includes(event.pubkey))
    .filter((event) => meetsPoW(event.id, MIN_POW_DIFFICULTY))
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))

  const saved = []
  for (const event of candidates) {
    try {
      const blocks = await decodeBlocks(event.content)
      if (!Array.isArray(blocks) || blocks.length === 0) continue
      const filename = `nostr-${event.id.slice(0, 12)}.json`
      const path = resolve(outputDir, filename)
      await writeFile(path, `${event.content}\n`, 'utf8')
      saved.push({ path, event, blockCount: blocks.length })
      if (saved.length >= count) break
    } catch {
      // Skip malformed or unsupported map payloads.
    }
  }

  return saved
}

async function main() {
  const saved = await downloadNostrMaps()
  if (saved.length < DEFAULT_COUNT) {
    console.error(`Downloaded ${saved.length} valid map(s), expected ${DEFAULT_COUNT}.`)
    process.exit(1)
  }
  for (const item of saved) {
    console.log(`${item.path}  ${item.blockCount.toLocaleString()} blocks  ${item.event.id}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  await main()
}
