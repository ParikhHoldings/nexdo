export const MAX_RELATED_TASKS = 20

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface TaskRelationshipValidationError {
  field: string
  message: string
}

export interface TaskRelationshipPatch {
  parent_task_id?: string | null
  related_task_ids?: string[] | null
}

export interface TaskRelationshipValidation {
  updates: TaskRelationshipPatch
  referencedTaskIds: string[]
  errors: TaskRelationshipValidationError[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTaskId(value: unknown) {
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined

  return value.trim()
}

function validateTaskId(
  field: string,
  value: string | null | undefined,
  currentTaskId: string,
  errors: TaskRelationshipValidationError[]
) {
  if (value === undefined || value === null) return

  if (!UUID_PATTERN.test(value)) {
    errors.push({ field, message: 'Must be a valid task id.' })
  } else if (value === currentTaskId) {
    errors.push({ field, message: 'Cannot link a task to itself.' })
  }
}

export function validateTaskRelationshipPatch(
  value: unknown,
  currentTaskId: string
): TaskRelationshipValidation {
  const errors: TaskRelationshipValidationError[] = []
  const updates: TaskRelationshipPatch = {}

  if (!isRecord(value)) {
    return {
      updates,
      referencedTaskIds: [],
      errors: [{ field: 'body', message: 'Request body must be an object.' }],
    }
  }

  for (const field of Object.keys(value)) {
    if (field !== 'parent_task_id' && field !== 'related_task_ids') {
      errors.push({
        field,
        message: 'This field is not editable through this route.',
      })
    }
  }

  const parentTaskId = normalizeTaskId(value.parent_task_id)
  if (value.parent_task_id !== undefined) {
    if (parentTaskId === undefined) {
      errors.push({
        field: 'parent_task_id',
        message: 'Must be a task id or null.',
      })
    } else {
      validateTaskId('parent_task_id', parentTaskId, currentTaskId, errors)
      updates.parent_task_id = parentTaskId
    }
  }

  if (value.related_task_ids !== undefined) {
    if (value.related_task_ids === null) {
      updates.related_task_ids = null
    } else if (!Array.isArray(value.related_task_ids)) {
      errors.push({
        field: 'related_task_ids',
        message: 'Must be an array of task ids or null.',
      })
    } else if (value.related_task_ids.length > MAX_RELATED_TASKS) {
      errors.push({
        field: 'related_task_ids',
        message: `Must include ${MAX_RELATED_TASKS} task ids or fewer.`,
      })
    } else {
      const relatedTaskIds: string[] = []
      for (const item of value.related_task_ids) {
        const relatedTaskId = normalizeTaskId(item)
        if (!relatedTaskId) continue
        validateTaskId('related_task_ids', relatedTaskId, currentTaskId, errors)
        if (!relatedTaskIds.includes(relatedTaskId)) {
          relatedTaskIds.push(relatedTaskId)
        }
      }
      updates.related_task_ids = relatedTaskIds.length > 0 ? relatedTaskIds : null
    }
  }

  if (
    updates.parent_task_id &&
    updates.related_task_ids?.includes(updates.parent_task_id)
  ) {
    errors.push({
      field: 'related_task_ids',
      message: 'Parent task cannot also be a related task.',
    })
  }

  const referencedTaskIds = [
    updates.parent_task_id,
    ...(updates.related_task_ids ?? []),
  ].filter((id): id is string => Boolean(id))

  return {
    updates,
    referencedTaskIds,
    errors,
  }
}
