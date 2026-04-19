import { reactive } from 'vue'

interface KoreanSpeechState {
  supported: boolean
  speaking: boolean
  speakingText: string
}

export const koreanSpeechState = reactive<KoreanSpeechState>({
  supported:
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined',
  speaking: false,
  speakingText: '',
})

function cleanupSpeechState() {
  koreanSpeechState.speaking = false
  koreanSpeechState.speakingText = ''
}

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
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  cleanupSpeechState()
}

export function speakKorean(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized || !koreanSpeechState.supported) return

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

