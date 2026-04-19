import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs/promises'
import OpenAI from 'openai'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const packsDir = path.join(__dirname, 'data', 'exercise-packs')

const openaiApiKey = (process.env.OPENAI_API_KEY || '').trim()
const openaiModel = (process.env.OPENAI_MODEL || 'gpt-4.1-mini').trim()
const port = Number.parseInt(process.env.PORT || '8030', 10)

const clientRegenWindows = new Map()
const grammarDailyCounts = new Map()

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))
app.use(cors({
  origin(origin, callback) {
    const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
    const defaultOrigins = [
      'https://api.keystonelanguages.com',
      'capacitor://localhost',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://localhost',
    ]
    const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Origin is not allowed'))
  },
}))

const grammarList = JSON.parse(await fs.readFile(path.join(repoRoot, 'src', 'data', 'grammar.json'), 'utf8'))
const grammarDetails = JSON.parse(await fs.readFile(path.join(repoRoot, 'src', 'data', 'grammar-details.json'), 'utf8'))
const clozeSentences = JSON.parse(await fs.readFile(path.join(repoRoot, 'src', 'data', 'cloze-sentences.json'), 'utf8'))

const grammarById = new Map(grammarList.map(item => [item.id, item]))
const detailById = new Map(grammarDetails.map(item => [item.id, item]))

await fs.mkdir(packsDir, { recursive: true })

const MODEL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    usageSummary: {
      type: 'string',
      minLength: 24,
    },
    examples: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          korean: { type: 'string', minLength: 6 },
          english: { type: 'string', minLength: 6 },
          whyItWorks: { type: 'string', minLength: 12 },
          breakdownItems: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                word: { type: 'string', minLength: 1 },
                romanization: { type: 'string', minLength: 1 },
                meaning: { type: 'string', minLength: 1 },
                conjugationBefore: { type: 'string' },
                conjugationAfter: { type: 'string' },
                grammarNote: { type: 'string' },
              },
              required: ['word', 'romanization', 'meaning', 'conjugationBefore', 'conjugationAfter', 'grammarNote'],
            },
          },
          notableGrammarPoints: {
            type: 'array',
            maxItems: 2,
            items: { type: 'string', minLength: 4 },
          },
        },
        required: ['korean', 'english', 'whyItWorks', 'breakdownItems', 'notableGrammarPoints'],
      },
    },
    sentenceChecks: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          prompt: { type: 'string', minLength: 10 },
          correctExampleIndex: {
            type: 'integer',
            minimum: 0,
            maximum: 2,
          },
          distractors: {
            type: 'array',
            minItems: 3,
            maxItems: 3,
            items: { type: 'string', minLength: 6 },
          },
          explanation: { type: 'string', minLength: 12 },
        },
        required: ['prompt', 'correctExampleIndex', 'distractors', 'explanation'],
      },
    },
  },
  required: ['usageSummary', 'examples', 'sentenceChecks'],
}

function shuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

