import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAlerts,
  addAlert,
  removeAlert,
  getWatchlist,
  saveCheckResults,
} from "../lib/watchlist.js";

const deal = (shop, amount, currency = "BRL") => ({
  shop: { id: 1, name: shop },
  price: { amount, currency },
  url: `https://${shop}`,
});
const result = (id, ...deals) => ({ id, deals });
const item = (overrides = {}) => ({
  id: "g1",
  title: "Hades",
  targetPrice: 30,
  currency: "BRL",
  lastNotifiedPrice: null,
  ...overrides,
});

test("não dispara quando todas as ofertas estão acima da meta", () => {
  const r = evaluateAlerts([item()], [result("g1", deal("Steam", 40), deal("Nuuvem", 35))]);
  assert.equal(r.triggered.length, 0);
  assert.deepEqual(r.updates, {});
});

test("dispara com a oferta mais barata quando alguma loja chega na meta", () => {
  const r = evaluateAlerts([item()], [result("g1", deal("Steam", 29.9), deal("Nuuvem", 25))]);
  assert.equal(r.triggered.length, 1);
  assert.equal(r.triggered[0].deal.shop.name, "Nuuvem");
  assert.deepEqual(r.updates, { g1: 25 });
});

test("preço exatamente igual à meta dispara", () => {
  const r = evaluateAlerts([item()], [result("g1", deal("Steam", 30))]);
  assert.equal(r.triggered.length, 1);
});

test("não repete o aviso para o mesmo preço", () => {
  const r = evaluateAlerts([item({ lastNotifiedPrice: 25 })], [result("g1", deal("Nuuvem", 25))]);
  assert.equal(r.triggered.length, 0);
  assert.deepEqual(r.updates, {});
});

test("avisa de novo quando o preço cai ainda mais", () => {
  const r = evaluateAlerts([item({ lastNotifiedPrice: 25 })], [result("g1", deal("Nuuvem", 20))]);
  assert.equal(r.triggered.length, 1);
  assert.deepEqual(r.updates, { g1: 20 });
});

test("rearma o alerta quando o preço volta a ficar acima da meta", () => {
  const r = evaluateAlerts([item({ lastNotifiedPrice: 25 })], [result("g1", deal("Nuuvem", 50))]);
  assert.equal(r.triggered.length, 0);
  assert.deepEqual(r.updates, { g1: null });
});

test("ignora ofertas em moeda diferente da meta", () => {
  const r = evaluateAlerts([item()], [result("g1", deal("GreenManGaming", 5, "USD"))]);
  assert.equal(r.triggered.length, 0);
  assert.deepEqual(r.seen, {});
});

test("jogo sem resultado ou sem ofertas não dispara nem quebra", () => {
  assert.equal(evaluateAlerts([item()], []).triggered.length, 0);
  assert.equal(evaluateAlerts([item()], [result("g1")]).triggered.length, 0);
});

test("alertas de jogos diferentes são independentes", () => {
  const r = evaluateAlerts(
    [item(), item({ id: "g2", targetPrice: 10 })],
    [result("g1", deal("Steam", 20)), result("g2", deal("Steam", 15))]
  );
  assert.deepEqual(r.triggered.map((t) => t.item.id), ["g1"]);
});

test("seen traz o menor preço atual mesmo quando não dispara", () => {
  const r = evaluateAlerts([item()], [result("g1", deal("Steam", 40), deal("Nuuvem", 35))]);
  assert.deepEqual(r.seen, { g1: { amount: 35, shop: "Nuuvem" } });
});

// --- persistência (chrome.storage.local simulado em memória) ---

let store;
beforeEach(() => {
  store = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => ({ [key]: store[key] }),
        set: async (obj) => Object.assign(store, structuredClone(obj)),
      },
    },
  };
});

const game = { id: "g1", title: "Hades", assets: { banner145: "thumb.jpg" } };

test("addAlert guarda meta, moeda, miniatura e o preço visto na criação", async () => {
  await addAlert(game, 29.9, "BRL", { amount: 39.99, shop: "Steam" });
  const saved = (await getWatchlist()).g1;
  assert.equal(saved.title, "Hades");
  assert.equal(saved.thumb, "thumb.jpg");
  assert.equal(saved.targetPrice, 29.9);
  assert.equal(saved.currency, "BRL");
  assert.equal(saved.lastNotifiedPrice, null);
  assert.equal(saved.lastSeen.amount, 39.99);
  assert.equal(saved.lastSeen.shop, "Steam");
  assert.equal(typeof saved.lastSeen.at, "number");
});

test("addAlert sem preço visto deixa lastSeen nulo", async () => {
  await addAlert(game, 29.9, "BRL");
  assert.equal((await getWatchlist()).g1.lastSeen, null);
});

test("removeAlert remove só o jogo indicado", async () => {
  await addAlert(game, 10, "BRL");
  await addAlert({ id: "g2", title: "Outro" }, 20, "BRL");
  await removeAlert("g1");
  assert.deepEqual(Object.keys(await getWatchlist()), ["g2"]);
});

test("saveCheckResults atualiza último aviso e preço visto sem tocar nos outros jogos", async () => {
  await addAlert(game, 30, "BRL");
  await addAlert({ id: "g2", title: "Outro" }, 20, "BRL");
  await saveCheckResults({ g1: 25 }, { g1: { amount: 25, shop: "Nuuvem" } });

  const list = await getWatchlist();
  assert.equal(list.g1.lastNotifiedPrice, 25);
  assert.equal(list.g1.lastSeen.amount, 25);
  assert.equal(list.g2.lastNotifiedPrice, null);
  assert.equal(list.g2.lastSeen, null);
});

test("saveCheckResults ignora jogos removidos durante a checagem", async () => {
  await saveCheckResults({ ghost: 10 }, { ghost: { amount: 10, shop: "Steam" } });
  assert.deepEqual(await getWatchlist(), {});
});
