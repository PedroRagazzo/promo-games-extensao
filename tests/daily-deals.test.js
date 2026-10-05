import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getDailyHighlights } from "../lib/daily-deals.js";

let store;
let fetchCalls;

beforeEach(() => {
  store = {};
  fetchCalls = 0;
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (key === null) return structuredClone(store);
          return { [key]: store[key] };
        },
        set: async (obj) => Object.assign(store, structuredClone(obj)),
        remove: async (keys) => {
          for (const k of [].concat(keys)) delete store[k];
        },
      },
    },
  };
  globalThis.fetch = async () => {
    fetchCalls++;
    return new Response(JSON.stringify({ list: [{ id: "g1", title: "Jogo" }] }), { status: 200 });
  };
});

const today = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test("busca na API na primeira vez e usa o cache nas seguintes", async () => {
  const first = await getDailyHighlights("KEY", "BR", 8);
  const second = await getDailyHighlights("KEY", "BR", 8);

  assert.deepEqual(first, [{ id: "g1", title: "Jogo" }]);
  assert.deepEqual(second, first);
  assert.equal(fetchCalls, 1);
});

test("países diferentes têm caches separados", async () => {
  await getDailyHighlights("KEY", "BR", 8);
  await getDailyHighlights("KEY", "US", 8);
  assert.equal(fetchCalls, 2);
});

test("apaga caches de dias anteriores e do formato antigo", async () => {
  store["dailyDealsCache2:2020-01-01:BR"] = [{ id: "velho" }];
  store["dailyDealsCache:2020-01-01:BR"] = [{ id: "formato-antigo" }];

  await getDailyHighlights("KEY", "BR", 8);

  assert.deepEqual(Object.keys(store).sort(), [`dailyDealsCache2:${today()}:BR`]);
});

test("mantém o cache de hoje de outros países ao podar", async () => {
  await getDailyHighlights("KEY", "US", 8);
  await getDailyHighlights("KEY", "BR", 8);

  assert.deepEqual(Object.keys(store).sort(), [
    `dailyDealsCache2:${today()}:BR`,
    `dailyDealsCache2:${today()}:US`,
  ]);
});

test("não mexe em dados que não são cache (alertas, URLs de notificação)", async () => {
  store.watchlist = { g1: { id: "g1" } };
  store["dealUrl:promo-games-g1"] = "https://oferta";

  await getDailyHighlights("KEY", "BR", 8);

  assert.deepEqual(store.watchlist, { g1: { id: "g1" } });
  assert.equal(store["dealUrl:promo-games-g1"], "https://oferta");
});
