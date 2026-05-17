import type { TaskInsert, TaskPriority, TaskStatus, TaskSource } from './database.types'
import { getLocalDateKey, normalizeLocalDateKey, normalizeLocalTime } from './dates'

// Types for import operations
export interface ImportedTaskData {
  title: string
  description?: string | null
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string | null
  due_time?: string | null
  context?: string | null
  tags?: string[] | null
  people?: string[] | null
  external_ref?: string | null
}

export interface ImportResult {
  imported: number
  failed: number
  tasks: TaskInsert[]
}

// Helper to parse various date formats to YYYY-MM-DD
export function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const value = dateStr.trim()
  if (!value) return null

  try {
    const datePart = value.includes('T') ? value.split('T')[0] : value

    // Handle ISO YYYY-MM-DD and compact ICS YYYYMMDD formats without
    // allowing invalid calendar dates to fall through Date parsing.
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return normalizeLocalDateKey(datePart)
    }
    if (/^\d{8}$/.test(datePart)) {
      return normalizeLocalDateKey(
        `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
      )
    }

    // Handle various date formats
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return getLocalDateKey(date)
    }

    return null
  } catch {
    return null
  }
}

// Helper to parse time from various formats to HH:MM
export function parseTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null
  const value = timeStr.trim()
  if (!value) return null

  try {
    const compactMatch = value.match(/^(?:\d{8}T)?(\d{2})([0-5]\d)([0-5]\d)(?:Z)?$/)
    if (compactMatch) {
      const time = normalizeLocalTime(
        `${compactMatch[1]}:${compactMatch[2]}:${compactMatch[3]}`
      )
      return time ? time.slice(0, 5) : null
    }

    const isoMatch = value.match(/T(\d{1,2}:[0-5]\d(?::[0-5]\d)?)(?:Z|[+-]\d{2}:?\d{2})?$/)
    if (isoMatch) {
      const time = normalizeLocalTime(isoMatch[1])
      return time ? time.slice(0, 5) : null
    }

    // Handle HH:MM:SS or HH:MM
    const time = normalizeLocalTime(value)
    return time ? time.slice(0, 5) : null
  } catch {
    return null
  }
}

function parseNonMidnightDateTime(value: string): string | null {
  const time = parseTime(value)
  return time === '00:00' ? null : time
}

// Map various priority representations to Nexdo priority
export function mapPriority(priority: string | number | null | undefined): TaskPriority {
  if (priority === null || priority === undefined) return 'medium'

  const p = typeof priority === 'string' ? priority.toLowerCase() : priority

  // ICS priority (1 = highest, 9 = lowest)
  if (typeof p === 'number') {
    if (p <= 1) return 'urgent'
    if (p <= 3) return 'high'
    if (p <= 5) return 'medium'
    return 'low'
  }

  // Todoist priority (4 = highest, 1 = lowest)
  if (p === '4' || p === 'p1') return 'urgent'
  if (p === '3' || p === 'p2') return 'high'
  if (p === '2' || p === 'p3') return 'medium'
  if (p === '1' || p === 'p4') return 'low'

  // String representations
  if (p === 'urgent' || p === 'critical' || p === 'highest') return 'urgent'
  if (p === 'high' || p === 'important') return 'high'
  if (p === 'medium' || p === 'normal' || p === 'default') return 'medium'
  if (p === 'low' || p === 'lowest') return 'low'

  return 'medium'
}

// Map various status representations to Nexdo status
export function mapStatus(status: string | boolean | null | undefined): TaskStatus {
  if (status === null || status === undefined) return 'todo'

  if (typeof status === 'boolean') {
    return status ? 'done' : 'todo'
  }

  const s = status.toLowerCase()

  if (s === 'completed' || s === 'done' || s === 'finished' || s === 'complete') return 'done'
  if (s === 'in-process' || s === 'in_progress' || s === 'inprogress' || s === 'started') return 'in_progress'
  if (s === 'waiting' || s === 'blocked' || s === 'pending') return 'waiting'
  if (s === 'cancelled' || s === 'canceled' || s === 'deleted') return 'cancelled'

  return 'todo'
}

// Normalize any imported task to Nexdo format
export function normalizeTask(
  rawTask: Record<string, unknown>,
  source: 'todoist' | 'microsoft' | 'google' | 'csv' | 'ics' | 'things3' | 'trello' | 'asana' | 'omnifocus' | 'generic',
  userId: string,
  importSource: TaskSource = 'api'
): TaskInsert {
  const task: TaskInsert = {
    user_id: userId,
    title: '',
    status: 'todo',
    priority: 'medium',
    source: importSource,
    action_type: 'manual',
  }

  // Extract title from various possible field names
  task.title = String(
    rawTask.title ||
    rawTask.name ||
    rawTask.content ||
    rawTask.summary ||
    rawTask.subject ||
    rawTask.task ||
    rawTask.SUMMARY ||
    'Untitled Task'
  ).trim()

  // Extract description/context
  const description = rawTask.description ||
    rawTask.notes ||
    rawTask.body ||
    rawTask.context ||
    rawTask.DESCRIPTION ||
    null
  if (description) {
    task.context = String(description).trim()
  }

  // Map status
  task.status = mapStatus(
    rawTask.status as string ||
    rawTask.completed as boolean ||
    rawTask.is_completed as boolean ||
    rawTask.STATUS as string ||
    null
  )

  // Map priority
  task.priority = mapPriority(
    rawTask.priority as string | number ||
    rawTask.PRIORITY as number ||
    null
  )

  // Parse due date
  const dueDate = rawTask.due_date ||
    rawTask.dueDate ||
    rawTask.due ||
    rawTask.deadline ||
    rawTask.DUE ||
    rawTask.DTSTART ||
    (rawTask.due && typeof rawTask.due === 'object' ? (rawTask.due as Record<string, unknown>).date : null) ||
    null
  if (dueDate) {
    task.due_date = parseDate(String(dueDate))
  }

  // Parse due time
  const dueTime = rawTask.due_time || rawTask.dueTime || null
  if (dueTime) {
    task.due_time = parseTime(String(dueTime))
  }

  // Parse tags/labels
  const tags = rawTask.tags ||
    rawTask.labels ||
    rawTask.categories ||
    rawTask.CATEGORIES ||
    null
  if (tags) {
    if (Array.isArray(tags)) {
      task.tags = tags.map(t => String(t).trim()).filter(Boolean)
    } else if (typeof tags === 'string') {
      task.tags = tags.split(',').map(t => t.trim()).filter(Boolean)
    }
  }

  // Parse people/assignees
  const people = rawTask.people ||
    rawTask.assignees ||
    rawTask.assignee ||
    rawTask.members ||
    null
  if (people) {
    if (Array.isArray(people)) {
      task.people = people.map(p => {
        if (typeof p === 'string') return p.trim()
        if (typeof p === 'object' && p !== null) {
          return String((p as Record<string, unknown>).name || (p as Record<string, unknown>).fullName || (p as Record<string, unknown>).email || '')
        }
        return ''
      }).filter(Boolean)
    } else if (typeof people === 'string') {
      task.people = [people.trim()]
    }
  }

  // Store external reference if available
  const externalId = rawTask.id || rawTask.taskId || rawTask.UID || null
  if (externalId) {
    task.external_ref = String(externalId)
  }

  // Set completed_at if status is done
  if (task.status === 'done') {
    const completedAt = rawTask.completed_at ||
      rawTask.completedDateTime ||
      rawTask.completed_date ||
      rawTask.COMPLETED ||
      null
    if (completedAt) {
      task.completed_at = new Date(String(completedAt)).toISOString()
    } else {
      task.completed_at = new Date().toISOString()
    }
  }

  return task
}

// Parse Todoist task format
export function parseTodoistTask(task: Record<string, unknown>, userId: string): TaskInsert {
  const normalized = normalizeTask(task, 'todoist', userId, 'api')

  // Todoist-specific: content field is the title
  if (task.content) {
    normalized.title = String(task.content).trim()
  }

  // Todoist priority is inverted (4 = urgent, 1 = low)
  if (task.priority !== undefined) {
    const p = Number(task.priority)
    if (p === 4) normalized.priority = 'urgent'
    else if (p === 3) normalized.priority = 'high'
    else if (p === 2) normalized.priority = 'medium'
    else normalized.priority = 'low'
  }

  // Todoist due object
  if (task.due && typeof task.due === 'object') {
    const due = task.due as Record<string, unknown>
    if (due.date) {
      normalized.due_date = parseDate(String(due.date))
    }
    if (due.datetime) {
      const dt = String(due.datetime)
      normalized.due_date = parseDate(dt)
      normalized.due_time = parseTime(dt)
    }
  }

  // Todoist labels
  if (Array.isArray(task.labels)) {
    normalized.tags = task.labels.map(l => String(l))
  }

  // Todoist is_completed
  if (task.is_completed === true) {
    normalized.status = 'done'
    normalized.completed_at = new Date().toISOString()
  }

  return normalized
}

// Parse Microsoft To Do task format
export function parseMicrosoftTask(task: Record<string, unknown>, userId: string): TaskInsert {
  const normalized = normalizeTask(task, 'microsoft', userId, 'api')

  // Microsoft uses 'title' field
  if (task.title) {
    normalized.title = String(task.title).trim()
  }

  // Microsoft status
  if (task.status === 'completed') {
    normalized.status = 'done'
    if (task.completedDateTime && typeof task.completedDateTime === 'object') {
      const cd = task.completedDateTime as Record<string, unknown>
      if (cd.dateTime) {
        normalized.completed_at = new Date(String(cd.dateTime)).toISOString()
      }
    }
  }

  // Microsoft importance
  if (task.importance === 'high') {
    normalized.priority = 'high'
  } else if (task.importance === 'low') {
    normalized.priority = 'low'
  }

  // Microsoft body/notes
  if (task.body && typeof task.body === 'object') {
    const body = task.body as Record<string, unknown>
    if (body.content) {
      normalized.context = String(body.content).trim()
    }
  }

  // Microsoft due date
  if (task.dueDateTime && typeof task.dueDateTime === 'object') {
    const dd = task.dueDateTime as Record<string, unknown>
    if (dd.dateTime) {
      normalized.due_date = parseDate(String(dd.dateTime))
      normalized.due_time = parseNonMidnightDateTime(String(dd.dateTime))
    }
  }

  return normalized
}

// Parse Google Tasks format
export function parseGoogleTask(task: Record<string, unknown>, userId: string): TaskInsert {
  const normalized = normalizeTask(task, 'google', userId, 'api')

  // Google uses 'title' field
  if (task.title) {
    normalized.title = String(task.title).trim()
  }

  // Google status
  if (task.status === 'completed') {
    normalized.status = 'done'
    if (task.completed) {
      normalized.completed_at = new Date(String(task.completed)).toISOString()
    }
  }

  // Google notes
  if (task.notes) {
    normalized.context = String(task.notes).trim()
  }

  // Google due date (RFC 3339)
  if (task.due) {
    const due = String(task.due)
    normalized.due_date = parseDate(due)
    normalized.due_time = parseNonMidnightDateTime(due)
  }

  return normalized
}

// Parse ICS VTODO content
export function parseICSContent(content: string, userId: string): TaskInsert[] {
  const tasks: TaskInsert[] = []

  // Split into components
  const lines = content.split(/\r?\n/)
  let inVTodo = false
  let currentTask: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    // Handle line folding (continuation lines start with space/tab)
    while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
      i++
      line += lines[i].substring(1)
    }

    if (line.startsWith('BEGIN:VTODO')) {
      inVTodo = true
      currentTask = {}
    } else if (line.startsWith('END:VTODO')) {
      inVTodo = false
      if (currentTask.SUMMARY) {
        tasks.push(parseICSTask(currentTask, userId))
      }
      currentTask = {}
    } else if (inVTodo) {
      // Parse property
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        let propName = line.substring(0, colonIdx)
        const propValue = line.substring(colonIdx + 1)

        // Handle parameters (e.g., DUE;VALUE=DATE:20240101)
        const semiIdx = propName.indexOf(';')
        if (semiIdx > 0) {
          propName = propName.substring(0, semiIdx)
        }

        currentTask[propName] = propValue
      }
    }
  }

  return tasks
}

function parseICSTask(icsTask: Record<string, string>, userId: string): TaskInsert {
  const task: TaskInsert = {
    user_id: userId,
    title: icsTask.SUMMARY || 'Untitled Task',
    status: 'todo',
    priority: 'medium',
    source: 'manual',
    action_type: 'manual',
  }

  // Description
  if (icsTask.DESCRIPTION) {
    // Unescape ICS encoding
    task.context = icsTask.DESCRIPTION
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
  }

  // Status
  if (icsTask.STATUS) {
    const status = icsTask.STATUS.toUpperCase()
    if (status === 'COMPLETED') task.status = 'done'
    else if (status === 'IN-PROCESS') task.status = 'in_progress'
    else if (status === 'CANCELLED') task.status = 'cancelled'
  }

  // Priority (ICS: 1=highest, 9=lowest, 0=undefined)
  if (icsTask.PRIORITY) {
    const p = parseInt(icsTask.PRIORITY, 10)
    if (p === 1) task.priority = 'urgent'
    else if (p >= 2 && p <= 4) task.priority = 'high'
    else if (p === 5) task.priority = 'medium'
    else if (p >= 6) task.priority = 'low'
  }

  // Due date (YYYYMMDD or YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
  const dueStr = icsTask.DUE || icsTask.DTSTART
  if (dueStr) {
    task.due_date = parseDate(dueStr)
    task.due_time = parseTime(dueStr)
  }

  // Categories as tags
  if (icsTask.CATEGORIES) {
    task.tags = icsTask.CATEGORIES.split(',').map(c => c.trim()).filter(Boolean)
  }

  // Completed timestamp
  if (task.status === 'done' && icsTask.COMPLETED) {
    const completedMatch = icsTask.COMPLETED.match(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/)
    if (completedMatch) {
      const [, y, m, d, h = '00', min = '00', s = '00'] = completedMatch
      task.completed_at = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`).toISOString()
    }
  }

  // UID as external reference
  if (icsTask.UID) {
    task.external_ref = icsTask.UID
  }

  return task
}

