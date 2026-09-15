// Cache diário dos destaques de promoção, compartilhado entre o popup e o
// service worker (chrome.storage.local) para não repetir a mesma chamada de
// API várias vezes no mesmo dia.
import { getTopDeals } from "./itad-api.js";

const CACHE_PREFIX = "dailyDealsCache:";

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  return deals;
}
