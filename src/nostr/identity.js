import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { schnorr } from '@noble/curves/secp256k1.js'

export function passphraseToPrivkey(passphrase) {
  const bytes = sha256(new TextEncoder().encode(passphrase))
  return bytesToHex(bytes)
}

export function privkeyToPubkey(privkeyHex) {
  return bytesToHex(schnorr.getPublicKey(hexToBytes(privkeyHex)))
}
