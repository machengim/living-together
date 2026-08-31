import { useEffect, useState } from 'react'
import styles from './SpeechBubble.module.css'

const thirtyCharactersPerSecond = 30

type SpeechBubbleProps = {
  text: string
  ariaLabel: string
  className?: string
  singleLine?: boolean
  animate?: boolean
  charactersPerSecond?: number
}

function SpeechBubble({
  text,
  ariaLabel,
  className,
  singleLine,
  animate = false,
  charactersPerSecond =  thirtyCharactersPerSecond,
}: SpeechBubbleProps) {
  const [visibleText, setVisibleText] = useState(animate ? '' : text)
  const [isTyping, setIsTyping] = useState(animate)

  useEffect(() => {
    if (!animate) {
      setVisibleText(text)
      setIsTyping(false)
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleText(text)
      setIsTyping(false)
      return
    }

    setVisibleText('')
    setIsTyping(true)
    const interval = window.setInterval(() => {
      setVisibleText((currentText) => {
        if (currentText.length >= text.length) {
          window.clearInterval(interval)
          setIsTyping(false)
          return currentText
        }

        const nextText = text.slice(0, currentText.length + 1)
        if (nextText.length === text.length) {
          window.clearInterval(interval)
          setIsTyping(false)
        }
        return nextText
      })
    }, 1000 / Math.max(1, charactersPerSecond))

    return () => window.clearInterval(interval)
  }, [animate, charactersPerSecond, text])

  return (
    <output
      className={`${styles.bubble} ${isTyping ? styles.typing : ''} ${singleLine ? styles.singleLine : ''} ${className ?? ''}`}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {visibleText}
    </output>
  )
}

export default SpeechBubble
