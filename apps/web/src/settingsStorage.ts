const SETTINGS_KEY = 'living-together.settings'

export type Settings = {
  language: 'en' | 'zh-CN'
}

export const defaultSettings: Settings = {
  language: 'en',
}

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)

    if (!stored) {
      return defaultSettings
    }

    const parsed: unknown = JSON.parse(stored)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'language' in parsed &&
      (parsed.language === 'en' || parsed.language === 'zh-CN')
    ) {
      return { language: parsed.language }
    }
  } catch {
    // Use defaults if storage is unavailable or invalid.
  }

  return defaultSettings
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage failures; settings still work for the current session.
  }
}