// Parse CSV content
export function parseCSVContent(
  content: string,
  mapping?: Record<string, string>
): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []

  // Parse header row
  const headers = parseCSVLine(lines[0])
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row: Record<string, string> = {}

    for (let j = 0; j < headers.length && j < values.length; j++) {
      const header = headers[j].trim()
      const value = values[j].trim()

      if (mapping && mapping[header]) {
        row[mapping[header]] = value
      } else {
        row[header] = value
      }
    }

    if (Object.keys(row).length > 0) {
      rows.push(row)
    }
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current)
  return result
}

// Auto-detect CSV column mapping
export function autoMapCSVColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())

  // Title mappings
  const titleCandidates = ['title', 'name', 'task', 'subject', 'summary', 'to-do', 'todo', 'item']
  for (const candidate of titleCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.title) {
      mapping[headers[idx]] = 'title'
    }
  }

  // Due date mappings
  const dueCandidates = ['due', 'deadline', 'date', 'due_date', 'duedate', 'due date', 'end date', 'target']
  for (const candidate of dueCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.due_date) {
      mapping[headers[idx]] = 'due_date'
    }
  }

  // Priority mappings
  const priorityCandidates = ['priority', 'importance', 'urgency', 'level']
  for (const candidate of priorityCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.priority) {
      mapping[headers[idx]] = 'priority'
    }
  }

  // Status mappings
  const statusCandidates = ['status', 'state', 'completed', 'done', 'complete']
  for (const candidate of statusCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.status) {
      mapping[headers[idx]] = 'status'
    }
  }

  // Description/notes mappings
  const notesCandidates = ['description', 'notes', 'note', 'details', 'context', 'body', 'content']
  for (const candidate of notesCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.context) {
      mapping[headers[idx]] = 'context'
    }
  }

  // Tags mappings
  const tagsCandidates = ['tags', 'labels', 'categories', 'category', 'tag', 'label']
  for (const candidate of tagsCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.tags) {
      mapping[headers[idx]] = 'tags'
    }
  }

  // People/assignee mappings
  const peopleCandidates = ['assignee', 'assigned', 'people', 'owner', 'responsible', 'assigned to', 'member']
  for (const candidate of peopleCandidates) {
    const idx = lowerHeaders.findIndex(h => h.includes(candidate))
    if (idx >= 0 && !mapping.people) {
      mapping[headers[idx]] = 'people'
    }
  }

  return mapping
}

