import { searchGames, getPrices, isOfficialShop } from "../lib/itad-api.js";
import { getSettings } from "../lib/settings.js";
import { getDailyHighlights } from "../lib/daily-deals.js";
import { getWatchlist, addAlert, removeAlert } from "../lib/watchlist.js";

const VIEWS = ["noKeyView", "searchView", "dealsView", "alertsView"];

const els = {
  noKeyView: document.getElementById("noKeyView"),
  searchView: document.getElementById("searchView"),
  dealsView: document.getElementById("dealsView"),
  alertsView: document.getElementById("alertsView"),
  goToOptionsBtn: document.getElementById("goToOptionsBtn"),
  openOptions: document.getElementById("openOptions"),
  openAlerts: document.getElementById("openAlerts"),
  alertsBackBtn: document.getElementById("alertsBackBtn"),
  alertsStatus: document.getElementById("alertsStatus"),
  alertsList: document.getElementById("alertsList"),
  watchPanel: document.getElementById("watchPanel"),
  searchForm: document.getElementById("searchForm"),
  searchInput: document.getElementById("searchInput"),
  resultsHeading: document.getElementById("resultsHeading"),
  showHighlightsBtn: document.getElementById("showHighlightsBtn"),
  statusMsg: document.getElementById("statusMsg"),
  resultsList: document.getElementById("resultsList"),
  backBtn: document.getElementById("backBtn"),
  gameHeader: document.getElementById("gameHeader"),
  dealsStatus: document.getElementById("dealsStatus"),
  dealsList: document.getElementById("dealsList"),
  historyLowNote: document.getElementById("historyLowNote"),
};

let settings = null;
let dealsReturnView = "searchView";

function showView(name) {
  for (const key of VIEWS) {
    els[key].hidden = key !== name;
  }
}

function currentViewName() {
  return VIEWS.find((key) => !els[key].hidden);
}

function setStatus(el, message, { error = false, loading = false } = {}) {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.classList.toggle("error", error);
  el.innerHTML = loading ? `<span class="spinner"></span>${message}` : message;
}

function formatMoney(price) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: price.currency,
    }).format(price.amount);
  } catch {
    return `${price.amount.toFixed(2)} ${price.currency}`;
  }
}

function createDealCard(deal, { bestPrice = false } = {}) {
  const li = document.createElement("li");
  li.className = "deal-item" + (bestPrice ? " best" : "");

  const topRow = document.createElement("div");
  topRow.className = "deal-top-row";

  const shopName = document.createElement("span");
  shopName.className = "deal-shop-name";
  shopName.textContent = deal.shop.name;
  topRow.appendChild(shopName);

  const officialBadge = document.createElement("span");
  officialBadge.className = "badge " + (isOfficialShop(deal.shop.name) ? "official" : "third-party");
  officialBadge.textContent = isOfficialShop(deal.shop.name) ? "Oficial" : "Revendedor";
  topRow.appendChild(officialBadge);

  if (bestPrice) {
    const bestBadge = document.createElement("span");
    bestBadge.className = "badge best-price";
    bestBadge.textContent = "Menor preço";
    topRow.appendChild(bestBadge);
  }

  const priceRow = document.createElement("div");
  priceRow.className = "deal-price-row";

  const currentPrice = document.createElement("span");
  currentPrice.className = "deal-price-current";
  currentPrice.textContent = formatMoney(deal.price);
  priceRow.appendChild(currentPrice);

  if (deal.cut > 0) {
    const regularPrice = document.createElement("span");
    regularPrice.className = "deal-price-regular";
    regularPrice.textContent = formatMoney(deal.regular);
    priceRow.appendChild(regularPrice);

    const cut = document.createElement("span");
    cut.className = "deal-cut";
    cut.textContent = `-${deal.cut}%`;
    priceRow.appendChild(cut);
  }

  li.appendChild(topRow);
  li.appendChild(priceRow);

  if (deal.voucher) {
    const voucher = document.createElement("div");
    voucher.className = "deal-voucher";
    voucher.textContent = `Cupom aplicado automaticamente no preço: ${deal.voucher}`;
    li.appendChild(voucher);
  }

  const link = document.createElement("a");
  link.className = "deal-link";
  link.href = deal.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Ver oferta →";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: deal.url });
  });
  li.appendChild(link);

  return li;
}

