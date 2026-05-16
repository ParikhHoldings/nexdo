import type { Task, TaskInsert, TaskUpdate, TaskStatus } from './database.types'

const DEMO_TASKS_STORAGE_KEY = 'nexdo_demo_tasks'

// Mock tasks for development when Supabase is not connected
const mockTasks: Task[] = [
  {
    id: '1',
    user_id: 'demo-user',
    title: 'Review Q4 marketing proposal',
    raw_input: 'Review the Q4 marketing proposal from Sarah by tomorrow - she needs feedback before the exec meeting',
    description: null,
    status: 'todo',
    priority: 'high',
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    due_time: null,
    context: 'Sarah needs feedback before the exec meeting on Friday',
    source: 'manual',
    action_type: 'manual',
    estimated_minutes: 45,
    energy_level: 'deep',
    people: ['Sarah'],
    tags: ['marketing', 'review'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  },
  {
    id: '2',
    user_id: 'demo-user',
    title: 'Research competitor pricing strategies',
    raw_input: 'Need to research how competitors are pricing their AI features',
    description: null,
    status: 'todo',
    priority: 'medium',
    due_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    due_time: null,
    context: 'For the pricing committee meeting next week',
    source: 'manual',
    action_type: 'research',
    estimated_minutes: 60,
    energy_level: 'deep',
    people: [],
    tags: ['research', 'pricing', 'competitors'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  },
  {
    id: '3',
    user_id: 'demo-user',
    title: 'Send weekly update to team',
    raw_input: 'Send weekly update email to the engineering team',
    description: null,
    status: 'todo',
    priority: 'medium',
    due_date: new Date().toISOString().split('T')[0],
    due_time: null,
    context: 'Include sprint progress and blockers',
    source: 'manual',
    action_type: 'draft',
    estimated_minutes: 15,
    energy_level: 'quick',
    people: ['Engineering Team'],
    tags: ['email', 'weekly-update'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  },
  {
    id: '4',
    user_id: 'demo-user',
    title: 'Prepare for investor meeting',
    raw_input: 'Prep for the investor call with Sequoia on Thursday',
    description: null,
    status: 'todo',
    priority: 'urgent',
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    due_time: null,
    context: 'Series A follow-up discussion',
    source: 'manual',
    action_type: 'prep',
    estimated_minutes: 90,
    energy_level: 'deep',
    people: ['Sequoia Team'],
    tags: ['investor', 'fundraising'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  },
  {
    id: '5',
    user_id: 'demo-user',
    title: 'Reply to customer feedback email',
    raw_input: 'Reply to the feedback from enterprise customer about the new dashboard',
    description: null,
    status: 'todo',
    priority: 'high',
    due_date: new Date().toISOString().split('T')[0],
    due_time: null,
    context: 'They loved the new features but had some UX concerns',
    source: 'email',
    action_type: 'draft',
    estimated_minutes: 10,
    energy_level: 'quick',
    people: ['Enterprise Customer'],
    tags: ['customer', 'feedback', 'email'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_agent_id: null,
    external_ref: null,
    ingestion_intent: null,
    agent_metadata: null,
  },
]

// In-memory store for demo mode
let demoTasks = [...mockTasks]
let taskIdCounter = 6

function canUseLocalStorage(): boolean {
  if (typeof window === 'undefined') return false

  try {
    return Boolean(window.localStorage)
  } catch {
    return false
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const task = value as Partial<Task>
  return typeof task.id === 'string' && typeof task.title === 'string'
}

function getStoredDemoTasks(): Task[] | null {
  if (!canUseLocalStorage()) return null

  try {
    const raw = window.localStorage.getItem(DEMO_TASKS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const tasks = parsed.filter(isTask)
    return tasks
  } catch {
    return null
  }
}

export function persistDemoTasks(tasks: Task[]): void {
  demoTasks = tasks
  taskIdCounter = getNextDemoTaskId(tasks)
  if (!canUseLocalStorage()) return

  try {
    window.localStorage.setItem(DEMO_TASKS_STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // Demo persistence is best-effort; local task state still works in memory.
  }
}

export function getDemoTasks(): Task[] {
  const storedTasks = getStoredDemoTasks()
  if (storedTasks) {
    persistDemoTasks(storedTasks)
  }
  return demoTasks
}

function getNextDemoTaskId(tasks: Task[]): number {
  const maxNumericId = tasks.reduce((max, task) => {
    const numericId = Number(task.id)
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max
  }, 0)

  return Math.max(maxNumericId + 1, mockTasks.length + 1)
}

export function getDemoTask(id: string): Task | undefined {
  return demoTasks.find((t) => t.id === id)
}

export function addDemoTask(task: Omit<TaskInsert, 'id' | 'user_id'>): Task {
  const newTask: Task = {
    ...task,
    id: String(taskIdCounter++),
    user_id: 'demo-user',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    source: task.source || 'manual',
    action_type: task.action_type || 'manual',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_input: task.raw_input || null,
    description: task.description || null,
    due_date: task.due_date || null,
    due_time: task.due_time || null,
    context: task.context || null,
    estimated_minutes: task.estimated_minutes || null,
    energy_level: task.energy_level || null,
    people: task.people || null,
    tags: task.tags || null,
    parent_task_id: task.parent_task_id || null,
    related_task_ids: task.related_task_ids || null,
    agent_output: task.agent_output || null,
    completed_at: task.completed_at || null,
    source_agent_id: task.source_agent_id || null,
    external_ref: task.external_ref || null,
    ingestion_intent: task.ingestion_intent || null,
    agent_metadata: task.agent_metadata || null,
  }
  persistDemoTasks([newTask, ...demoTasks])
  return newTask
}

export function updateDemoTask(id: string, updates: TaskUpdate): Task | undefined {
  const index = demoTasks.findIndex((t) => t.id === id)
  if (index === -1) return undefined

  const updatedTask: Task = {
    ...demoTasks[index],
    ...updates,
    updated_at: new Date().toISOString(),
    completed_at:
      updates.status === 'done' && !demoTasks[index].completed_at
        ? new Date().toISOString()
        : updates.status !== 'done'
          ? null
          : demoTasks[index].completed_at,
  }

  persistDemoTasks([
    ...demoTasks.slice(0, index),
    updatedTask,
    ...demoTasks.slice(index + 1),
  ])

  return updatedTask
}

export function deleteDemoTask(id: string): boolean {
  const index = demoTasks.findIndex((t) => t.id === id)
  if (index === -1) return false
  persistDemoTasks([...demoTasks.slice(0, index), ...demoTasks.slice(index + 1)])
  return true
}

export function filterDemoTasks(filter: {
  status?: TaskStatus | TaskStatus[]
  dueToday?: boolean
  upcoming?: boolean
}): Task[] {
  let filtered = [...demoTasks]

  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    filtered = filtered.filter((t) => statuses.includes(t.status))
  }

  if (filter.dueToday) {
    const today = new Date().toISOString().split('T')[0]
    filtered = filtered.filter((t) => t.due_date === today)
  }

  if (filter.upcoming) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    filtered = filtered.filter((t) => {
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate > today
    })
  }

  return filtered
}

export function resetDemoTasks(): void {
  persistDemoTasks([...mockTasks])
  taskIdCounter = 6
}
