<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TtsButton from '../components/TtsButton.vue'
import grammarData from '../data/grammar.json'
import grammarDetails from '../data/grammar-details.json'
import clozeSentences from '../data/cloze-sentences.json'
import type { GrammarPoint, GrammarDetail, GrammarExample, StudyState } from '../types/grammar'
import { getItem, addClozePractice, addClozeSession } from '../storage'
import { playClickSound } from '../sound'

interface ClozeQuestion {
  id: number
  grammar: string
  meaning: string
  level: string
  category: string
  sentence: string
  breakdown: string
  english: string
  options: string[]
  correctIndex: number
  explanation?: string
}

interface AnswerRecord {
  questionIndex: number
  selectedOption: number
  correctOption: number
  isCorrect: boolean
  grammarId: number
}

const allGrammar = grammarData as GrammarPoint[]
const allDetails = grammarDetails as GrammarDetail[]
const grammarById = new Map(allGrammar.map(g => [g.id, g]))
const detailsById = new Map(allDetails.map(d => [d.id, d]))

// Filters
const levelFilter = ref<'all' | '1-2' | '3-4' | '5-6'>('all')
const statusFilter = ref<'all' | 'new' | 'learning' | 'mastered'>('all')
const studyStates = ref<Record<number, StudyState>>({})

// Session state
const questions = ref<ClozeQuestion[]>([])
const currentIndex = ref(0)
const selectedOption = ref<number | null>(null)
const isCorrect = ref<boolean | null>(null)
const showReveal = ref(false)
const phase = ref<'setup' | 'playing' | 'review' | 'finished'>('setup')
const answerHistory = ref<AnswerRecord[]>([])
const sessionStartTime = ref<number>(0)

// Practice tracking
const totalPracticed = ref(0)

onMounted(async () => {
  studyStates.value = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  const history = await getItem<any[]>('cloze_practice_history') || []
  totalPracticed.value = history.length
})

function getStatus(id: number): StudyState['status'] {
  return studyStates.value[id]?.status || 'new'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateQuestions(): ClozeQuestion[] {
  const pool: { detail: GrammarDetail; grammar: GrammarPoint; example: GrammarExample }[] = []

  for (const detail of allDetails) {
    const grammar = grammarById.get(detail.id)
    if (!grammar) continue

    if (levelFilter.value !== 'all' && grammar.level !== levelFilter.value) continue

    const status = getStatus(grammar.id)
    if (statusFilter.value !== 'all' && status !== statusFilter.value) continue

    if (grammar.level === '1-2' || grammar.level === '3-4') {
      const cs = (clozeSentences as Record<number, GrammarExample[]>)[grammar.id]
      if (cs && cs.length > 0) {
        for (const ex of cs) {
          if (ex.korean) pool.push({ detail, grammar, example: ex })
        }
        continue
      }
    }

    if (!detail.rules) continue
    for (const rule of detail.rules) {
      if (!rule.examples) continue
      for (const ex of rule.examples) {
        if (!ex.korean) continue
        pool.push({ detail, grammar, example: ex })
      }
    }
  }

  if (pool.length === 0) return []

  const selected = shuffle(pool).slice(0, Math.min(10, pool.length))

  const byLevel = new Map<string, GrammarPoint[]>()
  for (const g of allGrammar) {
    const arr = byLevel.get(g.level) || []
    arr.push(g)
    byLevel.set(g.level, arr)
  }

  return selected.map(({ detail, grammar, example }) => {
    const sameLevel = byLevel.get(grammar.level) || []
    const wrong = shuffle(sameLevel.filter(g => g.id !== grammar.id)).slice(0, 3)
    const opts = shuffle([grammar, ...wrong])
    const correctIdx = opts.findIndex(g => g.id === grammar.id)

    return {
      id: grammar.id,
      grammar: grammar.grammar,
      meaning: grammar.meaning,
      level: grammar.level,
      category: grammar.category,
      sentence: example.korean,
      breakdown: example.breakdown || '',
      english: example.english,
      options: opts.map(g => g.grammar),
      correctIndex: correctIdx,
      explanation: detail.explanation,
    }
  })
}

async function startSession() {
  playClickSound()
  questions.value = generateQuestions()
  if (questions.value.length === 0) {
    phase.value = 'setup'
    return
  }
  currentIndex.value = 0
  selectedOption.value = null
  isCorrect.value = null
  showReveal.value = false
  answerHistory.value = []
  sessionStartTime.value = Date.now()
  phase.value = 'playing'
}

function backToSetup() {
  playClickSound()
  phase.value = 'setup'
}

const current = computed(() => questions.value[currentIndex.value])
const progressPercent = computed(() => {
  if (questions.value.length === 0) return 0
  return ((currentIndex.value) / questions.value.length) * 100
})

const accuracyPercent = computed(() => {
  if (answerHistory.value.length === 0) return 0
  const correct = answerHistory.value.filter(a => a.isCorrect).length
  return Math.round((correct / answerHistory.value.length) * 100)
})

async function selectOption(index: number) {
  if (selectedOption.value !== null) return
  playClickSound()
  selectedOption.value = index
  const correct = index === current.value.correctIndex
  isCorrect.value = correct

  answerHistory.value.push({
    questionIndex: currentIndex.value,
    selectedOption: index,
    correctOption: current.value.correctIndex,
    isCorrect: correct,
    grammarId: current.value.id,
  })

  await addClozePractice({
    grammarId: current.value.id,
    practicedAt: Date.now(),
    correct,
    sentenceIndex: currentIndex.value,
  })

  showReveal.value = true
}

function nextQuestion() {
  playClickSound()
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    selectedOption.value = null
    isCorrect.value = null
    showReveal.value = false
  } else {
    finishSession()
  }
}

