export interface GrammarPoint {
  id: number
  level: string
  category: string
  grammar: string
  meaning: string
}

export type StudyStatus = 'new' | 'learning' | 'mastered'

export interface StudyState {
  status: StudyStatus
  lastReviewed: number | null
  reviewCount: number
}

export interface GrammarExample {
  korean: string
  breakdown?: string
  english: string
}

export interface GrammarRule {
  title: string
  description: string
  examples: GrammarExample[]
}

export interface GrammarNote {
  icon: 'check' | 'group' | 'close' | 'warning' | 'info'
  title: string
  text: string
}

export interface GrammarException {
  name: string
  description: string
  example: string
}

export interface GrammarDetail {
  id: number
  explanation?: string
  rules?: GrammarRule[]
  notes?: GrammarNote[]
  exceptions?: GrammarException[]
}
