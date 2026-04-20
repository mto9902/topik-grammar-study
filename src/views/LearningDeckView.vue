<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TtsButton from '../components/TtsButton.vue'
import grammarData from '../data/grammar.json'
import grammarDetails from '../data/grammar-details.json'
import type { ExercisePack } from '../types/exercise'
import type { GrammarDetail, GrammarExample, GrammarPoint, StudyState } from '../types/grammar'
import { fetchExercisePack } from '../api/exercise'
import {
  getCachedExercisePack,
  getItem,
  getOrCreateExerciseClientId,
  setItem,
  setCachedExercisePack,
} from '../storage'
import { playClickSound } from '../sound'

interface FlashcardExample {
  korean: string
  english: string
}

interface LearningDeckState {
  levelFilter: 'all' | '1-2' | '3-4' | '5-6'
  grammarId: number | null
  showBack: boolean
}

const LEARNING_DECK_STATE_KEY = 'learning_deck_state_v1'

const navigateTo = inject('navigateTo') as (tab: string, grammar?: GrammarPoint) => void

const allGrammar = grammarData as GrammarPoint[]
const detailById = Object.fromEntries(
  (grammarDetails as GrammarDetail[]).map(detail => [detail.id, detail]),
) as Record<number, GrammarDetail>

const levelFilter = ref<'all' | '1-2' | '3-4' | '5-6'>('all')
const currentIndex = ref(0)
const showBack = ref(false)
const booting = ref(true)
const backFaceRef = ref<HTMLElement | null>(null)
const swipeStartedAt = ref<{ x: number; y: number } | null>(null)
const suppressFlipUntil = ref(0)
const cardChangeLockUntil = ref(0)
const restoreGrammarId = ref<number | null>(null)
const restoringDeckState = ref(false)

// ── Drag / swipe animation state ──
const isDragging = ref(false)
const didDrag = ref(false)
const withTransition = ref(false)
const snapBack = ref(false)
const dragOffset = ref(0)
const dragRotation = ref(0)
const dragOpacity = ref(1)
const flyOutTimer = ref<number | null>(null)

const studyStates = ref<Record<number, StudyState>>({})
const clientId = ref('')
const packMap = ref<Record<number, ExercisePack>>({})
const packLoading = ref<Record<number, boolean>>({})
const packError = ref<Record<number, string>>({})

const levelOptions = [
  { key: 'all' as const, label: 'All Levels' },
  { key: '1-2' as const, label: 'Level 1-2' },
  { key: '3-4' as const, label: 'Level 3-4' },
  { key: '5-6' as const, label: 'Level 5-6' },
]

const allLearningGrammar = computed(() => {
  return [...allGrammar]
    .filter(item => studyStates.value[item.id]?.status === 'learning')
    .sort((a, b) => {
      const aLast = studyStates.value[a.id]?.lastReviewed || 0
      const bLast = studyStates.value[b.id]?.lastReviewed || 0
      if (aLast !== bLast) return bLast - aLast
      return a.id - b.id
    })
})

const filteredLearningGrammar = computed(() => {
  return allLearningGrammar.value.filter(item => {
    return levelFilter.value === 'all' || item.level === levelFilter.value
  })
})

const currentGrammar = computed<GrammarPoint | null>(() => {
  return filteredLearningGrammar.value[currentIndex.value] || null
})

const currentDetail = computed<GrammarDetail | undefined>(() => {
  if (!currentGrammar.value) return undefined
  return detailById[currentGrammar.value.id]
})

const currentPack = computed<ExercisePack | null>(() => {
  if (!currentGrammar.value) return null
  return packMap.value[currentGrammar.value.id] || null
})

const currentSummary = computed(() => {
  if (!currentGrammar.value) return ''
  return pickShortSummary(currentGrammar.value, currentDetail.value, currentPack.value)
})

const currentExamples = computed<FlashcardExample[]>(() => {
  if (!currentGrammar.value) return []
  return pickExamples(currentGrammar.value.id, currentPack.value)
})

const currentPackLoading = computed(() => {
  if (!currentGrammar.value) return false
  return !!packLoading.value[currentGrammar.value.id]
})

