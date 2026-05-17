#!/usr/bin/env node

import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY
const model = process.env.OPENAI_MODEL || 'gpt-4o'
const PLACEHOLDER_FRAGMENTS = [
  'placeholder',
  'your-',
  'xxx',
  'replace',
  'example',
  'todo',
  'changeme',
]

function isUsableSecret(value) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  const lower = trimmed.toLowerCase()
  return !PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

if (!isUsableSecret(apiKey)) {
  console.error('Missing OPENAI_API_KEY or value looks like a placeholder.')
  process.exit(1)
}

const openai = new OpenAI({ apiKey })

async function jsonCompletion(label, system, user) {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  })

  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error(`${label} returned no content`)

  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`${label} did not return valid JSON: ${content}`)
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} missing string value`)
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} missing array value`)
}

function assertNonEmptyArray(value, label) {
  assertArray(value, label)
  if (value.length === 0) throw new Error(`${label} missing at least one item`)
}

async function smokeParse() {
  const parsed = await jsonCompletion(
    'task parse',
    `Return only JSON for a task with fields title, due_date, priority, context, people, tags, action_type, estimated_minutes, energy_level.`,
    'Research pricing pages for three AI task managers by tomorrow, high priority.'
  )

  assertString(parsed.title, 'parse.title')
  assertString(parsed.priority, 'parse.priority')
  assertString(parsed.action_type, 'parse.action_type')
  assertArray(parsed.people, 'parse.people')
  assertArray(parsed.tags, 'parse.tags')
  console.log('ok OpenAI task parse')
}

async function smokePrioritize() {
  const prioritized = await jsonCompletion(
    'prioritize',
    `Return only JSON in the form {"tasks":[{"task_id":"string","rank":number,"reasoning":"string","time_block":"morning_deep|afternoon_light|quick_win|evening"}]}.`,
    JSON.stringify([
      {
        id: 'task-1',
        title: 'Reply to investor email',
        priority: 'urgent',
        due_date: new Date().toISOString().slice(0, 10),
        estimated_minutes: 10,
      },
      {
        id: 'task-2',
        title: 'Draft launch notes',
        priority: 'medium',
        due_date: null,
        estimated_minutes: 45,
      },
    ])
  )

  assertArray(prioritized.tasks, 'prioritize.tasks')
  assertString(prioritized.tasks[0]?.task_id, 'prioritize.tasks[0].task_id')
  assertString(prioritized.tasks[0]?.reasoning, 'prioritize.tasks[0].reasoning')
  console.log('ok OpenAI prioritization')
}

async function smokeBriefing() {
  const briefing = await jsonCompletion(
    'briefing',
    `Return only JSON with fields greeting, top_priorities, overdue, quick_wins, someone_waiting, summary.`,
    JSON.stringify({
      userName: 'Nexdo',
      tasks: [
        {
          id: 'task-1',
          title: 'Prepare customer onboarding call',
          priority: 'high',
          due_date: new Date().toISOString().slice(0, 10),
          people: ['Alex'],
          estimated_minutes: 30,
        },
      ],
    })
  )

  assertString(briefing.greeting, 'briefing.greeting')
  assertArray(briefing.top_priorities, 'briefing.top_priorities')
  assertArray(briefing.overdue, 'briefing.overdue')
  assertArray(briefing.quick_wins, 'briefing.quick_wins')
  assertArray(briefing.someone_waiting, 'briefing.someone_waiting')
  assertString(briefing.summary, 'briefing.summary')
  console.log('ok OpenAI briefing')
}

async function smokeResearchExecution() {
  const research = await jsonCompletion(
    'research execution',
    `Return only JSON with fields summary, key_findings, sources_searched, recommended_action, confidence.`,
    'Research three practical wedges for an AI-native task manager for founders.'
  )

  assertString(research.summary, 'research.summary')
  assertNonEmptyArray(research.key_findings, 'research.key_findings')
  assertArray(research.sources_searched, 'research.sources_searched')
  assertString(research.recommended_action, 'research.recommended_action')
  assertString(research.confidence, 'research.confidence')
  console.log('ok OpenAI research execution')
}

async function smokeDraftExecution() {
  const draft = await jsonCompletion(
    'draft execution',
    `Return only JSON with fields draft, tone, suggested_subject, word_count.`,
    'Draft a concise product update email about Nexdo becoming ready for bounded AI-agent task execution.'
  )

  assertString(draft.draft, 'draft.draft')
  assertString(draft.tone, 'draft.tone')
  if (draft.suggested_subject !== null && draft.suggested_subject !== undefined) {
    assertString(draft.suggested_subject, 'draft.suggested_subject')
  }
  if (!Number.isFinite(Number(draft.word_count))) {
    throw new Error('draft.word_count missing numeric value')
  }
  console.log('ok OpenAI draft execution')
}

async function smokePrepExecution() {
  const prep = await jsonCompletion(
    'prep execution',
    `Return only JSON with fields overview, key_points, questions_to_ask, materials_needed, time_estimate.`,
    'Prepare for a customer discovery call about AI-native task management.'
  )

  assertString(prep.overview, 'prep.overview')
  assertNonEmptyArray(prep.key_points, 'prep.key_points')
  assertArray(prep.questions_to_ask, 'prep.questions_to_ask')
  assertArray(prep.materials_needed, 'prep.materials_needed')
  assertString(prep.time_estimate, 'prep.time_estimate')
  console.log('ok OpenAI prep execution')
}

async function main() {
  console.log(`Smoking OpenAI model ${model}`)
  await smokeParse()
  await smokePrioritize()
  await smokeBriefing()
  await smokeResearchExecution()
  await smokeDraftExecution()
  await smokePrepExecution()
  console.log('OpenAI smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
