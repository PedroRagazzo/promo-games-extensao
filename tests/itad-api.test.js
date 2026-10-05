import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getTopDeals, searchGames, getPrices, isOfficialShop } from "../lib/itad-api.js";

let calls;
let responder;

beforeEach(() => {
  calls = [];
  responder = () => new Response("{}", { status: 200 });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return responder(calls.length);
  };
});

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("getTopDeals pede só jogos bem avaliados, ordenados por desconto", async () => {
  responder = () => json({ list: [{ id: "g1" }] });
  const out = await getTopDeals("KEY", "BR", 8);

  assert.deepEqual(out, [{ id: "g1" }]);
  assert.equal(calls.length, 1);
  const u = calls[0].url;
  assert.equal(u.pathname, "/deals/v2");
  assert.equal(u.searchParams.get("key"), "KEY");
  assert.equal(u.searchParams.get("country"), "BR");
  assert.equal(u.searchParams.get("limit"), "8");
  assert.equal(u.searchParams.get("sort"), "-cut");
  assert.equal(u.searchParams.get("mature"), "false");
  assert.deepEqual(JSON.parse(u.searchParams.get("filter")), {
    type: [1],
    cut: { min: 30, max: null },
    steamPerc: { min: 80, max: null },
    steamCount: { min: 500, max: null },
  });
});

test("getTopDeals cai para o filtro só-jogos quando o estrito vem vazio", async () => {
  responder = (n) => json({ list: n === 1 ? [] : [{ id: "g2" }] });
  const out = await getTopDeals("KEY", "BR", 8);

  assert.deepEqual(out, [{ id: "g2" }]);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[1].url.searchParams.get("filter")), { type: [1] });
});

test("getTopDeals devolve lista vazia se nenhum filtro encontrar ofertas", async () => {
  responder = () => json({ list: [] });
  assert.deepEqual(await getTopDeals("KEY", "BR", 8), []);
  assert.equal(calls.length, 2);
});

test("searchGames coloca jogos antes de pacotes e DLCs, mantendo a relevância dentro do grupo", async () => {
  responder = () =>
    json([
      { id: "1", title: "Hades Soundtrack", type: "dlc" },
      { id: "2", title: "Hades", type: "game" },
      { id: "3", title: "Hades Bundle", type: "package" },
      { id: "4", title: "Hades II", type: "game" },
      { id: "5", title: "Outro", type: null },
    ]);
  const out = await searchGames("KEY", "hades");
  assert.deepEqual(out.map((g) => g.id), ["2", "4", "3", "1", "5"]);
});

test("searchGames não chama a API com título vazio", async () => {
  assert.deepEqual(await searchGames("KEY", "   "), []);
  assert.equal(calls.length, 0);
});

test("getPrices envia os IDs no corpo (POST) e o país na query", async () => {
  responder = () => json([]);
  await getPrices("KEY", ["a", "b"], "BR");

  const { url, init } = calls[0];
  assert.equal(url.pathname, "/games/prices/v3");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), ["a", "b"]);
  assert.equal(url.searchParams.get("country"), "BR");
});

test("getPrices sem IDs não chama a API", async () => {
  assert.deepEqual(await getPrices("KEY", [], "BR"), []);
  assert.equal(calls.length, 0);
});

test("chave inválida (403) vira mensagem orientando a configurar a chave", async () => {
  responder = () => json({ status_code: 403, reason_phrase: "Missing api key" }, 403);
  await assert.rejects(() => searchGames("", "hades"), /Chave de API inválida/);
});

test("falha de rede vira mensagem clara", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(() => searchGames("KEY", "hades"), /Falha de rede/);
});

test("isOfficialShop separa lojas oficiais de revendedores", () => {
  assert.equal(isOfficialShop("Steam"), true);
  assert.equal(isOfficialShop("Epic Game Store"), true);
  assert.equal(isOfficialShop("Nuuvem"), false);
  assert.equal(isOfficialShop("GreenManGaming"), false);
});
