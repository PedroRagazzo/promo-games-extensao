import { searchGames } from "../lib/itad-api.js";
import { getSettings, saveSettings } from "../lib/settings.js";

const apiKeyInput = document.getElementById("apiKeyInput");
const countrySelect = document.getElementById("countrySelect");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const feedback = document.getElementById("feedback");
const dailyNotifInput = document.getElementById("dailyNotifInput");
const notifyHourSelect = document.getElementById("notifyHourSelect");

const COUNTRIES = [
  ["DE", "Alemanha"], ["AR", "Argentina"], ["AU", "Austrália"], ["AT", "Áustria"],
  ["BE", "Bélgica"], ["CA", "Canadá"], ["CL", "Chile"], ["CO", "Colômbia"],
  ["KR", "Coreia do Sul"], ["DK", "Dinamarca"], ["ES", "Espanha"], ["US", "Estados Unidos"],
  ["FI", "Finlândia"], ["FR", "França"], ["IN", "Índia"], ["IE", "Irlanda"],
  ["IT", "Itália"], ["JP", "Japão"], ["MX", "México"], ["NO", "Noruega"],
  ["NZ", "Nova Zelândia"], ["NL", "Países Baixos"], ["PE", "Peru"], ["PL", "Polônia"],
  ["PT", "Portugal"], ["GB", "Reino Unido"], ["RU", "Rússia"], ["SE", "Suécia"],
  ["CH", "Suíça"], ["TR", "Turquia"], ["UY", "Uruguai"], ["ZA", "África do Sul"],
];

// Brasil fixo no topo (padrão); o restante em ordem alfabética.
const countryOptions = [
  ["BR", "Brasil"],
  ...COUNTRIES.sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
];
for (const [code, name] of countryOptions) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = name;
  countrySelect.appendChild(option);
}

for (let h = 0; h < 24; h++) {
  const option = document.createElement("option");
  option.value = String(h);
  option.textContent = `${String(h).padStart(2, "0")}:00`;
  notifyHourSelect.appendChild(option);
}

function showFeedback(message, isError = false) {
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
}

async function loadCurrentSettings() {
  const settings = await getSettings();
  apiKeyInput.value = settings.apiKey;
  countrySelect.value = settings.country;
  dailyNotifInput.checked = settings.dailyNotifications;
  notifyHourSelect.value = String(settings.notifyHour);
}

async function handleSave() {
  await saveSettings({
    apiKey: apiKeyInput.value.trim(),
    country: countrySelect.value,
  });
  showFeedback("Configurações salvas com sucesso.");
}

async function handleNotificationPrefsChange() {
  await saveSettings({
    dailyNotifications: dailyNotifInput.checked,
    notifyHour: Number(notifyHourSelect.value),
  });
  showFeedback("Preferência de notificação salva.");
}

async function handleTest() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showFeedback("Digite uma chave antes de testar.", true);
    return;
  }
  showFeedback("Testando...");
  try {
    await searchGames(key, "test", 1);
    showFeedback("Chave válida! Tudo pronto para usar a extensão.");
  } catch (err) {
    showFeedback(err.message || "Não foi possível validar a chave.", true);
  }
}

saveBtn.addEventListener("click", handleSave);
testBtn.addEventListener("click", handleTest);
dailyNotifInput.addEventListener("change", handleNotificationPrefsChange);
notifyHourSelect.addEventListener("change", handleNotificationPrefsChange);

loadCurrentSettings();
