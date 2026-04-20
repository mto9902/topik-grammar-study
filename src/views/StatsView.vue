<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import grammarData from '../data/grammar.json'
import type { ExerciseVisit, GrammarExerciseStats } from '../types/exercise'
import type { GrammarPoint, StudyState } from '../types/grammar'
import {
  getClozeSessionHistory,
  getGrammarExerciseStats,
  getGrammarExerciseVisits,
  getItem,
  resetAllProgress,
} from '../storage'

const allGrammar = grammarData as GrammarPoint[]

const studyStates = ref<Record<number, StudyState>>({})
const exerciseStats = ref<Record<number, GrammarExerciseStats>>({})
const exerciseVisits = ref<ExerciseVisit[]>([])
const legacySessionCount = ref(0)
const isLoading = ref(true)
const isResetting = ref(false)
const resetMessage = ref('')
const loadError = ref('')

async function loadProfile() {
  isLoading.value = true
  loadError.value = ''

  try {
    const [
      nextStudyStates,
      nextExerciseStats,
      nextExerciseVisits,
      nextClozeSessions,
    ] = await Promise.all([
      getItem<Record<number, StudyState>>('study_states_detail'),
      getGrammarExerciseStats(),
      getGrammarExerciseVisits(),
      getClozeSessionHistory(),
    ])

    studyStates.value = nextStudyStates || {}
    exerciseStats.value = nextExerciseStats
    exerciseVisits.value = nextExerciseVisits
    legacySessionCount.value = nextClozeSessions.length
  } catch (error) {
    void error
    loadError.value = 'Profile data could not be loaded right now.'
  } finally {
    isLoading.value = false
  }
}

function getPercent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

function formatDate(timestamp: number | null) {
  if (!timestamp) return 'No activity yet'
  return new Date(timestamp).toLocaleDateString()
}

const overall = computed(() => {
  const total = allGrammar.length
  const mastered = Object.values(studyStates.value).filter(state => state.status === 'mastered').length
  const learning = Object.values(studyStates.value).filter(state => state.status === 'learning').length

  return {
    total,
    mastered,
    learning,
    new: total - mastered - learning,
  }
})

const levelStats = computed(() => {
  const result: Record<string, { total: number; mastered: number; learning: number; new: number }> = {}

  for (const grammar of allGrammar) {
    if (!result[grammar.level]) {
      result[grammar.level] = { total: 0, mastered: 0, learning: 0, new: 0 }
    }

    result[grammar.level].total += 1
    const status = studyStates.value[grammar.id]?.status || 'new'
    result[grammar.level][status] += 1
  }

  return result
})

const totalQuestionsAnswered = computed(() => {
  return Object.values(exerciseStats.value).reduce((sum, stat) => sum + stat.questionsAnswered, 0)
})

const totalCorrectAnswers = computed(() => {
  return Object.values(exerciseStats.value).reduce((sum, stat) => sum + stat.correctCount, 0)
})

const overallAccuracy = computed(() => {
  return getPercent(totalCorrectAnswers.value, totalQuestionsAnswered.value)
})

const totalPracticeSessions = computed(() => {
  return exerciseVisits.value.length + legacySessionCount.value
})

const lastActivityAt = computed(() => {
  const reviewedAt = Object.values(studyStates.value)
    .map(state => state.lastReviewed || 0)
    .reduce((latest, value) => Math.max(latest, value), 0)

  const practicedAt = exerciseVisits.value
    .map(visit => visit.endedAt || visit.startedAt || 0)
    .reduce((latest, value) => Math.max(latest, value), 0)

  const latest = Math.max(reviewedAt, practicedAt)
  return latest || null
})

