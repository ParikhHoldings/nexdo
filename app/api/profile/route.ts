import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_PROFILE_SELECT, toClientProfile } from '@/lib/profile'
import type { WorkType } from '@/lib/database.types'

const WORK_TYPES = ['founder', 'developer', 'marketer', 'student', 'other'] as const
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
] as const
const MAX_FULL_NAME = 120

type ValidationError = {
  field: string
  message: string
}

function validateProfilePatch(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}
  const errors: ValidationError[] = []

  if (body.full_name !== undefined) {
    if (body.full_name === null) {
      updates.full_name = null
    } else if (typeof body.full_name !== 'string') {
      errors.push({ field: 'full_name', message: 'Must be a string or null.' })
    } else if (body.full_name.length > MAX_FULL_NAME) {
      errors.push({ field: 'full_name', message: `Must be ${MAX_FULL_NAME} characters or fewer.` })
    } else {
      updates.full_name = body.full_name.trim() || null
    }
  }

  if (body.timezone !== undefined) {
    if (!TIMEZONES.includes(body.timezone as typeof TIMEZONES[number])) {
      errors.push({ field: 'timezone', message: `Must be one of ${TIMEZONES.join(', ')}.` })
    } else {
      updates.timezone = body.timezone
    }
  }

  if (body.work_type !== undefined) {
    if (body.work_type !== null && !WORK_TYPES.includes(body.work_type as WorkType)) {
      errors.push({ field: 'work_type', message: `Must be one of ${WORK_TYPES.join(', ')} or null.` })
    } else {
      updates.work_type = body.work_type
    }
  }

  return { updates, errors }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 503 }
    )
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { updates, errors } = validateProfilePatch(body)

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      )
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const db = supabase as any
    const { data: profile, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select(CLIENT_PROFILE_SELECT)
      .maybeSingle()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(toClientProfile(profile))
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
