import { getSettings } from "../lib/settings.js";
import { getDailyHighlights } from "../lib/daily-deals.js";
import { getPrices } from "../lib/itad-api.js";
import { getWatchlist, updateNotifiedPrices, evaluateAlerts } from "../lib/watchlist.js";

const ALARM_NAME = "promo-games-daily-check";
const WATCH_ALARM_NAME = "promo-games-watchlist-check";

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

function nextTriggerTime(hour) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  if (!settings.dailyNotifications) return;
  chrome.alarms.create(ALARM_NAME, {
    when: nextTriggerTime(settings.notifyHour),
    periodInMinutes: 24 * 60,
  });
}

async function runDailyCheck() {
  const settings = await getSettings();
  if (!settings.dailyNotifications || !settings.apiKey) return;

  const todayStr = new Date().toDateString();
  const { lastNotifiedDay } = await chrome.storage.local.get("lastNotifiedDay");
  if (lastNotifiedDay === todayStr) return;

  let deals;
  try {
    deals = await getDailyHighlights(settings.apiKey, settings.country, 10);
  } catch (err) {
    console.error("Promo Games: falha ao buscar destaques diários", err);
    return;
  }
  if (!deals.length) return;

  const top = deals[0];
  const notificationId = `promo-games-${top.id}`;

  chrome.notifications.create(notificationId, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: `${top.title} está com ${top.deal.cut}% de desconto`,
    message: `${top.deal.shop.name}: ${formatMoney(top.deal.price)} (de ${formatMoney(
      top.deal.regular
    )}). Clique para ver a oferta.`,
    priority: 1,
  });

  await chrome.storage.local.set({
    lastNotifiedDay: todayStr,
    [`dealUrl:${notificationId}`]: top.deal.url,
  });
}

function scheduleWatchAlarm() {
  chrome.alarms.create(WATCH_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 180 });
}

async function runWatchlistCheck() {
  const settings = await getSettings();
  if (!settings.apiKey) return;

  const items = Object.values(await getWatchlist());
  if (!items.length) return;

  let results;
  try {
    results = await getPrices(
      settings.apiKey,
      items.map((i) => i.id),
      settings.country
    );
  } catch (err) {
    console.error("Promo Games: falha ao checar alertas de preço", err);
    return;
  }

  const { triggered, updates } = evaluateAlerts(items, results);

  for (const { item, deal } of triggered) {
    const notificationId = `promo-games-alert-${item.id}`;
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: `${item.title} chegou ao seu preço`,
      message: `${deal.shop.name}: ${formatMoney(deal.price)} (sua meta: ${formatMoney({
        amount: item.targetPrice,
        currency: item.currency,
      })}). Clique para ver a oferta.`,
      priority: 1,
    });
    await chrome.storage.local.set({ [`dealUrl:${notificationId}`]: deal.url });
  }

  await updateNotifiedPrices(updates);
}

function scheduleAll() {
  scheduleAlarm();
  scheduleWatchAlarm();
}

chrome.runtime.onInstalled.addListener(scheduleAll);
chrome.runtime.onStartup.addListener(scheduleAll);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runDailyCheck();
  if (alarm.name === WATCH_ALARM_NAME) runWatchlistCheck();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "check-watchlist") runWatchlistCheck();
});

chrome.notifications.onClicked.addListener(async (notificationId) => {
  if (!notificationId.startsWith("promo-games-")) return;
  const key = `dealUrl:${notificationId}`;
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) chrome.tabs.create({ url: stored[key] });
  chrome.notifications.clear(notificationId);
  chrome.storage.local.remove(key);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.dailyNotifications || changes.notifyHour)) {
    scheduleAlarm();
  }
});
