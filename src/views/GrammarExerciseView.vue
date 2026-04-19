<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import TtsButton from '../components/TtsButton.vue'
import grammarDetails from '../data/grammar-details.json'
import type { GrammarPoint, GrammarDetail } from '../types/grammar'
import type { ExerciseBreakdownItem, ExerciseExampleCard, ExercisePack, PracticeCheck } from '../types/exercise'
import { fetchExercisePack, regenerateExercisePack } from '../api/exercise'
import {
  addGrammarExerciseVisit,
  getCachedExercisePack,
  getOrCreateExerciseClientId,
  recordGrammarExerciseStats,
  setCachedExercisePack,
} from '../storage'
import { playClickSound } from '../sound'

type SectionKey = 'overview' | 'examples' | 'practice' | 'summary'

const selectedGrammar = inject('selectedGrammar') as Ref<GrammarPoint | null>
const goBack = inject('goBack') as () => void
const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void

const grammar = computed(() => selectedGrammar.value)
const detail = computed<GrammarDetail | undefined>(() => {
  if (!grammar.value) return undefined
  return (grammarDetails as GrammarDetail[]).find(item => item.id === grammar.value?.id)
})

const clientId = ref('')
const pack = ref<ExercisePack | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const regenerating = ref(false)
const errorMessage = ref('')

const activeCheckIndex = ref(0)
const selectedOption = ref<number | null>(null)
const answeredCorrectly = ref<boolean | null>(null)
const visitStartedAt = ref(Date.now())
const visitSaved = ref(false)
const questionsAnswered = ref(0)
const correctAnswers = ref(0)
const revealedExamples = ref<number[]>([])
const activeSection = ref<SectionKey>('overview')

const overviewRef = ref<HTMLElement | null>(null)
const examplesRef = ref<HTMLElement | null>(null)
const practiceRef = ref<HTMLElement | null>(null)
const summaryRef = ref<HTMLElement | null>(null)

const sectionRefs: Record<SectionKey, Ref<HTMLElement | null>> = {
  overview: overviewRef,
  examples: examplesRef,
  practice: practiceRef,
  summary: summaryRef,
}

const currentCheck = computed<PracticeCheck | null>(() => {
  if (!pack.value) return null
  return pack.value.checks[activeCheckIndex.value] || null
})

const completedChecks = computed(() => {
  if (!pack.value) return false
  return activeCheckIndex.value >= pack.value.checks.length
})

const accuracyPercent = computed(() => {
  if (questionsAnswered.value === 0) return 0
  return Math.round((correctAnswers.value / questionsAnswered.value) * 100)
})

function normalizedBreakdownItems(example: ExerciseExampleCard): ExerciseBreakdownItem[] {
  if (Array.isArray(example.breakdownItems) && example.breakdownItems.length > 0) {
    return example.breakdownItems
  }

  if (!example.breakdown) return []

  return example.breakdown
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [word, middle, meaning] = line.split('|').map(part => part?.trim() || '')
      return {
        word: word || line,
        romanization: '',
        meaning: meaning || middle || '',
        grammarNote: middle && meaning ? middle : '',
      }
    })
}

function setPack(nextPack: ExercisePack) {
  pack.value = nextPack
  activeCheckIndex.value = 0
  selectedOption.value = null
  answeredCorrectly.value = null
  questionsAnswered.value = 0
  correctAnswers.value = 0
  revealedExamples.value = []
  visitStartedAt.value = Date.now()
  visitSaved.value = false
}

async function persistVisit() {
  if (visitSaved.value || !pack.value || questionsAnswered.value === 0 || !grammar.value) return

  visitSaved.value = true
  const endedAt = Date.now()

  await Promise.all([
    addGrammarExerciseVisit({
      grammarId: grammar.value.id,
      startedAt: visitStartedAt.value,
      endedAt,
      version: pack.value.version,
      questionsAnswered: questionsAnswered.value,
      correctCount: correctAnswers.value,
      examplesRevealed: revealedExamples.value.length,
    }),
    recordGrammarExerciseStats({
      grammarId: grammar.value.id,
      lastPracticedAt: endedAt,
      questionsAnswered: questionsAnswered.value,
      correctCount: correctAnswers.value,
      examplesRevealed: revealedExamples.value.length,
    }),
  ])
}

