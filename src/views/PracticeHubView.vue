<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import grammarData from '../data/grammar.json'
import type { GrammarPoint, StudyState } from '../types/grammar'
import type { ExerciseVisit, GrammarExerciseStats } from '../types/exercise'
import { getItem, getGrammarExerciseStats, getGrammarExerciseVisits } from '../storage'

const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void

const allGrammar = grammarData as GrammarPoint[]
const studyStates = ref<Record<number, StudyState>>({})
const recentVisits = ref<ExerciseVisit[]>([])
const exerciseStats = ref<Record<number, GrammarExerciseStats>>({})

const levelFilter = ref<'all' | '1-2' | '3-4' | '5-6'>('all')
const statusFilter = ref<'all' | 'new' | 'learning' | 'mastered'>('all')
const searchQuery = ref('')

onMounted(async () => {
  studyStates.value = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  recentVisits.value = await getGrammarExerciseVisits()
  exerciseStats.value = await getGrammarExerciseStats()
})

function grammarStatus(id: number): StudyState['status'] {
  return studyStates.value[id]?.status || 'new'
}

const levelOptions = [
  { key: 'all' as const, label: 'All Levels' },
  { key: '1-2' as const, label: 'Level 1-2' },
  { key: '3-4' as const, label: 'Level 3-4' },
  { key: '5-6' as const, label: 'Level 5-6' },
]

const statusOptions = [
  { key: 'all' as const, label: 'All' },
  { key: 'new' as const, label: 'New' },
  { key: 'learning' as const, label: 'Learning' },
  { key: 'mastered' as const, label: 'Mastered' },
]

const recentGrammar = computed(() => {
  const seen = new Set<number>()
  const items: Array<GrammarPoint & { visit?: ExerciseVisit; stats?: GrammarExerciseStats }> = []

  for (const visit of recentVisits.value) {
    if (seen.has(visit.grammarId)) continue
    const grammar = allGrammar.find(item => item.id === visit.grammarId)
    if (!grammar) continue
    seen.add(visit.grammarId)
    items.push({
      ...grammar,
      visit,
      stats: exerciseStats.value[visit.grammarId],
    })
    if (items.length >= 6) break
  }

  return items
})

const recommendedGrammar = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return [...allGrammar]
    .filter(item => levelFilter.value === 'all' || item.level === levelFilter.value)
    .filter(item => statusFilter.value === 'all' || grammarStatus(item.id) === statusFilter.value)
    .filter(item => {
      if (!query) return true
      return (
        item.grammar.toLowerCase().includes(query) ||
        item.meaning.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      const aStatus = grammarStatus(a.id)
      const bStatus = grammarStatus(b.id)
      const statusRank = { new: 0, learning: 1, mastered: 2 }
      if (statusRank[aStatus] !== statusRank[bStatus]) {
        return statusRank[aStatus] - statusRank[bStatus]
      }

      const aLast = exerciseStats.value[a.id]?.lastPracticedAt || 0
      const bLast = exerciseStats.value[b.id]?.lastPracticedAt || 0
      if (aLast !== bLast) {
        return aLast - bLast
      }

      return a.id - b.id
    })
    .slice(0, 18)
})

function accuracyLabel(stats?: GrammarExerciseStats): string {
  if (!stats || stats.questionsAnswered === 0) return 'No checks yet'
  return `${Math.round((stats.correctCount / stats.questionsAnswered) * 100)}% accuracy`
}

