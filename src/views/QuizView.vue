<script setup lang="ts">
import { ref, computed } from 'vue'
import grammarData from '../data/grammar.json'
import type { GrammarPoint } from '../types/grammar'
import { playClickSound } from '../sound'

const allGrammar = grammarData as GrammarPoint[]
const questions = ref<GrammarPoint[]>([])
const currentIndex = ref(0)
const selectedOption = ref<number | null>(null)
const isCorrect = ref<boolean | null>(null)
const score = ref(0)
const isFinished = ref(false)

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateQuestions() {
  questions.value = shuffle(allGrammar).slice(0, 10)
  currentIndex.value = 0
  selectedOption.value = null
  isCorrect.value = null
  score.value = 0
  isFinished.value = false
}

const current = computed(() => questions.value[currentIndex.value])

const options = computed(() => {
  if (!current.value) return []
  const wrong = shuffle(allGrammar.filter(g => g.id !== current.value!.id)).slice(0, 3)
  return shuffle([current.value, ...wrong])
})

function selectOption(index: number) {
  playClickSound()
  if (selectedOption.value !== null) return
  selectedOption.value = index
  const correct = options.value[index].id === current.value.id
  isCorrect.value = correct
  if (correct) score.value++
}

function nextQuestion() {
  playClickSound()
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    selectedOption.value = null
    isCorrect.value = null
  } else {
    isFinished.value = true
  }
}

generateQuestions()
</script>

<template>
  <div class="quiz-view">
    <div v-if="isFinished" class="finished">
      <div class="finish-card neu-card animate-pop">
        <div class="finish-icon">🏆</div>
        <h2>Quiz Complete!</h2>
        <div class="score-display">{{ score }} / {{ questions.length }}</div>
        <button class="restart-btn neu-button neu-button-primary" @click="generateQuestions">New Quiz</button>
      </div>
    </div>
    <div v-else-if="current" class="quiz-container">
      <div class="quiz-header neu-inset">
        <span class="quiz-counter">Question {{ currentIndex + 1 }} / {{ questions.length }}</span>
        <span class="quiz-score">Score: {{ score }}</span>
      </div>

      <div class="question-box neu-card">
        <div class="question-label">Which grammar matches this meaning?</div>
        <div class="question-meaning">{{ current.meaning }}</div>
      </div>

      <div class="options">
        <button
          v-for="(opt, i) in options"
          :key="opt.id"
          :class="[
            'option-btn neu-button',
            {
              selected: selectedOption === i,
              correct: selectedOption !== null && opt.id === current.id,
              wrong: selectedOption === i && opt.id !== current.id,
            }
          ]"
          @click="selectOption(i)"
        >
          {{ opt.grammar }}
        </button>
      </div>

      <button
        v-if="selectedOption !== null"
        class="next-btn neu-button neu-button-primary"
        @click="nextQuestion"
      >
        {{ currentIndex < questions.length - 1 ? 'Next →' : 'Finish' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.quiz-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0;
}

.quiz-container {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.6);
  padding: 12px 16px;
}

.question-box {
  padding: 24px;
  text-align: center;
}

.question-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.question-meaning {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-dark);
  line-height: 1.5;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-btn {
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  font-family: 'Noto Sans KR', sans-serif;
  justify-content: flex-start;
}

.option-btn.selected.correct {
  background: var(--color-success);
  color: #fff;
  box-shadow:
    5px 5px 12px rgba(24, 99, 75, 0.2),
    -5px -5px 12px rgba(255, 255, 255, 0.8);
}

.option-btn.selected.wrong {
  background: var(--color-danger);
  color: #fff;
  box-shadow:
    5px 5px 12px rgba(169, 30, 44, 0.22),
    -5px -5px 12px rgba(255, 255, 255, 0.8);
}

.option-btn:not(.selected).correct {
  background: var(--color-success);
  color: #fff;
  opacity: 0.7;
}

.next-btn {
  font-size: 15px;
  font-weight: 700;
}

.finished {
  width: 100%;
  max-width: 400px;
  padding: 8px 0;
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

.score-display {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-dark);
}

.restart-btn {
  width: 100%;
  font-size: 15px;
  font-weight: 700;
}
</style>