// Parse JSON export from various apps
export function parseJSONExport(
  content: string,
  source: 'things3' | 'omnifocus' | 'trello' | 'asana' | 'generic',
  userId: string
): TaskInsert[] {
  try {
    const data = JSON.parse(content)
    const tasks: TaskInsert[] = []

    if (source === 'things3') {
      return parseThings3Export(data, userId)
    } else if (source === 'trello') {
      return parseTrelloExport(data, userId)
    } else if (source === 'asana') {
      return parseAsanaExport(data, userId)
    } else if (source === 'omnifocus') {
      return parseOmniFocusExport(data, userId)
    } else {
      // Generic: try to handle arrays or objects with tasks
      const items = Array.isArray(data) ? data : data.tasks || data.items || data.todos || [data]
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          tasks.push(normalizeTask(item as Record<string, unknown>, 'generic', userId, 'manual'))
        }
      }
    }

    return tasks
  } catch {
    return []
  }
}

function parseThings3Export(data: unknown, userId: string): TaskInsert[] {
  const tasks: TaskInsert[] = []
  const items = Array.isArray(data) ? data : []

  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const t = item as Record<string, unknown>

    const task: TaskInsert = {
      user_id: userId,
      title: String(t.title || t.name || 'Untitled'),
      status: t.status === 'completed' || t.completed === true ? 'done' : 'todo',
      priority: 'medium',
      source: 'manual',
      action_type: 'manual',
    }

    if (t.notes) task.context = String(t.notes)
    if (t.dueDate) task.due_date = parseDate(String(t.dueDate))
    if (t.deadline) task.due_date = parseDate(String(t.deadline))
    if (t.tags && Array.isArray(t.tags)) task.tags = t.tags.map((tag: unknown) => String(tag))
    if (t.uuid) task.external_ref = String(t.uuid)

    tasks.push(task)
  }

  return tasks
}

