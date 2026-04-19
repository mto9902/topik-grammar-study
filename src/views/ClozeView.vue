<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import grammarData from '../data/grammar.json'
import grammarDetails from '../data/grammar-details.json'
import clozeSentences from '../data/cloze-sentences.json'
import type { GrammarPoint, GrammarDetail, GrammarExample, StudyState } from '../types/grammar'
import { getItem } from '../storage'
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
}

const allGrammar = grammarData as GrammarPoint[]
const allDetails = grammarDetails as GrammarDetail[]
const grammarById = new Map(allGrammar.map(g => [g.id, g]))

// Filters
const levelFilter = ref<'all' | '1-2' | '3-4' | '5-6'>('all')
const statusFilter = ref<'all' | 'new' | 'learning' | 'mastered'>('all')
const studyStates = ref<Record<number, StudyState>>({})

// Session state
const questions = ref<ClozeQuestion[]>([])
const currentIndex = ref(0)
const selectedOption = ref<number | null>(null)
const isCorrect = ref<boolean | null>(null)
const score = ref(0)
const isFinished = ref(false)
const showReveal = ref(false)
const phase = ref<'setup' | 'playing' | 'finished'>('setup')

onMounted(async () => {
  studyStates.value = await getItem<Record<number, StudyState>>('study_states_detail') || {}
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
  // Build pool of all examples across all grammar points
  const pool: { detail: GrammarDetail; grammar: GrammarPoint; example: GrammarExample }[] = []

  for (const detail of allDetails) {
    const grammar = grammarById.get(detail.id)
    if (!grammar) continue

    // Apply level filter
    if (levelFilter.value !== 'all' && grammar.level !== levelFilter.value) continue

    // Apply status filter
    const status = getStatus(grammar.id)
    if (statusFilter.value !== 'all' && status !== statusFilter.value) continue

    // Use cloze-sentences for Level 1-2 and 3-4 (better contextual sentences)
    // Fall back to grammar-details examples for Level 5-6 (already good)
    if (grammar.level === '1-2' || grammar.level === '3-4') {
      const cs = (clozeSentences as Record<number, GrammarExample[]>)[grammar.id]
      if (cs && cs.length > 0) {
        for (const ex of cs) {
          if (ex.korean) pool.push({ detail, grammar, example: ex })
        }
        continue
      }
    }

    // Fall back to grammar-details examples
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

  // Shuffle and take 10 (or fewer if pool is small)
  const selected = shuffle(pool).slice(0, Math.min(10, pool.length))

  // Get all grammar patterns for distractors, grouped by level
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
    }
  })
}

function startSession() {
  questions.value = generateQuestions()
  currentIndex.value = 0
  selectedOption.value = null
  isCorrect.value = null
  score.value = 0
  isFinished.value = false
  showReveal.value = false
  phase.value = questions.value.length > 0 ? 'playing' : 'setup'
}

function backToSetup() {
  phase.value = 'setup'
}

const current = computed(() => questions.value[currentIndex.value])

function selectOption(index: number) {
  if (selectedOption.value !== null) return
  playClickSound()
  selectedOption.value = index
  const correct = index === current.value.correctIndex
  isCorrect.value = correct
  if (correct) score.value++
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
    phase.value = 'finished'
  }
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
</script>

