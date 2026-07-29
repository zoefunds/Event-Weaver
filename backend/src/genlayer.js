import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { config } from './config.js';

/** Read-only GenLayer client for indexing StudioNet contract state. */
const client = createClient({ chain: studionet });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  return /rate limit/i.test(err?.message ?? err?.details ?? String(err));
}

/**
 * StudioNet's RPC enforces a hard 30 requests/minute cap. User-facing routes
 * that fan out into several live reads per request (e.g. portfolio: 2 reads
 * plus 3 per position) can trip it on their own, especially layered on top
 * of the indexer/resolver's own polling — surfacing as a hard failure on
 * an otherwise ordinary page load. Retry rate-limit errors a few times with
 * backoff before giving up; anything else fails immediately as before.
 */
export async function readContract(functionName, args = [], attempt = 0) {
  try {
    return await client.readContract({
      address: config.contractAddress,
      functionName,
      args,
    });
  } catch (err) {
    if (isRateLimitError(err) && attempt < 3) {
      await sleep(500 * 2 ** attempt);
      return readContract(functionName, args, attempt + 1);
    }
    throw err;
  }
}

/** Normalize genlayer-js return values (Maps/BigInts) into plain JSON. */
export function plain(value) {
  if (value instanceof Map) {
    const obj = {};
    for (const [k, v] of value.entries()) obj[k] = plain(v);
    return obj;
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  }
  if (value && typeof value === 'object') {
    const obj = {};
    for (const [k, v] of Object.entries(value)) obj[k] = plain(v);
    return obj;
  }
  return value;
}
