import type {
  ActionType,
  BriefingContent,
  DraftOutput,
  EnergyLevel,
  ParsedTask,
  PrepOutput,
  PrioritizedTask,
  ResearchOutput,
  Task,
  TaskPriority,
} from './database.types'

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
const ACTION_TYPES: ActionType[] = ['manual', 'research', 'draft', 'prep', 'remind']
const ENERGY_LEVELS: EnergyLevel[] = ['deep', 'light', 'quick']
const TIME_BLOCKS: PrioritizedTask['time_block'][] = [
  'morning_deep',
  'afternoon_light',
  'quick_win',
  'evening',
]
const CONFIDENCE: ResearchOutput['confidence'][] = ['high', 'medium', 'low']

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, max) : null
}

function multilineText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\n{4,}/g, '\n\n\n').trim()
  return normalized ? normalized.slice(0, max) : null
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null
  return text(value, max)
}

function stringArray(value: unknown, maxItems: number, maxItemLength: number): string[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, maxItems)
    .map((item) => text(item, maxItemLength))
    .filter((item): item is string => Boolean(item))
}

function integer(value: unknown, min: number, max: number): number | null {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  const rounded = Math.round(numberValue)
  if (rounded < min || rounded > max) return null
  return rounded
}

function isoDate(value: unknown): string | null {
  const date = text(value, 10)
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10) === date ? date : null
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function optionalEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return allowed.includes(value as T) ? (value as T) : null
}

export function parseJsonResponse(content: string): unknown | null {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

export function validateParsedTask(value: unknown): ParsedTask | null {
  const object = asObject(value)
  if (!object) return null

  const title = text(object.title, 120)
  if (!title) return null

  return {
    title,
    due_date: isoDate(object.due_date),
    priority: enumValue(object.priority, PRIORITIES, 'medium'),
    context: optionalText(object.context, 1200),
    people: stringArray(object.people, 10, 80),
    tags: stringArray(object.tags, 10, 40).map((tag) => tag.toLowerCase()),
    action_type: enumValue(object.action_type, ACTION_TYPES, 'manual'),
    estimated_minutes: integer(object.estimated_minutes, 0, 60 * 24 * 7),
    energy_level: optionalEnumValue(object.energy_level, ENERGY_LEVELS),
  }
}

export function validatePrioritizedTasks(
  value: unknown,
  tasks: Task[]
): PrioritizedTask[] | null {
  if (tasks.length === 0) return []

  const source = Array.isArray(value) ? value : asObject(value)?.tasks
  if (!Array.isArray(source)) return null

  const validIds = new Set(tasks.map((task) => task.id))
  const seen = new Set<string>()
  const normalized: PrioritizedTask[] = []

  for (const item of source) {
    const object = asObject(item)
    if (!object) continue

    const taskId = text(object.task_id ?? object.id, 120)
    if (!taskId || !validIds.has(taskId) || seen.has(taskId)) continue

    const reasoning = text(object.reasoning, 260)
    const rank = integer(object.rank, 1, tasks.length)
    if (!reasoning || rank === null) continue

    normalized.push({
      task_id: taskId,
      rank,
      reasoning,
      time_block: enumValue(object.time_block, TIME_BLOCKS, 'afternoon_light'),
    })
    seen.add(taskId)
  }

  if (normalized.length !== tasks.length) return null

  return normalized
    .sort((a, b) => a.rank - b.rank)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

export function validateBriefingContent(
  value: unknown,
  tasks: Task[]
): BriefingContent | null {
  const object = asObject(value)
  if (!object) return null

  const greeting = text(object.greeting, 160)
  const summary = text(object.summary, 500)
  if (!greeting || !summary) return null

  const validTasks = new Map(tasks.map((task) => [task.id, task]))

  const topPriorities = Array.isArray(object.top_priorities)
    ? object.top_priorities.slice(0, 3).flatMap((item) => {
        const priority = asObject(item)
        if (!priority) return []
        const taskId = text(priority.task_id, 120)
        const task = taskId ? validTasks.get(taskId) : null
        const reasoning = text(priority.reasoning, 260)
        if (!taskId || !task || !reasoning) return []
        return [{ task_id: taskId, title: task.title, reasoning }]
      })
    : []

  const overdue = Array.isArray(object.overdue)
    ? object.overdue.slice(0, 5).flatMap((item) => {
        const overdueItem = asObject(item)
        if (!overdueItem) return []
        const taskId = text(overdueItem.task_id, 120)
        const task = taskId ? validTasks.get(taskId) : null
        const daysOverdue = integer(overdueItem.days_overdue, 1, 3650)
        if (!taskId || !task || daysOverdue === null) return []
        return [{ task_id: taskId, title: task.title, days_overdue: daysOverdue }]
      })
    : []

  const quickWins = Array.isArray(object.quick_wins)
    ? object.quick_wins.slice(0, 3).flatMap((item) => {
        const quickWin = asObject(item)
        if (!quickWin) return []
        const taskId = text(quickWin.task_id, 120)
        const task = taskId ? validTasks.get(taskId) : null
        const estimatedMinutes = integer(quickWin.estimated_minutes, 0, 60 * 24)
        if (!taskId || !task || estimatedMinutes === null) return []
        return [{ task_id: taskId, title: task.title, estimated_minutes: estimatedMinutes }]
      })
    : []

  const someoneWaiting = Array.isArray(object.someone_waiting)
    ? object.someone_waiting.slice(0, 3).flatMap((item) => {
        const waiting = asObject(item)
        if (!waiting) return []
        const taskId = text(waiting.task_id, 120)
        const task = taskId ? validTasks.get(taskId) : null
        const person = text(waiting.person, 80)
        if (!taskId || !task || !person) return []
        return [{ task_id: taskId, title: task.title, person }]
      })
    : []

  return {
    greeting,
    top_priorities: topPriorities,
    overdue,
    quick_wins: quickWins,
    someone_waiting: someoneWaiting,
    summary,
  }
}

export function validateResearchOutput(value: unknown): ResearchOutput | null {
  const object = asObject(value)
  if (!object) return null

  const summary = text(object.summary, 1200)
  const recommendedAction = text(object.recommended_action, 800)
  if (!summary || !recommendedAction) return null

  const keyFindings = stringArray(object.key_findings, 7, 500)
  if (keyFindings.length === 0) return null

  return {
    summary,
    key_findings: keyFindings,
    sources_searched: stringArray(object.sources_searched, 8, 200),
    recommended_action: recommendedAction,
    confidence: enumValue(object.confidence, CONFIDENCE, 'medium'),
  }
}

export function validateDraftOutput(value: unknown): DraftOutput | null {
  const object = asObject(value)
  if (!object) return null

  const draft = multilineText(object.draft, 8000)
  const tone = text(object.tone, 220)
  if (!draft || !tone) return null

  return {
    draft,
    tone,
    suggested_subject: optionalText(object.suggested_subject, 200),
    word_count: integer(object.word_count, 0, 10000) ?? draft.split(/\s+/).length,
  }
}

export function validatePrepOutput(value: unknown): PrepOutput | null {
  const object = asObject(value)
  if (!object) return null

  const overview = text(object.overview, 1000)
  const timeEstimate = text(object.time_estimate, 120)
  if (!overview || !timeEstimate) return null

  const keyPoints = stringArray(object.key_points, 7, 500)
  if (keyPoints.length === 0) return null

  return {
    overview,
    key_points: keyPoints,
    questions_to_ask: stringArray(object.questions_to_ask, 7, 300),
    materials_needed: stringArray(object.materials_needed, 7, 200),
    time_estimate: timeEstimate,
  }
}
