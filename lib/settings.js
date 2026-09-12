// Leitura/gravação das configurações da extensão (chrome.storage.sync).
const DEFAULTS = {
  apiKey: "",
  country: "BR",
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

export async function saveSettings(partial) {
  await chrome.storage.sync.set(partial);
}
