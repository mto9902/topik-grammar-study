<script setup lang="ts">
import { inject, ref } from 'vue'
import type { GrammarPoint, StudyState } from '../types/grammar'
import { getItem, setItem } from '../storage'

const selectedGrammar = inject('selectedGrammar') as any
const grammar = selectedGrammar.value as GrammarPoint
const goBack = inject('goBack') as () => void

const state = ref<StudyState>({ status: 'new', lastReviewed: null, reviewCount: 0 })

async function loadState() {
  const all = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  if (all[grammar.id]) {
    state.value = all[grammar.id]
  }
}
loadState()

async function setStatus(status: StudyState['status']) {
  const all = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  all[grammar.id] = {
    status,
    lastReviewed: Date.now(),
    reviewCount: (all[grammar.id]?.reviewCount || 0) + 1,
  }
  await setItem('study_states_detail', all)
  state.value = all[grammar.id]
}

const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void
</script>

<template>
  <div class="status-view">
    <!-- Hero -->
    <section class="hero">
      <span class="hero-label">{{ grammar.category }} • Level {{ grammar.level }}</span>
      <h1 class="hero-grammar">{{ grammar.grammar }}</h1>
      <p class="hero-meaning">{{ grammar.meaning }}</p>
    </section>

    <!-- Progress Summary -->
    <div class="card summary-card">
      <div class="summary-stat">
        <span class="stat-label">Reviews</span>
        <span class="stat-value">{{ state.reviewCount }}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Last reviewed</span>
        <span class="stat-value">
          {{ state.lastReviewed ? new Date(state.lastReviewed).toLocaleDateString() : 'Never' }}
        </span>
      </div>
      <div class="summary-stat">
        <span class="stat-label">Current status</span>
        <span class="stat-badge" :class="state.status">
          {{ state.status === 'new' ? 'New' : state.status === 'learning' ? 'Learning' : 'Mastered' }}
        </span>
      </div>
    </div>

    <!-- Status Selector -->
    <div class="card">
      <h3 class="card-header">
        <span class="material-symbols-outlined">check_circle</span>
        Update Status
      </h3>
      <div class="status-list">
        <button
          :class="['status-row', { active: state.status === 'new' }]"
          @click="setStatus('new')"
        >
          <div class="status-accent" style="background: #c6c6c6"></div>
          <div class="status-body">
            <div class="status-title">New</div>
            <div class="status-desc">Haven't studied yet</div>
          </div>
          <span v-if="state.status === 'new'" class="material-symbols-outlined check-icon">check</span>
        </button>
        <button
          :class="['status-row', { active: state.status === 'learning' }]"
          @click="setStatus('learning')"
        >
          <div class="status-accent" style="background: #3b3b3b"></div>
          <div class="status-body">
            <div class="status-title">Learning</div>
            <div class="status-desc">Currently reviewing</div>
          </div>
          <span v-if="state.status === 'learning'" class="material-symbols-outlined check-icon">check</span>
        </button>
        <button
          :class="['status-row', { active: state.status === 'mastered' }]"
          @click="setStatus('mastered')"
        >
          <div class="status-accent" style="background: #000"></div>
          <div class="status-body">
            <div class="status-title">Mastered</div>
            <div class="status-desc">Fully understood</div>
          </div>
          <span v-if="state.status === 'mastered'" class="material-symbols-outlined check-icon">check</span>
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="action-btn primary" @click="navigateTo('cards')">
        <span class="material-symbols-outlined">style</span>
        Open learning deck
      </button>
      <button class="action-btn secondary" @click="navigateTo('detail', grammar)">
        <span class="material-symbols-outlined">edit_note</span>
        Practice this grammar
      </button>
    </div>
  </div>
</template>

<style scoped>
.status-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
}

.hero-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #474747;
}

.hero-grammar {
  font-size: clamp(1.75rem, 7vw, 2.5rem);
  font-weight: 900;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.15;
  letter-spacing: -0.02em;
  word-break: keep-all;
}

.hero-meaning {
  font-size: 0.95rem;
  font-weight: 500;
  color: #474747;
  line-height: 1.5;
}

/* Card Base */
.card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  border: 1px solid rgba(198, 198, 198, 0.2);
  padding: 20px;
}

.card-header {
  font-size: 1rem;
  font-weight: 700;
  color: #000;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  letter-spacing: -0.01em;
}

.card-header .material-symbols-outlined {
  font-size: 20px;
  color: #000;
}

/* Summary Card */
.summary-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(198, 198, 198, 0.3);
}

.summary-stat:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.stat-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #777;
}

.stat-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: #000;
}

.stat-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: capitalize;
}

.stat-badge.new {
  background: #f3f3f4;
  color: #777;
}

.stat-badge.learning {
  background: #1a1c1c;
  color: #fff;
}

.stat-badge.mastered {
  background: #000;
  color: #fff;
}

/* Status List */
.status-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
  position: relative;
  font-family: inherit;
}

.status-row:active {
  background: rgba(0, 0, 0, 0.03);
}

.status-row.active {
  background: rgba(0, 0, 0, 0.04);
}

.status-accent {
  width: 3px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}

.status-body {
  flex: 1;
  min-width: 0;
}

.status-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #000;
  line-height: 1.3;
}

.status-desc {
  font-size: 0.8rem;
  font-weight: 500;
  color: #777;
  line-height: 1.4;
}

.check-icon {
  font-size: 20px;
  color: #000;
  flex-shrink: 0;
}

/* Actions */
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.action-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 14px 20px;
  font-size: 0.85rem;
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

.action-btn.primary {
  background: #000;
  color: #fff;
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.12);
}

.action-btn.primary:active {
  transform: translateY(1px);
  background: #3b3b3b;
}

.action-btn.secondary {
  background: transparent;
  color: #000;
  border: 2px solid #000;
}

.action-btn.secondary:active {
  background: rgba(0, 0, 0, 0.04);
}

.action-btn .material-symbols-outlined {
  font-size: 18px;
}
</style>