function parseTrelloExport(data: unknown, userId: string): TaskInsert[] {
  const tasks: TaskInsert[] = []

  if (typeof data !== 'object' || data === null) return tasks
  const board = data as Record<string, unknown>

  // Trello exports cards array
  const cards = (board.cards || []) as Array<Record<string, unknown>>
  const labels = (board.labels || []) as Array<Record<string, unknown>>
  const labelMap = new Map(labels.map(l => [String(l.id), String(l.name || l.color)]))

  for (const card of cards) {
    const task: TaskInsert = {
      user_id: userId,
      title: String(card.name || 'Untitled'),
      status: card.closed === true ? 'done' : 'todo',
      priority: 'medium',
      source: 'manual',
      action_type: 'manual',
    }

    if (card.desc) task.context = String(card.desc)
    if (card.due) task.due_date = parseDate(String(card.due))
    if (card.id) task.external_ref = String(card.id)

    // Map label IDs to names
    if (Array.isArray(card.idLabels)) {
      task.tags = card.idLabels
        .map((id: unknown) => labelMap.get(String(id)))
        .filter((name): name is string => !!name)
    }

    // Members as people
    if (Array.isArray(card.idMembers) && card.idMembers.length > 0) {
      const members = (board.members || []) as Array<Record<string, unknown>>
      const memberMap = new Map(members.map(m => [String(m.id), String(m.fullName || m.username)]))
      task.people = card.idMembers
        .map((id: unknown) => memberMap.get(String(id)))
        .filter((name): name is string => !!name)
    }

    tasks.push(task)
  }

  return tasks
}

