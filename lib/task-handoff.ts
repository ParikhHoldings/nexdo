import type { Task, TaskNote } from './database.types'

const MAX_HANDOFF_NOTES = 5

function line(label: string, value: unknown): string | null {
  if (value === null || value === undefined) return null

  if (Array.isArray(value)) {
    return value.length > 0 ? `${label}: ${value.join(', ')}` : null
  }

  const text = String(value).trim()
  return text ? `${label}: ${text}` : null
}

function noteLine(note: TaskNote): string {
  const type = note.note_type === 'agent_result' ? 'agent result' : note.note_type
  return `- ${type}: ${note.content}`
}

export function taskHandoffBrief(task: Task, notes: TaskNote[] = []): string {
  const taskLines = [
    '# Nexdo Task Handoff',
    line('Title', task.title),
    line('Status', task.status),
    line('Priority', task.priority),
    line('Action type', task.action_type),
    line(
      'Due',
      task.due_date
        ? `${task.due_date}${task.due_time ? ` ${task.due_time}` : ''}`
        : null
    ),
    line(
      'Estimate',
      task.estimated_minutes !== null && task.estimated_minutes !== undefined
        ? `${task.estimated_minutes} minutes`
        : null
    ),
    line('Energy', task.energy_level),
    line('People', task.people),
    line('Tags', task.tags),
    line('Context', task.context),
    line('Description', task.description),
    line('Original input', task.raw_input && task.raw_input !== task.title ? task.raw_input : null),
    line('Source agent', task.source_agent_id),
    line('External ref', task.external_ref),
    line('Ingestion intent', task.ingestion_intent),
  ].filter((item): item is string => Boolean(item))

  const recentNotes = notes.slice(0, MAX_HANDOFF_NOTES)
  const noteLines =
    recentNotes.length > 0
      ? ['Recent notes:', ...recentNotes.map(noteLine)]
      : ['Recent notes: none yet']

  const instructions = [
    'Agent instructions:',
    '- Read the task details and notes before changing task state.',
    '- Prefer add_task_note with note_type=agent_result for findings, drafts, handoffs, and uncertainty.',
    '- Include source_agent_id and external_ref on create, update, complete, and note writes when available.',
    '- Do not send messages, spend money, or make irreversible external commitments unless the human explicitly asks.',
  ]

  return [...taskLines, '', ...noteLines, '', ...instructions].join('\n')
}