async function finishSession() {
  const duration = Math.floor((Date.now() - sessionStartTime.value) / 1000)
  const correctCount = answerHistory.value.filter(a => a.isCorrect).length

  await addClozeSession({
    date: Date.now(),
    totalQuestions: questions.value.length,
    correctCount,
    duration,
    levelFilter: levelFilter.value,
    statusFilter: statusFilter.value,
  })

  const history = await getItem<any[]>('cloze_practice_history') || []
  totalPracticed.value = history.length

  phase.value = 'finished'
}

function startReview() {
  playClickSound()
  const wrongAnswers = answerHistory.value.filter(a => !a.isCorrect)
  if (wrongAnswers.length === 0) {
    phase.value = 'setup'
    return
  }
  questions.value = wrongAnswers.map(record => {
    const originalQuestion = questions.value[record.questionIndex]
    return {
      ...originalQuestion,
      options: shuffle([...originalQuestion.options]),
      correctIndex: shuffle([0, 1, 2, 3]).findIndex((_, idx) => {
        return originalQuestion.options[idx] === originalQuestion.grammar
      }),
    }
  })
  currentIndex.value = 0
  selectedOption.value = null
  isCorrect.value = null
  showReveal.value = false
  answerHistory.value = []
  phase.value = 'playing'
}

const levelOptions = [
  { key: 'all' as const, label: 'All Levels' },
  { key: '1-2' as const, label: 'Level 1–2' },
  { key: '3-4' as const, label: 'Level 3–4' },
  { key: '5-6' as const, label: 'Level 5–6' },
]

const statusOptions = [
  { key: 'all' as const, label: 'All' },
  { key: 'new' as const, label: 'New' },
  { key: 'learning' as const, label: 'Learning' },
  { key: 'mastered' as const, label: 'Mastered' },
]

const wrongAnswers = computed(() => {
  return answerHistory.value.filter(a => !a.isCorrect)
})

const correctAnswers = computed(() => {
  return answerHistory.value.filter(a => a.isCorrect)
})
</script>

