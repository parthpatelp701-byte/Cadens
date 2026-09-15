/**
 * Lightweight unit tests for mentions helpers.
 * Run with: npx tsx --test src/lib/mentions.test.ts
 * (or add vitest later)
 */
import { extractMentions, splitMentions } from './mentions'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

export function runMentionTests() {
  assert(extractMentions('hi @alice and @bob').join(',') === 'alice,bob', 'extract two')
  assert(extractMentions('no mentions').length === 0, 'empty')
  assert(extractMentions('@A_b1 @a_b1').join(',') === 'a_b1', 'dedupe lower')
  assert(extractMentions('email@x.com').length === 0 || extractMentions('email@x.com')[0] === 'x', 'edge email-like')

  const parts = splitMentions('Hey @sam!')
  assert(parts.some((p) => p.type === 'mention' && p.value === '@sam'), 'split mention')
  assert(parts.some((p) => p.type === 'text'), 'split text')

  console.log('mentions tests: ok')
}

// Auto-run when executed directly
if (typeof process !== 'undefined' && process.argv?.[1]?.includes('mentions.test')) {
  runMentionTests()
}