async function hydratePack() {
  if (!grammar.value) {
    loading.value = false
    return
  }

  clientId.value = await getOrCreateExerciseClientId()

  const cached = await getCachedExercisePack(grammar.value.id)
  if (cached) {
    setPack(cached.pack)
    loading.value = false
  }

  try {
    const freshPack = await fetchExercisePack(grammar.value.id, clientId.value)
    if (!pack.value || freshPack.version > pack.value.version) {
      setPack(freshPack)
    }
    await setCachedExercisePack(grammar.value.id, freshPack)
    errorMessage.value = ''
  } catch (error) {
    if (!pack.value) {
      errorMessage.value = error instanceof Error ? error.message : 'Unable to load practice content right now.'
    }
  } finally {
    loading.value = false
  }
}

async function retryLoad() {
  if (!grammar.value) return
  playClickSound()
  loading.value = !pack.value
  refreshing.value = true
  errorMessage.value = ''

  try {
    const freshPack = await fetchExercisePack(grammar.value.id, clientId.value)
    setPack(freshPack)
    await setCachedExercisePack(grammar.value.id, freshPack)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Unable to load practice content right now.'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function regeneratePack() {
  if (!grammar.value || !clientId.value) return
  playClickSound()
  regenerating.value = true
  errorMessage.value = ''

  try {
    await persistVisit()
    const freshPack = await regenerateExercisePack(grammar.value.id, clientId.value)
    setPack(freshPack)
    await setCachedExercisePack(grammar.value.id, freshPack)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Regeneration failed.'
  } finally {
    regenerating.value = false
  }
}

function scrollToSection(section: SectionKey, shouldPlaySound = true) {
  activeSection.value = section
  if (shouldPlaySound) {
    playClickSound()
  }
  sectionRefs[section].value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function revealExampleSupport(index: number) {
  playClickSound()
  if (!revealedExamples.value.includes(index)) {
    revealedExamples.value = [...revealedExamples.value, index]
  }
}

function selectOption(index: number) {
  if (!currentCheck.value || selectedOption.value !== null) return
  playClickSound()
  selectedOption.value = index
  answeredCorrectly.value = index === currentCheck.value.correctIndex
  questionsAnswered.value += 1
  if (answeredCorrectly.value) {
    correctAnswers.value += 1
  }
}

function nextCheck() {
  if (!pack.value) return
  playClickSound()
  if (activeCheckIndex.value < pack.value.checks.length - 1) {
    activeCheckIndex.value += 1
    selectedOption.value = null
    answeredCorrectly.value = null
    return
  }

  activeCheckIndex.value = pack.value.checks.length
  selectedOption.value = null
  answeredCorrectly.value = null
  scrollToSection('summary', false)
}

async function doneForNow() {
  playClickSound()
  await persistVisit()
  scrollToSection('summary', false)
}

function backToDetail() {
  playClickSound()
  navigateTo('detail', grammar.value || undefined)
}

function updateStatus() {
  playClickSound()
  navigateTo('grammar-status', grammar.value || undefined)
}

onMounted(() => {
  hydratePack()
})

onBeforeUnmount(() => {
  void persistVisit()
})
</script>

<template>
  <div v-if="grammar" class="exercise-view">
    <section ref="overviewRef" class="hero-card">
      <div class="hero-meta">{{ grammar.category }} • Level {{ grammar.level }}</div>
      <h2 class="hero-grammar">{{ grammar.grammar }}</h2>
      <p class="hero-meaning">{{ grammar.meaning }}</p>
      <p class="hero-summary">
        {{ pack?.usageSummary || detail?.explanation || 'Practice this grammar with fresh examples and short checks.' }}
      </p>

      <div class="hero-actions">
        <button class="primary-btn" @click="scrollToSection('practice')">
          Start Checks
          <span class="material-symbols-outlined">arrow_downward</span>
        </button>
        <button class="secondary-btn" @click="regeneratePack" :disabled="regenerating || loading">
          {{ regenerating ? 'Refreshing...' : 'Regenerate Set' }}
        </button>
      </div>
    </section>

    <div class="section-nav">
      <button
        v-for="section in (['overview', 'examples', 'practice', 'summary'] as SectionKey[])"
        :key="section"
        class="nav-chip"
        :class="{ active: activeSection === section }"
        @click="scrollToSection(section)"
      >
        {{ section === 'overview' ? 'Overview' : section === 'examples' ? 'Examples' : section === 'practice' ? 'Practice' : 'Summary' }}
      </button>
    </div>

    <section ref="examplesRef" class="section-card">
      <div class="section-heading">
        <div>
          <span class="section-label">Examples</span>
          <h3>Fresh sentence set</h3>
        </div>
      </div>

      <div v-if="pack?.examples?.length" class="example-list">
        <article v-for="(example, index) in pack.examples" :key="`${pack.version}-${index}`" class="example-card">
          <span class="example-index">Example {{ index + 1 }}</span>
          <div class="sentence-row">
            <p class="example-korean">{{ example.korean }}</p>
            <TtsButton :text="example.korean" label="example sentence" />
          </div>
          <button
            v-if="!revealedExamples.includes(index)"
            class="support-btn"
            @click="revealExampleSupport(index)"
          >
            Reveal breakdown and English
          </button>
          <template v-else>
            <div v-if="normalizedBreakdownItems(example).length" class="breakdown-list">
              <div
                v-for="(item, breakdownIndex) in normalizedBreakdownItems(example)"
                :key="`${index}-${breakdownIndex}-${item.word}`"
                class="breakdown-row"
              >
                <div class="breakdown-main">
                  <strong class="breakdown-word">{{ item.word }}</strong>
                  <span v-if="item.romanization" class="breakdown-romanization">{{ item.romanization }}</span>
                </div>
                <div class="breakdown-meaning">{{ item.meaning }}</div>
                <div v-if="item.conjugationBefore || item.conjugationAfter || item.grammarNote" class="breakdown-meta">
                  <span v-if="item.conjugationBefore || item.conjugationAfter">
                    {{ item.conjugationBefore || item.word }} → {{ item.conjugationAfter || item.word }}
                  </span>
                  <span v-if="item.grammarNote">{{ item.grammarNote }}</span>
                </div>
              </div>
            </div>
            <p v-else-if="example.breakdown" class="example-breakdown">{{ example.breakdown }}</p>
            <p class="example-english">{{ example.english }}</p>
            <div v-if="example.notableGrammarPoints?.length" class="grammar-notes">
              <span class="grammar-notes-label">Also notice</span>
              <ul class="grammar-notes-list">
                <li v-for="(note, noteIndex) in example.notableGrammarPoints" :key="`${index}-note-${noteIndex}`">
                  {{ note }}
                </li>
              </ul>
            </div>
          </template>
          <p v-if="example.whyItWorks" class="example-why">{{ example.whyItWorks }}</p>
        </article>
      </div>

      <div v-else-if="loading" class="state-card">
        <p>Loading AI-generated examples...</p>
      </div>

      <div v-else class="state-card">
        <p>{{ errorMessage || 'Examples are unavailable right now.' }}</p>
        <button class="secondary-btn" @click="retryLoad" :disabled="refreshing">
          {{ refreshing ? 'Retrying...' : 'Retry loading examples' }}
        </button>
      </div>
    </section>

    <section ref="practiceRef" class="section-card">
      <div class="section-heading">
        <div>
          <span class="section-label">Practice</span>
          <h3>Short checks</h3>
        </div>
        <span v-if="pack" class="section-count">
          {{ Math.min(activeCheckIndex + 1, pack.checks.length) }} / {{ pack.checks.length }}
        </span>
      </div>

      <div v-if="currentCheck" class="practice-card">
        <span class="question-type">{{ currentCheck.type === 'sentence_choice' ? 'Sentence choice' : 'Meaning choice' }}</span>
        <p class="question-prompt">{{ currentCheck.prompt }}</p>
        <div class="question-target">{{ grammar.grammar }}</div>

        <div class="options">
          <div
            v-for="(option, index) in currentCheck.options"
            :key="`${currentCheck.id}-${index}`"
            class="option-row"
          >
            <button
              :class="[
                'option-btn',
                {
                  selected: selectedOption === index,
                  correct: selectedOption !== null && index === currentCheck.correctIndex,
                  wrong: selectedOption === index && index !== currentCheck.correctIndex,
                },
              ]"
              :disabled="selectedOption !== null"
              @click="selectOption(index)"
            >
              <span class="option-letter">{{ ['A', 'B', 'C', 'D'][index] }}</span>
              <span class="option-text">{{ option }}</span>
            </button>
            <TtsButton
              v-if="currentCheck.type === 'sentence_choice'"
              :text="option"
              label="answer option"
              size="md"
            />
          </div>
        </div>

        <div v-if="selectedOption !== null" class="feedback-card">
          <div class="feedback-state" :class="answeredCorrectly ? 'correct' : 'wrong'">
            <span class="material-symbols-outlined">
              {{ answeredCorrectly ? 'check_circle' : 'cancel' }}
            </span>
            {{ answeredCorrectly ? 'Correct' : 'Try again next set' }}
          </div>
          <p class="feedback-text">{{ currentCheck.explanation }}</p>
        </div>

        <div v-if="selectedOption !== null" class="practice-actions">
          <button class="primary-btn" @click="nextCheck">
            {{ activeCheckIndex < (pack?.checks.length || 0) - 1 ? 'Next Check' : 'Finish This Set' }}
          </button>
          <button class="secondary-btn" @click="doneForNow">Done for now</button>
        </div>
      </div>

      <div v-else-if="completedChecks && pack" class="practice-card complete-card">
        <span class="question-type">Set complete</span>
        <h4>You finished version {{ pack.version }}.</h4>
        <p class="feedback-text">
          You answered {{ questionsAnswered }} checks with {{ accuracyPercent }}% accuracy.
        </p>
        <div class="practice-actions">
          <button class="primary-btn" @click="regeneratePack" :disabled="regenerating">
            {{ regenerating ? 'Refreshing...' : 'Regenerate New Set' }}
          </button>
          <button class="secondary-btn" @click="doneForNow">Done for now</button>
        </div>
      </div>

      <div v-else-if="loading" class="state-card">
        <p>Preparing your practice set...</p>
      </div>

      <div v-else class="state-card">
        <p>{{ errorMessage || 'Practice is unavailable right now.' }}</p>
        <button class="secondary-btn" @click="retryLoad" :disabled="refreshing">
          {{ refreshing ? 'Retrying...' : 'Retry loading practice' }}
        </button>
      </div>
    </section>

    <section ref="summaryRef" class="section-card summary-card">
      <div class="section-heading">
        <div>
          <span class="section-label">Summary</span>
          <h3>This visit</h3>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-value">{{ questionsAnswered }}</span>
          <span class="summary-name">Checks</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ correctAnswers }}</span>
          <span class="summary-name">Correct</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ accuracyPercent }}%</span>
          <span class="summary-name">Accuracy</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ revealedExamples.length }}</span>
          <span class="summary-name">Supports opened</span>
        </div>
      </div>

      <div class="summary-actions">
        <button class="primary-btn" @click="scrollToSection('practice')">
          {{ completedChecks ? 'Review summary above' : 'Continue practice' }}
        </button>
        <button class="secondary-btn" @click="regeneratePack" :disabled="regenerating || loading">
          {{ regenerating ? 'Refreshing...' : 'Regenerate New Set' }}
        </button>
        <button class="secondary-btn" @click="backToDetail">Back to Detail</button>
        <button class="secondary-btn" @click="updateStatus">Update Status</button>
        <button class="secondary-btn" @click="goBack">Close Workspace</button>
      </div>
    </section>
  </div>

  <div v-else class="missing-state">
    <p>No grammar point is selected.</p>
  </div>