<template>
  <div class="cloze-view">
    <!-- SETUP SCREEN -->
    <div v-if="phase === 'setup'" class="setup-container">
      <div class="setup-card">
        <span class="material-symbols-outlined setup-icon">edit_note</span>
        <h2 class="setup-title">Cloze Drill</h2>
        <p class="setup-subtitle">Read a Korean sentence and identify the grammar pattern.</p>

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
          Start Session
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- PLAYING SCREEN -->
    <div v-else-if="phase === 'playing' && current" class="quiz-container">
      <!-- Header -->
      <div class="quiz-header">
        <button class="header-back" @click="backToSetup">
          <span class="material-symbols-outlined">close</span>
        </button>
        <span class="quiz-counter">{{ currentIndex + 1 }} / {{ questions.length }}</span>
        <span class="quiz-score">{{ score }} correct</span>
      </div>

      <!-- Sentence Card -->
      <div class="sentence-card">
        <div class="sentence-label">Read this sentence</div>
        <p class="sentence-korean">{{ current.sentence }}</p>
        <div class="sentence-meta">{{ current.category }} • Level {{ current.level }}</div>
      </div>

      <!-- Prompt -->
      <div class="prompt">Which grammar pattern is used?</div>

      <!-- Options -->
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
        >
          <span class="option-letter">{{ ['A', 'B', 'C', 'D'][i] }}</span>
          <span class="option-text">{{ opt }}</span>
        </button>
      </div>

      <!-- Reveal -->
      <div v-if="showReveal" class="reveal-card">
        <div class="reveal-status" :class="isCorrect ? 'correct' : 'wrong'">
          <span class="material-symbols-outlined">{{ isCorrect ? 'check_circle' : 'cancel' }}</span>
          {{ isCorrect ? 'Correct' : 'Incorrect' }}
        </div>
        <div class="reveal-grammar">
          <span class="reveal-pattern">{{ current.grammar }}</span>
          <span class="reveal-meaning">{{ current.meaning }}</span>
        </div>
        <p v-if="current.breakdown" class="reveal-breakdown">{{ current.breakdown }}</p>
        <p class="reveal-english">{{ current.english }}</p>
      </div>

      <!-- Next button -->
      <button
        v-if="selectedOption !== null"
        class="next-btn"
        @click="nextQuestion"
      >
        {{ currentIndex < questions.length - 1 ? 'Next' : 'Finish' }}
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>

    <!-- Empty state (no matching questions) -->
    <div v-else-if="phase === 'playing'" class="empty-state">
      <span class="material-symbols-outlined empty-icon">inbox</span>
      <p class="empty-text">No grammar points match your filters.</p>
      <button class="restart-btn" @click="backToSetup">Change Filters</button>
    </div>

    <!-- FINISHED SCREEN -->
    <div v-else-if="phase === 'finished'" class="finished">
      <div class="finish-card">
        <span class="material-symbols-outlined finish-icon">trophy</span>
        <h2 class="finish-title">Session Complete</h2>
        <div class="score-display">
          <span class="score-num">{{ score }}</span>
          <span class="score-den">/ {{ questions.length }}</span>
        </div>
        <p class="score-label">
          {{ score === questions.length ? 'Perfect!' : score >= questions.length * 0.7 ? 'Great work!' : 'Keep practicing!' }}
        </p>
        <div class="finish-actions">
          <button class="restart-btn" @click="startSession">Study Again</button>
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
  align-items: center;
  gap: 24px;
  text-align: center;
}

.setup-icon {
  font-size: 48px;
  color: #000;
}

.setup-title {
  font-size: 22px;
  font-weight: 800;
  color: #000;
  letter-spacing: -0.02em;
}

.setup-subtitle {
  font-size: 14px;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
  max-width: 280px;
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
  align-self: flex-start;
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

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
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

.quiz-score {
  font-size: 12px;
  font-weight: 700;
  color: #777;
}

/* Sentence Card */
.sentence-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  border: 1px solid rgba(198, 198, 198, 0.2);
  text-align: center;
}

.sentence-label {
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 14px;
}

.sentence-korean {
  font-size: clamp(1.1rem, 5vw, 1.4rem);
  font-weight: 700;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.6;
  word-break: keep-all;
}

.sentence-meta {
  font-size: 11px;
  font-weight: 700;
  color: #a0a0a0;
  margin-top: 14px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  align-items: center;
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
}

.option-btn:active {
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
}

.option-text {
  font-size: 15px;
  font-weight: 700;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.4;
}

/* Selected states */
.option-btn.selected.correct {
  border-color: #000;
  background: #000;
}

.option-btn.selected.correct .option-letter {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.option-btn.selected.correct .option-text {
  color: #fff;
}

.option-btn.selected.wrong {
  border-color: #ba1a1a;
  background: #ba1a1a;
}

.option-btn.selected.wrong .option-letter {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.option-btn.selected.wrong .option-text {
  color: #fff;
}

.option-btn:not(.selected).correct {
  border-color: #000;
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
  gap: 10px;
  border: 1px solid rgba(198, 198, 198, 0.3);
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

.reveal-grammar {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reveal-pattern {
  font-size: 18px;
  font-weight: 800;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.reveal-meaning {
  font-size: 13px;
  font-weight: 600;
  color: #777;
}

.reveal-breakdown {
  font-size: 13px;
  font-weight: 600;
  color: #474747;
  font-family: 'Noto Sans KR', sans-serif;
  background: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 4px;
}

.reveal-english {
  font-size: 13px;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
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
  gap: 16px;
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
}

.score-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-num {
  font-size: 48px;
  font-weight: 900;
  color: #000;
  line-height: 1;
}

.score-den {
  font-size: 20px;
  font-weight: 700;
  color: #777;
}

.score-label {
  font-size: 14px;
  font-weight: 600;
  color: #777;
}

.finish-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

.restart-btn {
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
}

.restart-btn:active {
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
