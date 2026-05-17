import OpenAI from 'openai'
import {
  TASK_PARSE_PROMPT,
  PRIORITIZE_PROMPT,
  BRIEFING_PROMPT,
  RESEARCH_PROMPT,
  DRAFT_PROMPT,
  PREP_PROMPT,
} from './prompts'
import type {
  ParsedTask,
  PrioritizedTask,
  BriefingContent,
  ResearchOutput,
  DraftOutput,
  PrepOutput,
  Task,
} from './database.types'
import {
  executeDraftHeuristic,
  executePrepHeuristic,
  executeResearchHeuristic,
  generateBriefingHeuristic,
  parseTaskHeuristic,
  prioritizeTasksHeuristic,
} from './task-intelligence'
import {
  parseJsonResponse,
  validateBriefingContent,
  validateDraftOutput,
  validateParsedTask,
  validatePrepOutput,
  validatePrioritizedTasks,
  validateResearchOutput,
} from './ai-response-validation'
import { isUsableEnv } from './env'
import { getLocalDateKey } from './dates'

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!isUsableEnv(apiKey)) {
    return null
  }
  return new OpenAI({ apiKey })
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o'
}

export async function parseTaskInput(rawInput: string): Promise<ParsedTask | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    return parseTaskHeuristic(rawInput)
  }

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: TASK_PARSE_PROMPT },
        { role: 'user', content: rawInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return parseTaskHeuristic(rawInput)

    const parsed = validateParsedTask(parseJsonResponse(content))
    return parsed ?? parseTaskHeuristic(rawInput)
  } catch (error) {
    console.error('Error parsing task:', error)
    return parseTaskHeuristic(rawInput)
  }
}

export async function prioritizeTasks(tasks: Task[]): Promise<PrioritizedTask[] | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    return prioritizeTasksHeuristic(tasks)
  }

  try {
    const tasksSummary = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      due_time: t.due_time,
      context: t.context,
      people: t.people,
      action_type: t.action_type,
      estimated_minutes: t.estimated_minutes,
      energy_level: t.energy_level,
      tags: t.tags,
    }))

    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: PRIORITIZE_PROMPT },
        { role: 'user', content: JSON.stringify(tasksSummary) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return prioritizeTasksHeuristic(tasks)

    return validatePrioritizedTasks(parseJsonResponse(content), tasks) ??
      prioritizeTasksHeuristic(tasks)
  } catch (error) {
    console.error('Error prioritizing tasks:', error)
    return prioritizeTasksHeuristic(tasks)
  }
}

export async function generateBriefing(
  tasks: Task[],
  userName: string
): Promise<BriefingContent | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    return generateBriefingHeuristic(tasks, userName)
  }

  try {
    const today = getLocalDateKey()
    const tasksSummary = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      due_time: t.due_time,
      context: t.context,
      people: t.people,
      action_type: t.action_type,
      estimated_minutes: t.estimated_minutes,
      energy_level: t.energy_level,
      tags: t.tags,
      status: t.status,
    }))

    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: BRIEFING_PROMPT },
        {
          role: 'user',
          content: `User: ${userName}\nToday: ${today}\nTasks:\n${JSON.stringify(tasksSummary)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return generateBriefingHeuristic(tasks, userName)

    return validateBriefingContent(parseJsonResponse(content), tasks) ??
      generateBriefingHeuristic(tasks, userName)
  } catch (error) {
    console.error('Error generating briefing:', error)
    return generateBriefingHeuristic(tasks, userName)
  }
}

export async function executeResearch(
  task: Task
): Promise<ResearchOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return executeResearchHeuristic(task)

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: RESEARCH_PROMPT },
        {
          role: 'user',
          content: `Task: ${task.title}\nContext: ${task.context || 'No additional context'}\nDescription: ${task.description || 'No description'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return executeResearchHeuristic(task)

    return validateResearchOutput(parseJsonResponse(content)) ?? executeResearchHeuristic(task)
  } catch (error) {
    console.error('Error executing research:', error)
    return executeResearchHeuristic(task)
  }
}

export async function executeDraft(task: Task): Promise<DraftOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return executeDraftHeuristic(task)

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: DRAFT_PROMPT },
        {
          role: 'user',
          content: `Task: ${task.title}\nContext: ${task.context || 'No additional context'}\nDescription: ${task.description || 'No description'}\nPeople involved: ${task.people?.join(', ') || 'None specified'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return executeDraftHeuristic(task)

    return validateDraftOutput(parseJsonResponse(content)) ?? executeDraftHeuristic(task)
  } catch (error) {
    console.error('Error executing draft:', error)
    return executeDraftHeuristic(task)
  }
}

export async function executePrep(task: Task): Promise<PrepOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return executePrepHeuristic(task)

  try {
    const completion = await openai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: PREP_PROMPT },
        {
          role: 'user',
          content: `Task: ${task.title}\nContext: ${task.context || 'No additional context'}\nDescription: ${task.description || 'No description'}\nDue: ${task.due_date || 'No specific date'}\nPeople: ${task.people?.join(', ') || 'None specified'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return executePrepHeuristic(task)

    return validatePrepOutput(parseJsonResponse(content)) ?? executePrepHeuristic(task)
  } catch (error) {
    console.error('Error executing prep:', error)
    return executePrepHeuristic(task)
  }
}