function renderSearchResults(games) {
  els.resultsList.innerHTML = "";
  setResultsHeading("Resultados da busca");
  els.showHighlightsBtn.hidden = false;

  if (!games.length) {
    setStatus(els.statusMsg, "Nenhum jogo encontrado com esse nome.");
    return;
  }
  setStatus(els.statusMsg, null);

  for (const game of games) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "result-item";
    btn.type = "button";

    const thumb = document.createElement("img");
    thumb.className = "result-thumb";
    thumb.src = game.assets?.banner145 || game.assets?.boxart || "";
    thumb.alt = "";
    thumb.onerror = () => (thumb.style.visibility = "hidden");

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = game.title;

    btn.appendChild(thumb);
    btn.appendChild(title);

    if (game.type && game.type !== "game") {
      const tag = document.createElement("span");
      tag.className = "result-type-tag";
      tag.textContent = game.type.toUpperCase();
      btn.appendChild(tag);
    }

    btn.addEventListener("click", () => openDealsFor(game));
    li.appendChild(btn);
    els.resultsList.appendChild(li);
  }
}

async function openDealsFor(game) {
  dealsReturnView = currentViewName();
  showView("dealsView");
  els.gameHeader.innerHTML = "";
  els.dealsList.innerHTML = "";
  els.watchPanel.hidden = true;
  els.historyLowNote.hidden = true;
  setStatus(els.dealsStatus, "Buscando os melhores preços...", { loading: true });

  const headerImg = document.createElement("img");
  headerImg.src = game.assets?.banner145 || game.assets?.boxart || "";
  headerImg.alt = "";
  headerImg.onerror = () => (headerImg.style.visibility = "hidden");
  const headerTitle = document.createElement("h2");
  headerTitle.textContent = game.title;
  els.gameHeader.appendChild(headerImg);
  els.gameHeader.appendChild(headerTitle);

  try {
    const [result] = await getPrices(settings.apiKey, [game.id], settings.country);
    renderDeals(result);
    renderWatchPanel(game, result);
  } catch (err) {
    setStatus(els.dealsStatus, err.message || "Erro ao buscar preços.", { error: true });
  }
}

function renderHistoryLow(result) {
  const low = result?.historyLow?.all;
  if (!low) return;
  els.historyLowNote.textContent = `Menor preço já registrado: ${formatMoney(low)}`;
  els.historyLowNote.hidden = false;
}

function renderDeals(result) {
  renderHistoryLow(result);
  if (!result || !result.deals || !result.deals.length) {
    setStatus(
      els.dealsStatus,
      "Nenhuma oferta ativa encontrada nas lojas monitoradas para este jogo."
    );
    return;
  }
  setStatus(els.dealsStatus, null);

  const deals = [...result.deals].sort((a, b) => a.price.amount - b.price.amount);
  deals.forEach((deal, index) => {
    els.dealsList.appendChild(createDealCard(deal, { bestPrice: index === 0 }));
  });
}

// Aceita "29,90", "29.90" e "1.299,90".
function parsePrice(text) {
  let s = text.trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatInputPrice(amount) {
  return amount.toFixed(2).replace(".", ",");
}

async function renderWatchPanel(game, result) {
  els.watchPanel.innerHTML = "";
  els.watchPanel.hidden = true;

  const currency = result?.deals?.[0]?.price.currency ?? result?.historyLow?.all?.currency;
  if (!currency) return;

  const existing = (await getWatchlist())[game.id];

  const title = document.createElement("h3");
  title.className = "watch-title";
  title.textContent = "🔔 Alerta de preço";
  els.watchPanel.appendChild(title);

  if (existing) {
    const text = document.createElement("p");
    text.className = "watch-text";
    text.textContent = `Você será avisado quando alguma loja chegar a ${formatMoney({
      amount: existing.targetPrice,
      currency: existing.currency,
    })} ou menos.`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "link-btn";
    removeBtn.textContent = "Remover alerta";
    removeBtn.addEventListener("click", async () => {
      await removeAlert(game.id);
      renderWatchPanel(game, result);
    });

    els.watchPanel.appendChild(text);
    els.watchPanel.appendChild(removeBtn);
    els.watchPanel.hidden = false;
    return;
  }

  const cheapest = result.deals?.length ? Math.min(...result.deals.map((d) => d.price.amount)) : null;
  const suggestion = result.historyLow?.all?.amount ?? (cheapest ? cheapest * 0.8 : null);

  const form = document.createElement("form");
  form.className = "watch-form";

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.className = "watch-input";
  input.setAttribute("aria-label", `Preço desejado (${currency})`);
  input.placeholder = "Ex: 29,90";
  if (suggestion) input.value = formatInputPrice(suggestion);

  const label = document.createElement("span");
  label.className = "watch-label";
  label.textContent = `Avisar a partir de (${currency})`;

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary-btn";
  submit.textContent = "Criar alerta";

  const message = document.createElement("p");
  message.className = "watch-msg";
  message.hidden = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const target = parsePrice(input.value);
    if (target === null) {
      message.textContent = "Digite um preço maior que zero, como 29,90.";
      message.hidden = false;
      return;
    }
    await addAlert(game, target, currency);
    chrome.runtime.sendMessage({ type: "check-watchlist" });
    renderWatchPanel(game, result);
  });

  els.watchPanel.appendChild(label);
  form.appendChild(input);
  form.appendChild(submit);
  els.watchPanel.appendChild(form);
  els.watchPanel.appendChild(message);
  els.watchPanel.hidden = false;
}

