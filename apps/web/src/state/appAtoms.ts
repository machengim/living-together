import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export type View = 'title' | 'room' | 'dark'

export type AppSettings = {
  language: 'en' | 'zh-CN'
  fullscreen: boolean
}

export const viewAtom = atom<View>('title')

export const settingsAtom = atomWithStorage<AppSettings>(
  'living-together.settings',
  { language: 'en', fullscreen: false },
)
