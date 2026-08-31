import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import styles from './Settings.module.css'
import { settingsAtom } from '../state/appAtoms'
import { enablePushNotifications, isWebPushEnabled } from '../pushNotifications'

type SettingsProps = {
  onBack: () => void
  onExit: () => void
  isProactiveMessageEnabled: boolean
  onProactiveMessageToggle: () => void
}

function Settings({
  onBack,
  onExit,
  isProactiveMessageEnabled,
  onProactiveMessageToggle,
}: SettingsProps) {
  const { i18n, t } = useTranslation()
  const [settings, setSettings] = useAtom(settingsAtom)
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'enabled' | 'error'>('idle')
  const currentLanguage = settings.language

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