const currentPackError = computed(() => {
  if (!currentGrammar.value) return ''
  return packError.value[currentGrammar.value.id] || ''
})

const usingFallbackExamples = computed(() => {
  return !currentPack.value?.examples?.length && currentExamples.value.length > 0
})

const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < filteredLearningGrammar.value.length - 1)

// The card peeking out from underneath
const behindGrammar = computed<GrammarPoint | null>(() => {
  if (!currentGrammar.value) return null
  // When dragging right, show the previous card underneath
  if (isDragging.value && dragOffset.value > 30 && hasPrev.value) {
    return filteredLearningGrammar.value[currentIndex.value - 1]
  }
  // Default: show the next card underneath
  if (hasNext.value) {
    return filteredLearningGrammar.value[currentIndex.value + 1]
  }
  // Fallback to previous when at the end
  if (hasPrev.value) {
    return filteredLearningGrammar.value[currentIndex.value - 1]
  }
  return null
})

const cardStyle = computed(() => ({
  '--drag-x': `${dragOffset.value}px`,
  '--drag-r': `${dragRotation.value}deg`,
  '--drag-o': String(dragOpacity.value),
}))

function firstSentence(text?: string): string {
  if (!text) return ''
  const normalized = text.replace(/\s+/g, ' ').trim()
  const sentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/)
  return sentenceMatch ? sentenceMatch[1].trim() : normalized
}

function pickShortSummary(
  grammar: GrammarPoint,
  detail?: GrammarDetail,
  pack?: ExercisePack | null,
): string {
  const aiSummary = firstSentence(pack?.usageSummary)
  if (aiSummary) return aiSummary

  const localSummary = firstSentence(detail?.explanation)
  if (localSummary) return localSummary

  return `Use this grammar for ${grammar.meaning.toLowerCase()}.`
}

function parseFallbackExample(example: GrammarExample): FlashcardExample {
  const englishSource = example.english.trim()
  const dashMatch = englishSource.match(/^(.*?)\s+[—-]\s+(.+)$/)
  if (dashMatch && /[가-힣]/.test(dashMatch[1])) {
    return {
      korean: dashMatch[1].trim(),
      english: dashMatch[2].trim(),
    }
  }

  const parenMatch = englishSource.match(/^(.*?)\s*\((.+)\)\s*$/)
  if (parenMatch && /[가-힣]/.test(parenMatch[1])) {
    return {
      korean: parenMatch[1].trim(),
      english: parenMatch[2].trim(),
    }
  }

  return {
    korean: example.korean.trim(),
    english: englishSource,
  }
}

function fallbackExamplesFor(grammarId: number): FlashcardExample[] {
  const detail = detailById[grammarId]
  if (!detail?.rules?.length) return []

  const seen = new Set<string>()
  const examples: FlashcardExample[] = []

  for (const rule of detail.rules) {
    for (const example of rule.examples || []) {
      const parsed = parseFallbackExample(example)
      const key = `${parsed.korean}|${parsed.english}`
      if (!parsed.korean || seen.has(key)) continue
      seen.add(key)
      examples.push(parsed)
      if (examples.length >= 3) return examples
    }
  }

  return examples
}

function pickExamples(grammarId: number, pack?: ExercisePack | null): FlashcardExample[] {
  if (pack?.examples?.length) {
    return pack.examples.slice(0, 3).map(example => ({
      korean: example.korean,
      english: example.english,
    }))
  }

  return fallbackExamplesFor(grammarId)
}

function setPackLoadingState(grammarId: number, isLoading: boolean) {
  packLoading.value = {
    ...packLoading.value,
    [grammarId]: isLoading,
  }
}

function setPackErrorState(grammarId: number, message: string) {
  packError.value = {
    ...packError.value,
    [grammarId]: message,
  }
}

function setPackRecord(grammarId: number, pack: ExercisePack) {
  packMap.value = {
    ...packMap.value,
    [grammarId]: pack,
  }
}