function formatVisitTime(timestamp?: number): string {
  if (!timestamp) return 'Not practiced yet'
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="practice-hub">
    <section class="hero-card">
      <span class="hero-label">Grammar Practice</span>
      <h2 class="hero-title">Practice one grammar point at a time.</h2>
      <p class="hero-copy">
        Open a grammar point, review fresh examples, and run a short set of checks built for that pattern.
      </p>
    </section>

    <section class="filters-card">
      <div class="search-wrap">
        <span class="material-symbols-outlined search-icon">search</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search grammar, meaning, or category..."
        />
      </div>

      <div class="filter-group">
        <span class="filter-label">Level</span>
        <div class="filter-pills">
          <button
            v-for="option in levelOptions"
            :key="option.key"
            :class="['pill', { active: levelFilter === option.key }]"
            @click="levelFilter = option.key"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="filter-group">
        <span class="filter-label">Status</span>
        <div class="filter-pills">
          <button
            v-for="option in statusOptions"
            :key="option.key"
            :class="['pill', { active: statusFilter === option.key }]"
            @click="statusFilter = option.key"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="recentGrammar.length" class="section-block">
      <div class="section-heading">
        <div>
          <span class="section-label">Resume</span>
          <h3>Recent practice</h3>
        </div>
      </div>

      <div class="recent-list">
        <button
          v-for="item in recentGrammar"
          :key="item.id"
          class="recent-card"
          @click="navigateTo('detail', item)"
        >
          <div class="recent-top">
            <span class="recent-level">Level {{ item.level }}</span>
            <span class="recent-status" :class="grammarStatus(item.id)">
              {{ grammarStatus(item.id) }}
            </span>
          </div>
          <strong class="recent-grammar">{{ item.grammar }}</strong>
          <p class="recent-meaning">{{ item.meaning }}</p>
          <div class="recent-meta">
            <span>{{ accuracyLabel(item.stats) }}</span>
            <span>{{ formatVisitTime(item.visit?.endedAt) }}</span>
          </div>
        </button>
      </div>
    </section>

    <section class="section-block">
      <div class="section-heading">
        <div>
          <span class="section-label">Pick a point</span>
          <h3>Recommended grammar</h3>
        </div>
        <span class="section-count">{{ recommendedGrammar.length }}</span>
      </div>

      <div v-if="recommendedGrammar.length" class="grammar-grid">
        <button
          v-for="item in recommendedGrammar"
          :key="item.id"
          class="grammar-card"
          @click="navigateTo('detail', item)"
        >
          <div class="grammar-top">
            <span class="grammar-category">{{ item.category }}</span>
            <span class="grammar-status" :class="grammarStatus(item.id)"></span>
          </div>
          <strong class="grammar-pattern">{{ item.grammar }}</strong>
          <p class="grammar-meaning">{{ item.meaning }}</p>
          <div class="grammar-footer">
            <span>Level {{ item.level }}</span>
            <span>{{ accuracyLabel(exerciseStats[item.id]) }}</span>
          </div>
        </button>
      </div>

      <div v-else class="empty-card">
        <p>No grammar points match your filters.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.practice-hub {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
}

.hero-card,
.filters-card,
.empty-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
}

.hero-label,
.section-label,
.filter-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #777;
}

.hero-title {
  margin: 8px 0 10px;
  font-size: clamp(1.7rem, 6vw, 2.3rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: #000;
}

.hero-copy {
  font-size: 14px;
  line-height: 1.6;
  color: #474747;
}

.filters-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.search-wrap {
  position: relative;
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  transform: translateY(-50%);
  font-size: 18px;
  color: #777;
}

.search-input {
  width: 100%;
  height: 46px;
  padding: 0 14px 0 42px;
  border-radius: 12px;
  border: 1px solid rgba(198, 198, 198, 0.35);
  background: #f9f9f9;
  font-size: 14px;
  font-family: inherit;
  color: #000;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input::placeholder {
  color: #999;
}

.search-input:focus {
  border-color: rgba(0, 0, 0, 0.25);
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  border: 1px solid rgba(198, 198, 198, 0.4);
  background: #fff;
  color: #474747;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.pill.active {
  background: #000;
  border-color: #000;
  color: #fff;
}

.pill:active {
  transform: scale(0.97);
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
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

.recent-list,
.grammar-grid {
  display: grid;
  gap: 12px;
}

.recent-card,
.grammar-card {
  width: 100%;
  text-align: left;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  padding: 18px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.recent-card:active,
.grammar-card:active {
  transform: scale(0.98);
}

.recent-top,
.grammar-top,
.recent-meta,
.grammar-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.recent-level,
.recent-status,
.grammar-category,
.grammar-footer {
  font-size: 11px;
  font-weight: 700;
}

.recent-status {
  text-transform: capitalize;
  color: #777;
}

.recent-status.learning,
.grammar-status.learning {
  color: #000;
}

.recent-status.mastered,
.grammar-status.mastered {
  color: #000;
}

.recent-grammar,
.grammar-pattern {
  display: block;
  margin-top: 12px;
  font-size: 20px;
  font-weight: 800;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.recent-meaning,
.grammar-meaning {
  margin-top: 6px;
  font-size: 14px;
  color: #474747;
  line-height: 1.5;
}

.recent-meta,
.grammar-footer {
  margin-top: 14px;
  color: #777;
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.grammar-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.grammar-status {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #c6c6c6;
  flex-shrink: 0;
}

.grammar-status.learning {
  background: #3b3b3b;
}

.grammar-status.mastered {
  background: #000;
}

.empty-card {
  text-align: center;
  color: #777;
  font-size: 14px;
}

@media (max-width: 360px) {
  .hero-card,
  .filters-card,
  .empty-card {
    padding: 16px 14px;
  }

  .recent-card,
  .grammar-card {
    padding: 14px;
  }

  .grammar-grid {
    grid-template-columns: 1fr;
  }

  .search-input {
    height: 42px;
    font-size: 13px;
  }

  .pill {
    padding: 7px 12px;
    font-size: 11px;
  }

  .recent-grammar,
  .grammar-pattern {
    font-size: 18px;
  }

  .section-heading h3 {
    font-size: 18px;
  }
}

@media (max-width: 320px) {
  .hero-title {
    font-size: 1.45rem;
  }

  .recent-card,
  .grammar-card {
    padding: 12px;
    border-radius: 14px;
  }

  .recent-grammar,
  .grammar-pattern {
    font-size: 16px;
  }

  .recent-meaning,
  .grammar-meaning {
    font-size: 13px;
  }
}
</style>
