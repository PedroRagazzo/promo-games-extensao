// Cache diário dos destaques de promoção, compartilhado entre o popup e o
// service worker (chrome.storage.local) para não repetir a mesma chamada de
// API várias vezes no mesmo dia.
import { getTopDeals } from "./itad-api.js";

const CACHE_PREFIX = "dailyDealsCache2:";

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Apaga caches de dias anteriores (e do formato antigo, "dailyDealsCache:").
async function pruneStaleCache() {
  const todayPrefix = `${CACHE_PREFIX}${todayKey()}:`;
  const all = await chrome.storage.local.get(null);
  const stale = Object.keys(all).filter(
    (key) => key.startsWith("dailyDealsCache") && !key.startsWith(todayPrefix)
  );
  if (stale.length) await chrome.storage.local.remove(stale);
}

/**
 * Retorna os destaques de hoje, usando cache local quando disponível.
 * @returns {Promise<Array>}
 */
export async function getDailyHighlights(apiKey, country, limit = 10) {
  const cacheKey = `${CACHE_PREFIX}${todayKey()}:${country}`;
  const stored = await chrome.storage.local.get(cacheKey);
  if (stored[cacheKey]) return stored[cacheKey];

  const deals = await getTopDeals(apiKey, country, limit);
  await chrome.storage.local.set({ [cacheKey]: deals });
  await pruneStaleCache();
  return deals;
}
