<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
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

type SectionKey = 'overview' | 'rules' | 'notes' | 'exceptions' | 'examples' | 'practice' | 'summary'

const selectedGrammar = inject('selectedGrammar') as Ref<GrammarPoint | null>
const goBack = inject('goBack') as () => void
const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void

const grammar = computed(() => selectedGrammar.value)

const details = computed<GrammarDetail | undefined>(() => {
  if (!grammar.value) return undefined
  return (grammarDetails as GrammarDetail[]).find(d => d.id === grammar.value?.id)
})

const hasDetails = computed(() => !!details.value)

const iconMap: Record<string, string> = {
  check: 'check',
  group: 'group',
  close: 'close',
  warning: 'warning',
  info: 'info',
}

// ── Exercise pack state ──
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

const overviewRef = ref<HTMLElement | null>(null)
const rulesRef = ref<HTMLElement | null>(null)
const notesRef = ref<HTMLElement | null>(null)
const exceptionsRef = ref<HTMLElement | null>(null)
const examplesRef = ref<HTMLElement | null>(null)
const practiceRef = ref<HTMLElement | null>(null)
const summaryRef = ref<HTMLElement | null>(null)

const sectionRefs: Partial<Record<SectionKey, Ref<HTMLElement | null>>> = {
  overview: overviewRef,
  rules: rulesRef,
  notes: notesRef,
  exceptions: exceptionsRef,
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

  // Reset state for fresh load
  activeCheckIndex.value = 0
  selectedOption.value = null
  answeredCorrectly.value = null
  questionsAnswered.value = 0
  correctAnswers.value = 0
  revealedExamples.value = []
  visitStartedAt.value = Date.now()
  visitSaved.value = false
  loading.value = true
  errorMessage.value = ''

  clientId.value = await getOrCreateExerciseClientId()

  const cached = await getCachedExercisePack(grammar.value.id)
  if (cached) {
    setPack(cached.pack)
    loading.value = false
  }

  try {
    const freshPack = await fetchExercisePack(grammar.value.id, clientId.value)
    const currentVersion = pack.value ? pack.value.version : 0
    if (freshPack.version > currentVersion) {
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
  if (shouldPlaySound) {
    playClickSound()
  }
  const el = sectionRefs[section]?.value
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

function updateStatus() {
  playClickSound()
  navigateTo('grammar-status', grammar.value || undefined)
}

watch(() => grammar.value?.id, (newId, oldId) => {
  if (newId && newId !== oldId) {
    void hydratePack()
  }
})

onMounted(() => {
  hydratePack()
})

onBeforeUnmount(() => {
  void persistVisit()
})
</script>

<template>
  <div v-if="grammar" class="grammar-detail">
    <!-- ── Hero ── -->
    <section ref="overviewRef" class="hero-card">
      <div class="hero-meta">{{ grammar.category }} • Level {{ grammar.level }}</div>
      <h1 class="hero-grammar">{{ grammar.grammar }}</h1>
      <p class="hero-meaning">{{ grammar.meaning }}</p>
      <p v-if="details?.explanation" class="hero-summary">{{ details.explanation }}</p>
      <p v-else-if="pack?.usageSummary" class="hero-summary">{{ pack.usageSummary }}</p>

      <div class="hero-actions">
        <button class="primary-btn" @click="scrollToSection('examples')">
          Show Examples
          <span class="material-symbols-outlined">arrow_downward</span>
        </button>
        <button class="secondary-btn" @click="updateStatus">Update Status</button>
      </div>
    </section>

    <!-- ── Rules ── -->
    <section v-if="hasDetails && details?.rules?.length" ref="rulesRef" class="section-card rules-card">
      <h3 class="section-header">
        <span class="material-symbols-outlined">hdr_auto</span>
        Form &amp; Conjugation
      </h3>
      <div class="rules-list">
        <div v-for="(rule, idx) in details.rules" :key="idx" class="rule-item">
          <div class="rule-accent" :style="{ background: idx === 0 ? '#000' : idx === 1 ? '#3b3b3b' : '#777' }"></div>
          <div class="rule-body">
            <h4 class="rule-title">{{ rule.title }}</h4>
            <p class="rule-desc">{{ rule.description }}</p>
            <div v-if="rule.examples?.length" class="examples-box">
              <div
                v-for="(ex, eidx) in rule.examples"
                :key="eidx"
                class="example-row"
                :class="{ border: eidx < rule.examples.length - 1 }"
              >
                <div class="sentence-row">
                  <span class="ex-korean">{{ ex.korean }}</span>
                  <TtsButton :text="ex.korean" label="detail example" />
                </div>
                <span v-if="ex.breakdown" class="ex-breakdown">{{ ex.breakdown }}</span>
                <span class="ex-english">{{ ex.english }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── Notes ── -->
    <section v-if="hasDetails && details?.notes?.length" ref="notesRef" class="section-card notes-card">
      <h3 class="section-header">
        <span class="material-symbols-outlined">forum</span>
        Usage &amp; Nuances
      </h3>
      <ul class="notes-list">
        <li v-for="(note, idx) in details.notes" :key="idx" class="note-item">
          <span class="material-symbols-outlined note-icon" :class="note.icon">
            {{ iconMap[note.icon] || 'info' }}
          </span>
          <div class="note-body">
            <strong>{{ note.title }}</strong>
            <span>{{ note.text }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- ── Exceptions ── -->
    <section v-if="hasDetails && details?.exceptions?.length" ref="exceptionsRef" class="section-card exceptions-card">
      <h3 class="section-header">
        <span class="material-symbols-outlined">warning</span>
        Exceptions
      </h3>
      <div class="exceptions-list">
        <div v-for="(ex, idx) in details.exceptions" :key="idx" class="exception-item">
          <h5 class="exception-name">{{ ex.name }}</h5>
          <p class="exception-desc">{{ ex.description }}</p>
          <div class="exception-row">
            <p class="exception-example">{{ ex.example }}</p>
            <TtsButton :text="ex.example" label="exception example" />
          </div>
        </div>
      </div>
    </section>

    <!-- ── Fallback when no rich data ── -->
    <section v-else-if="!hasDetails" class="section-card fallback-card">
      <p class="fallback-text">
        Detailed explanation, rules, and usage notes for this grammar point are coming soon.
      </p>
    </section>

    <!-- ── AI Examples ── -->
    <section ref="examplesRef" class="section-card">
      <div class="section-heading">
        <h3>Examples</h3>
      </div>

      <div v-if="pack?.examples?.length" class="example-list">
        <article v-for="(example, index) in pack.examples" :key="`${pack.version}-${index}`" class="example-card">
          <span class="example-index">Example {{ index + 1 }}</span>
          <div class="sentence-row">
            <p class="example-korean">{{ example.korean }}</p>
            <TtsButton :text="example.korean" label="example sentence" />
          </div>
          <div v-if="!revealedExamples.includes(index)" class="reveal-wrap">
            <button class="reveal-trigger" @click="revealExampleSupport(index)">
              <span class="material-symbols-outlined">expand_more</span>
              Show translation
            </button>
          </div>
          <template v-else>
            <p class="example-english">{{ example.english }}</p>
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
        <div class="examples-footer">
          <button class="secondary-btn" @click="regeneratePack" :disabled="regenerating || loading">
            {{ regenerating ? 'Refreshing...' : 'Regenerate Examples' }}
          </button>
        </div>
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

    <!-- ── Practice (hidden) ──
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
        <p class="question-prompt">
          {{ currentCheck.type === 'sentence_choice' ? 'Choose the sentence that correctly uses this grammar.' : 'Choose the correct meaning of this grammar.' }}
        </p>
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
    -->

    <!-- ── Summary ── -->
    <section ref="summaryRef" class="section-card summary-card">
      <div class="section-heading">
        <div>
          <span class="section-label">Summary</span>
          <h3>Session</h3>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-value">{{ revealedExamples.length }}</span>
          <span class="summary-name">Revealed</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ pack?.examples?.length || 0 }}</span>
          <span class="summary-name">Examples</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">L{{ grammar.level }}</span>
          <span class="summary-name">Level</span>
        </div>
        <div class="summary-item">
          <span class="summary-value">{{ pack?.version || 1 }}</span>
          <span class="summary-name">Set</span>
        </div>
      </div>

      <div class="summary-actions">
        <button class="secondary-btn" @click="regeneratePack" :disabled="regenerating || loading">
          {{ regenerating ? 'Refreshing...' : 'Regenerate Examples' }}
        </button>
        <button class="secondary-btn" @click="updateStatus">Update Status</button>
        <button class="secondary-btn" @click="goBack">Close</button>
      </div>
    </section>
  </div>

  <div v-else class="missing-state">
    <p>No grammar point is selected.</p>
  </div>
</template>

<style scoped>
.grammar-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

/* ── Hero ── */
.hero-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
}

.hero-meta {
  font-size: 11px;
  font-weight: 700;
  color: #777;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-grammar {
  margin-top: 8px;
  font-size: clamp(2.5rem, 10vw, 4rem);
  font-weight: 900;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.1;
  letter-spacing: -0.02em;
  word-break: keep-all;
}

.hero-meaning {
  margin-top: 8px;
  font-size: 1rem;
  font-weight: 500;
  color: #474747;
  line-height: 1.6;
}

.hero-summary {
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.6;
  color: #474747;
}

.hero-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 18px;
}

/* ── Base Card ── */
.section-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
}

