import { searchGames, getPrices, isOfficialShop } from "../lib/itad-api.js";
import { getSettings } from "../lib/settings.js";
import { getDailyHighlights } from "../lib/daily-deals.js";

const els = {
  noKeyView: document.getElementById("noKeyView"),
  searchView: document.getElementById("searchView"),
  dealsView: document.getElementById("dealsView"),
  goToOptionsBtn: document.getElementById("goToOptionsBtn"),
  openOptions: document.getElementById("openOptions"),
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

function showView(name) {
  for (const key of ["noKeyView", "searchView", "dealsView"]) {
    els[key].hidden = key !== name;
  }
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
  showView("dealsView");
  els.gameHeader.innerHTML = "";
  els.dealsList.innerHTML = "";
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
  els.backBtn.addEventListener("click", () => showView("searchView"));
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
