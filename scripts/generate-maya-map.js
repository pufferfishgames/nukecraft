#!/usr/bin/env node
// Generates a Maya/Aztec/Inca pyramid map and publishes it to Nostr.
// Run: node scripts/generate-maya-map.js
import { passphraseToPrivkey, privkeyToPubkey } from '../src/nostr/identity.js'
import { getEventId, signEvent } from '../src/nostr/events.js'
import { mineEvent, MIN_POW_DIFFICULTY, meetsPoW } from '../src/nostr/pow.js'
import { buildPublishMessage, parseRelayMessage } from '../src/nostr/relay.js'
import { encodeBlocks } from '../src/nostr/codec.js'

const PASSPHRASE = 'maya'
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

const B = {
  GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5,
  WOOD: 6, LEAVES: 7, STONE_BRICK: 8, CONCRETE: 9, GRAVEL: 10, NUKE: 11,
}

// ── Map generation ────────────────────────────────────────────────────────────

function generateMap() {
  const seen = new Map()
  const blocks = []

  function add(x, y, z, type) {
    if (x < 0 || y < 0 || z < 0) return
    const k = `${x},${y},${z}`
    if (seen.has(k)) return
    seen.set(k, true)
    blocks.push({ x, y, z, type })
  }

  // Ground — sand base covering the full site
  for (let x = 0; x <= 330; x++) {
    for (let z = 0; z <= 290; z++) {
      add(x, 0, z, B.SAND)
    }
  }

  // ── Maya pyramid — El Castillo (Chichen Itza) ─────────────────────────────
  // Solid step pyramid: 10 tiers, each 3 blocks tall, step=4 per side per tier
  // Center (80, 0, 80), base 81×81 (half=40), material STONE_BRICK
  {
    const cx = 80, cz = 80
    for (let tier = 0; tier < 10; tier++) {
      const half = 40 - tier * 4
      const yBase = tier * 3 + 1
      for (let y = yBase; y < yBase + 3; y++) {
        for (let dx = -half; dx <= half; dx++) {
          for (let dz = -half; dz <= half; dz++) {
            add(cx + dx, y, cz + dz, B.STONE_BRICK)
          }
        }
      }
    }
    // Temple on top (hollow box, y=31–35)
    for (let y = 31; y <= 35; y++) {
      for (let dx = -4; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
          if (y === 35 || y === 31 || Math.abs(dx) === 4 || Math.abs(dz) === 4) {
            add(cx + dx, y, cz + dz, B.STONE_BRICK)
          }
        }
      }
    }
    // Staircases on all four faces (stone strip up the center of each face)
    for (let tier = 0; tier < 10; tier++) {
      const half = 40 - tier * 4
      const yBase = tier * 3 + 1
      for (let y = yBase; y < yBase + 3; y++) {
        // North face
        add(cx, y, cz - half, B.CONCRETE)
        // South face
        add(cx, y, cz + half, B.CONCRETE)
        // West face
        add(cx - half, y, cz, B.CONCRETE)
        // East face
        add(cx + half, y, cz, B.CONCRETE)
      }
    }
  }

  // ── Aztec pyramid — Teotihuacan (Sun Pyramid) ─────────────────────────────
  // Solid step pyramid: 8 tiers, each 4 blocks tall, step=5 per side per tier
  // Center (250, 0, 80), base 81×81 (half=40), material STONE
  {
    const cx = 250, cz = 80
    for (let tier = 0; tier < 8; tier++) {
      const half = 40 - tier * 5
      if (half <= 0) break
      const yBase = tier * 4 + 1
      for (let y = yBase; y < yBase + 4; y++) {
        for (let dx = -half; dx <= half; dx++) {
          for (let dz = -half; dz <= half; dz++) {
            add(cx + dx, y, cz + dz, B.STONE)
          }
        }
      }
    }
    // Sacrificial altar on top (solid block, y=33–37)
    for (let y = 33; y <= 37; y++) {
      for (let dx = -5; dx <= 5; dx++) {
        for (let dz = -5; dz <= 5; dz++) {
          add(cx + dx, y, cz + dz, y >= 36 ? B.CONCRETE : B.STONE)
        }
      }
    }
    // Central staircase (north face)
    for (let tier = 0; tier < 8; tier++) {
      const half = 40 - tier * 5
      if (half <= 0) break
      const yBase = tier * 4 + 1
      for (let y = yBase; y < yBase + 4; y++) {
        for (let dz = -2; dz <= 2; dz++) {
          add(cx + dz, y, cz - half, B.CONCRETE)
        }
      }
    }
  }

  // ── Inca terraces — Machu Picchu style ───────────────────────────────────
  // Rectangular terraced platform: 10 levels, each 2 blocks tall
  // Center (165, 0, 220), halfX=50-5*level, halfZ=25-2*level, material GRAVEL
  {
    const cx = 165, cz = 220
    for (let level = 0; level < 10; level++) {
      const halfX = 50 - level * 5
      const halfZ = 25 - level * 2
      if (halfX <= 0 || halfZ <= 0) break
      const yBase = level * 2 + 1
      for (let y = yBase; y < yBase + 2; y++) {
        for (let dx = -halfX; dx <= halfX; dx++) {
          for (let dz = -halfZ; dz <= halfZ; dz++) {
            add(cx + dx, y, cz + dz, B.GRAVEL)
          }
        }
      }
    }
    // Stone walls and buildings on the summit (level 10 area)
    const topY = 21
    for (let y = topY; y < topY + 4; y++) {
      for (let dx = -8; dx <= 8; dx++) {
        for (let dz = -4; dz <= 4; dz++) {
          if (Math.abs(dx) === 8 || Math.abs(dz) === 4) {
            add(cx + dx, y, cz + dz, B.STONE)
          }
        }
      }
    }
    // Interior buildings
    for (let y = topY; y < topY + 3; y++) {
      for (let dx = -6; dx <= -3; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 6 || Math.abs(dx) === 3 || Math.abs(dz) === 2) {
            add(cx + dx, y, cz + dz, B.STONE)
          }
        }
      }
      for (let dx = 3; dx <= 6; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 6 || Math.abs(dx) === 3 || Math.abs(dz) === 2) {
            add(cx + dx, y, cz + dz, B.STONE)
          }
        }
      }
    }
  }

  // ── Stone roads connecting the three sites ────────────────────────────────
  function road(x0, z0, x1, z1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 2
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(x0 + (x1 - x0) * t / steps)
      const z = Math.round(z0 + (z1 - z0) * t / steps)
      for (let d = -1; d <= 1; d++) {
        add(x, 1, z + d, B.CONCRETE)
        add(x + d, 1, z, B.CONCRETE)
      }
    }
  }
  // Maya (80,80) ↔ Aztec (250,80)
  road(121, 80, 209, 80)
  // Maya (80,80) ↔ Inca (165,220)
  road(80, 121, 165, 179)
  // Aztec (250,80) ↔ Inca (165,220)
  road(250, 121, 165, 179)

  // ── Jungle trees (deterministic, scattered around structures) ─────────────
  for (let i = 0; i < 400; i++) {
    const tx = ((i * 317 + 89) % 320) + 5
    const tz = ((i * 431 + 53) % 270) + 5
    const dm = Math.abs(tx - 80) + Math.abs(tz - 80)
    const da = Math.abs(tx - 250) + Math.abs(tz - 80)
    const di = Math.abs(tx - 165) + Math.abs(tz - 220)
    if (dm < 55 || da < 55 || di < 45) continue
    // Trunk
    for (let y = 1; y <= 6; y++) add(tx, y, tz, B.WOOD)
    // Canopy
    for (let dy = 0; dy <= 5; dy++) {
      const r = Math.max(0, 3 - Math.abs(dy - 2))
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= r + 1) {
            add(tx + dx, 6 + dy, tz + dz, B.LEAVES)
          }
        }
      }
    }
  }

  return blocks
}