async function ensurePackLoaded(grammarId: number) {
  if (!clientId.value || packLoading.value[grammarId]) return

  const cached = await getCachedExercisePack(grammarId)
  if (cached?.pack && !packMap.value[grammarId]) {
    setPackRecord(grammarId, cached.pack)
  }

  setPackLoadingState(grammarId, true)
  try {
    const freshPack = await fetchExercisePack(grammarId, clientId.value)
    setPackRecord(grammarId, freshPack)
    await setCachedExercisePack(grammarId, freshPack)
    setPackErrorState(grammarId, '')
  } catch (error) {
    if (!packMap.value[grammarId]) {
      void error
      setPackErrorState(grammarId, 'Fresh examples are unavailable right now.')
    }
  } finally {
    setPackLoadingState(grammarId, false)
  }
}

function flipCard(force = false) {
  if (!currentGrammar.value) return
  if (!force && Date.now() < suppressFlipUntil.value) return
  if (!force && Date.now() < cardChangeLockUntil.value) return
  if (!force && didDrag.value) return
  playClickSound()
  showBack.value = !showBack.value
}

function handleCardFlipClick() {
  flipCard(false)
}

function handleForcedFlip() {
  flipCard(true)
}

function prepareForCardChange() {
  cardChangeLockUntil.value = Date.now() + 700
  showBack.value = false
}

function goPrevCard() {
  if (!hasPrev.value) return
  playClickSound()
  prepareForCardChange()
  currentIndex.value -= 1
}

function goNextCard() {
  if (!hasNext.value) return
  playClickSound()
  prepareForCardChange()
  currentIndex.value += 1
}

function resetToAllLevels() {
  playClickSound()
  levelFilter.value = 'all'
}

async function openDetail() {
  if (!currentGrammar.value) return
  playClickSound()
  await persistDeckState()
  navigateTo('detail', currentGrammar.value)
}

async function openLibrary() {
  playClickSound()
  await persistDeckState()
  navigateTo('browse')
}

async function persistDeckState() {
  if (booting.value || restoringDeckState.value) return

  await setItem<LearningDeckState>(LEARNING_DECK_STATE_KEY, {
    levelFilter: levelFilter.value,
    grammarId: currentGrammar.value?.id || null,
    showBack: showBack.value,
  })
}

function applySavedDeckSelection() {
  const items = filteredLearningGrammar.value

  if (items.length === 0) {
    currentIndex.value = 0
    showBack.value = false
    restoreGrammarId.value = null
    restoringDeckState.value = false
    return
  }

  if (restoreGrammarId.value !== null) {
    const restoredIndex = items.findIndex(item => item.id === restoreGrammarId.value)
    currentIndex.value = restoredIndex >= 0 ? restoredIndex : 0
    if (restoredIndex < 0) {
      showBack.value = false
    }
    restoreGrammarId.value = null
    restoringDeckState.value = false
    return
  }

  if (currentIndex.value > items.length - 1) {
    currentIndex.value = 0
  }
}

function resetBackScroll() {
  if (backFaceRef.value) {
    backFaceRef.value.scrollTop = 0
  }
}

// ── Drag helpers ──
function resetDragState() {
  isDragging.value = false
  didDrag.value = false
  withTransition.value = false
  snapBack.value = false
  dragOffset.value = 0
  dragRotation.value = 0
  dragOpacity.value = 1
  if (flyOutTimer.value) {
    clearTimeout(flyOutTimer.value)
    flyOutTimer.value = null
  }
}

function startDrag(x: number, y: number) {
  resetDragState()
  swipeStartedAt.value = { x, y }
  isDragging.value = true
}

function moveDrag(x: number, y: number) {
  if (!isDragging.value || !swipeStartedAt.value) return
  const dx = x - swipeStartedAt.value.x
  const dy = y - swipeStartedAt.value.y

  if (Math.abs(dx) > 6) didDrag.value = true

  if (Math.abs(dx) > Math.abs(dy) * 0.5) {
    let effectiveDx = dx
    if (!hasNext.value && dx < 0) effectiveDx = dx * 0.25
    if (!hasPrev.value && dx > 0) effectiveDx = dx * 0.25

    dragOffset.value = effectiveDx
    dragRotation.value = Math.max(-10, Math.min(10, effectiveDx * 0.05))
    dragOpacity.value = Math.max(0.45, 1 - Math.abs(effectiveDx) / 500)
  }
}

