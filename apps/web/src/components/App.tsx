import BedRoom from './BedRoom'
import Settings from './Settings.tsx'
import Title from './Title'
import LivingRoom from './LivingRoom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue, useSetAtom } from 'jotai'
import { viewAtom } from '../state/appAtoms'

function App() {
  const view = useAtomValue(viewAtom)
  const setView = useSetAtom(viewAtom)
  const [isSettingsVisible, setSettingsVisible] = useState(false)
  const [isProactiveMessageEnabled, setIsProactiveMessageEnabled] = useState(false)
  const [gameResetVersion, setGameResetVersion] = useState(0)
  const { t } = useTranslation()

  useEffect(() => {
    document.title = t('pageTitle')
  }, [t])

  const openSettings = () => {
    setSettingsVisible(true)
  }

  const page = view === 'title' ? (
      <Title
        onStart={() => setView('room')}
        onSettings={openSettings}
      />
    ) : view === 'dark' ? (
      <BedRoom
        onBack={() => setView('room')}
        onSettings={openSettings}
      />
    ) : (
      <LivingRoom
        key={gameResetVersion}
        onChangeRoom={() => setView('dark')}
        onSettings={openSettings}
        isProactiveMessageEnabled={isProactiveMessageEnabled}
      />
    )

  return (
    <>
      {page}
      {isSettingsVisible && (
        <Settings
          onBack={() => setSettingsVisible(false)}
          onResetGame={() => {
            setGameResetVersion((version) => version + 1)
            setSettingsVisible(false)
          }}
          isProactiveMessageEnabled={isProactiveMessageEnabled}
          onProactiveMessageToggle={() => setIsProactiveMessageEnabled((enabled) => !enabled)}
          onExit={() => {
            setSettingsVisible(false)
            setView('title')
          }}
        />
      )}
    </>
  )
}

export default App
