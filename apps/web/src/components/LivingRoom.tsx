import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import backgroundImage from '../assets/bg-room.png'
import idleImage from '../assets/idle/01.png'
import eyeImage from '../assets/idle/_parts/eye/01_01.png'
import holdWaistImage from '../assets/tease/07-hold-waist.png'
import holdHandImage from '../assets/tease/04-hold-hand.png'
import holdShoulderImage from '../assets/tease/06-hold-shoulder.png'
import kissImage from '../assets/tease/08-kiss.png'
import patHeadImage from '../assets/tease/02-pat-head.png'
import touchBreastImage from '../assets/tease/09-touch-breast.png'
import touchPussyImage from '../assets/tease/10-touch-pussy.png'
import touchThighImage from '../assets/tease/03-touch-thigh.png'
import touchAssImage from '../assets/tease/05-touch-ass.png'
import styles from './LivingRoom.module.css'
import SpeechBubble from './SpeechBubble'

type LivingRoomProps = {
  onChangeRoom: () => void
  onSettings: () => void
  isProactiveMessageEnabled: boolean
}

type TeaseAction =
  | 'patHead'
  | 'holdHands'
  | 'holdShoulder'
  | 'kiss'
  | 'holdWaist'
  | 'touchThigh'
  | 'touchAss'
  | 'touchBreast'
  | 'touchPussy'

type ChatBubble = {
  id: string
  text: string
  createdAt: number
  isStreaming?: boolean
}

const bubbleLifetime = 60_000

function createChatBubble(text: string): ChatBubble {
  return {
    id: `${Date.now()}-${Math.random()}`,
    text,
    createdAt: Date.now(),
  }
}

const teaseImages: Record<TeaseAction, string> = {
  patHead: patHeadImage,
  holdHands: holdHandImage,
  holdShoulder: holdShoulderImage,
  kiss: kissImage,
  holdWaist: holdWaistImage,
  touchThigh: touchThighImage,
  touchAss: touchAssImage,
  touchBreast: touchBreastImage,
  touchPussy: touchPussyImage,
}