function endDrag(finalDx: number, finalDy: number) {
  if (!isDragging.value || !swipeStartedAt.value) {
    resetDragState()
    return
  }

  isDragging.value = false
  swipeStartedAt.value = null

  const wasQuickSwipe = Math.abs(finalDx) >= 48 && Math.abs(finalDx) >= Math.abs(finalDy) * 1.2
  const wasMeaningfulDrag = didDrag.value || Math.abs(dragOffset.value) > 24

  if (!wasMeaningfulDrag && Math.abs(finalDx) < 10 && Math.abs(finalDy) < 10) {
    suppressFlipUntil.value = 0
    resetDragState()
    return
  }

  if (Math.abs(dragOffset.value) > 80) {
    suppressFlipUntil.value = Date.now() + 350
    const direction = dragOffset.value < 0 ? 'left' : 'right'

    if (direction === 'left' && hasNext.value) {
      withTransition.value = true
      snapBack.value = false
      dragOffset.value = -window.innerWidth * 0.55
      dragRotation.value = -12
      dragOpacity.value = 0
      flyOutTimer.value = window.setTimeout(() => {
        goNextCard()
        withTransition.value = false
        dragOffset.value = 0
        dragRotation.value = 0
        dragOpacity.value = 1
      }, 300)
    } else if (direction === 'right' && hasPrev.value) {
      withTransition.value = true
      snapBack.value = false
      dragOffset.value = window.innerWidth * 0.55
      dragRotation.value = 12
      dragOpacity.value = 0
      flyOutTimer.value = window.setTimeout(() => {
        goPrevCard()
        withTransition.value = false
        dragOffset.value = 0
        dragRotation.value = 0
        dragOpacity.value = 1
      }, 300)
    } else {
      // At edge — spring back
      withTransition.value = true
      snapBack.value = true
      dragOffset.value = 0
      dragRotation.value = 0
      dragOpacity.value = 1
      flyOutTimer.value = window.setTimeout(() => { withTransition.value = false }, 400)
    }
  } else if (wasQuickSwipe) {
    suppressFlipUntil.value = Date.now() + 350
    if (finalDx < 0) goNextCard()
    else goPrevCard()
    resetDragState()
  } else {
    // Spring back
    suppressFlipUntil.value = Date.now() + 180
    withTransition.value = true
    snapBack.value = true
    dragOffset.value = 0
    dragRotation.value = 0
    dragOpacity.value = 1
    flyOutTimer.value = window.setTimeout(() => { withTransition.value = false }, 400)
  }
}

// ── Touch handlers ──
function handleCardTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]
  startDrag(touch.clientX, touch.clientY)
}

function handleCardTouchMove(event: TouchEvent) {
  if (event.touches.length !== 1) return
  const touch = event.touches[0]
  moveDrag(touch.clientX, touch.clientY)
}

function handleCardTouchEnd(event: TouchEvent) {
  if (event.changedTouches.length !== 1) {
    resetDragState()
    return
  }
  const touch = event.changedTouches[0]
  endDrag(touch.clientX - (swipeStartedAt.value?.x ?? 0), touch.clientY - (swipeStartedAt.value?.y ?? 0))
}

// ── Mouse handlers (desktop testing) ──
function handleCardMouseDown(event: MouseEvent) {
  startDrag(event.clientX, event.clientY)
}

function handleCardMouseMove(event: MouseEvent) {
  moveDrag(event.clientX, event.clientY)
}

function handleCardMouseUp(event: MouseEvent) {
  endDrag(event.clientX - (swipeStartedAt.value?.x ?? 0), event.clientY - (swipeStartedAt.value?.y ?? 0))
}

function clearSwipeState() {
  resetDragState()
}

watch(levelFilter, () => {
  currentIndex.value = 0
  showBack.value = false
})

watch(filteredLearningGrammar, items => {
  void items
  applySavedDeckSelection()
}, { deep: false })

