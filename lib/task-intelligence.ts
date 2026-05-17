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

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const STOP_NAMES = new Set([
  'I',
  'Need',
  'Review',
  'Send',
  'Reply',
  'Research',
  'Prepare',
  'Call',
  'Email',
  'Draft',
  'The',
  'A',
  'An',
])

function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function parseDueDate(input: string, now = new Date()): string | null {
  const lower = input.toLowerCase()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (/\btoday\b/.test(lower)) return isoDate(today)
  if (/\btomorrow\b/.test(lower)) return isoDate(addDays(today, 1))
  if (/\bnext week\b/.test(lower)) return isoDate(addDays(today, 7))

  const inDays = lower.match(/\bin\s+(\d+)\s+days?\b/)
  if (inDays) return isoDate(addDays(today, Number(inDays[1])))

  const explicit = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (explicit) return explicit[1]

  const slashDate = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (slashDate) {
    const month = Number(slashDate[1])
    const day = Number(slashDate[2])
    const year = slashDate[3]
      ? Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3])
      : today.getFullYear()
    return isoDate(new Date(year, month - 1, day))
  }

  const weekdayIndex = WEEKDAYS.findIndex((day) => lower.includes(day))
  if (weekdayIndex >= 0) {
    const daysAhead = (weekdayIndex - today.getDay() + 7) % 7 || 7
    return isoDate(addDays(today, daysAhead))
  }

  return null
}

function normalizeHour(hour: number, meridiem: string | undefined): number | null {
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === 'am') return hour === 12 ? 0 : hour
    return hour === 12 ? 12 : hour + 12
  }

  return hour >= 0 && hour <= 23 ? hour : null
}

function parseDueTime(input: string): string | null {
  const lower = input.toLowerCase()
  const withMinutes = lower.match(/\b(?:at\s*)?(\d{1,2}):([0-5]\d)\s*(am|pm)?\b/)
  if (withMinutes) {
    const hour = normalizeHour(Number(withMinutes[1]), withMinutes[3])
    if (hour === null) return null
    return `${String(hour).padStart(2, '0')}:${withMinutes[2]}`
  }

  const hourOnly = lower.match(/\b(?:at\s*)?(\d{1,2})\s*(am|pm)\b/)
  if (hourOnly) {
    const hour = normalizeHour(Number(hourOnly[1]), hourOnly[2])
    if (hour === null) return null
    return `${String(hour).padStart(2, '0')}:00`
  }

  return null
}

function inferPriority(input: string, dueDate: string | null): TaskPriority {
  const lower = input.toLowerCase()
  if (/\b(urgent|asap|critical|blocker|blocked|today|eod)\b/.test(lower)) {
    return 'urgent'
  }
  if (/\b(high priority|important|tomorrow|soon|deadline)\b/.test(lower)) {
    return 'high'
  }
  if (/\b(low priority|whenever|someday|no rush|later)\b/.test(lower)) {
    return 'low'
  }
  if (dueDate === isoDate(new Date())) return 'high'
  return 'medium'
}

function inferActionType(input: string): ActionType {
  const lower = input.toLowerCase()
  if (/\b(research|compare|investigate|look into|analyze|analyse)\b/.test(lower)) {
    return 'research'
  }
  if (/\b(draft|write|reply|email|message|proposal|post|outline)\b/.test(lower)) {
    return 'draft'
  }
  if (/\b(prepare|prep|meeting|call|interview|presentation|agenda)\b/.test(lower)) {
    return 'prep'
  }
  if (/\b(remind|follow up|follow-up)\b/.test(lower)) {
    return 'remind'
  }
  return 'manual'
}

function inferEstimate(input: string, actionType: ActionType): number | null {
  const lower = input.toLowerCase()
  const minutes = lower.match(/\b(\d+)\s*(?:m|min|mins|minutes)\b/)
  if (minutes) return Number(minutes[1])

  const hours = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/)
  if (hours) return Math.round(Number(hours[1]) * 60)

  if (/\b(quick|small|tiny|reply)\b/.test(lower)) return 10
  if (actionType === 'research') return 60
  if (actionType === 'prep') return 45
  if (actionType === 'draft') return 25
  return 30
}

function inferEnergy(estimate: number | null, actionType: ActionType): EnergyLevel {
  if (estimate !== null && estimate <= 15) return 'quick'
  if (actionType === 'research' || actionType === 'prep' || (estimate ?? 0) >= 45) {
    return 'deep'
  }
  return 'light'
}