// ── Nostr publishing ──────────────────────────────────────────────────────────

function publishToRelay(relayUrl, signedEvent) {
  return new Promise((resolve, reject) => {
    let done = false
    const finish = (ok, val) => { if (!done) { done = true; ok ? resolve(val) : reject(val) } }
    const timer = setTimeout(() => finish(false, new Error('relay timeout')), 30_000)

    const ws = new WebSocket(relayUrl)
    ws.onopen = () => ws.send(buildPublishMessage(signedEvent))
    ws.onmessage = (e) => {
      clearTimeout(timer)
      ws.close()
      finish(true, parseRelayMessage(e.data))
    }
    ws.onerror = (e) => { clearTimeout(timer); finish(false, e) }
    ws.onclose = (e) => { clearTimeout(timer); if (!done) finish(false, new Error('relay closed unexpectedly')) }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

const privkey = passphraseToPrivkey(PASSPHRASE)
const pubkey = privkeyToPubkey(privkey)

console.log(`Identity: pubkey ${pubkey.slice(0, 16)}… (passphrase: "${PASSPHRASE}")`)
console.log('Generating pyramids…')

const blocks = generateMap()
console.log(`Blocks generated: ${blocks.length.toLocaleString()}`)

console.log('Encoding (gzip+base64)…')
const content = await encodeBlocks(blocks)
const contentKB = (content.length / 1024).toFixed(1)
console.log(`Encoded content size: ${contentKB} KB`)

const baseEvent = {
  kind: 30078,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: [['d', 'pufferfishgames/nukecraft']],
  content,
}

console.log(`Mining PoW (difficulty ${MIN_POW_DIFFICULTY})…`)
const mined = mineEvent(baseEvent, MIN_POW_DIFFICULTY)
const signed = signEvent(mined, privkey)
console.log(`Event id: ${signed.id}  PoW: ${signed.id.match(/^0*/)[0].length * 4} bits`)

let published = false
for (const relay of RELAYS) {
  process.stdout.write(`Publishing to ${relay}… `)
  try {
    const result = await publishToRelay(relay, signed)
    if (result.type === 'OK' && result.accepted) {
      console.log('✓ accepted')
      published = true
    } else if (result.type === 'OK' && !result.accepted) {
      console.log(`✗ rejected: ${result.message}`)
    } else {
      console.log(`? ${JSON.stringify(result)}`)
    }
  } catch (err) {
    console.log(`✗ error: ${err.message}`)
  }
}

if (!published) {
  console.error('\nFailed to publish to any relay. Event id for manual republishing:')
  console.error(signed.id)
  process.exit(1)
}
console.log('\nDone. Load in-game with passphrase "maya" → ↻ Fetch → Load.')
