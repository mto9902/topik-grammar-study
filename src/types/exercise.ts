export interface ExerciseBreakdownItem {
  word: string
  romanization: string
  meaning: string
  conjugationBefore?: string
  conjugationAfter?: string
  grammarNote?: string
}

export interface ExerciseExampleCard {
  korean: string
  breakdown?: string
  breakdownItems?: ExerciseBreakdownItem[]
  english: string
  whyItWorks: string
  notableGrammarPoints?: string[]
}

export type PracticeCheckType = 'sentence_choice' | 'meaning_choice'

export interface PracticeCheck {
  id: string
  type: PracticeCheckType
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface ExercisePack {
  grammarId: number
  grammar: string
  meaning: string
  level: string
  category: string
  usageSummary: string
  examples: ExerciseExampleCard[]
  checks: PracticeCheck[]
  version: number
  generatedAt: number
  publishedAt: number
}

export interface GrammarExerciseStats {
  grammarId: number
  lastPracticedAt: number
  questionsAnswered: number
  correctCount: number
  examplesRevealed: number
}

export interface ExerciseVisit {
  grammarId: number
  startedAt: number
  endedAt: number
  version: number
  questionsAnswered: number
  correctCount: number
  examplesRevealed: number
}

export interface CachedExercisePack {
  pack: ExercisePack
  cachedAt: number
}