<template>
  <div class="cloze-view">
    <!-- SETUP SCREEN -->
    <div v-if="phase === 'setup'" class="setup-container">
      <div class="setup-card">
        <div class="setup-header">
          <span class="material-symbols-outlined setup-icon">edit_note</span>
          <div class="setup-title-group">
            <h2 class="setup-title">Cloze Practice</h2>
            <p class="total-practiced">{{ totalPracticed }} practiced so far</p>
          </div>
        </div>

        <p class="setup-subtitle">See a grammar pattern and choose the correct sentence that uses it.</p>

        <!-- Level Filter -->
        <div class="filter-section">
          <label class="filter-label">
            <span class="material-symbols-outlined">signal_cellular_alt</span>
            Level
          </label>
          <div class="filter-pills">
            <button
              v-for="opt in levelOptions"
              :key="opt.key"
              :class="['pill', { active: levelFilter === opt.key }]"
              @click="levelFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Status Filter -->
        <div class="filter-section">
          <label class="filter-label">
            <span class="material-symbols-outlined">bookmark</span>
            Status
          </label>
          <div class="filter-pills">
            <button
              v-for="opt in statusOptions"
              :key="opt.key"
              :class="['pill', { active: statusFilter === opt.key }]"
              @click="statusFilter = opt.key"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <button class="start-btn" @click="startSession">
          Start Practice
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- PLAYING SCREEN -->
    <div v-else-if="phase === 'playing' && current" class="quiz-container">
      <!-- Progress Bar -->
      <div class="progress-bar-container">
        <div class="progress-bar-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Header -->
      <div class="quiz-header">
        <button class="header-back" @click="backToSetup">
          <span class="material-symbols-outlined">close</span>
        </button>
        <span class="quiz-counter">{{ currentIndex + 1 }} / {{ questions.length }}</span>
        <span class="quiz-accuracy">{{ accuracyPercent }}% accuracy</span>
      </div>

      <!-- Grammar Pattern Card -->
      <div class="grammar-card">
        <div class="grammar-label">Practice this pattern</div>
        <h3 class="grammar-pattern">{{ current.grammar }}</h3>
        <p class="grammar-meaning">{{ current.meaning }}</p>
        <div class="grammar-meta">{{ current.category }} • Level {{ current.level }}</div>
      </div>

      <!-- Prompt -->
      <div class="prompt">Which sentence uses this grammar?</div>

      <!-- Options (Sentences) -->
      <div class="options">
        <button
          v-for="(opt, i) in current.options"
          :key="i"
          :class="[
            'option-btn',
            {
              selected: selectedOption === i,
              correct: selectedOption !== null && i === current.correctIndex,
              wrong: selectedOption === i && i !== current.correctIndex,
            }
          ]"
          @click="selectOption(i)"
          :disabled="selectedOption !== null"
        >
          <span class="option-letter">{{ ['A', 'B', 'C', 'D'][i] }}</span>
          <span class="option-text">{{ opt }}</span>
          <span v-if="selectedOption !== null && i === current.correctIndex" class="option-check">
            <span class="material-symbols-outlined">check_circle</span>
          </span>
          <span v-if="selectedOption === i && i !== current.correctIndex" class="option-cross">
            <span class="material-symbols-outlined">cancel</span>
          </span>
        </button>
      </div>

      <!-- Reveal Card -->
      <div v-if="showReveal" class="reveal-card">
        <div class="reveal-status" :class="isCorrect ? 'correct' : 'wrong'">
          <span class="material-symbols-outlined">{{ isCorrect ? 'check_circle' : 'cancel' }}</span>
          {{ isCorrect ? 'Correct' : 'Incorrect' }}
        </div>

        <div class="reveal-sentence">
          <div class="sentence-row">
            <p class="sentence-full">{{ current.sentence }}</p>
            <TtsButton :text="current.sentence" label="cloze answer sentence" />
          </div>
          <p v-if="current.breakdown" class="sentence-breakdown">{{ current.breakdown }}</p>
          <p class="sentence-english">{{ current.english }}</p>
        </div>

        <!-- Explanation from grammar-details -->
        <div v-if="current.explanation" class="reveal-explanation">
          <span class="explanation-label">Usage:</span>
          <p>{{ current.explanation }}</p>
        </div>
      </div>

      <!-- Next button -->
      <button
        v-if="selectedOption !== null"
        class="next-btn"
        @click="nextQuestion"
      >
        {{ currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Session' }}
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="phase === 'playing'" class="empty-state">
      <span class="material-symbols-outlined empty-icon">inbox</span>
      <p class="empty-text">No grammar points match your filters.</p>
      <button class="restart-btn" @click="backToSetup">Change Filters</button>
    </div>

    <!-- REVIEW SCREEN -->
    <div v-else-if="phase === 'review'" class="review-container">
      <div class="review-card">
        <span class="material-symbols-outlined review-icon">assignment_turned_in</span>
        <h2 class="review-title">Review Mistakes</h2>
        <p class="review-subtitle">You got {{ wrongAnswers.length }} question{{ wrongAnswers.length === 1 ? '' : 's' }} wrong. Review them now?</p>

        <div class="review-actions">
          <button class="review-btn primary" @click="startReview">
            Review Mistakes
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <button class="review-btn secondary" @click="backToSetup">
            Back to Setup
          </button>
        </div>
      </div>
    </div>

    <!-- FINISHED SCREEN -->
    <div v-else-if="phase === 'finished'" class="finished">
      <div class="finish-card">
        <span class="material-symbols-outlined finish-icon">done_all</span>
        <h2 class="finish-title">Session Complete</h2>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ correctAnswers.length }}</span>
            <span class="stat-label">Correct</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ wrongAnswers.length }}</span>
            <span class="stat-label">Incorrect</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ accuracyPercent }}%</span>
            <span class="stat-label">Accuracy</span>
          </div>
        </div>

        <p class="finish-message" v-if="accuracyPercent === 100">Perfect! All answers correct.</p>
        <p class="finish-message" v-else-if="accuracyPercent >= 70">Good work! Keep practicing.</p>
        <p class="finish-message" v-else>Keep studying! Review the grammar patterns you missed.</p>

        <div class="finish-actions">
          <button v-if="wrongAnswers.length > 0" class="review-btn primary" @click="phase = 'review'">
            Review Mistakes
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <button class="finish-btn" @click="startSession">Practice Again</button>
          <button class="secondary-btn" @click="backToSetup">Change Filters</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cloze-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 0 24px;
  min-height: 100%;
}

