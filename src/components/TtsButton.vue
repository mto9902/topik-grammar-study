<script setup lang="ts">
import { computed } from 'vue'
import { koreanSpeechState, speakKorean, stopKoreanSpeech } from '../tts'

const props = withDefaults(defineProps<{
  text: string
  label?: string
  size?: 'sm' | 'md'
}>(), {
  label: 'sentence',
  size: 'sm',
})

const normalizedText = computed(() => props.text.replace(/\s+/g, ' ').trim())
const isActive = computed(() => {
  return koreanSpeechState.speaking && koreanSpeechState.speakingText === normalizedText.value
})

function handleClick(event: Event) {
  event.stopPropagation()
  if (!normalizedText.value) return
  if (isActive.value) {
    stopKoreanSpeech()
    return
  }
  speakKorean(normalizedText.value)
}
</script>

<template>
  <button
    v-if="koreanSpeechState.supported && normalizedText"
    type="button"
    :class="['tts-btn', size, { active: isActive }]"
    :aria-label="isActive ? `Stop audio for ${label}` : `Play audio for ${label}`"
    @click="handleClick"
  >
    <span class="material-symbols-outlined">
      {{ isActive ? 'stop_circle' : 'volume_up' }}
    </span>
  </button>
</template>

<style scoped>
.tts-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: #333;
  transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.tts-btn.sm {
  width: 34px;
  height: 34px;
}

.tts-btn.md {
  width: 38px;
  height: 38px;
}

.tts-btn .material-symbols-outlined {
  font-size: 19px;
}

.tts-btn.active {
  background: #000;
  color: #fff;
}

.tts-btn:active {
  transform: scale(0.96);
}

@media (max-width: 320px) {
  .tts-btn.sm {
    width: 32px;
    height: 32px;
  }

  .tts-btn.md {
    width: 36px;
    height: 36px;
  }

  .tts-btn .material-symbols-outlined {
    font-size: 18px;
  }
}
</style>