function inferTags(input: string, actionType: ActionType): string[] {
  const lower = input.toLowerCase()
  const candidates: Array<[string, RegExp]> = [
    ['email', /\b(email|reply|inbox)\b/],
    ['meeting', /\b(meeting|call|agenda|presentation)\b/],
    ['research', /\b(research|compare|investigate|analyze|analyse)\b/],
    ['customer', /\b(customer|client|user)\b/],
    ['sales', /\b(sales|lead|proposal|pricing)\b/],
    ['product', /\b(product|roadmap|feature|launch)\b/],
    ['finance', /\b(invoice|budget|pricing|revenue)\b/],
  ]
  const tags = candidates.filter(([, regex]) => regex.test(lower)).map(([tag]) => tag)
  if (actionType !== 'manual' && actionType !== 'remind' && !tags.includes(actionType)) {
    tags.push(actionType)
  }
  return Array.from(new Set(tags)).slice(0, 5)
}

function inferPeople(input: string): string[] {
  const matches = input.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) ?? []
  return Array.from(
    new Set(
      matches
        .map((name) => name.trim())
        .filter((name) => !STOP_NAMES.has(name) && !WEEKDAYS.includes(name.toLowerCase()))
    ),
  ).slice(0, 5)
}

function cleanTitle(input: string): string {
  return input
    .replace(/^\/quick\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function parseTaskHeuristic(rawInput: string, now = new Date()): ParsedTask {
  const dueDate = parseDueDate(rawInput, now)
  const priority = inferPriority(rawInput, dueDate)
  const actionType = inferActionType(rawInput)
  const estimatedMinutes = inferEstimate(rawInput, actionType)

  return {
    title: cleanTitle(rawInput),
    due_date: dueDate,
    due_time: parseDueTime(rawInput),
    priority,
    context: rawInput.length > 90 ? rawInput : null,
    people: inferPeople(rawInput),
    tags: inferTags(rawInput, actionType),
    action_type: actionType,
    estimated_minutes: estimatedMinutes,
    energy_level: inferEnergy(estimatedMinutes, actionType),
  }
}

function priorityScore(priority: TaskPriority): number {
  return { urgent: 0, high: 25, medium: 50, low: 75 }[priority]
}

function dueScore(dueDate: string | null): number {
  if (!dueDate) return 30
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const due = new Date(`${dueDate}T00:00:00`).getTime()
  const days = Math.round((due - start) / 86400000)
  if (days < 0) return -20
  if (days === 0) return -10
  if (days === 1) return 0
  if (days <= 3) return 10
  return 25
}

function timeBlock(task: Task): PrioritizedTask['time_block'] {
  if ((task.estimated_minutes ?? 0) <= 15 || task.energy_level === 'quick') return 'quick_win'
  if (task.energy_level === 'deep') return 'morning_deep'
  if (task.priority === 'urgent') return 'morning_deep'
  return 'afternoon_light'
}

function prioritizationReason(task: Task): string {
  if (task.due_date && dueScore(task.due_date) <= -10) return 'Due now or overdue, so it needs attention first.'
  if (task.priority === 'urgent') return 'Marked urgent or time-sensitive.'
  if (task.people && task.people.length > 0) return `${task.people[0]} is connected to this work.`
  if ((task.estimated_minutes ?? 0) <= 15) return 'Short enough to clear quickly.'
  return 'Ranked by priority, due date, and task context.'
}

export function prioritizeTasksHeuristic(tasks: Task[]): PrioritizedTask[] {
  return [...tasks]
    .sort((a, b) => {
      const aScore =
        priorityScore(a.priority) +
        dueScore(a.due_date) -
        ((a.people?.length ?? 0) > 0 ? 5 : 0) -
        ((a.estimated_minutes ?? 999) <= 15 ? 3 : 0)
      const bScore =
        priorityScore(b.priority) +
        dueScore(b.due_date) -
        ((b.people?.length ?? 0) > 0 ? 5 : 0) -
        ((b.estimated_minutes ?? 999) <= 15 ? 3 : 0)
      return aScore - bScore
    })
    .map((task, index) => ({
      task_id: task.id,
      rank: index + 1,
      reasoning: prioritizationReason(task),
      time_block: timeBlock(task),
    }))
}

export function generateBriefingHeuristic(
  tasks: Task[],
  userName = 'there'
): BriefingContent {
  const activeTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled')
  const ranked = prioritizeTasksHeuristic(activeTasks)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const greeting =
    today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  const byId = new Map(activeTasks.map((task) => [task.id, task]))
  const overdue = activeTasks
    .filter((task) => task.due_date && new Date(`${task.due_date}T00:00:00`).getTime() < todayStart)
    .slice(0, 5)
    .map((task) => ({
      task_id: task.id,
      title: task.title,
      days_overdue: Math.max(
        1,
        Math.round((todayStart - new Date(`${task.due_date}T00:00:00`).getTime()) / 86400000)
      ),
    }))

  return {
    greeting: `${greeting}, ${userName || 'there'}!`,
    top_priorities: ranked.slice(0, 3).flatMap((item) => {
      const task = byId.get(item.task_id)
      return task ? [{ task_id: task.id, title: task.title, reasoning: item.reasoning }] : []
    }),
    overdue,
    quick_wins: activeTasks
      .filter((task) => (task.estimated_minutes ?? 999) <= 15)
      .slice(0, 3)
      .map((task) => ({
        task_id: task.id,
        title: task.title,
        estimated_minutes: task.estimated_minutes ?? 15,
      })),
    someone_waiting: activeTasks
      .filter((task) => task.people && task.people.length > 0)
      .slice(0, 3)
      .map((task) => ({
        task_id: task.id,
        title: task.title,
        person: task.people?.[0] ?? 'Someone',
      })),
    summary:
      overdue.length > 0
        ? `${activeTasks.length} active tasks, including ${overdue.length} overdue item${overdue.length === 1 ? '' : 's'}.`
        : `${activeTasks.length} active task${activeTasks.length === 1 ? '' : 's'} organized by urgency, effort, and context.`,
  }
}

export function executeResearchHeuristic(task: Task): ResearchOutput {
  return {
    summary: `This is a launch-safe research brief for "${task.title}" based on the task context currently available in Nexdo.`,
    key_findings: [
      task.context || 'No additional context was attached, so clarify the decision this research should support.',
      'Define the source list before relying on this as final research.',
      'Capture the expected output format: summary, comparison, recommendation, or source list.',
      'Identify who will use the findings and what action they need to take next.',
      'Use the agent result as a working brief, then verify facts before external use.',
    ],
    sources_searched: ['Nexdo task title', 'Nexdo task context', 'Attached people/tags metadata'],
    recommended_action: 'Add source requirements or constraints, then run a provider-backed research agent for final results.',
    confidence: 'medium',
  }
}

export function executeDraftHeuristic(task: Task): DraftOutput {
  const recipient = task.people?.[0] ? ` ${task.people[0]}` : ''
  const draft = `Hi${recipient},\n\nQuick note on ${task.title.toLowerCase()}.\n\n${task.context || 'I wanted to move this forward and make sure the next step is clear.'}\n\nProposed next step: confirm the priority, owner, and deadline so this can keep moving.\n\nThanks.`

  return {
    draft,
    tone: 'Concise, practical, and action-oriented',
    suggested_subject: task.title,
    word_count: draft.split(/\s+/).length,
  }
}

export function executePrepHeuristic(task: Task): PrepOutput {
  return {
    overview: `Preparation brief for "${task.title}".`,
    key_points: [
      task.context || 'Clarify the goal and expected decision before starting.',
      task.due_date ? `Target date: ${task.due_date}.` : 'No due date is set yet.',
      task.people?.length ? `People involved: ${task.people.join(', ')}.` : 'No people are attached yet.',
    ],
    questions_to_ask: [
      'What outcome should this work produce?',
      'Who owns the next decision?',
      'What would make this complete enough to ship?',
    ],
    materials_needed: ['Current task context', 'Relevant notes or links', 'Clear success criteria'],
    time_estimate: task.estimated_minutes ? `${task.estimated_minutes} minutes` : '30-45 minutes',
  }
}

export function executeTaskHeuristic(task: Task): ResearchOutput | DraftOutput | PrepOutput | null {
  if (task.action_type === 'research') return executeResearchHeuristic(task)
  if (task.action_type === 'draft') return executeDraftHeuristic(task)
  if (task.action_type === 'prep') return executePrepHeuristic(task)
  return null
}