watch(
  [() => currentGrammar.value?.id, clientId],
  ([grammarId, nextClientId]) => {
    if (!grammarId || !nextClientId) return
    void ensurePackLoaded(grammarId)
  },
  { immediate: true },
)

watch(
  [levelFilter, () => currentGrammar.value?.id ?? null, showBack],
  () => {
    void persistDeckState()
  },
)

watch(showBack, isShowingBack => {
  if (isShowingBack) {
    void nextTick(resetBackScroll)
  }
})

watch(booting, isBooting => {
  if (!isBooting) {
    void persistDeckState()
  }
})

onMounted(async () => {
  booting.value = true
  studyStates.value = await getItem<Record<number, StudyState>>('study_states_detail') || {}
  const savedState = await getItem<LearningDeckState>(LEARNING_DECK_STATE_KEY)
  if (savedState) {
    restoringDeckState.value = true
    levelFilter.value = savedState.levelFilter || 'all'
    restoreGrammarId.value = savedState.grammarId
    showBack.value = !!savedState.showBack
  }
  applySavedDeckSelection()
  clientId.value = await getOrCreateExerciseClientId()
  booting.value = false
})

onBeforeUnmount(() => {
  void persistDeckState()
})
</script>

<template>
  <div class="learning-deck">
    <section class="filter-card">
      <div class="filter-head">
        <span class="filter-label">Level</span>
        <span class="filter-count">{{ filteredLearningGrammar.length }} cards</span>
      </div>

      <div class="filter-pills">
        <button
          v-for="option in levelOptions"
          :key="option.key"
          type="button"
          :class="['pill', { active: levelFilter === option.key }]"
          @click="levelFilter = option.key"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <section v-if="booting" class="state-card">
      <p>Loading your learning deck...</p>
    </section>

    <section v-else-if="filteredLearningGrammar.length === 0" class="state-card">
      <h3>{{ allLearningGrammar.length === 0 ? 'No learning grammar yet.' : 'No cards in this level.' }}</h3>
      <p v-if="allLearningGrammar.length === 0">
        Mark grammar as <strong>Learning</strong> from its status screen and it will appear here automatically.
      </p>
      <p v-else>
        Your learning deck has cards, just not in the current level filter.
      </p>
      <div class="empty-actions">
        <button v-if="allLearningGrammar.length === 0" type="button" class="secondary-btn" @click="openLibrary">
          Browse Grammar
        </button>
        <button v-else type="button" class="primary-btn" @click="resetToAllLevels">
          Show All Levels
        </button>
      </div>
    </section>

    <section v-else class="deck-shell">
      <div class="deck-top">
        <div class="deck-meta">
          <span class="deck-label">Card {{ currentIndex + 1 }} of {{ filteredLearningGrammar.length }}</span>
          <p class="deck-subtitle">Learning deck</p>
        </div>
        <div class="deck-chips">
          <span class="chip">Level {{ currentGrammar?.level }}</span>
          <span class="chip muted">Learning</span>
        </div>
      </div>

      <div class="card-stack">
        <!-- Behind card (peeks from underneath) -->
        <div
          v-if="behindGrammar && !showBack"
          class="flashcard behind-card"
          :class="{ 'coming-forward': withTransition && !snapBack }"
        >
          <div class="flashcard-face front-face">
            <div class="front-grammar">{{ behindGrammar.grammar }}</div>
          </div>
        </div>

        <!-- Front card (active, draggable) -->
        <div
          class="flashcard front-card"
          :class="{
            dragging: isDragging,
            'with-transition': withTransition,
            'snap-back': snapBack,
          }"
          :style="cardStyle"
          role="button"
          tabindex="0"
          @click="handleCardFlipClick"
          @keydown.enter.prevent="handleForcedFlip"
          @keydown.space.prevent="handleForcedFlip"
          @touchstart.passive="handleCardTouchStart"
          @touchmove="handleCardTouchMove"
          @touchend.passive="handleCardTouchEnd"
          @touchcancel="clearSwipeState"
          @mousedown="handleCardMouseDown"
          @mousemove="handleCardMouseMove"
          @mouseup="handleCardMouseUp"
          @mouseleave="handleCardMouseUp"
        >
          <div v-if="!showBack" class="flashcard-face front-face">
            <span class="face-label">Front</span>
            <div class="front-grammar">{{ currentGrammar?.grammar }}</div>
            <p class="front-hint">Tap to reveal. Swipe left / right to change cards.</p>
          </div>

          <div v-else ref="backFaceRef" class="flashcard-face back-face">
            <div class="back-block">
              <span class="face-label">Quick explanation</span>
              <h4 class="back-grammar">{{ currentGrammar?.grammar }}</h4>
              <p class="back-meaning">{{ currentGrammar?.meaning }}</p>
              <p class="summary-copy">{{ currentSummary }}</p>
            </div>

            <div class="back-block">
              <div class="examples-head">
                <span class="face-label">Examples</span>
                <span v-if="usingFallbackExamples && currentPackLoading" class="examples-note">
                  Loading fresher sentences...
                </span>
              </div>

              <div v-if="currentExamples.length" class="example-list">
                <article
                  v-for="(example, index) in currentExamples"
                  :key="`${currentGrammar?.id}-${index}`"
                  class="example-card"
                >
                  <div class="sentence-row">
                    <p class="example-korean">{{ example.korean }}</p>
                    <TtsButton :text="example.korean" label="example sentence" />
                  </div>
                  <p class="example-english">{{ example.english }}</p>
                </article>
              </div>

              <p v-else-if="currentPackLoading" class="support-copy">
                Loading example sentences...
              </p>
              <p v-else-if="currentPackError" class="support-copy">
                {{ currentPackError }}
              </p>
              <p v-else class="support-copy">
                No examples are ready for this grammar yet.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="primary-actions">
        <button type="button" class="action-btn" :disabled="!hasPrev" @click="goPrevCard">
          Prev
        </button>
        <button type="button" class="action-btn emphasis" @click="handleForcedFlip">
          {{ showBack ? 'Front' : 'Flip' }}
        </button>
        <button type="button" class="action-btn" :disabled="!hasNext" @click="goNextCard">
          Next
        </button>
      </div>

      <div class="secondary-actions">
        <button type="button" class="primary-btn" @click="openDetail">
          Open Detail
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.learning-deck {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
}

