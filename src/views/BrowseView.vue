<script setup lang="ts">
import { ref, computed, inject, type Ref } from 'vue'
import grammarData from '../data/grammar.json'
import type { GrammarPoint } from '../types/grammar'
import { getItem } from '../storage'

const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void
const browseState = inject('browseState') as Ref<{ activeLevel: string; categoryFilter: string; searchQuery: string }>

const allGrammar = grammarData as GrammarPoint[]
const levels = ['1-2', '3-4', '5-6']

// Use persisted state from App.vue, with local refs that sync both ways
const activeLevel = ref(browseState.value.activeLevel)
const searchQuery = ref(browseState.value.searchQuery)
const categoryFilter = ref(browseState.value.categoryFilter)
const studyStates = ref<Record<number, string>>({})

// Sync local changes back to the persisted state
function syncBrowseState() {
  browseState.value.activeLevel = activeLevel.value
  browseState.value.categoryFilter = categoryFilter.value
  browseState.value.searchQuery = searchQuery.value
}

async function loadStates() {
  const states = await getItem<Record<number, { status: string }>>('study_states_detail')
  if (states) {
    studyStates.value = Object.fromEntries(
      Object.entries(states).map(([id, s]) => [Number(id), (s as any).status])
    )
  }
}
loadStates()

const categories = computed(() => {
  const cats = new Set(allGrammar.filter(g => g.level === activeLevel.value).map(g => g.category))
  return ['All', ...Array.from(cats)]
})

const filteredGrammar = computed(() => {
  let result = allGrammar.filter(g => g.level === activeLevel.value)
  if (categoryFilter.value !== 'All') {
    result = result.filter(g => g.category === categoryFilter.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(g =>
      g.grammar.toLowerCase().includes(q) ||
      g.meaning.toLowerCase().includes(q)
    )
  }
  return result
})

function getStatusColor(status?: string) {
  switch (status) {
    case 'mastered': return '#000000'
    case 'learning': return '#3b3b3b'
    default: return '#c6c6c6'
  }
}

const levelSubtitle: Record<string, string> = {
  '1-2': 'Foundational grammar structures',
  '3-4': 'Intermediate grammar structures',
  '5-6': 'Advanced grammar structures',
}
</script>

<template>
  <div class="browse-view">
    <!-- Page Header -->
    <div class="page-header">
      <h2 class="page-title">Level {{ activeLevel }} Index</h2>
      <p class="page-subtitle">{{ levelSubtitle[activeLevel] }}</p>
    </div>

    <!-- Search -->
    <div class="search-wrap">
      <span class="material-symbols-outlined search-icon">search</span>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search grammar or meaning..."
        class="search-input"
        @input="syncBrowseState"
      />
    </div>

    <!-- Level Pills -->
    <div class="level-pills">
      <button
        v-for="lvl in levels"
        :key="lvl"
        :class="['level-pill', { active: activeLevel === lvl }]"
        @click="activeLevel = lvl; categoryFilter = 'All'; syncBrowseState()"
      >
        Level {{ lvl }}
      </button>
    </div>

    <!-- Category Chips -->
    <div class="category-scroll">
      <button
        v-for="cat in categories"
        :key="cat"
        :class="['category-chip', { active: categoryFilter === cat }]"
        @click="categoryFilter = cat; syncBrowseState()"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Grammar Grid -->
    <div class="grammar-grid">
      <div
        v-for="item in filteredGrammar"
        :key="item.id"
        class="grammar-card"
        @click="navigateTo('detail', item)"
      >
        <div class="card-top">
          <span class="card-category">{{ item.category }}</span>
          <span
            class="status-dot"
            :style="{ background: getStatusColor(studyStates[item.id]) }"
          ></span>
        </div>
        <div class="card-center">
          <span class="card-grammar">{{ item.grammar }}</span>
        </div>
        <div class="card-meaning">{{ item.meaning }}</div>
      </div>
    </div>

    <div v-if="filteredGrammar.length === 0" class="empty-state">
      No grammar points found.
    </div>
  </div>
</template>

<style scoped>
.browse-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #000;
  line-height: 1.1;
}

.page-subtitle {
  font-size: 0.875rem;
  font-weight: 500;
  color: #474747;
}

/* Search */
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  font-size: 20px;
  color: #777;
  pointer-events: none;
}

.search-input {
  width: 100%;
  min-height: 48px;
  border-radius: 12px;
  border: 1px solid rgba(198, 198, 198, 0.4);
  background: #fff;
  padding: 12px 14px 12px 44px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a1c1c;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
}

.search-input::placeholder {
  color: #777;
}

.search-input:focus {
  border-color: #000;
}

/* Level Pills */
.level-pills {
  display: flex;
  gap: 8px;
}

.level-pill {
  flex: 1;
  min-height: 40px;
  border-radius: 10px;
  border: 1px solid rgba(198, 198, 198, 0.4);
  background: transparent;
  color: #1a1c1c;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.level-pill.active {
  background: #000;
  color: #fff;
  border-color: #000;
}

.level-pill:not(.active):active {
  background: rgba(0, 0, 0, 0.04);
}

/* Category Chips */
.category-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-chip {
  flex-shrink: 0;
  min-height: 36px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(0, 0, 0, 0.04);
  color: #474747;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.category-chip.active {
  background: #000;
  color: #fff;
}

.category-chip:not(.active):active {
  background: rgba(0, 0, 0, 0.08);
}

/* Grammar Grid */
.grammar-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
}

.grammar-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(26, 28, 28, 0.05);
  border: 1px solid rgba(198, 198, 198, 0.2);
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 96px;
  overflow: hidden;
}

.grammar-card:active {
  transform: scale(0.98);
  box-shadow: 0 6px 18px rgba(26, 28, 28, 0.04);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-category {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #474747;
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.card-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 4px 0;
}

.card-grammar {
  font-size: clamp(0.95rem, 4.5vw, 1.35rem);
  font-weight: 700;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  text-align: center;
  line-height: 1.25;
  word-break: keep-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-meaning {
  font-size: 0.75rem;
  font-weight: 500;
  color: #474747;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: #777;
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
