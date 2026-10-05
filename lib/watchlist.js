// Alertas de preço: jogos acompanhados e a regra que decide quando avisar.
const KEY = "watchlist";

/**
 * lastSeen = menor preço visto na última checagem (ou na criação do alerta).
 * @returns {Promise<Record<string, {id:string, title:string, thumb:string, targetPrice:number, currency:string, lastNotifiedPrice:number|null, lastSeen:{amount:number, shop:string, at:number}|null}>>}
 */
export async function getWatchlist() {
  const stored = await chrome.storage.local.get(KEY);
  return stored[KEY] || {};
}

export async function addAlert(game, targetPrice, currency, seen = null) {
  const list = await getWatchlist();
  list[game.id] = {
    id: game.id,
    title: game.title,
    thumb: game.assets?.banner145 || game.assets?.boxart || "",
    targetPrice,
    currency,
    lastNotifiedPrice: null,
    lastSeen: seen ? { ...seen, at: Date.now() } : null,
  };
  await chrome.storage.local.set({ [KEY]: list });
}

export async function removeAlert(gameId) {
  const list = await getWatchlist();
  delete list[gameId];
  await chrome.storage.local.set({ [KEY]: list });
}

export async function saveCheckResults(updates, seen) {
  const list = await getWatchlist();
  const at = Date.now();
  for (const item of Object.values(list)) {
    if (item.id in updates) item.lastNotifiedPrice = updates[item.id];
    if (seen[item.id]) item.lastSeen = { ...seen[item.id], at };
  }
  await chrome.storage.local.set({ [KEY]: list });
}

/**
 * Decide quais alertas disparar. Só avisa de novo se o preço cair abaixo do
 * último preço avisado; quando o preço volta a ficar acima da meta, o alerta
 * é rearmado. Ofertas em outra moeda que a da meta são ignoradas.
 * `seen` traz o menor preço atual de cada jogo (na moeda da meta), para exibir na lista.
 * @returns {{triggered: Array<{item:object, deal:object}>, updates: Record<string, number|null>, seen: Record<string, {amount:number, shop:string}>}}
 */
export function evaluateAlerts(items, priceResults) {
  const triggered = [];
  const updates = {};
  const seen = {};

  for (const item of items) {
    const result = priceResults.find((r) => r.id === item.id);
    const deals = (result?.deals || []).filter((d) => d.price.currency === item.currency);
    if (!deals.length) continue;

    const cheapest = deals.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
    const amount = cheapest.price.amount;
    seen[item.id] = { amount, shop: cheapest.shop.name };

    if (amount <= item.targetPrice) {
      if (item.lastNotifiedPrice == null || amount < item.lastNotifiedPrice) {
        triggered.push({ item, deal: cheapest });
        updates[item.id] = amount;
      }
    } else if (item.lastNotifiedPrice != null) {
      updates[item.id] = null;
    }
  }

  return { triggered, updates, seen };
}
