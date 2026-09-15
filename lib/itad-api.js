// Camada fina sobre a API v2 do IsThereAnyDeal (https://docs.isthereanydeal.com/).
const BASE_URL = "https://api.isthereanydeal.com";

// Lojas consideradas "oficiais" (do próprio publisher/plataforma).
// Todo o restante retornado pela API é tratado como revendedor terceiro.
export const OFFICIAL_SHOPS = new Set([
  "Steam",
  "Epic Game Store",
  "GOG",
  "Microsoft Store",
  "EA Store",
  "Ubisoft Store",
  "Blizzard",
  "Battle.net",
]);

export function isOfficialShop(shopName) {
  return OFFICIAL_SHOPS.has(shopName);
}

class ItadApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ItadApiError";
    this.status = status;
  }
}

async function itadFetch(path, { method = "GET", apiKey, query = {}, body } = {}) {
  const url = new URL(BASE_URL + path);
  if (apiKey) url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) url.searchParams.set(k, v.join(","));
    } else {
      url.searchParams.set(k, String(v));
    }
  }

  let res;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ItadApiError("Falha de rede ao contatar a API do IsThereAnyDeal.", 0);
  }

  if (!res.ok) {
    let reason = res.statusText;
    try {
      const data = await res.json();
      reason = data.reason_phrase || data.message || reason;
    } catch {
      /* corpo não era JSON, mantém statusText */
    }
    if (res.status === 403) {
      throw new ItadApiError(
        "Chave de API inválida ou ausente. Configure sua chave nas opções da extensão.",
        403
      );
    }
    throw new ItadApiError(`Erro da API (${res.status}): ${reason}`, res.status);
  }

  return res.json();
}

/**
 * Busca jogos pelo título.
 * @returns {Promise<Array<{id:string, slug:string, title:string, type:string, mature:boolean, assets:object}>>}
 */
export async function searchGames(apiKey, title, results = 10) {
  if (!title || !title.trim()) return [];
  return itadFetch("/games/search/v1", {
    apiKey,
    query: { title: title.trim(), results },
  });
}

/**
 * Busca preços/ofertas atuais para uma lista de IDs de jogo (UUIDs da ITAD).
 * @returns {Promise<Array<{id:string, historyLow:object, deals:Array}>>}
 */
export async function getPrices(apiKey, gameIds, country = "BR") {
  if (!gameIds || !gameIds.length) return [];
  return itadFetch("/games/prices/v3", {
    method: "POST",
    apiKey,
    query: { country, vouchers: true },
    body: gameIds,
  });
}

/**
 * Lista lojas ativas para um país. Endpoint público, não exige chave.
 * @returns {Promise<Array<{id:number, title:string, deals:number, games:number, update:string|null}>>}
 */
export async function getShops(country = "BR") {
  return itadFetch("/service/shops/v1", { query: { country } });
}

/**
 * Lista as ofertas atualmente em destaque (maior desconto primeiro), um jogo por vez.
 * Usada para os "destaques de hoje" no popup e na notificação diária.
 * @returns {Promise<Array<{id:string, slug:string, title:string, type:string, mature:boolean, assets:object, deal:object}>>}
 */
export async function getTopDeals(apiKey, country = "BR", limit = 10) {
  const res = await itadFetch("/deals/v2", {
    apiKey,
    query: { country, limit, sort: "-cut", mature: false },
  });
  return res.list || [];
}

export { ItadApiError };