async function handleReset() {
  if (isResetting.value) return

  const confirmed = window.confirm(
    'Reset all progress? This clears study statuses, practice history, cached exercise packs, and deck state.',
  )

  if (!confirmed) return

  isResetting.value = true
  resetMessage.value = ''
  loadError.value = ''

  try {
    await resetAllProgress()
    await loadProfile()
    resetMessage.value = 'All progress has been reset.'
  } catch (error) {
    void error
    loadError.value = 'Progress could not be reset right now.'
  } finally {
    isResetting.value = false
  }
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="profile-view">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Profile</p>
        <h2>Your TOPIK grammar progress</h2>
        <p class="hero-copy">
          Track what you have learned, how much you have practiced, and reset everything when you want a clean start.
        </p>
      </div>

      <div class="hero-meta">
        <div class="meta-chip">
          <span class="material-symbols-outlined">history</span>
          <span>{{ formatDate(lastActivityAt) }}</span>
        </div>
        <div class="meta-chip">
          <span class="material-symbols-outlined">bookmark_manager</span>
          <span>{{ overall.total }} grammar points</span>
        </div>
      </div>
    </section>

    <section v-if="loadError" class="message-card error">
      <span class="material-symbols-outlined">error</span>
      <p>{{ loadError }}</p>
    </section>

    <section v-if="resetMessage" class="message-card success">
      <span class="material-symbols-outlined">check_circle</span>
      <p>{{ resetMessage }}</p>
    </section>

    <section v-if="isLoading" class="state-card">
      <p>Loading your profile...</p>
    </section>

    <template v-else>
      <section class="summary-grid">
        <article class="summary-card">
          <span class="summary-label">Mastered</span>
          <strong>{{ overall.mastered }}</strong>
          <span class="summary-sub">{{ getPercent(overall.mastered, overall.total) }}% of library</span>
        </article>

        <article class="summary-card">
          <span class="summary-label">Learning</span>
          <strong>{{ overall.learning }}</strong>
          <span class="summary-sub">{{ getPercent(overall.learning, overall.total) }}% in deck</span>
        </article>

        <article class="summary-card">
          <span class="summary-label">Practice Checks</span>
          <strong>{{ totalQuestionsAnswered }}</strong>
          <span class="summary-sub">{{ overallAccuracy }}% correct</span>
        </article>

        <article class="summary-card">
          <span class="summary-label">Practice Sessions</span>
          <strong>{{ totalPracticeSessions }}</strong>
          <span class="summary-sub">Studio and legacy sessions</span>
        </article>
      </section>

      <section class="progress-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Study Progress</p>
            <h3>Overall library status</h3>
          </div>
          <span class="section-total">{{ overall.total }} total</span>
        </div>

        <div class="progress-track">
          <div
            class="progress-fill mastered"
            :style="{ width: `${getPercent(overall.mastered, overall.total)}%` }"
          ></div>
          <div
            class="progress-fill learning"
            :style="{ width: `${getPercent(overall.learning, overall.total)}%`, left: `${getPercent(overall.mastered, overall.total)}%` }"
          ></div>
        </div>

        <div class="legend">
          <div class="legend-item">
            <span class="legend-dot mastered"></span>
            <span>{{ overall.mastered }} mastered</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot learning"></span>
            <span>{{ overall.learning }} learning</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot new"></span>
            <span>{{ overall.new }} new</span>
          </div>
        </div>
      </section>

      <section class="levels-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">By Level</p>
            <h3>Progress breakdown</h3>
          </div>
        </div>

        <div class="level-list">
          <article
            v-for="(stat, level) in levelStats"
            :key="level"
            class="level-item"
          >
            <div class="level-row">
              <strong>Level {{ level }}</strong>
              <span>{{ stat.total }} points</span>
            </div>

            <div class="progress-track compact">
              <div
                class="progress-fill mastered"
                :style="{ width: `${getPercent(stat.mastered, stat.total)}%` }"
              ></div>
              <div
                class="progress-fill learning"
                :style="{ width: `${getPercent(stat.learning, stat.total)}%`, left: `${getPercent(stat.mastered, stat.total)}%` }"
              ></div>
            </div>

            <div class="level-stats">
              <span>{{ stat.mastered }} mastered</span>
              <span>{{ stat.learning }} learning</span>
              <span>{{ stat.new }} new</span>
            </div>
          </article>
        </div>
      </section>

      <section class="danger-card">
        <div class="section-head danger-head">
          <div>
            <p class="eyebrow danger">Danger Zone</p>
            <h3>Reset all progress</h3>
          </div>
          <span class="material-symbols-outlined danger-icon">warning</span>
        </div>

        <p class="danger-copy">
          This removes study statuses, practice history, cached generated exercise content, and saved flashcard state on this device.
        </p>

        <button
          type="button"
          class="reset-btn"
          :disabled="isResetting"
          @click="handleReset"
        >
          {{ isResetting ? 'Resetting...' : 'Reset All Progress' }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.profile-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 20px;
}

.hero-card,
.summary-card,
.progress-card,
.levels-card,
.danger-card,
.message-card,
.state-card {
  background: #fff;
  border: 1px solid rgba(198, 198, 198, 0.22);
  border-radius: 20px;
  box-shadow: 0 10px 28px rgba(26, 28, 28, 0.06);
}

.hero-card,
.progress-card,
.levels-card,
.danger-card,
.message-card,
.state-card {
  padding: 18px;
}

.hero-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background:
    radial-gradient(circle at top right, rgba(42, 114, 255, 0.12), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%);
}

