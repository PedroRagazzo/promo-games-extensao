// Alertas de preço: jogos acompanhados e a regra que decide quando avisar.
const KEY = "watchlist";

/** @returns {Promise<Record<string, {id:string, title:string, thumb:string, targetPrice:number, currency:string, lastNotifiedPrice:number|null}>>} */
export async function getWatchlist() {
  const stored = await chrome.storage.local.get(KEY);
  return stored[KEY] || {};
}

export async function addAlert(game, targetPrice, currency) {
  const list = await getWatchlist();
  list[game.id] = {
    id: game.id,
    title: game.title,
    thumb: game.assets?.banner145 || game.assets?.boxart || "",
    targetPrice,
    currency,
    lastNotifiedPrice: null,
  };
  await chrome.storage.local.set({ [KEY]: list });
}

export async function removeAlert(gameId) {
  const list = await getWatchlist();
  delete list[gameId];
  await chrome.storage.local.set({ [KEY]: list });
}

export async function updateNotifiedPrices(updates) {
  const list = await getWatchlist();
  for (const [id, price] of Object.entries(updates)) {
    if (list[id]) list[id].lastNotifiedPrice = price;
  }
  await chrome.storage.local.set({ [KEY]: list });
}

/**
 * Decide quais alertas disparar. Só avisa de novo se o preço cair abaixo do
 * último preço avisado; quando o preço volta a ficar acima da meta, o alerta
 * é rearmado. Ofertas em outra moeda que a da meta são ignoradas.
 * @returns {{triggered: Array<{item:object, deal:object}>, updates: Record<string, number|null>}}
 */
export function evaluateAlerts(items, priceResults) {
  const triggered = [];
  const updates = {};

  for (const item of items) {
    const result = priceResults.find((r) => r.id === item.id);
    const deals = (result?.deals || []).filter((d) => d.price.currency === item.currency);
    if (!deals.length) continue;

    const cheapest = deals.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
    const amount = cheapest.price.amount;

    if (amount <= item.targetPrice) {
      if (item.lastNotifiedPrice == null || amount < item.lastNotifiedPrice) {
        triggered.push({ item, deal: cheapest });
        updates[item.id] = amount;
      }
    } else if (item.lastNotifiedPrice != null) {
      updates[item.id] = null;
    }
  }

  return { triggered, updates };
}
