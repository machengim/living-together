import { useTranslation } from 'react-i18next'
import styles from './Title.module.css'

type TitleProps = {
  onStart: () => void
  onSettings: () => void
}

function Title({ onStart, onSettings }: TitleProps) {
  const { t } = useTranslation()

  return (
    <main
      className={styles.title}
    >
      <div className={styles.actions}>
        <button className={styles.startButton} type="button" onClick={onStart}>
          {t('startGame')}
        </button>
        <button className={styles.settingsButton} type="button" onClick={onSettings}>
          {t('settings')}
        </button>
      </div>
    </main>
  )
}

export default Title
