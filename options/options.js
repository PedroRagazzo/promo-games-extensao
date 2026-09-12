import { searchGames } from "../lib/itad-api.js";
import { getSettings, saveSettings } from "../lib/settings.js";

const apiKeyInput = document.getElementById("apiKeyInput");
const countrySelect = document.getElementById("countrySelect");
const saveBtn = document.getElementById("saveBtn");
const testBtn = document.getElementById("testBtn");
const feedback = document.getElementById("feedback");

function showFeedback(message, isError = false) {
  feedback.hidden = false;
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
}

async function loadCurrentSettings() {
  const settings = await getSettings();
  apiKeyInput.value = settings.apiKey;
  countrySelect.value = settings.country;
}

async function handleSave() {
  await saveSettings({
    apiKey: apiKeyInput.value.trim(),
    country: countrySelect.value,
  });
  showFeedback("Configurações salvas com sucesso.");
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

loadCurrentSettings();