function parseAsanaExport(data: unknown, userId: string): TaskInsert[] {
  const tasks: TaskInsert[] = []
  const items = Array.isArray(data) ? data : (data as Record<string, unknown>).data || []

  for (const item of items as Array<Record<string, unknown>>) {
    const task: TaskInsert = {
      user_id: userId,
      title: String(item.name || 'Untitled'),
      status: item.completed === true ? 'done' : 'todo',
      priority: 'medium',
      source: 'manual',
      action_type: 'manual',
    }

    if (item.notes) task.context = String(item.notes)
    if (item.due_on) task.due_date = parseDate(String(item.due_on))
    if (item.due_at) {
      const dueAt = String(item.due_at)
      task.due_date = parseDate(dueAt)
      task.due_time = parseTime(dueAt)
    }
    if (item.gid) task.external_ref = String(item.gid)

    // Tags from Asana
    if (Array.isArray(item.tags)) {
      task.tags = item.tags.map((t: unknown) => {
        if (typeof t === 'string') return t
        if (typeof t === 'object' && t !== null) return String((t as Record<string, unknown>).name || '')
        return ''
      }).filter(Boolean)
    }

    // Assignee
    if (item.assignee && typeof item.assignee === 'object') {
      const assignee = item.assignee as Record<string, unknown>
      if (assignee.name) task.people = [String(assignee.name)]
    }

    tasks.push(task)
  }

  return tasks
}