function LivingRoom({ onChangeRoom, onSettings, isProactiveMessageEnabled }: LivingRoomProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isTeaseMenuOpen, setIsTeaseMenuOpen] = useState(false)
  const [activeTease, setActiveTease] = useState<TeaseAction | null>(null)
  const [message, setMessage] = useState('')
  const [sentMessages, setSentMessages] = useState<ChatBubble[]>([])
  const [characterMessages, setCharacterMessages] = useState<ChatBubble[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isReplyInProgress, setIsReplyInProgress] = useState(false)
  const [sendError, setSendError] = useState('')
  const proactiveMessageEnabledRef = useRef(isProactiveMessageEnabled)
  const socketRef = useRef<WebSocket | null>(null)
  const streamingReplyIdRef = useRef<string | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    proactiveMessageEnabledRef.current = isProactiveMessageEnabled

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'proactive-toggle',
        enabled: isProactiveMessageEnabled,
      }))
    }
  }, [isProactiveMessageEnabled])

  useEffect(() => {
    let socket: WebSocket | null = null
    let reconnectTimer: number | undefined
    let isUnmounted = false

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/ws`)
      socketRef.current = socket

      socket.onopen = () => {
        socket?.send(JSON.stringify({
          type: 'proactive-toggle',
          enabled: proactiveMessageEnabledRef.current,
        }))
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') {
          return
        }

        try {
          const data: unknown = JSON.parse(event.data)

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            data.type === 'reset'
          ) {
            setSentMessages([])
            setIsReplyInProgress(false)
            streamingReplyIdRef.current = null
            setCharacterMessages([])
            return
          }

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            data.type === 'message-start' &&
            'id' in data &&
            typeof data.id === 'string'
          ) {
            setSentMessages([])
            setIsReplyInProgress(true)
            streamingReplyIdRef.current = data.id
            setCharacterMessages([{
              id: data.id,
              text: '…',
              createdAt: Date.now(),
              isStreaming: true,
            }])
            return
          }

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            data.type === 'message-delta' &&
            'id' in data &&
            'text' in data &&
            typeof data.id === 'string' &&
            typeof data.text === 'string'
          ) {
            const deltaText = data.text
            setIsReplyInProgress(true)
            setCharacterMessages((messages) => messages.map((bubble) =>
              bubble.id === data.id
                ? {
                    ...bubble,
                    text: bubble.text === '…' ? deltaText : bubble.text + deltaText,
                    isStreaming: true,
                  }
                : bubble,
            ))
            return
          }

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            data.type === 'message-end' &&
            'id' in data &&
            typeof data.id === 'string'
          ) {
            if ('message' in data && typeof data.message === 'string') {
              const finalMessage = data.message
              setIsReplyInProgress(false)
              streamingReplyIdRef.current = null
              setCharacterMessages((messages) => messages.map((bubble) =>
                bubble.id === data.id
                  ? { ...bubble, text: finalMessage, createdAt: Date.now(), isStreaming: false }
                  : bubble,
              ))
            }
            return
          }

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            (data.type === 'message-error' || data.type === 'message-cancelled')
          ) {
            setIsReplyInProgress(false)
            streamingReplyIdRef.current = null
            setCharacterMessages([])
            if (data.type === 'message-error') {
              setSendError(t('sendError'))
            }
            return
          }

          if (
            typeof data === 'object' &&
            data !== null &&
            'type' in data &&
            'message' in data &&
            data.type === 'message' &&
            typeof data.message === 'string'
          ) {
            const nextCharacterMessage = data.message

            setIsReplyInProgress(false)
            streamingReplyIdRef.current = null
            setSentMessages([])
            setCharacterMessages([createChatBubble(nextCharacterMessage)])
          }
        } catch {
          // Ignore malformed WebSocket messages.
        }
      }

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null
        }

        if (!isUnmounted) {
          reconnectTimer = window.setTimeout(connect, 2000)
        }
      }
    }

    connect()

    return () => {
      isUnmounted = true
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer)
      }
      socket?.close()
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!activeTease) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setActiveTease(null)
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [activeTease])

  useEffect(() => {
    const timeoutIds = sentMessages.flatMap((bubble) => {
      if (bubble.isStreaming) {
        return []
      }

      return [window.setTimeout(() => {
        setSentMessages((messages) => messages.filter((message) => message.id !== bubble.id))
      }, Math.max(0, bubbleLifetime - (Date.now() - bubble.createdAt)))]
    })

    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [sentMessages])

  useEffect(() => {
    const timeoutIds = characterMessages.flatMap((bubble) => {
      if (bubble.isStreaming) {
        return []
      }

      return [window.setTimeout(() => {
        setCharacterMessages((messages) => messages.filter((message) => message.id !== bubble.id))
      }, Math.max(0, bubbleLifetime - (Date.now() - bubble.createdAt)))]
    })

    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }, [characterMessages])

  const showTease = (action: TeaseAction) => {
    setActiveTease(action)
    setIsMenuOpen(false)
    setIsTeaseMenuOpen(false)
  }

  const handleCharacterClick = () => {
    if (activeTease) {
      return
    }

    setIsMenuOpen(true)
    setIsTeaseMenuOpen(false)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextMessage = message.trim()

    if (!nextMessage || isSending) {
      return
    }

    setIsSending(true)
    setIsReplyInProgress(true)
    setSendError('')
    setCharacterMessages([])
    setSentMessages([createChatBubble(nextMessage)])

    try {
      const response = await fetch('/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-User-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          'X-User-Local-Time': new Date().toLocaleString(),
        },
        body: nextMessage,
      })

      if (!response.ok) {
        throw new Error(`Message request failed with status ${response.status}`)
      }

      setMessage('')
    } catch {
      setSentMessages([])
      setIsReplyInProgress(false)
      setSendError(t('sendError'))
    } finally {
      setIsSending(false)
    }
  }

  const handleRoomClick = () => {
    if (activeTease) {
      setActiveTease(null)
    }
  }

  const handleCancelReply = () => {
    const replyId = streamingReplyIdRef.current

    if (!replyId || socketRef.current?.readyState !== WebSocket.OPEN) {
      return
    }

    socketRef.current.send(JSON.stringify({
      type: 'cancel-message',
      id: replyId,
    }))
  }

  return (
    <main
      className={`${styles.room} ${sentMessages.length ? styles.hasMessage : ''}`}
      onClickCapture={handleRoomClick}
    >
      <div
        className={activeTease ? styles.sceneBlurred : styles.scene}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {sentMessages.length > 0 && (
          <div className={styles.messageBubbleStack}>
            {sentMessages.map((bubble) => (
              <SpeechBubble
                key={bubble.id}
                text={bubble.text}
                ariaLabel={t('recentMessage')}
                className={styles.messageBubble}
              />
            ))}
          </div>
        )}

        <button
          className={styles.settingsButton}
          type="button"
          onClick={onSettings}
        >
          {t('settings')}
        </button>
        <form
          className={styles.chatBar}
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('chatPlaceholder')}
            aria-label={t('chatPlaceholder')}
          />
          <button
            type={isReplyInProgress ? 'button' : 'submit'}
            onClick={isReplyInProgress ? handleCancelReply : undefined}
            disabled={isSending && !isReplyInProgress}
          >
            {t(isReplyInProgress ? 'cancel' : 'send')}
          </button>
        </form>
        {sendError && (
          <p className={styles.sendError} role="alert">{sendError}</p>
        )}

        <div className={styles.character}>
          {characterMessages.length > 0 && (
            <div className={styles.characterBubbleStack}>
              {characterMessages.map((bubble) => (
                <SpeechBubble
                  key={bubble.id}
                  text={bubble.text}
                  ariaLabel={t('characterReply')}
                  className={styles.characterBubble}
                />
              ))}
            </div>
          )}
          <div className={styles.characterImage}>
            <img className={styles.idle} src={idleImage} alt="" />
            <img className={styles.eye} src={eyeImage} alt="" />
            <button
              className={styles.characterHitArea}
              type="button"
              aria-label={t('openChoices')}
              disabled={Boolean(activeTease)}
              onClick={handleCharacterClick}
            />
          </div>
        </div>

        {isMenuOpen && (
          <div className={styles.menuOverlay}>
            <button
              className={styles.menuBackdrop}
              type="button"
              aria-label={t('closeChoices')}
              onClick={() => setIsMenuOpen(false)}
            />
            <div
              className={`${styles.menu} ${isTeaseMenuOpen ? styles.teaseMenu : ''}`}
              role="menu"
              aria-label={t(isTeaseMenuOpen ? 'teaseChoices' : 'choices')}
            >
              {!isTeaseMenuOpen ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setIsTeaseMenuOpen(true)}
                  >
                    {t('tease')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChangeRoom()
                      setIsMenuOpen(false)
                    }}
                  >
                    {t('changeRoom')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('patHead')}
                  >
                    {t('patHead')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('holdHands')}
                  >
                    {t('holdHands')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('holdShoulder')}
                  >
                    {t('holdShoulder')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('kiss')}
                  >
                    {t('kiss')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('holdWaist')}
                  >
                    {t('holdWaist')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('touchThigh')}
                  >
                    {t('touchThigh')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('touchAss')}
                  >
                    {t('touchAss')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('touchBreast')}
                  >
                    {t('touchBreast')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => showTease('touchPussy')}
                  >
                    {t('touchPussy')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {activeTease && (
        <>
          <div className={styles.teaseBackdrop} aria-hidden="true" />
          <img
            className={styles.teaseImage}
            src={teaseImages[activeTease]}
            alt={t(activeTease)}
          />
        </>
      )}
    </main>
  )
}

export default LivingRoom
