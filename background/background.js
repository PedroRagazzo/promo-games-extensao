import { getSettings } from "../lib/settings.js";
import { getDailyHighlights } from "../lib/daily-deals.js";

const ALARM_NAME = "promo-games-daily-check";

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

chrome.runtime.onInstalled.addListener(scheduleAlarm);
chrome.runtime.onStartup.addListener(scheduleAlarm);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) runDailyCheck();
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
