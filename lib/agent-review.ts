import type { Task } from './database.types'
import { agentOutputReviewStatus } from './agent-output'
import { hasAgentTrace } from './agent-trace'

export function taskNeedsAgentReview(task: Task): boolean {
  const reviewStatus = agentOutputReviewStatus(
    task.agent_output,
    task.action_type
  )

  if (reviewStatus === 'unreviewed' || reviewStatus === 'needs_revision') {
    return true
  }

  if (reviewStatus === 'verified') {
    return false
  }

  return hasAgentTrace(task)
}

export function taskHasVerifiedAgentOutput(task: Task): boolean {
  return agentOutputReviewStatus(task.agent_output, task.action_type) === 'verified'
}
