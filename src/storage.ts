import { Preferences } from '@capacitor/preferences'
import type {
  CachedExercisePack,
  ExercisePack,
  ExerciseVisit,
  GrammarExerciseStats,
} from './types/exercise'

const PREFIX = 'topik_';

export async function getItem<T>(key: string): Promise<T | null> {
  const { value } = await Preferences.get({ key: PREFIX + key });
  return value ? JSON.parse(value) : null;
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await Preferences.set({ key: PREFIX + key, value: JSON.stringify(value) });
}

export async function removeItem(key: string): Promise<void> {
  await Preferences.remove({ key: PREFIX + key });
}

// Cloze practice tracking
export interface ClozePracticeRecord {
  grammarId: number
  practicedAt: number // timestamp
  correct: boolean
  sentenceIndex: number // which sentence from the pool
}

export interface ClozeSessionSummary {
  date: number // timestamp
  totalQuestions: number
  correctCount: number
  duration: number // seconds
  levelFilter: string
  statusFilter: string
}

export async function addClozePractice(record: ClozePracticeRecord): Promise<void> {
  const history = await getItem<ClozePracticeRecord[]>('cloze_practice_history') || []
  history.push(record)
  // Keep last 1000 records to avoid storage bloat
  if (history.length > 1000) {
    history.splice(0, history.length - 1000)
  }
  await setItem('cloze_practice_history', history)
}

export async function addClozeSession(summary: ClozeSessionSummary): Promise<void> {
  const sessions = await getItem<ClozeSessionSummary[]>('cloze_session_history') || []
  sessions.push(summary)
  // Keep last 100 sessions
  if (sessions.length > 100) {
    sessions.splice(0, sessions.length - 100)
  }
  await setItem('cloze_session_history', sessions)
}

export async function getClozePracticeHistory(): Promise<ClozePracticeRecord[]> {
  return await getItem<ClozePracticeRecord[]>('cloze_practice_history') || []
}

export async function getClozeSessionHistory(): Promise<ClozeSessionSummary[]> {
  return await getItem<ClozeSessionSummary[]>('cloze_session_history') || []
}

// Get practice count for a specific grammar point
export async function getClozePracticeCount(grammarId: number): Promise<number> {
  const history = await getClozePracticeHistory()
  return history.filter(r => r.grammarId === grammarId).length
}

// Get accuracy for a specific grammar point
export async function getClozeAccuracy(grammarId: number): Promise<{ correct: number; total: number }> {
  const history = await getClozePracticeHistory()
  const records = history.filter(r => r.grammarId === grammarId)
  const correct = records.filter(r => r.correct).length
  return { correct, total: records.length }
}

const EXERCISE_PACK_CACHE_KEY = 'exercise_pack_cache_v1'
const EXERCISE_VISITS_KEY = 'grammar_exercise_visits_v1'
const EXERCISE_STATS_KEY = 'grammar_exercise_stats_v1'
const EXERCISE_CLIENT_ID_KEY = 'grammar_exercise_client_id'

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function getOrCreateExerciseClientId(): Promise<string> {
  const existing = await getItem<string>(EXERCISE_CLIENT_ID_KEY)
  if (existing) return existing

  const next = createClientId()
  await setItem(EXERCISE_CLIENT_ID_KEY, next)
  return next
}

export async function getExercisePackCache(): Promise<Record<number, CachedExercisePack>> {
  return await getItem<Record<number, CachedExercisePack>>(EXERCISE_PACK_CACHE_KEY) || {}
}

export async function getCachedExercisePack(grammarId: number): Promise<CachedExercisePack | null> {
  const cache = await getExercisePackCache()
  return cache[grammarId] || null
}

export async function setCachedExercisePack(grammarId: number, pack: ExercisePack): Promise<void> {
  const cache = await getExercisePackCache()
  cache[grammarId] = {
    pack,
    cachedAt: Date.now(),
  }
  await setItem(EXERCISE_PACK_CACHE_KEY, cache)
}

export async function getGrammarExerciseVisits(): Promise<ExerciseVisit[]> {
  return await getItem<ExerciseVisit[]>(EXERCISE_VISITS_KEY) || []
}

export async function addGrammarExerciseVisit(visit: ExerciseVisit): Promise<void> {
  const visits = await getGrammarExerciseVisits()
  visits.unshift(visit)
  if (visits.length > 100) {
    visits.splice(100)
  }
  await setItem(EXERCISE_VISITS_KEY, visits)
}

export async function getGrammarExerciseStats(): Promise<Record<number, GrammarExerciseStats>> {
  return await getItem<Record<number, GrammarExerciseStats>>(EXERCISE_STATS_KEY) || {}
}

export async function recordGrammarExerciseStats(next: GrammarExerciseStats): Promise<void> {
  const stats = await getGrammarExerciseStats()
  const current = stats[next.grammarId]
  stats[next.grammarId] = {
    grammarId: next.grammarId,
    lastPracticedAt: next.lastPracticedAt,
    questionsAnswered: (current?.questionsAnswered || 0) + next.questionsAnswered,
    correctCount: (current?.correctCount || 0) + next.correctCount,
    examplesRevealed: (current?.examplesRevealed || 0) + next.examplesRevealed,
  }
  await setItem(EXERCISE_STATS_KEY, stats)
}
