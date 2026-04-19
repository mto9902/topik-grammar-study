<script setup lang="ts">
import { ref, computed } from 'vue'
import grammarData from '../data/grammar.json'
import type { GrammarPoint, StudyState } from '../types/grammar'
import { getItem, setItem } from '../storage'
import { playClickSound } from '../sound'

const allGrammar = grammarData as GrammarPoint[]
const queue = ref<GrammarPoint[]>([])
const currentIndex = ref(0)
const showAnswer = ref(false)
const sessionStats = ref({ mastered: 0, learning: 0 })
const isLoading = ref(true)

async function initQueue() {
  isLoading.value = true
  const states = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  const newItems = allGrammar.filter(g => !states[g.id] || states[g.id].status !== 'mastered')
  queue.value = shuffle(newItems.length > 0 ? newItems : allGrammar).slice(0, 20)
  currentIndex.value = 0
  showAnswer.value = false
  sessionStats.value = { mastered: 0, learning: 0 }
  isLoading.value = false
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const current = computed(() => queue.value[currentIndex.value])
const progress = computed(() => queue.value.length > 0 ? currentIndex.value / queue.value.length : 0)

async function handleResponse(status: 'mastered' | 'learning') {
  playClickSound()
  if (!current.value) return
  const states = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  states[current.value.id] = {
    status,
    lastReviewed: Date.now(),
    reviewCount: (states[current.value.id]?.reviewCount || 0) + 1,
  }
  await setItem('study_states_detail', states)
  sessionStats.value[status]++
  showAnswer.value = false
  if (currentIndex.value < queue.value.length - 1) {
    currentIndex.value++
  } else {
    currentIndex.value++
  }
}

const isFinished = computed(() => queue.value.length > 0 && currentIndex.value >= queue.value.length)

initQueue()
</script>

<template>
  <div class="study-view">
    <div v-if="isLoading" class="loading">Loading...</div>
    <div v-else-if="isFinished" class="finished">
      <div class="finish-card neu-card animate-pop">
        <div class="finish-icon">🎉</div>
        <h2>Session Complete!</h2>
        <div class="finish-stats">
          <div class="stat mastered">✅ {{ sessionStats.mastered }} Mastered</div>
          <div class="stat learning">📖 {{ sessionStats.learning }} Learning</div>
        </div>
        <button class="restart-btn neu-button neu-button-primary" @click="initQueue">Study Again</button>
      </div>
    </div>
    <div v-else-if="current" class="card-container">
      <div class="progress-wrap">
        <div class="neu-progress-track">
          <div class="neu-progress-fill" :style="{ width: `${progress * 100}%` }"></div>
        </div>
        <div class="counter">{{ currentIndex + 1 }} / {{ queue.length }}</div>
      </div>

      <div class="flashcard neu-card" @click="showAnswer = !showAnswer">
        <div v-if="!showAnswer" class="card-front">
          <div class="card-label">What does this mean?</div>
          <div class="card-grammar">{{ current.grammar }}</div>
          <div class="card-hint">Tap to reveal</div>
        </div>
        <div v-else class="card-back">
          <div class="card-grammar">{{ current.grammar }}</div>
          <div class="card-meaning">{{ current.meaning }}</div>
          <div class="card-category">{{ current.category }} • Level {{ current.level }}</div>
        </div>
      </div>

      <div class="actions">
        <button class="action-btn neu-button" @click.stop="handleResponse('learning')">
          ↩️ Again
        </button>
        <button class="action-btn neu-button neu-button-success" @click.stop="handleResponse('mastered')">
          ✅ Got it
        </button>
      </div>
    </div>
    <div v-else class="empty">
      <p>No grammar points to study.</p>
      <button class="restart-btn neu-button neu-button-primary" @click="initQueue">Start New Session</button>
    </div>
  </div>
</template>

<style scoped>
.study-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px 0;
}

.loading, .empty {
  text-align: center;
  color: rgba(49, 52, 75, 0.6);
  font-weight: 600;
}

.card-container {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.counter {
  text-align: center;
  font-size: 12px;
  color: rgba(49, 52, 75, 0.5);
  font-weight: 700;
}

.flashcard {
  padding: 32px 24px;
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  user-select: none;
}

.card-label {
  font-size: 12px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 16px;
}

.card-grammar {
  font-size: clamp(1.6rem, 7vw, 2.4rem);
  font-weight: 700;
  color: var(--color-dark);
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.3;
  margin-bottom: 8px;
}

.card-hint {
  font-size: 12px;
  color: rgba(49, 52, 75, 0.42);
  margin-top: 16px;
  font-weight: 600;
}

.card-meaning {
  font-size: 17px;
  color: rgba(49, 52, 75, 0.78);
  margin-top: 14px;
  line-height: 1.5;
  font-weight: 600;
}

.card-category {
  font-size: 11px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.48);
  margin-top: 18px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
}

.finished {
  width: 100%;
  max-width: 400px;
}

.finish-card {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 32px 24px;
}

.finish-icon {
  font-size: 56px;
}

.finish-card h2 {
  font-size: 22px;
  color: var(--color-dark);
}

.finish-stats {
  display: flex;
  gap: 12px;
}

.stat {
  font-size: 13px;
  font-weight: 700;
  padding: 10px 16px;
  border-radius: 14px;
  background: #e9ebf2;
  box-shadow:
    3px 3px 7px #d0d4dd,
    -3px -3px 7px #fbfbff;
}

.restart-btn {
  width: 100%;
  font-size: 15px;
  font-weight: 700;
}
</style>