.filter-card,
.state-card,
.deck-shell {
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(198, 198, 198, 0.2);
  box-shadow: 0 10px 30px rgba(26, 28, 28, 0.06);
  padding: 18px;
}

.filter-label,
.deck-label,
.face-label {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #777;
}

.filter-head,
.deck-top,
.examples-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-count,
.examples-note {
  font-size: 0.78rem;
  color: #777;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.pill,
.action-btn,
.secondary-btn,
.primary-btn {
  border: none;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
}

.pill {
  padding: 10px 14px;
  background: #f0f0f0;
  color: #555;
  font-size: 0.82rem;
}

.pill.active {
  background: #000;
  color: #fff;
}

.state-card h3 {
  margin: 0 0 8px;
  font-size: 1.1rem;
  color: #000;
}

.state-card p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #474747;
}

.empty-actions,
.secondary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.deck-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.back-grammar {
  margin: 6px 0 0;
  font-size: clamp(1.35rem, 6vw, 2rem);
  line-height: 1.15;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
  overflow-wrap: anywhere;
}

.deck-meta {
  min-height: 42px;
}

.deck-subtitle {
  margin: 6px 0 0;
  font-size: 0.95rem;
  line-height: 1.35;
  color: #474747;
}

.back-meaning {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.5;
  color: #2f2720;
}

.deck-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f0f0f0;
  color: #555;
  font-size: 0.8rem;
  font-weight: 700;
}

.chip.muted {
  background: #eaeaea;
}

/* ── Card stack ── */
.card-stack {
  --front-card-height: 400px;
  position: relative;
  min-height: var(--front-card-height);
}

/* ── Behind card ── */
.flashcard.behind-card {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: var(--front-card-height);
  z-index: 1;
  transform: scale(0.92);
  opacity: 0.55;
  transition: transform 0.35s ease, opacity 0.35s ease;
  pointer-events: none;
}

