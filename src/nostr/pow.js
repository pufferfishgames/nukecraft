import { getEventId } from './events.js'

export const MIN_POW_DIFFICULTY = 8

export function countLeadingZeroBits(hex) {
  let count = 0
  for (const char of hex) {
    const nibble = parseInt(char, 16)
    if (nibble === 0) {
      count += 4
    } else {
      if (nibble < 2) count += 3
      else if (nibble < 4) count += 2
      else if (nibble < 8) count += 1
      break
    }
  }
  return count
}

export function meetsPoW(eventId, difficulty) {
  return countLeadingZeroBits(eventId) >= difficulty
}

export function mineEvent(event, difficulty = MIN_POW_DIFFICULTY) {
  const baseTags = event.tags.filter((t) => t[0] !== 'nonce')
  for (let nonce = 0; ; nonce++) {
    const candidate = {
      ...event,
      tags: [...baseTags, ['nonce', String(nonce), String(difficulty)]],
    }
    const id = getEventId(candidate)
    if (meetsPoW(id, difficulty)) return { ...candidate, id }
  }
}
