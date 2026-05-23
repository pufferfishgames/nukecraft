# Nostr Map Format

**Protocol**: Nostr kind `30078`, d-tag `pufferfishgames/nukecraft`, NIP-13 PoW difficulty 8.  
**Relay**: `wss://nos.lol` (primary; damus.io + relay.nostr.band as fallback).  
**Identity**: passphrase → SHA256 → secp256k1 private key → public key (BIP-340 x-only).  
**Replaceable**: same pubkey + d-tag = one canonical map per user (cross-device sync).
**Label**: map events include a public `["label","<20 chars>"]` tag. Older unlabeled maps get a 20-character fallback label in-game.

## Content encoding

| Format | When used | Detection |
|--------|-----------|-----------|
| `[{x,y,z,type},…]` | UI saves (small maps) | JSON array of objects |
| `{"v":2,"data":"<gzip+base64>"}` | Generated/large maps | `v:2` field |

Binary packing: 6 bytes per block — `x` uint16-BE, `y` uint8, `z` uint16-BE, `type` uint8.  
Typical compression: 300k blocks → ~120 KB on wire.

## Generating large maps

```
node scripts/generate-maya-map.js
```

Publishes the Maya pyramids + Boeing 747 map to relays with passphrase `b747`.
Load in-game: enter passphrase → **↻ Fetch** → **Load**.

## Block types

`1` GRASS · `2` DIRT · `3` STONE · `4` SAND · `5` WATER  
`6` WOOD · `7` LEAVES · `8` STONE_BRICK · `9` CONCRETE · `10` GRAVEL · `11` NUKE
