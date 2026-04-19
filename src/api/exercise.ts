import type { ExercisePack } from '../types/exercise'

const DEFAULT_API_BASE = 'https://api.keystonelanguages.com/topik-grammar-api'

function getApiBase(): string {
  return (import.meta.env.VITE_GRAMMAR_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '')
}

interface ExercisePackResponse {
  pack: ExercisePack
}

interface ErrorResponse {
  error?: string
  detail?: string
}

async function requestExercisePack(
  path: string,
  clientId: string,
  init?: RequestInit,
): Promise<ExercisePack> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Exercise-Client-Id': clientId,
      ...(init?.headers || {}),
    },
  })

  const data = await response.json().catch(() => null) as ExercisePackResponse | ErrorResponse | null
  if (!response.ok) {
    const failure = data as ErrorResponse | null
    throw new Error(failure?.error || failure?.detail || 'The exercise service is unavailable right now.')
  }

  if (!data || typeof data !== 'object' || !('pack' in data) || !data.pack) {
    throw new Error('The exercise service returned an invalid payload.')
  }

  return data.pack
}

export async function fetchExercisePack(grammarId: number, clientId: string): Promise<ExercisePack> {
  return requestExercisePack(`/v1/exercise-packs/${grammarId}`, clientId)
}

export async function regenerateExercisePack(grammarId: number, clientId: string): Promise<ExercisePack> {
  return requestExercisePack(`/v1/exercise-packs/${grammarId}/regenerate`, clientId, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