function parseOmniFocusExport(data: unknown, userId: string): TaskInsert[] {
  const tasks: TaskInsert[] = []
  const items = Array.isArray(data) ? data : []

  for (const item of items as Array<Record<string, unknown>>) {
    const task: TaskInsert = {
      user_id: userId,
      title: String(item.name || item.title || 'Untitled'),
      status: item.completed === true || item.status === 'completed' ? 'done' : 'todo',
      priority: 'medium',
      source: 'manual',
      action_type: 'manual',
    }

    if (item.note) task.context = String(item.note)
    if (item.dueDate) task.due_date = parseDate(String(item.dueDate))
    if (item.deferDate) task.due_date = task.due_date || parseDate(String(item.deferDate))
    if (item.id) task.external_ref = String(item.id)

    // Tags/contexts
    if (Array.isArray(item.tags)) {
      task.tags = item.tags.map((t: unknown) => String(t))
    } else if (item.context) {
      task.tags = [String(item.context)]
    }

    // Flagged = high priority
    if (item.flagged === true) {
      task.priority = 'high'
    }

    tasks.push(task)
  }

  return tasks
}

// Batch save imported tasks to Supabase
export async function saveImportedTasks(
  tasks: TaskInsert[],
  supabase: { from: (table: string) => { insert: (data: TaskInsert[]) => { select: () => Promise<{ data: unknown[] | null; error: unknown }> } } } | null,
  addTaskToStore?: (task: TaskInsert) => void
): Promise<ImportResult> {
  if (tasks.length === 0) {
    return { imported: 0, failed: 0, tasks: [] }
  }

  const result: ImportResult = {
    imported: 0,
    failed: 0,
    tasks: [],
  }

  if (supabase) {
    // Batch insert in chunks of 50
    const chunkSize = 50
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize)

      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert(chunk)
          .select()

        if (error) {
          console.error('Error inserting tasks:', error)
          result.failed += chunk.length
        } else {
          const insertedTasks = Array.isArray(data) ? (data as TaskInsert[]) : []
          result.imported += insertedTasks.length
          result.failed += chunk.length - insertedTasks.length
          result.tasks.push(...insertedTasks)
        }
      } catch (err) {
        console.error('Error inserting tasks:', err)
        result.failed += chunk.length
      }
    }
  } else if (addTaskToStore) {
    // Demo mode: add to store one by one
    for (const task of tasks) {
      try {
        addTaskToStore(task)
        result.imported++
        result.tasks.push(task)
      } catch {
        result.failed++
      }
    }
  } else {
    // No persistence available
    result.imported = tasks.length
    result.tasks = tasks
  }

  return result
}

// AI-powered CSV column mapping using OpenAI
export async function aiMapCSVColumns(
  headers: string[],
  sampleRows: string[][],
  openaiApiKey?: string
): Promise<Record<string, string> | null> {
  if (!openaiApiKey) return null

  const prompt = `You are mapping CSV columns to a task management app schema.

Target fields:
- title: The task name/title (required)
- due_date: When the task is due (date)
- priority: Task priority (urgent/high/medium/low)
- status: Task status (todo/done/in_progress)
- context: Description or notes
- tags: Labels/categories (comma-separated)
- people: Assignees (comma-separated)

CSV Headers: ${JSON.stringify(headers)}

Sample data (first 3 rows):
${sampleRows.slice(0, 3).map(row => JSON.stringify(row)).join('\n')}

Return a JSON object mapping CSV headers to target fields. Only include mappings you're confident about.
Example: {"Task Name": "title", "Due Date": "due_date", "Priority Level": "priority"}

Return ONLY the JSON object, no explanation.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 500,
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return null

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return null
  } catch {
    return null
  }
}
