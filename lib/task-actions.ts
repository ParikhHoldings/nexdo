import type { ActionType } from './database.types'

export const EXECUTABLE_ACTION_TYPES = ['research', 'draft', 'prep'] as const

export type ExecutableActionType = (typeof EXECUTABLE_ACTION_TYPES)[number]

const EXECUTABLE_ACTION_TYPE_SET = new Set<ActionType>([
  ...EXECUTABLE_ACTION_TYPES,
])

export function isExecutableActionType(
  actionType: ActionType
): actionType is ExecutableActionType {
  return EXECUTABLE_ACTION_TYPE_SET.has(actionType)
}

export function asExecutableActionType(
  actionType: ActionType
): ExecutableActionType | null {
  return isExecutableActionType(actionType) ? actionType : null
}