/* SETUP SCREEN */
.setup-container {
  width: 100%;
  max-width: 520px;
  padding: 8px 4px;
}

.setup-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  border: 1px solid rgba(198, 198, 198, 0.2);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.setup-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.setup-icon {
  font-size: 48px;
  color: #000;
  flex-shrink: 0;
}

.setup-title-group {
  flex: 1;
}

.setup-title {
  font-size: 22px;
  font-weight: 800;
  color: #000;
  letter-spacing: -0.02em;
  margin: 0 0 4px 0;
}

.total-practiced {
  font-size: 13px;
  font-weight: 600;
  color: #777;
  margin: 0;
}

.setup-subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
  margin: 0;
}

.filter-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filter-label .material-symbols-outlined {
  font-size: 16px;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  background: #f3f3f4;
  border: 1.5px solid transparent;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #777;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.pill.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.pill:active {
  transform: scale(0.97);
}

.start-btn {
  width: 100%;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.12);
  margin-top: 8px;
}

.start-btn:active {
  transform: translateY(1px);
  background: #3b3b3b;
}

.start-btn .material-symbols-outlined {
  font-size: 18px;
}

/* PLAYING SCREEN */
.quiz-container {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Progress Bar */
.progress-bar-container {
  width: 100%;
  height: 4px;
  background: #f3f3f4;
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: #000;
  transition: width 0.3s ease;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px;
}

.header-back {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #777;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s ease;
}

.header-back:active {
  background: rgba(0, 0, 0, 0.05);
}

.header-back .material-symbols-outlined {
  font-size: 22px;
}

.quiz-counter {
  font-size: 12px;
  font-weight: 700;
  color: #777;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.quiz-accuracy {
  font-size: 12px;
  font-weight: 700;
  color: #000;
}

/* Grammar Pattern Card */
.grammar-card {
  background: #000;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  color: #fff;
}

.grammar-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-bottom: 12px;
}

