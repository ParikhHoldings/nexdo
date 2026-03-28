export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'done' | 'cancelled'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'
export type TaskSource = 'manual' | 'email' | 'voice' | 'api' | 'agent'
export type ActionType = 'manual' | 'research' | 'draft' | 'prep' | 'remind'
export type EnergyLevel = 'deep' | 'light' | 'quick'
export type NoteType = 'note' | 'agent_result' | 'link' | 'file'
export type WorkType = 'founder' | 'developer' | 'marketer' | 'student' | 'other'
export type SubscriptionTier = 'free' | 'pro' | 'power' | 'team'
export type IngestionIntent = 'create' | 'update' | 'complete' | 'auto'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          timezone: string
          work_type: WorkType | null
          subscription_tier: SubscriptionTier
          stripe_customer_id: string | null
          api_key: string | null
          task_count_this_month: number
          agent_executions_this_month: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          timezone?: string
          work_type?: WorkType | null
          subscription_tier?: SubscriptionTier
          stripe_customer_id?: string | null
          api_key?: string | null
          task_count_this_month?: number
          agent_executions_this_month?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          timezone?: string
          work_type?: WorkType | null
          subscription_tier?: SubscriptionTier
          stripe_customer_id?: string | null
          api_key?: string | null
          task_count_this_month?: number
          agent_executions_this_month?: number
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          raw_input: string | null
          description: string | null
          status: TaskStatus
          priority: TaskPriority
          due_date: string | null
          due_time: string | null
          context: string | null
          source: TaskSource
          action_type: ActionType
          estimated_minutes: number | null
          energy_level: EnergyLevel | null
          people: string[] | null
          tags: string[] | null
          parent_task_id: string | null
          related_task_ids: string[] | null
          agent_output: Json | null
          completed_at: string | null
          created_at: string
          updated_at: string
          // Agent interop fields
          source_agent_id: string | null
          external_ref: string | null
          ingestion_intent: IngestionIntent | null
          agent_metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          raw_input?: string | null
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          due_time?: string | null
          context?: string | null
          source?: TaskSource
          action_type?: ActionType
          estimated_minutes?: number | null
          energy_level?: EnergyLevel | null
          people?: string[] | null
          tags?: string[] | null
          parent_task_id?: string | null
          related_task_ids?: string[] | null
          agent_output?: Json | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          source_agent_id?: string | null
          external_ref?: string | null
          ingestion_intent?: IngestionIntent | null
          agent_metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          raw_input?: string | null
          description?: string | null
          status?: TaskStatus
          priority?: TaskPriority
          due_date?: string | null
          due_time?: string | null
          context?: string | null
          source?: TaskSource
          action_type?: ActionType
          estimated_minutes?: number | null
          energy_level?: EnergyLevel | null
          people?: string[] | null
          tags?: string[] | null
          parent_task_id?: string | null
          related_task_ids?: string[] | null
          agent_output?: Json | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          source_agent_id?: string | null
          external_ref?: string | null
          ingestion_intent?: IngestionIntent | null
          agent_metadata?: Json | null
        }
      }
      task_notes: {
        Row: {
          id: string
          task_id: string
          content: string
          note_type: NoteType
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          content: string
          note_type?: NoteType
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          content?: string
          note_type?: NoteType
          created_at?: string
        }
      }
      daily_briefings: {
        Row: {
          id: string
          user_id: string
          briefing_date: string
          content: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          briefing_date: string
          content: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          briefing_date?: string
          content?: Json
          created_at?: string
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type TaskNote = Database['public']['Tables']['task_notes']['Row']
export type DailyBriefing = Database['public']['Tables']['daily_briefings']['Row']

// AI Response types
export interface ParsedTask {
  title: string
  due_date: string | null
  priority: TaskPriority
  context: string | null
  people: string[]
  tags: string[]
  action_type: ActionType
  estimated_minutes: number | null
  energy_level: EnergyLevel | null
}

export interface PrioritizedTask {
  task_id: string
  rank: number
  reasoning: string
  time_block: 'morning_deep' | 'afternoon_light' | 'quick_win' | 'evening'
}

export interface BriefingContent {
  greeting: string
  top_priorities: Array<{ task_id: string; title: string; reasoning: string }>
  overdue: Array<{ task_id: string; title: string; days_overdue: number }>
  quick_wins: Array<{ task_id: string; title: string; estimated_minutes: number }>
  someone_waiting: Array<{ task_id: string; title: string; person: string }>
  summary: string
}

export interface ResearchOutput {
  summary: string
  key_findings: string[]
  sources_searched: string[]
  recommended_action: string
  confidence: 'high' | 'medium' | 'low'
}

export interface DraftOutput {
  draft: string
  tone: string
  suggested_subject: string | null
  word_count: number
}

export interface PrepOutput {
  overview: string
  key_points: string[]
  questions_to_ask: string[]
  materials_needed: string[]
  time_estimate: string
}
