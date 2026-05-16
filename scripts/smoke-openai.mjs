#!/usr/bin/env node

import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY
const model = process.env.OPENAI_MODEL || 'gpt-4o'

if (!apiKey) {
  console.error('Missing OPENAI_API_KEY.')
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

async function smokeParse() {
  const parsed = await jsonCompletion(
    'task parse',
    `Return only JSON for a task with fields title, due_date, priority, context, people, tags, action_type, estimated_minutes, energy_level.`,
    'Research pricing pages for three AI task managers by tomorrow, high priority.'
  )

  assertString(parsed.title, 'parse.title')
  assertString(parsed.priority, 'parse.priority')
  assertString(parsed.action_type, 'parse.action_type')
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
  assertString(briefing.summary, 'briefing.summary')
  console.log('ok OpenAI briefing')
}

async function smokeExecution() {
  const prep = await jsonCompletion(
    'prep execution',
    `Return only JSON with fields overview, key_points, questions_to_ask, materials_needed, time_estimate.`,
    'Prepare for a customer discovery call about AI-native task management.'
  )

  assertString(prep.overview, 'prep.overview')
  assertArray(prep.key_points, 'prep.key_points')
  assertArray(prep.questions_to_ask, 'prep.questions_to_ask')
  console.log('ok OpenAI prep execution')
}

async function main() {
  console.log(`Smoking OpenAI model ${model}`)
  await smokeParse()
  await smokePrioritize()
  await smokeBriefing()
  await smokeExecution()
  console.log('OpenAI smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
