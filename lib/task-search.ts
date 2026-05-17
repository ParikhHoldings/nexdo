import type { Task } from '@/lib/database.types'

function fieldMatches(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLowerCase().includes(query))
}

function listMatches(value: string[] | null | undefined, query: string): boolean {
  return Boolean(value?.some((item) => fieldMatches(item, query)))
}

export function taskMatchesSearch(task: Task, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return (
    fieldMatches(task.title, needle) ||
    fieldMatches(task.context, needle) ||
    fieldMatches(task.description, needle) ||
    listMatches(task.people, needle) ||
    listMatches(task.tags, needle)
  )
}
