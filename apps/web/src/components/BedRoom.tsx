import backgroundImage from '../assets/bg-room-dark.png'
import missionaryImage from '../assets/fun/missionary/01-lying.png'
import eyesImage from '../assets/fun/missionary/eyes/01.png'
import { useTranslation } from 'react-i18next'
import styles from './BedRoom.module.css'

type BedRoomProps = {
  onBack: () => void
  onSettings: () => void
}

function BedRoom({ onBack, onSettings }: BedRoomProps) {
  const { t } = useTranslation()

  return (
    <main
      className={styles.background}
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <img className={styles.missionaryImage} src={missionaryImage} alt="" />
      <img className={styles.missionaryImage} src={eyesImage} alt="" />
      <button className={styles.settingsButton} type="button" onClick={onSettings}>
        {t('settings')}
      </button>
      <button className={styles.backButton} type="button" onClick={onBack}>
        {t('back')}
      </button>
    </main>
  )
}

export default BedRoom
