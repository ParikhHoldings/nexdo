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

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === '') {
    return null
  }
  return new OpenAI({ apiKey })
}

export async function parseTaskInput(rawInput: string): Promise<ParsedTask | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    // Return a simple parsed task when OpenAI is not configured
    return {
      title: rawInput.slice(0, 80),
      due_date: null,
      priority: 'medium',
      context: null,
      people: [],
      tags: [],
      action_type: 'manual',
      estimated_minutes: null,
      energy_level: null,
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: TASK_PARSE_PROMPT },
        { role: 'user', content: rawInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    return JSON.parse(content) as ParsedTask
  } catch (error) {
    console.error('Error parsing task:', error)
    return null
  }
}

export async function prioritizeTasks(tasks: Task[]): Promise<PrioritizedTask[] | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    // Return tasks in their current order with default time blocks
    return tasks.map((task, index) => ({
      task_id: task.id,
      rank: index + 1,
      reasoning: 'AI prioritization unavailable',
      time_block: 'morning_deep' as const,
    }))
  }

  try {
    const tasksSummary = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      context: t.context,
      people: t.people,
      estimated_minutes: t.estimated_minutes,
      energy_level: t.energy_level,
    }))

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: PRIORITIZE_PROMPT },
        { role: 'user', content: JSON.stringify(tasksSummary) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return null

    const result = JSON.parse(content)
    // Handle both array and object with tasks array
    return Array.isArray(result) ? result : result.tasks || []
  } catch (error) {
    console.error('Error prioritizing tasks:', error)
    return null
  }
}

export async function generateBriefing(
  tasks: Task[],
  userName: string
): Promise<BriefingContent | null> {
  const openai = getOpenAIClient()
  if (!openai) {
    // Return a simple briefing when OpenAI is not configured
    const today = new Date()
    const hour = today.getHours()
    const greeting =
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    return {
      greeting: `${greeting}, ${userName || 'there'}!`,
      top_priorities: tasks.slice(0, 3).map((t) => ({
        task_id: t.id,
        title: t.title,
        reasoning: 'Based on task order',
      })),
      overdue: [],
      quick_wins: tasks
        .filter((t) => t.estimated_minutes && t.estimated_minutes <= 15)
        .slice(0, 3)
        .map((t) => ({
          task_id: t.id,
          title: t.title,
          estimated_minutes: t.estimated_minutes || 15,
        })),
      someone_waiting: tasks
        .filter((t) => t.people && t.people.length > 0)
        .slice(0, 3)
        .map((t) => ({
          task_id: t.id,
          title: t.title,
          person: t.people?.[0] || '',
        })),
      summary: `You have ${tasks.length} tasks to focus on today.`,
    }
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const tasksSummary = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      context: t.context,
      people: t.people,
      estimated_minutes: t.estimated_minutes,
      status: t.status,
    }))

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    if (!content) return null

    return JSON.parse(content) as BriefingContent
  } catch (error) {
    console.error('Error generating briefing:', error)
    return null
  }
}

export async function executeResearch(
  task: Task
): Promise<ResearchOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    if (!content) return null

    return JSON.parse(content) as ResearchOutput
  } catch (error) {
    console.error('Error executing research:', error)
    return null
  }
}

export async function executeDraft(task: Task): Promise<DraftOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    if (!content) return null

    return JSON.parse(content) as DraftOutput
  } catch (error) {
    console.error('Error executing draft:', error)
    return null
  }
}

export async function executePrep(task: Task): Promise<PrepOutput | null> {
  const openai = getOpenAIClient()
  if (!openai) return null

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
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
    if (!content) return null

    return JSON.parse(content) as PrepOutput
  } catch (error) {
    console.error('Error executing prep:', error)
    return null
  }
}
