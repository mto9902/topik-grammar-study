import { Capacitor, registerPlugin } from '@capacitor/core'
import { reactive } from 'vue'

interface NativeTtsPlugin {
  isSupported(): Promise<{ supported: boolean }>
  speak(options: { text: string }): Promise<void>
  stop(): Promise<void>
  addListener(
    eventName: 'ttsStateChange',
    listenerFunc: (state: { speaking: boolean; text?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>
}

interface KoreanSpeechState {
  supported: boolean
  speaking: boolean
  speakingText: string
}

const isNativePlatform = Capacitor.isNativePlatform()
const hasWebSpeech =
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof SpeechSynthesisUtterance !== 'undefined'
const NativeTts = registerPlugin<NativeTtsPlugin>('NativeTts')

export const koreanSpeechState = reactive<KoreanSpeechState>({
  supported: isNativePlatform || hasWebSpeech,
  speaking: false,
  speakingText: '',
})

let nativeListenerReady = false

function cleanupSpeechState() {
  koreanSpeechState.speaking = false
  koreanSpeechState.speakingText = ''
}

async function ensureNativeSupport() {
  if (!isNativePlatform || nativeListenerReady) return
  nativeListenerReady = true

  try {
    await NativeTts.addListener('ttsStateChange', state => {
      koreanSpeechState.speaking = !!state.speaking
      koreanSpeechState.speakingText = state.text || ''
    })
    const { supported } = await NativeTts.isSupported()
    koreanSpeechState.supported = supported || isNativePlatform
  } catch {
    koreanSpeechState.supported = isNativePlatform
  }
}

void ensureNativeSupport()

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  return (
    voices.find(voice => voice.lang.toLowerCase() === 'ko-kr') ||
    voices.find(voice => voice.lang.toLowerCase().startsWith('ko')) ||
    null
  )
}

export function stopKoreanSpeech() {
  if (isNativePlatform) {
    void NativeTts.stop().catch(() => {})
    cleanupSpeechState()
    return
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  cleanupSpeechState()
}

export async function speakKorean(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized || !koreanSpeechState.supported) return

  if (isNativePlatform) {
    if (koreanSpeechState.speaking && koreanSpeechState.speakingText === normalized) {
      stopKoreanSpeech()
      return
    }

    try {
      koreanSpeechState.speaking = true
      koreanSpeechState.speakingText = normalized
      await NativeTts.speak({ text: normalized })
    } catch {
      cleanupSpeechState()
    }
    return
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  if (koreanSpeechState.speaking && koreanSpeechState.speakingText === normalized) {
    stopKoreanSpeech()
    return
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(normalized)
  utterance.lang = 'ko-KR'
  utterance.rate = 0.96
  utterance.pitch = 1
  const voice = pickKoreanVoice()
  if (voice) {
    utterance.voice = voice
  }

  koreanSpeechState.speaking = true
  koreanSpeechState.speakingText = normalized

  utterance.onend = cleanupSpeechState
  utterance.onerror = cleanupSpeechState

  window.speechSynthesis.speak(utterance)
}
