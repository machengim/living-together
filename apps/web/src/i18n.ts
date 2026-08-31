import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import { loadSettings } from './settingsStorage'

const settings = loadSettings()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-CN': { translation: zhCN },
  },
  lng: settings.language,
  supportedLngs: ['en', 'zh-CN'],
  load: 'currentOnly',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