.grammar-pattern {
  font-size: clamp(1.3rem, 6vw, 1.6rem);
  font-weight: 900;
  font-family: 'Noto Sans KR', sans-serif;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.grammar-meaning {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
  margin: 0 0 12px 0;
}

.grammar-meta {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

/* Prompt */
.prompt {
  font-size: 14px;
  font-weight: 700;
  color: #000;
  text-align: center;
  letter-spacing: -0.01em;
}

/* Options */
.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-btn {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: #fff;
  border: 1.5px solid rgba(198, 198, 198, 0.4);
  border-radius: 12px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  position: relative;
}

.option-btn:disabled {
  cursor: default;
}

.option-btn:not(:disabled):active {
  transform: scale(0.99);
  background: #f9f9f9;
}

.option-letter {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f3f3f4;
  color: #777;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 2px;
}

.option-text {
  font-size: 14px;
  font-weight: 600;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.6;
  flex: 1;
  word-break: keep-all;
}

.option-check,
.option-cross {
  flex-shrink: 0;
  margin-top: 2px;
}

.option-check .material-symbols-outlined {
  font-size: 22px;
  color: #000;
}

.option-cross .material-symbols-outlined {
  font-size: 22px;
  color: #ba1a1a;
}

/* Selected states */
.option-btn.selected.correct {
  border-color: #000;
  background: #f9f9f9;
}

.option-btn.selected.correct .option-letter {
  background: #000;
  color: #fff;
}

.option-btn.selected.wrong {
  border-color: #ba1a1a;
  background: #fef2f2;
}

.option-btn.selected.wrong .option-letter {
  background: #ba1a1a;
  color: #fff;
}

.option-btn:not(.selected).correct {
  border-color: #000;
  background: #f9f9f9;
}

.option-btn:not(.selected).correct .option-letter {
  background: #000;
  color: #fff;
}

/* Reveal Card */
.reveal-card {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid rgba(198, 198, 198, 0.3);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reveal-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.reveal-status.correct {
  color: #000;
}

.reveal-status.wrong {
  color: #ba1a1a;
}

.reveal-status .material-symbols-outlined {
  font-size: 20px;
}

.reveal-sentence {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sentence-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.sentence-full {
  font-size: 16px;
  font-weight: 700;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.6;
  word-break: keep-all;
  margin: 0;
}

@media (max-width: 360px) {
  .sentence-row {
    gap: 8px;
  }
}

.sentence-breakdown {
  font-size: 13px;
  font-weight: 600;
  color: #474747;
  font-family: 'Noto Sans KR', sans-serif;
  background: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  margin: 0;
}

.sentence-english {
  font-size: 13px;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
  margin: 0;
}

.reveal-explanation {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  border-left: 3px solid #000;
}

.explanation-label {
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: block;
  margin-bottom: 6px;
}

.reveal-explanation p {
  font-size: 13px;
  font-weight: 500;
  color: #474747;
  line-height: 1.6;
  margin: 0;
}

/* Next button */
.next-btn {
  width: 100%;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.12);
}

.next-btn:active {
  transform: translateY(1px);
  background: #3b3b3b;
}

.next-btn .material-symbols-outlined {
  font-size: 18px;
}

/* Empty state */
.empty-state {
  width: 100%;
  max-width: 400px;
  padding: 60px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-icon {
  font-size: 48px;
  color: #c6c6c6;
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: #777;
}

/* REVIEW SCREEN */
.review-container {
  width: 100%;
  max-width: 400px;
  padding: 40px 16px;
}

.review-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  border: 1px solid rgba(198, 198, 198, 0.2);
}

.review-icon {
  font-size: 56px;
  color: #000;
}

.review-title {
  font-size: 20px;
  font-weight: 800;
  color: #000;
  letter-spacing: -0.02em;
  margin: 0;
}

.review-subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
  margin: 0;
}

.review-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.review-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.review-btn.primary {
  background: #000;
  color: #fff;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.12);
}

.review-btn.primary:active {
  transform: translateY(1px);
  background: #3b3b3b;
}

.review-btn.secondary {
  background: transparent;
  color: #000;
  border: 2px solid #000;
}

.review-btn.secondary:active {
  background: rgba(0, 0, 0, 0.04);
}

/* FINISHED SCREEN */
.finished {
  width: 100%;
  max-width: 400px;
  padding: 40px 16px;
}

.finish-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  border: 1px solid rgba(198, 198, 198, 0.2);
}

.finish-icon {
  font-size: 56px;
  color: #000;
}

.finish-title {
  font-size: 20px;
  font-weight: 800;
  color: #000;
  letter-spacing: -0.02em;
  margin: 0;
}

.stats-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: 900;
  color: #000;
  line-height: 1;
}

.stat-label {
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.finish-message {
  font-size: 14px;
  font-weight: 600;
  color: #777;
  line-height: 1.5;
  margin: 0;
}

.finish-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.finish-btn {
  width: 100%;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.12);
}

.finish-btn:active {
  transform: translateY(1px);
  background: #3b3b3b;
}

.secondary-btn {
  width: 100%;
  background: transparent;
  color: #000;
  border: 2px solid #000;
  border-radius: 12px;
  padding: 14px 24px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.secondary-btn:active {
  background: rgba(0, 0, 0, 0.04);
}
</style>
