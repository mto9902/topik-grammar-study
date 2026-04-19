<script setup lang="ts">
import { ref, computed } from 'vue'
import grammarData from '../data/grammar.json'
import type { GrammarPoint, StudyState } from '../types/grammar'
import { getItem } from '../storage'

const allGrammar = grammarData as GrammarPoint[]
const states = ref<Record<number, StudyState>>({})

async function loadStats() {
  const s = await getItem<Record<number, StudyState>>('study_states_detail')
  if (s) states.value = s
}
loadStats()

const statsByLevel = computed(() => {
  const result: Record<string, { total: number; mastered: number; learning: number; new: number }> = {}
  for (const g of allGrammar) {
    if (!result[g.level]) result[g.level] = { total: 0, mastered: 0, learning: 0, new: 0 }
    result[g.level].total++
    const status = states.value[g.id]?.status || 'new'
    result[g.level][status]++
  }
  return result
})

const overall = computed(() => {
  const total = allGrammar.length
  const mastered = Object.values(states.value).filter(s => s.status === 'mastered').length
  const learning = Object.values(states.value).filter(s => s.status === 'learning').length
  return { total, mastered, learning, new: total - mastered - learning }
})

function getPercent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0
}

const levelColors: Record<string, string> = {
  '1-2': 'var(--level-1)',
  '3-4': 'var(--level-4)',
  '5-6': 'var(--level-6)',
}
</script>

<template>
  <div class="stats-view">
    <div class="stats-card neu-card animate-pop">
      <h2>Overall Progress</h2>
      <div class="neu-progress-track overall-track">
        <div
          class="neu-progress-fill"
          :style="{ width: `${getPercent(overall.mastered, overall.total)}%`, background: 'var(--color-success)' }"
        ></div>
        <div
          class="neu-progress-fill"
          :style="{ width: `${getPercent(overall.learning, overall.total)}%`, background: 'var(--color-warning)', marginLeft: `${getPercent(overall.mastered, overall.total)}%`, position: 'absolute', left: 0, top: 0 }"
        ></div>
      </div>
      <div class="overall-legend">
        <div class="legend-item">
          <span class="dot" style="background: var(--color-success)"></span>
          <span>{{ overall.mastered }} Mastered ({{ getPercent(overall.mastered, overall.total) }}%)</span>
        </div>
        <div class="legend-item">
          <span class="dot" style="background: var(--color-warning)"></span>
          <span>{{ overall.learning }} Learning ({{ getPercent(overall.learning, overall.total) }}%)</span>
        </div>
        <div class="legend-item">
          <span class="dot" style="background: rgba(49, 52, 75, 0.22)"></span>
          <span>{{ overall.new }} New ({{ getPercent(overall.new, overall.total) }}%)</span>
        </div>
      </div>
    </div>

    <div class="level-stats">
      <div
        v-for="(stat, level) in statsByLevel"
        :key="level"
        class="level-card neu-card animate-pop"
      >
        <div class="level-header">
          <span class="level-title" :style="{ color: levelColors[level] }">Level {{ level }}</span>
          <span class="level-total">{{ stat.total }} points</span>
        </div>
        <div class="neu-progress-track level-track">
          <div
            class="neu-progress-fill"
            :style="{ width: `${getPercent(stat.mastered, stat.total)}%`, background: 'var(--color-success)' }"
          ></div>
          <div
            class="neu-progress-fill"
            :style="{ width: `${getPercent(stat.learning, stat.total)}%`, background: 'var(--color-warning)', marginLeft: `${getPercent(stat.mastered, stat.total)}%`, position: 'absolute', left: 0, top: 0 }"
          ></div>
        </div>
        <div class="level-numbers">
          <span>✅ {{ stat.mastered }}</span>
          <span>📖 {{ stat.learning }}</span>
          <span>🆕 {{ stat.new }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.stats-card {
  padding: 20px;
}

.stats-card h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-dark);
  margin-bottom: 16px;
}

.overall-track,
.level-track {
  position: relative;
  margin-bottom: 14px;
  overflow: hidden;
}

.overall-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(49, 52, 75, 0.72);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow:
    2px 2px 4px rgba(49, 52, 75, 0.14),
    -2px -2px 4px rgba(255, 255, 255, 0.7);
}

.level-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-card {
  padding: 16px;
}

.level-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.level-title {
  font-size: 15px;
  font-weight: 700;
}

.level-total {
  font-size: 12px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.5);
}

.level-numbers {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  color: rgba(49, 52, 75, 0.7);
}
</style>