</template>

<style scoped>
.exercise-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.hero-card,
.section-card,
.state-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
}

.hero-meta,
.section-label,
.question-type,
.example-index,
.summary-name {
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-grammar {
  margin-top: 8px;
  font-size: clamp(2rem, 8vw, 3.2rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.hero-meaning,
.hero-summary {
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.6;
  color: #474747;
}

.hero-actions,
.practice-actions,
.summary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.primary-btn,
.secondary-btn,
.support-btn,
.nav-chip {
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.primary-btn,
.secondary-btn,
.support-btn {
  min-height: 46px;
  padding: 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
}

.primary-btn {
  background: #000;
  color: #fff;
}

.secondary-btn,
.support-btn,
.nav-chip {
  background: #fff;
  color: #000;
  border: 1px solid rgba(198, 198, 198, 0.35);
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.6;
}

.primary-btn:not(:disabled):active,
.secondary-btn:not(:disabled):active,
.support-btn:active,
.nav-chip:active {
  transform: scale(0.97);
}

.section-nav {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.nav-chip {
  min-height: 40px;
  padding: 0 14px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
}

.nav-chip.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
}

.section-heading h3 {
  margin-top: 4px;
  font-size: 20px;
  font-weight: 800;
  color: #000;
}

.section-count {
  font-size: 12px;
  font-weight: 700;
  color: #777;
}

.example-list,
.summary-grid {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.example-card {
  background: #f9f9f9;
  border-radius: 14px;
  padding: 16px;
}

.sentence-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.example-korean {
  margin: 0;
  font-size: 17px;
  line-height: 1.6;
  color: #000;
  font-weight: 700;
  font-family: 'Noto Sans KR', sans-serif;
}

.example-breakdown,
.example-english,
.example-why,
.feedback-text {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.6;
  color: #474747;
}

.example-breakdown {
  background: #fff;
  padding: 10px 12px;
  border-radius: 10px;
  font-family: 'Noto Sans KR', sans-serif;
}

.breakdown-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakdown-row {
  background: #fff;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.breakdown-main {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.breakdown-word {
  font-size: 15px;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.breakdown-romanization {
  font-size: 12px;
  color: #777;
  letter-spacing: 0.02em;
}

.breakdown-meaning {
  font-size: 13px;
  color: #111;
  line-height: 1.5;
}

.breakdown-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #777;
  line-height: 1.5;
}

.grammar-notes {
  margin-top: 10px;
  background: #fff;
  border-radius: 10px;
  padding: 12px;
}

.grammar-notes-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
}

.grammar-notes-list {
  margin: 0;
  padding-left: 18px;
  color: #474747;
  font-size: 13px;
  line-height: 1.5;
}

.practice-card {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.question-prompt {
  font-size: 16px;
  line-height: 1.6;
  color: #111;
}

.question-target {
  border-radius: 14px;
  background: #000;
  color: #fff;
  padding: 18px;
  text-align: center;
  font-size: 22px;
  font-weight: 900;
  font-family: 'Noto Sans KR', sans-serif;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.option-btn {
  flex: 1;
  text-align: left;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-radius: 14px;
  border: 1px solid rgba(198, 198, 198, 0.35);
  background: #fff;
  padding: 14px 16px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.option-btn:active:not(:disabled) {
  transform: scale(0.99);
}

.option-btn.selected {
  border-color: #000;
}

.option-btn.correct {
  border-color: #000;
  background: #f5f5f5;
}

.option-btn.wrong {
  border-color: #ba1a1a;
  background: #fef2f2;
}

.option-letter {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #f5f5f5;
  color: #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
  margin-top: 2px;
}

.option-text {
  flex: 1;
  font-size: 14px;
  line-height: 1.6;
  color: #111;
  word-break: keep-all;
}

.feedback-card {
  background: #f9f9f9;
  border-radius: 14px;
  padding: 16px;
}

.feedback-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 800;
  color: #000;
}

.feedback-state.wrong {
  color: #ba1a1a;
}

.complete-card h4 {
  font-size: 20px;
  font-weight: 800;
  color: #000;
}

.summary-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.summary-item {
  background: #f9f9f9;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-value {
  font-size: 28px;
  font-weight: 900;
  color: #000;
}

.missing-state {
  padding: 40px 20px;
  color: #777;
  text-align: center;
}

@media (max-width: 360px) {
  .hero-card,
  .section-card,
  .state-card {
    padding: 16px 14px;
    border-radius: 14px;
  }

  .hero-grammar {
    font-size: clamp(1.7rem, 7vw, 2.4rem);
  }

  .question-target {
    font-size: 18px;
    padding: 14px;
  }

  .option-btn {
    padding: 12px 14px;
  }

  .option-text {
    font-size: 13px;
  }

  .sentence-row {
    gap: 8px;
  }

  .option-row {
    gap: 6px;
  }

  .summary-value {
    font-size: 24px;
  }

  .primary-btn,
  .secondary-btn,
  .support-btn {
    min-height: 42px;
    padding: 0 14px;
    font-size: 12px;
  }

  .nav-chip {
    min-height: 36px;
    padding: 0 12px;
    font-size: 12px;
  }
}

@media (max-width: 320px) {
  .hero-grammar {
    font-size: 1.6rem;
  }

  .example-korean {
    font-size: 15px;
  }

  .question-target {
    font-size: 16px;
  }

  .option-letter {
    width: 22px;
    height: 22px;
    font-size: 10px;
  }

  .summary-value {
    font-size: 22px;
  }
}
</style>
