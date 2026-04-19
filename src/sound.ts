const clickSoundPath = '/lesiakower-laptop-touchpad-click-384384.mp3'

let clickAudio: HTMLAudioElement | null = null

export function primeClickAudio() {
  if (!clickAudio) {
    clickAudio = new Audio(clickSoundPath)
    clickAudio.preload = 'auto'
    clickAudio.volume = 0.45
  }
  return clickAudio
}

export function playClickSound() {
  const audio = primeClickAudio()
  audio.currentTime = 0
  void audio.play().catch(() => {})
}

export function initGlobalClickSound() {
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest('button')
    if (!button) return
    if ((button as HTMLButtonElement).disabled) return
    if (button.dataset.soundHandled === 'manual') return
    playClickSound()
  })
}