.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6d7280;
}

.hero-card h2,
.progress-card h3,
.levels-card h3,
.danger-card h3 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.2;
  color: #111827;
}

.hero-copy,
.danger-copy,
.state-card p,
.message-card p {
  margin: 10px 0 0;
  font-size: 0.94rem;
  line-height: 1.6;
  color: #4b5563;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.05);
  color: #374151;
  font-size: 0.82rem;
  font-weight: 700;
}

.meta-chip .material-symbols-outlined,
.danger-icon,
.message-card .material-symbols-outlined {
  font-size: 18px;
}

.message-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.message-card p {
  margin: 0;
}

.message-card.success {
  border-color: rgba(22, 163, 74, 0.18);
  background: rgba(240, 253, 244, 0.95);
  color: #166534;
}

.message-card.error {
  border-color: rgba(220, 38, 38, 0.18);
  background: rgba(254, 242, 242, 0.95);
  color: #991b1b;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
}

.summary-card strong {
  font-size: clamp(1.4rem, 5vw, 1.9rem);
  line-height: 1;
  color: #111827;
}

.summary-label,
.summary-sub,
.section-total,
.level-row span,
.level-stats {
  color: #6b7280;
}

.summary-label {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.summary-sub {
  font-size: 0.82rem;
  line-height: 1.45;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-total {
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.progress-track {
  position: relative;
  height: 12px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.08);
  overflow: hidden;
}

.progress-track.compact {
  height: 10px;
}

.progress-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
}

.progress-fill.mastered {
  left: 0;
  background: #16a34a;
}

.progress-fill.learning {
  background: #f59e0b;
}

.legend,
.level-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: #4b5563;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.mastered {
  background: #16a34a;
}

.legend-dot.learning {
  background: #f59e0b;
}

.legend-dot.new {
  background: rgba(17, 24, 39, 0.18);
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-item {
  padding: 14px;
  border-radius: 16px;
  background: rgba(17, 24, 39, 0.03);
  border: 1px solid rgba(17, 24, 39, 0.04);
}

.level-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.level-row strong {
  font-size: 0.96rem;
  color: #111827;
}

.level-row span,
.level-stats {
  font-size: 0.82rem;
}

.danger-head {
  margin-bottom: 12px;
}

.eyebrow.danger,
.danger-icon {
  color: #b91c1c;
}

.reset-btn {
  width: 100%;
  min-height: 48px;
  margin-top: 16px;
  border: none;
  border-radius: 14px;
  background: #b91c1c;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.reset-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.reset-btn:not(:disabled):active {
  transform: scale(0.985);
}

@media (max-width: 360px) {
  .hero-card,
  .progress-card,
  .levels-card,
  .danger-card,
  .message-card,
  .state-card {
    padding: 16px 14px;
  }

  .summary-grid {
    gap: 10px;
  }

  .summary-card {
    padding: 14px;
  }
}

@media (max-width: 320px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .section-head,
  .level-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-card h2,
  .progress-card h3,
  .levels-card h3,
  .danger-card h3 {
    font-size: 1.1rem;
  }

  .hero-copy,
  .danger-copy,
  .state-card p,
  .message-card p,
  .summary-sub,
  .legend-item,
  .level-row span,
  .level-stats {
    font-size: 0.82rem;
  }

  .meta-chip {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
