<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef } from 'vue'
import { App as CapacitorApp } from '@capacitor/app'
import BrowseView from './views/BrowseView.vue'
import DetailView from './views/DetailView.vue'
import GrammarStatusView from './views/GrammarStatusView.vue'

import LearningDeckView from './views/LearningDeckView.vue'
import PracticeHubView from './views/PracticeHubView.vue'
import StatsView from './views/StatsView.vue'
import type { GrammarPoint } from './types/grammar'
import { initGlobalClickSound } from './sound'

const tabs = [
  { key: 'browse', label: 'Library', icon: 'menu_book' },
  { key: 'cards', label: 'Deck', icon: 'style' },
  { key: 'quiz', label: 'Studio', icon: 'edit_note' },
  { key: 'stats', label: 'Profile', icon: 'account_circle' },
]

const activeTab = ref('browse')
const selectedGrammar = shallowRef<GrammarPoint | null>(null)
const viewStack = ref<string[]>(['browse'])

// Persisted browse filter state so returning from detail keeps the filter
const browseState = ref({
  activeLevel: '1-2',
  categoryFilter: 'All',
  searchQuery: '',
})

function navigateTo(tab: string, grammar?: GrammarPoint) {
  if (grammar) {
    selectedGrammar.value = grammar
    viewStack.value.push(tab)
  } else {
    viewStack.value = [tab]
    activeTab.value = tab
    selectedGrammar.value = null
  }
  // Scroll to top when opening any view
  const main = document.querySelector('.app-main')
  if (main) main.scrollTop = 0
}

function goBack() {
  viewStack.value.pop()
  const prev = viewStack.value[viewStack.value.length - 1]
  if (tabs.find(t => t.key === prev)) {
    activeTab.value = prev
  }
}

provide('navigateTo', navigateTo)
provide('goBack', goBack)
provide('selectedGrammar', selectedGrammar)
provide('browseState', browseState)

const currentView = computed(() => {
  const top = viewStack.value[viewStack.value.length - 1]
  switch (top) {
    case 'browse': return BrowseView
    case 'detail': return DetailView
    case 'grammar-status': return GrammarStatusView
    case 'grammar-exercise': return DetailView
    case 'cards': return LearningDeckView
    case 'quiz': return PracticeHubView
    case 'stats': return StatsView
    default: return BrowseView
  }
})

const isHome = computed(() => viewStack.value.length === 1)
const pageTitle = computed(() => {
  const top = viewStack.value[viewStack.value.length - 1]
  if ((top === 'detail' || top === 'grammar-status' || top === 'grammar-exercise') && selectedGrammar.value) {
    return selectedGrammar.value.grammar
  }
  const tab = tabs.find(t => t.key === top)
  return tab ? tab.label : ''
})

onMounted(() => {
  initGlobalClickSound()

  // Handle Android hardware back button
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (viewStack.value.length > 1) {
      goBack()
    } else if (canGoBack) {
      // At home screen — let the system handle it (minimize/exit)
      CapacitorApp.exitApp()
    }
  })
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <button
        v-if="!isHome"
        class="header-btn back"
        @click="goBack"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div v-else class="header-spacer"></div>

      <h1 v-if="isHome" class="app-title">TOPIK GRAMMAR</h1>
      <h1 v-else class="app-title">{{ pageTitle }}</h1>

      <button
        v-if="isHome"
        class="header-btn search"
        @click=""
      >
        <span class="material-symbols-outlined">search</span>
      </button>
      <div v-else class="header-spacer"></div>
    </header>

    <main :class="['app-main', { 'has-nav': isHome }]">
      <component :is="currentView" />
    </main>

    <!-- Bottom Nav -->
    <nav v-if="isHome" class="app-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['nav-btn', { active: activeTab === tab.key }]"
        @click="navigateTo(tab.key)"
      >
        <span class="material-symbols-outlined nav-icon">{{ tab.icon }}</span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: #f9f9f9;
}

.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: none;
  box-shadow: none;
}

.header-spacer {
  width: 40px;
  height: 40px;
}

.header-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #000;
  cursor: pointer;
  border-radius: 50%;
  transition: opacity 0.15s ease;
}

.header-btn:hover {
  opacity: 0.7;
}

.header-btn:active {
  transform: scale(0.95);
}

.header-btn .material-symbols-outlined {
  font-size: 24px;
}

.app-title {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #000;
  text-align: center;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 64px 12px 24px;
}

.app-main.has-nav {
  padding-bottom: 96px;
}

.app-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  background: #fff;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.04);
  padding: 0 4px 12px;
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  background: none;
  border: none;
  color: #a0a0a0;
  font-size: 10px;
  padding: 8px 4px 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1 1 0;
  min-width: 0;
  border-top: 4px solid transparent;
  border-radius: 0;
}

.nav-btn.active {
  color: #000;
  border-top-color: #000;
}

.nav-btn:not(.active):hover {
  color: #000;
}

.nav-btn:active {
  transform: translateY(-2px);
}

.nav-icon {
  font-size: 22px;
  line-height: 1;
}

.nav-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 360px) {
  .app-main {
    padding-left: 10px;
    padding-right: 10px;
  }

  .app-nav {
    padding-left: 2px;
    padding-right: 2px;
  }

  .nav-btn {
    padding-left: 2px;
    padding-right: 2px;
  }

  .nav-icon {
    font-size: 20px;
  }

  .nav-label {
    font-size: 9px;
    letter-spacing: 0.02em;
  }
}
</style>