async function renderAlertsView() {
  els.alertsList.innerHTML = "";
  const items = Object.values(await getWatchlist());

  if (!items.length) {
    setStatus(
      els.alertsStatus,
      "Nenhum alerta ainda. Abra a comparação de preços de um jogo e crie um alerta com o preço que você quer pagar."
    );
    return;
  }
  setStatus(els.alertsStatus, null);

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "alert-row";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "result-item";

    const thumb = document.createElement("img");
    thumb.className = "result-thumb";
    thumb.src = item.thumb;
    thumb.alt = "";
    thumb.onerror = () => (thumb.style.visibility = "hidden");

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = item.title;

    const target = document.createElement("span");
    target.className = "alert-target";
    target.textContent = `≤ ${formatMoney({ amount: item.targetPrice, currency: item.currency })}`;

    open.append(thumb, title, target);
    open.addEventListener("click", () =>
      openDealsFor({ id: item.id, title: item.title, assets: { banner145: item.thumb } })
    );

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-btn";
    remove.textContent = "Remover";
    remove.setAttribute("aria-label", `Remover alerta de ${item.title}`);
    remove.addEventListener("click", async () => {
      await removeAlert(item.id);
      renderAlertsView();
    });

    li.append(open, remove);
    els.alertsList.appendChild(li);
  }
}

function setResultsHeading(text) {
  els.resultsHeading.textContent = text;
}

function renderDailyHighlights(games) {
  els.resultsList.innerHTML = "";
  els.showHighlightsBtn.hidden = true;

  if (!games.length) {
    setStatus(els.statusMsg, "Nenhum destaque disponível no momento.");
    return;
  }
  setStatus(els.statusMsg, null);

  for (const game of games) {
    const card = createDealCard(game.deal);
    card.classList.add("highlight-card");

    const titleRow = document.createElement("button");
    titleRow.type = "button";
    titleRow.className = "highlight-title-row";

    const thumb = document.createElement("img");
    thumb.className = "result-thumb";
    thumb.src = game.assets?.banner145 || game.assets?.boxart || "";
    thumb.alt = "";
    thumb.onerror = () => (thumb.style.visibility = "hidden");

    const title = document.createElement("span");
    title.className = "result-title";
    title.textContent = game.title;

    titleRow.appendChild(thumb);
    titleRow.appendChild(title);
    titleRow.addEventListener("click", () => openDealsFor(game));

    card.insertBefore(titleRow, card.firstChild);
    els.resultsList.appendChild(card);
  }
}

async function loadDailyHighlights() {
  els.searchInput.value = "";
  setResultsHeading("🔥 Destaques de hoje");
  els.showHighlightsBtn.hidden = true;
  els.resultsList.innerHTML = "";
  setStatus(els.statusMsg, "Carregando destaques de hoje...", { loading: true });

  try {
    const games = await getDailyHighlights(settings.apiKey, settings.country, 8);
    renderDailyHighlights(games);
  } catch (err) {
    setStatus(els.statusMsg, err.message || "Erro ao carregar destaques.", { error: true });
  }
}

async function handleSearch(e) {
  e.preventDefault();
  const title = els.searchInput.value.trim();
  if (!title) return;

  setStatus(els.statusMsg, "Buscando jogos...", { loading: true });

  try {
    const games = await searchGames(settings.apiKey, title, 15);
    renderSearchResults(games);
  } catch (err) {
    setStatus(els.statusMsg, err.message || "Erro ao buscar jogos.", { error: true });
  }
}

function openOptionsPage() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html") });
  }
}

async function init() {
  settings = await getSettings();

  if (!settings.apiKey) {
    showView("noKeyView");
  } else {
    showView("searchView");
    els.searchInput.focus();
    loadDailyHighlights();
  }

  els.goToOptionsBtn.addEventListener("click", openOptionsPage);
  els.openOptions.addEventListener("click", openOptionsPage);
  els.searchForm.addEventListener("submit", handleSearch);
  els.showHighlightsBtn.addEventListener("click", loadDailyHighlights);
  els.backBtn.addEventListener("click", () => showView(dealsReturnView));
  els.openAlerts.addEventListener("click", () => {
    showView("alertsView");
    renderAlertsView();
  });
  els.alertsBackBtn.addEventListener("click", () =>
    showView(settings.apiKey ? "searchView" : "noKeyView")
  );
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.apiKey || changes.country)) {
    getSettings().then((s) => {
      settings = s;
      if (settings.apiKey && !els.noKeyView.hidden) {
        showView("searchView");
      }
    });
  }
});

init();