function uniqueStrings(items) {
  const seen = new Set()
  const result = []

  for (const item of items) {
    const normalized = String(item || '').trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

function staticExamplesForGrammar(grammarId) {
  const grammar = grammarById.get(grammarId)
  const detail = detailById.get(grammarId)
  const clozeExamples = Array.isArray(clozeSentences[String(grammarId)]) ? clozeSentences[String(grammarId)] : []

  if (grammar && (grammar.level === '1-2' || grammar.level === '3-4') && clozeExamples.length > 0) {
    return clozeExamples.filter(example => example?.korean)
  }

  return (detail?.rules || [])
    .flatMap(rule => rule.examples || [])
    .filter(example => example?.korean)
}

function sentenceDistractorPool(targetGrammarId) {
  const target = grammarById.get(targetGrammarId)
  if (!target) return []

  const sameCategory = []
  const sameLevel = []
  const fallback = []

  for (const grammar of grammarList) {
    if (grammar.id === targetGrammarId) continue
    const examples = staticExamplesForGrammar(grammar.id)
      .map(example => String(example.korean || '').trim())
      .filter(Boolean)

    if (examples.length === 0) continue

    if (grammar.level === target.level && grammar.category === target.category) {
      sameCategory.push(...examples)
      continue
    }

    if (grammar.level === target.level) {
      sameLevel.push(...examples)
      continue
    }

    fallback.push(...examples)
  }

  return uniqueStrings([...sameCategory, ...sameLevel, ...fallback])
}

function meaningDistractorPool(targetGrammarId) {
  const target = grammarById.get(targetGrammarId)
  if (!target) return []

  const sameCategory = []
  const sameLevel = []
  const fallback = []

  for (const grammar of grammarList) {
    if (grammar.id === targetGrammarId || !grammar.meaning) continue

    if (grammar.level === target.level && grammar.category === target.category) {
      sameCategory.push(grammar.meaning)
      continue
    }

    if (grammar.level === target.level) {
      sameLevel.push(grammar.meaning)
      continue
    }

    fallback.push(grammar.meaning)
  }

  return uniqueStrings([...sameCategory, ...sameLevel, ...fallback]).filter(item => item !== target.meaning)
}

function buildMeaningChecks(grammar, detail, usageSummary) {
  const prompts = [
    `Which meaning best matches ${grammar.grammar}?`,
    `Choose the English meaning for ${grammar.grammar}.`,
  ]

  return prompts.map((prompt, index) => {
    const wrongOptions = meaningDistractorPool(grammar.id)
      .filter(option => option !== grammar.meaning)
      .slice(index, index + 6)

    const selectedWrong = uniqueStrings(wrongOptions).slice(0, 3)
    if (selectedWrong.length < 3) {
      throw new Error(`Not enough distractor meanings for grammar ${grammar.id}`)
    }

    const options = shuffle([grammar.meaning, ...selectedWrong])
    return {
      id: `meaning-${index + 1}`,
      type: 'meaning_choice',
      prompt,
      options,
      correctIndex: options.findIndex(option => option === grammar.meaning),
      explanation: index === 0 ? usageSummary : (detail?.explanation || usageSummary),
    }
  })
}

function normalizeModelOutput(payload) {
  const usageSummary = String(payload?.usageSummary || '').trim()
  const examples = Array.isArray(payload?.examples) ? payload.examples : []
  const sentenceChecks = Array.isArray(payload?.sentenceChecks) ? payload.sentenceChecks : []

  if (!usageSummary || examples.length !== 3 || sentenceChecks.length !== 2) {
    throw new Error('Model output did not contain the expected exercise seed shape.')
  }

  return {
    usageSummary,
    examples: examples.map(example => ({
      korean: String(example.korean || '').trim(),
      english: String(example.english || '').trim(),
      whyItWorks: String(example.whyItWorks || '').trim(),
      breakdownItems: Array.isArray(example.breakdownItems)
        ? example.breakdownItems.map(item => ({
            word: String(item.word || '').trim(),
            romanization: String(item.romanization || '').trim(),
            meaning: String(item.meaning || '').trim(),
            conjugationBefore: String(item.conjugationBefore || '').trim(),
            conjugationAfter: String(item.conjugationAfter || '').trim(),
            grammarNote: String(item.grammarNote || '').trim(),
          }))
        : [],
      notableGrammarPoints: Array.isArray(example.notableGrammarPoints)
        ? example.notableGrammarPoints.map(item => String(item || '').trim()).filter(Boolean)
        : [],
    })),
    sentenceChecks: sentenceChecks.map(check => ({
      prompt: String(check.prompt || '').trim(),
      correctExampleIndex: Number.parseInt(String(check.correctExampleIndex), 10),
      distractors: Array.isArray(check.distractors) ? check.distractors.map(item => String(item || '').trim()) : [],
      explanation: String(check.explanation || '').trim(),
    })),
  }
}

async function generateExerciseSeed(grammar, detail) {
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the exercise backend.')
  }

  const staticExamples = staticExamplesForGrammar(grammar.id)
    .slice(0, 5)
    .map(example => ({
      korean: String(example.korean || '').trim(),
      english: String(example.english || '').trim(),
    }))

  const client = new OpenAI({ apiKey: openaiApiKey })
  const response = await client.responses.create({
    model: openaiModel,
    store: false,
    instructions: [
      'You create Korean grammar exercise seed data for a TOPIK study app.',
      'Return JSON only.',
      'Use natural Korean that fits the target grammar point.',
      'Make exactly 3 example cards and 2 sentence-choice check seeds.',
      'Each example must be practical for learners and must clearly demonstrate the target grammar.',
      'For every example, include a UX-friendly breakdownItems array that covers the important words or chunks in order.',
      'Each breakdown item must include the Korean word or chunk, a learner-friendly romanization, and a simple English meaning.',
      'If a word is conjugated, include conjugationBefore as the dictionary or base form and conjugationAfter as the realized form in the sentence.',
      'If a word is not conjugated, leave conjugationBefore and conjugationAfter as empty strings.',
      'If there is another notable grammar point in that word or chunk, explain it briefly in grammarNote. Otherwise use an empty string.',
      'Also include up to 2 short notableGrammarPoints strings for extra grammar patterns worth noticing in the sentence.',
      'Each whyItWorks line should explain the grammar usage in one plain English sentence.',
      'Each sentence-choice check seed must point to one example card with correctExampleIndex and provide 3 distractor sentences that do not naturally use the target grammar.',
      'Do not create broken Korean, fake chunks, or ungrammatical distractors.',
      'Do not use bullet markers, numbering, or markdown in any field.',
    ].join(' '),
    input: JSON.stringify({
      grammarId: grammar.id,
      grammar: grammar.grammar,
      meaning: grammar.meaning,
      level: grammar.level,
      category: grammar.category,
      explanation: detail?.explanation || '',
      notes: (detail?.notes || []).map(note => note.text),
      referenceExamples: staticExamples,
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'topik_exercise_seed',
        strict: true,
        schema: MODEL_OUTPUT_SCHEMA,
      },
    },
  })

  return normalizeModelOutput(JSON.parse(response.output_text || '{}'))
}

function buildSentenceChecks(grammar, seed) {
  const exampleSentences = seed.examples.map(example => example.korean)
  const fallbackPool = sentenceDistractorPool(grammar.id)

  return seed.sentenceChecks.map((check, index) => {
    const correctSentence = seed.examples[check.correctExampleIndex]?.korean
    if (!correctSentence) {
      throw new Error('Model selected an invalid example index for a sentence check.')
    }

    const fallbackDistractors = fallbackPool.filter(sentence => !exampleSentences.includes(sentence))
    const distractors = uniqueStrings([
      ...check.distractors.filter(sentence => !exampleSentences.includes(sentence)),
      ...fallbackDistractors,
    ]).slice(0, 3)

    if (distractors.length < 3) {
      throw new Error(`Not enough distractor sentences for grammar ${grammar.id}`)
    }

    const options = shuffle([correctSentence, ...distractors])
    return {
      id: `sentence-${index + 1}`,
      type: 'sentence_choice',
      prompt: check.prompt || `Which sentence correctly uses ${grammar.grammar}?`,
      options,
      correctIndex: options.findIndex(option => option === correctSentence),
      explanation: check.explanation,
    }
  })
}

async function generateExercisePack(grammarId, nextVersion) {
  const grammar = grammarById.get(grammarId)
  if (!grammar) {
    const error = new Error('Grammar point was not found.')
    error.statusCode = 404
    throw error
  }

  const detail = detailById.get(grammarId)
  const seed = await generateExerciseSeed(grammar, detail)
  const sentenceChecks = buildSentenceChecks(grammar, seed)
  const meaningChecks = buildMeaningChecks(grammar, detail, seed.usageSummary)
  const now = Date.now()

  return {
    grammarId: grammar.id,
    grammar: grammar.grammar,
    meaning: grammar.meaning,
    level: grammar.level,
    category: grammar.category,
    usageSummary: seed.usageSummary,
    examples: seed.examples,
    checks: [
      sentenceChecks[0],
      meaningChecks[0],
      sentenceChecks[1],
      meaningChecks[1],
    ],
    version: nextVersion,
    generatedAt: now,
    publishedAt: now,
  }
}

function packFile(grammarId) {
  return path.join(packsDir, `${grammarId}.json`)
}

async function readPackRecord(grammarId) {
  try {
    const raw = await fs.readFile(packFile(grammarId), 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function writePackRecord(grammarId, record) {
  await fs.writeFile(packFile(grammarId), JSON.stringify(record, null, 2))
}

async function getOrCreatePack(grammarId) {
  const existing = await readPackRecord(grammarId)
  if (existing?.current) {
    return existing.current
  }

  const pack = await generateExercisePack(grammarId, 1)
  await writePackRecord(grammarId, {
    current: pack,
    history: [],
  })
  return pack
}

function enforceRegenerationLimits(grammarId, clientId) {
  const now = Date.now()
  const minuteKey = `${clientId}:${grammarId}`
  const previous = clientRegenWindows.get(minuteKey)
  if (previous && now - previous < 60_000) {
    const error = new Error('Please wait about a minute before regenerating this grammar again.')
    error.statusCode = 429
    throw error
  }

  const dayKey = `${grammarId}:${new Date(now).toISOString().slice(0, 10)}`
  const count = grammarDailyCounts.get(dayKey) || 0
  if (count >= 25) {
    const error = new Error('This grammar has hit today’s regeneration limit.')
    error.statusCode = 429
    throw error
  }

  clientRegenWindows.set(minuteKey, now)
  grammarDailyCounts.set(dayKey, count + 1)
}

async function regeneratePack(grammarId, clientId) {
  if (!clientId) {
    const error = new Error('Missing exercise client identifier.')
    error.statusCode = 400
    throw error
  }

  enforceRegenerationLimits(grammarId, clientId)

  const existing = await readPackRecord(grammarId)
  const nextVersion = Number(existing?.current?.version || 0) + 1
  const pack = await generateExercisePack(grammarId, nextVersion)
  const history = existing?.current
    ? [existing.current, ...(existing.history || [])].slice(0, 5)
    : []

  await writePackRecord(grammarId, {
    current: pack,
    history,
  })

  return pack
}

app.get('/v1/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/v1/exercise-packs/:grammarId', async (request, response) => {
  try {
    const grammarId = Number.parseInt(request.params.grammarId, 10)
    const pack = await getOrCreatePack(grammarId)
    response.json({ pack })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    response.status(statusCode).json({ error: error.message || 'Unable to load the exercise pack.' })
  }
})

app.post('/v1/exercise-packs/:grammarId/regenerate', async (request, response) => {
  try {
    const grammarId = Number.parseInt(request.params.grammarId, 10)
    const clientId = String(request.get('x-exercise-client-id') || '').trim()
    const pack = await regeneratePack(grammarId, clientId)
    response.json({ pack })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    response.status(statusCode).json({ error: error.message || 'Unable to regenerate the exercise pack.' })
  }
})

app.listen(Number.isFinite(port) ? port : 8030, '127.0.0.1', () => {
  console.log(`TOPIK exercise backend listening on http://127.0.0.1:${port}`)
})
