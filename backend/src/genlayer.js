import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { config } from './config.js';

/** Read-only GenLayer client for indexing StudioNet contract state. */
const client = createClient({ chain: studionet });

export async function readContract(functionName, args = []) {
  return client.readContract({
    address: config.contractAddress,
    functionName,
    args,
  });
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
