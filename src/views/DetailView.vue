<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import TtsButton from '../components/TtsButton.vue'
import type { GrammarPoint, GrammarDetail } from '../types/grammar'
import grammarDetails from '../data/grammar-details.json'

const selectedGrammar = inject('selectedGrammar') as any
const grammar = selectedGrammar.value as GrammarPoint
const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void

const details = computed<GrammarDetail | undefined>(() => {
  return (grammarDetails as GrammarDetail[]).find(d => d.id === grammar.id)
})

const hasDetails = computed(() => !!details.value)

const iconMap: Record<string, string> = {
  check: 'check',
  group: 'group',
  close: 'close',
  warning: 'warning',
  info: 'info',
}
</script>

<template>
  <div class="detail-view">
    <!-- Hero Section -->
    <section class="hero">
      <span class="hero-label">{{ grammar.category }} • Level {{ grammar.level }}</span>
      <h1 class="hero-grammar">{{ grammar.grammar }}</h1>
      <p class="hero-meaning">{{ grammar.meaning }}</p>
    </section>

    <!-- Rich Content -->
    <template v-if="hasDetails">
      <!-- Explanation -->
      <div v-if="details?.explanation" class="card">
        <p class="explanation-text">{{ details.explanation }}</p>
      </div>

      <!-- Rules -->
      <div v-if="details?.rules?.length" class="card rules-card">
        <h3 class="card-header">
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
      </div>

      <!-- Notes -->
      <div v-if="details?.notes?.length" class="card notes-card">
        <h3 class="card-header">
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
      </div>

      <!-- Exceptions -->
      <div v-if="details?.exceptions?.length" class="card exceptions-card">
        <h3 class="card-header">
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
      </div>
    </template>

    <!-- Fallback when no rich data -->
    <div v-else class="card fallback-card">
      <p class="fallback-text">
        Detailed explanation, examples, and usage notes for this grammar point are coming soon.
      </p>
    </div>

    <div class="cta-wrap">
      <button class="cta-btn primary" @click="navigateTo('grammar-exercise', grammar)">
        Practice This Grammar
        <span class="material-symbols-outlined">arrow_forward</span>
      </button>
      <button class="cta-btn secondary" @click="navigateTo('grammar-status', grammar)">
        View Study Status
      </button>
    </div>
  </div>
</template>

<style scoped>
.detail-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

/* Hero */
.hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  font-size: clamp(2.5rem, 10vw, 4rem);
  font-weight: 900;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  line-height: 1.1;
  letter-spacing: -0.02em;
  word-break: keep-all;
}

.hero-meaning {
  font-size: 1rem;
  font-weight: 500;
  color: #474747;
  line-height: 1.6;
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

/* Explanation */
.explanation-text {
  font-size: 0.95rem;
  font-weight: 500;
  color: #1a1c1c;
  line-height: 1.7;
}

/* Rules */
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

/* Examples Box */
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

.sentence-row,
.exception-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
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

/* Notes */
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

.note-icon.check {
  color: #000;
}

.note-icon.group {
  color: #000;
}

.note-icon.close {
  color: #ba1a1a;
}

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

/* Exceptions */
.exceptions-card {
  background: #fff;
}

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

@media (max-width: 360px) {
  .sentence-row,
  .exception-row {
    gap: 8px;
  }
}

/* Fallback */
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

/* CTA */
.cta-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.cta-btn {
  width: 100%;
  border-radius: 12px;
  padding: 16px 24px;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
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

.cta-btn.primary {
  background: #000;
  color: #fff;
  border: none;
}

.cta-btn.secondary {
  background: #fff;
  color: #000;
  border: 1px solid rgba(198, 198, 198, 0.4);
}

.cta-btn:active {
  transform: translateY(1px);
}

.cta-btn.primary:active {
  background: #3b3b3b;
}

.cta-btn.secondary:active {
  background: rgba(0, 0, 0, 0.04);
}

.cta-btn .material-symbols-outlined {
  font-size: 18px;
}
</style>