.section-header {
  font-size: 1rem;
  font-weight: 700;
  color: #000;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}

.section-header .material-symbols-outlined {
  font-size: 20px;
  color: #000;
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

.section-count {
  font-size: 12px;
  font-weight: 700;
  color: #777;
}

/* ── Buttons ── */
.primary-btn,
.secondary-btn {
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.primary-btn,
.secondary-btn {
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

.secondary-btn {
  background: #fff;
  color: #000;
  border: 1px solid rgba(198, 198, 198, 0.35);
}

.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.6;
}

.primary-btn:not(:disabled):active,
.secondary-btn:not(:disabled):active {
  transform: scale(0.97);
}

/* ── Rules ── */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rule-item {
  display: flex;
  gap: 12px;
}

.rule-accent {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: 4px;
  min-height: 36px;
}

.rule-body {
  flex: 1;
  min-width: 0;
}

.rule-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #000;
  line-height: 1.3;
  margin-bottom: 4px;
}

.rule-desc {
  font-size: 0.85rem;
  font-weight: 500;
  color: #777;
  line-height: 1.5;
  margin-bottom: 10px;
}

.examples-box {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.example-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 0;
}

.example-row.border {
  border-bottom: 1px solid rgba(198, 198, 198, 0.4);
}

.ex-korean {
  font-size: 0.85rem;
  font-weight: 700;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.ex-breakdown {
  font-size: 0.8rem;
  font-weight: 500;
  color: #474747;
  font-family: 'Noto Sans KR', sans-serif;
}

.ex-english {
  font-size: 0.8rem;
  font-weight: 500;
  color: #777;
}

/* ── Notes ── */
.notes-card {
  background: #f3f3f4;
  box-shadow: none;
  border: none;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.note-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.note-icon {
  font-size: 18px;
  margin-top: 1px;
  flex-shrink: 0;
}

.note-icon.check,
.note-icon.group {
  color: #000;
}

.note-icon.close,
.note-icon.warning {
  color: #ba1a1a;
}

.note-icon.info {
  color: #777;
}

.note-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #474747;
}

.note-body strong {
  color: #000;
  font-weight: 700;
}

/* ── Exceptions ── */
.exceptions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.exception-item {
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(198, 198, 198, 0.3);
}

.exception-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.exception-name {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ba1a1a;
  margin-bottom: 4px;
}

.exception-desc {
  font-size: 0.8rem;
  font-weight: 500;
  color: #777;
  margin-bottom: 6px;
  line-height: 1.4;
}

.exception-example {
  margin: 0;
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  color: #000;
  background: #f9f9f9;
  padding: 8px 10px;
  border-radius: 6px;
  font-family: 'Noto Sans KR', sans-serif;
}

/* ── Fallback ── */
.fallback-card {
  background: #f3f3f4;
  box-shadow: none;
  border: none;
}

.fallback-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: #777;
  text-align: center;
  line-height: 1.6;
}

/* ── Shared row ── */
.sentence-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.exception-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

/* ── AI Examples ── */
.example-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.example-card {
  background: #f9f9f9;
  border-radius: 14px;
  padding: 16px;
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

.reveal-wrap {
  display: flex;
  justify-content: center;
  margin-top: 6px;
}

.reveal-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(198, 198, 198, 0.4);
  color: #777;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reveal-trigger:active {
  transform: scale(0.97);
  background: #f5f5f5;
}

.examples-footer {
  display: flex;
  justify-content: center;
  margin-top: 6px;
}

.breakdown-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakdown-row {
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.breakdown-main {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}

.breakdown-word {
  font-size: 14px;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.breakdown-romanization {
  font-size: 11px;
  color: #999;
  letter-spacing: 0.02em;
}

.breakdown-meaning {
  font-size: 13px;
  color: #222;
  line-height: 1.45;
}

.breakdown-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #999;
  line-height: 1.45;
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

/* ── Practice ── */
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

.practice-actions,
.summary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

/* ── Summary ── */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
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

/* ── Missing state ── */
.missing-state {
  padding: 40px 20px;
  color: #777;
  text-align: center;
}

.state-card {
  margin-top: 14px;
  color: #777;
  font-size: 14px;
}

.state-card p {
  margin: 0 0 12px;
}

/* ── Responsive ── */
@media (max-width: 360px) {
  .hero-card,
  .section-card {
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

  .sentence-row,
  .exception-row {
    gap: 8px;
  }

  .option-row {
    gap: 6px;
  }

  .summary-value {
    font-size: 24px;
  }

  .primary-btn,
  .secondary-btn {
    min-height: 42px;
    padding: 0 14px;
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
    font-size: 18px;
  }
}
</style>