.flashcard.behind-card.coming-forward {
  transform: scale(0.98);
  opacity: 0.85;
}

/* ── Front card (draggable + flippable) ── */
.flashcard.front-card {
  position: relative;
  z-index: 2;
  width: 100%;
  min-height: var(--front-card-height);
  border: none;
  border-radius: 24px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04);
  color: inherit;
  padding: 0;
  text-align: left;
  perspective: 1000px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;

  transform: translateX(var(--drag-x, 0px)) rotateZ(var(--drag-r, 0deg));
  opacity: var(--drag-o, 1);
  will-change: transform, opacity;
}

.flashcard.front-card.dragging {
  transition: none !important;
}

.flashcard.front-card.with-transition {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease;
}

.flashcard.front-card.with-transition.snap-back {
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.28s ease;
}

.flashcard-face {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 20px;
  border-radius: 24px;
}

.front-face {
  min-height: var(--front-card-height);
  align-items: center;
  justify-content: center;
  text-align: center;
}

.front-grammar {
  font-size: clamp(2rem, 9vw, 3.1rem);
  font-weight: 900;
  color: #000;
  line-height: 1.1;
  font-family: 'Noto Sans KR', sans-serif;
  overflow-wrap: anywhere;
}

.front-hint {
  margin: 0;
  font-size: 0.92rem;
  color: #777;
}

.back-face {
  justify-content: flex-start;
}

.back-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.summary-copy,
.support-copy {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: #474747;
}

.example-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.example-card {
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.sentence-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.example-korean,
.example-english {
  margin: 0;
  overflow-wrap: anywhere;
}

.example-korean {
  font-size: clamp(1rem, 4.8vw, 1.15rem);
  font-weight: 800;
  line-height: 1.35;
  color: #000;
  font-family: 'Noto Sans KR', sans-serif;
}

.example-english {
  margin-top: 6px;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #555;
}

.primary-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.action-btn,
.secondary-btn,
.primary-btn {
  min-height: 48px;
  padding: 0 14px;
  font-size: 0.92rem;
}

.action-btn {
  background: #f0f0f0;
  color: #333;
}

.action-btn.emphasis,
.primary-btn {
  background: #000;
  color: #fff;
}

.secondary-btn {
  background: #f5f5f5;
  color: #333;
}

.action-btn:disabled {
  opacity: 0.42;
  cursor: default;
}

.pill:not(.active):active,
.action-btn:not(:disabled):active,
.secondary-btn:active,
.primary-btn:active {
  transform: scale(0.98);
}

@media (max-width: 360px) {
  .card-stack {
    --front-card-height: 372px;
  }

  .filter-card,
  .state-card,
  .deck-shell {
    padding: 16px 14px;
  }

  .flashcard-face {
    padding: 18px 14px;
    gap: 16px;
  }

  .primary-actions,
  .secondary-actions,
  .empty-actions {
    gap: 8px;
  }

  .action-btn,
  .secondary-btn,
  .primary-btn {
    min-height: 44px;
    padding: 0 10px;
    font-size: 0.84rem;
  }

  .pill {
    padding: 9px 12px;
    font-size: 0.76rem;
  }
}

@media (max-width: 320px) {
  .card-stack {
    --front-card-height: 348px;
  }

  .deck-top {
    align-items: flex-start;
  }

  .deck-chips {
    justify-content: flex-start;
  }

  .flashcard-face {
    padding: 16px 12px;
  }

  .front-grammar {
    font-size: clamp(1.75rem, 10vw, 2.3rem);
  }

  .back-grammar {
    font-size: 1.2rem;
  }

  .back-meaning,
  .summary-copy,
  .support-copy,
  .state-card p,
  .front-hint,
  .example-english {
    font-size: 0.84rem;
  }

  .example-korean {
    font-size: 0.96rem;
  }

  .sentence-row {
    gap: 8px;
  }

  .action-btn,
  .secondary-btn,
  .primary-btn {
    font-size: 0.78rem;
  }
}
</style>
