import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import styles from './Settings.module.css'
import { settingsAtom } from '../state/appAtoms'
import { enablePushNotifications, isWebPushEnabled } from '../pushNotifications'

type SettingsProps = {
  onBack: () => void
  onExit: () => void
  onResetGame: () => void
  isProactiveMessageEnabled: boolean
  onProactiveMessageToggle: () => void
}

function Settings({
  onBack,
  onExit,
  onResetGame,
  isProactiveMessageEnabled,
  onProactiveMessageToggle,
}: SettingsProps) {
  const { i18n, t } = useTranslation()
  const [settings, setSettings] = useAtom(settingsAtom)
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'enabled' | 'error'>('idle')
  const [isResettingGame, setIsResettingGame] = useState(false)
  const [resetGameError, setResetGameError] = useState(false)
  const [activeAiProvider, setActiveAiProvider] = useState('')
  const [availableAiProviders, setAvailableAiProviders] = useState<string[]>([])
  const [isLoadingAiProviders, setIsLoadingAiProviders] = useState(true)
  const [aiProviderError, setAiProviderError] = useState(false)
  const currentLanguage = settings.language

  useEffect(() => {
    let isMounted = true

    void fetch('/ai-provider')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load AI providers: ${response.status}`)
        }

        return response.json() as Promise<{
          activeProvider: string
          availableProviders: string[]
        }>
      })
      .then((data) => {
        if (!isMounted) return
        setActiveAiProvider(data.activeProvider)
        setAvailableAiProviders(data.availableProviders)
      })
      .catch(() => {
        if (isMounted) setAiProviderError(true)
      })
      .finally(() => {
        if (isMounted) setIsLoadingAiProviders(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setSettings((current) => ({
        ...current,
        fullscreen: Boolean(document.fullscreenElement),
      }))
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onBack()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onBack, setSettings])

  const changeLanguage = (language: 'en' | 'zh-CN') => {
    i18n.changeLanguage(language)
    setSettings({ ...settings, language })
  }

  const toggleFullscreen = async (enabled: boolean) => {
    try {
      if (enabled) {
        await document.documentElement.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }

      setSettings({ ...settings, fullscreen: enabled })
    } catch {
      setSettings({ ...settings, fullscreen: false })
    }
  }

  const enableNotifications = async () => {
    setIsEnablingNotifications(true)
    setNotificationStatus('idle')

    try {
      await enablePushNotifications()
      setNotificationStatus('enabled')
    } catch {
      setNotificationStatus('error')
    } finally {
      setIsEnablingNotifications(false)
    }
  }

  const changeAiProvider = async (provider: string) => {
    const previousProvider = activeAiProvider
    setActiveAiProvider(provider)
    setAiProviderError(false)

    try {
      const response = await fetch('/ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      if (!response.ok) {
        throw new Error(`Could not change AI provider: ${response.status}`)
      }
    } catch {
      setActiveAiProvider(previousProvider)
      setAiProviderError(true)
    }
  }

  const resetGame = async () => {
    if (!window.confirm(t('resetGameConfirm'))) {
      return
    }

    setIsResettingGame(true)
    setResetGameError(false)

    try {
      const response = await fetch('/reset-game', { method: 'POST' })

      if (!response.ok) {
        throw new Error(`Game reset failed with status ${response.status}`)
      }

      onResetGame()
    } catch {
      setResetGameError(true)
    } finally {
      setIsResettingGame(false)
    }
  }

  return (
    <main className={styles.settings}>
      <section className={styles.panel} aria-labelledby="settings-title">
        <h1 id="settings-title">{t('settings')}</h1>
        <div className={styles.languages} role="group" aria-label={t('language')}>
          <button
            className={currentLanguage === 'en' ? styles.active : undefined}
            type="button"
            onClick={() => changeLanguage('en')}
          >
            {t('english')}
          </button>
          <button
            className={currentLanguage === 'zh-CN' ? styles.active : undefined}
            type="button"
            onClick={() => changeLanguage('zh-CN')}
          >
            {t('chinese')}
          </button>
        </div>
        <label className={styles.fullscreenToggle}>
          <input
            type="checkbox"
            checked={Boolean(settings.fullscreen)}
            onChange={(event) => toggleFullscreen(event.target.checked)}
          />
          {t('fullscreen')}
        </label>
        <label className={styles.providerSelect}>
          <span>{t('aiProvider')}</span>
          <select
            value={activeAiProvider}
            disabled={isLoadingAiProviders || availableAiProviders.length === 0}
            onChange={(event) => void changeAiProvider(event.target.value)}
          >
            {availableAiProviders.map((provider) => (
              <option key={provider} value={provider}>
                {t(`aiProvider${provider.charAt(0).toUpperCase()}${provider.slice(1)}`)}
              </option>
            ))}
          </select>
        </label>
        {aiProviderError && (
          <p role="alert">{t('aiProviderError')}</p>
        )}
        <button
          className={styles.back}
          type="button"
          aria-pressed={isProactiveMessageEnabled}
          onClick={onProactiveMessageToggle}
        >
          {t(isProactiveMessageEnabled ? 'disableProactiveMessage' : 'allowProactiveMessage')}
        </button>
        {isWebPushEnabled && (
          <>
            <button
              className={styles.back}
              type="button"
              onClick={enableNotifications}
              disabled={isEnablingNotifications || notificationStatus === 'enabled'}
            >
              {notificationStatus === 'enabled'
                ? t('notificationsEnabled')
                : t('enableNotifications')}
            </button>
            {notificationStatus === 'error' && (
              <p role="alert">{t('notificationError')}</p>
            )}
          </>
        )}
        <button
          className={styles.reset}
          type="button"
          onClick={resetGame}
          disabled={isResettingGame}
        >
          {isResettingGame ? t('resettingGame') : t('resetGame')}
        </button>
        {resetGameError && (
          <p role="alert">{t('resetGameError')}</p>
        )}
        <button className={styles.back} type="button" onClick={onBack}>
          {t('back')}
        </button>
        <button className={styles.exit} type="button" onClick={onExit}>
          {t('backToTitle')}
        </button>
      </section>
    </main>
  )
}

export default Settings
