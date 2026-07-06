export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_action_idempotency: {
        Row: {
          created_at: string
          idempotency_key: string
          result: Json | null
          status: string
          tool_name: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          result?: Json | null
          status?: string
          tool_name: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          result?: Json | null
          status?: string
          tool_name?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_idempotency_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_briefing_log: {
        Row: {
          briefed_on: string
          created_at: string
          trainer_id: string
        }
        Insert: {
          briefed_on: string
          created_at?: string
          trainer_id: string
        }
        Update: {
          briefed_on?: string
          created_at?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_briefing_log_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          student_id: string | null
          title: string
          trainer_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          student_id?: string | null
          title?: string
          trainer_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          student_id?: string | null
          title?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_topups: {
        Row: {
          consumed_in_period: string | null
          cost_brl_cents: number
          created_at: string
          credits: number
          id: string
          stripe_payment_intent_id: string | null
          trainer_id: string
        }
        Insert: {
          consumed_in_period?: string | null
          cost_brl_cents: number
          created_at?: string
          credits: number
          id?: string
          stripe_payment_intent_id?: string | null
          trainer_id: string
        }
        Update: {
          consumed_in_period?: string | null
          cost_brl_cents?: number
          created_at?: string
          credits?: number
          id?: string
          stripe_payment_intent_id?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_topups_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_free_trials: {
        Row: {
          action_class: string
          trainer_id: string
          used_at: string
        }
        Insert: {
          action_class: string
          trainer_id: string
          used_at?: string
        }
        Update: {
          action_class?: string
          trainer_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_free_trials_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          credits_cost: number
          id: string
          parts: Json
          role: string
          trainer_id: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string
          conversation_id: string
          created_at?: string
          credits_cost?: number
          id?: string
          parts?: Json
          role: string
          trainer_id: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          credits_cost?: number
          id?: string
          parts?: Json
          role?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          action_class: string
          cached_input_tokens: number | null
          cost_usd_micros: number | null
          created_at: string
          credits: number
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          surface: string | null
          trainer_id: string
        }
        Insert: {
          action_class: string
          cached_input_tokens?: number | null
          cost_usd_micros?: number | null
          created_at?: string
          credits: number
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          surface?: string | null
          trainer_id: string
        }
        Update: {
          action_class?: string
          cached_input_tokens?: number | null
          cost_usd_micros?: number | null
          created_at?: string
          credits?: number
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          surface?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_periods: {
        Row: {
          cost_usd_micros: number
          credits_used: number
          id: string
          period_start: string
          period_type: string
          trainer_id: string
          turns_count: number
          updated_at: string
        }
        Insert: {
          cost_usd_micros?: number
          credits_used?: number
          id?: string
          period_start: string
          period_type: string
          trainer_id: string
          turns_count?: number
          updated_at?: string
        }
        Update: {
          cost_usd_micros?: number
          credits_used?: number
          id?: string
          period_start?: string
          period_type?: string
          trainer_id?: string
          turns_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_periods_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      android_tester_queue: {
        Row: {
          added_at: string | null
          created_at: string | null
          email: string
          id: string
          status: string | null
          student_name: string | null
        }
        Insert: {
          added_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          status?: string | null
          student_name?: string | null
        }
        Update: {
          added_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          status?: string | null
          student_name?: string | null
        }
        Relationships: []
      }
      appointment_exceptions: {
        Row: {
          created_at: string
          id: string
          kind: string
          new_date: string | null
          new_start_time: string | null
          notes: string | null
          occurrence_date: string
          recurring_appointment_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          new_date?: string | null
          new_start_time?: string | null
          notes?: string | null
          occurrence_date: string
          recurring_appointment_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          new_date?: string | null
          new_start_time?: string | null
          notes?: string | null
          occurrence_date?: string
          recurring_appointment_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_exceptions_recurring_appointment_id_fkey"
            columns: ["recurring_appointment_id"]
            isOneToOne: false
            referencedRelation: "recurring_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_exceptions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_groups: {
        Row: {
          capacity: number | null
          coach_id: string
          created_at: string
          day_of_week: number | null
          duration_minutes: number
          ends_on: string | null
          frequency: string
          id: string
          organization_id: string
          start_time: string | null
          starts_on: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          coach_id: string
          created_at?: string
          day_of_week?: number | null
          duration_minutes?: number
          ends_on?: string | null
          frequency?: string
          id?: string
          organization_id: string
          start_time?: string | null
          starts_on?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          coach_id?: string
          created_at?: string
          day_of_week?: number | null
          duration_minutes?: number
          ends_on?: string | null
          frequency?: string
          id?: string
          organization_id?: string
          start_time?: string | null
          starts_on?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_groups_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_measurements: {
        Row: {
          attempt_number: number | null
          id: string
          is_selected: boolean | null
          measured_at: string
          metric_key: string
          raw_input: Json | null
          session_id: string
          side: string | null
          value_numeric: number | null
          value_text: string | null
          value_unit: string | null
        }
        Insert: {
          attempt_number?: number | null
          id?: string
          is_selected?: boolean | null
          measured_at?: string
          metric_key: string
          raw_input?: Json | null
          session_id: string
          side?: string | null
          value_numeric?: number | null
          value_text?: string | null
          value_unit?: string | null
        }
        Update: {
          attempt_number?: number | null
          id?: string
          is_selected?: boolean | null
          measured_at?: string
          metric_key?: string
          raw_input?: Json | null
          session_id?: string
          side?: string | null
          value_numeric?: number | null
          value_text?: string | null
          value_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_measurements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assessment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_sessions: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          computed_metrics: Json | null
          created_at: string
          id: string
          inbox_item_id: string | null
          notes: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          student_id: string
          template_id: string | null
          template_snapshot: Json | null
          template_version: number | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          computed_metrics?: Json | null
          created_at?: string
          id?: string
          inbox_item_id?: string | null
          notes?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          student_id: string
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          computed_metrics?: Json | null
          created_at?: string
          id?: string
          inbox_item_id?: string | null
          notes?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          student_id?: string
          template_id?: string | null
          template_snapshot?: Json | null
          template_version?: number | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sessions_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "student_inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_programs: {
        Row: {
          ai_generated: boolean
          completed_at: string | null
          created_at: string
          current_week: number | null
          description: string | null
          duration_weeks: number | null
          expires_at: string | null
          id: string
          last_completed_workout_at: string | null
          name: string
          prescription_generation_id: string | null
          scheduled_start_date: string | null
          source_template_id: string | null
          started_at: string | null
          status: string
          student_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          completed_at?: string | null
          created_at?: string
          current_week?: number | null
          description?: string | null
          duration_weeks?: number | null
          expires_at?: string | null
          id?: string
          last_completed_workout_at?: string | null
          name: string
          prescription_generation_id?: string | null
          scheduled_start_date?: string | null
          source_template_id?: string | null
          started_at?: string | null
          status?: string
          student_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          completed_at?: string | null
          created_at?: string
          current_week?: number | null
          description?: string | null
          duration_weeks?: number | null
          expires_at?: string | null
          id?: string
          last_completed_workout_at?: string | null
          name?: string
          prescription_generation_id?: string | null
          scheduled_start_date?: string | null
          source_template_id?: string | null
          started_at?: string | null
          status?: string
          student_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_programs_prescription_generation_id_fkey"
            columns: ["prescription_generation_id"]
            isOneToOne: false
            referencedRelation: "prescription_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_programs_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_programs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_programs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_workout_item_sets: {
        Row: {
          assigned_workout_item_id: string
          created_at: string
          id: string
          notes: string | null
          reps: string
          rest_seconds: number
          rir: number | null
          round_number: number | null
          set_number: number
          set_type: string
          tempo: string | null
          updated_at: string
          weight_target_kg: number | null
          weight_target_pct1rm: number | null
        }
        Insert: {
          assigned_workout_item_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reps: string
          rest_seconds?: number
          rir?: number | null
          round_number?: number | null
          set_number: number
          set_type: string
          tempo?: string | null
          updated_at?: string
          weight_target_kg?: number | null
          weight_target_pct1rm?: number | null
        }
        Update: {
          assigned_workout_item_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reps?: string
          rest_seconds?: number
          rir?: number | null
          round_number?: number | null
          set_number?: number
          set_type?: string
          tempo?: string | null
          updated_at?: string
          weight_target_kg?: number | null
          weight_target_pct1rm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assigned_workout_item_sets_assigned_workout_item_id_fkey"
            columns: ["assigned_workout_item_id"]
            isOneToOne: false
            referencedRelation: "assigned_workout_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_workout_items: {
        Row: {
          assigned_workout_id: string
          created_at: string
          exercise_equipment: string | null
          exercise_function: string | null
          exercise_id: string | null
          exercise_muscle_group: string | null
          exercise_name: string | null
          id: string
          item_config: Json
          item_type: string
          method_key: string | null
          notes: string | null
          order_index: number
          parent_item_id: string | null
          reps: string | null
          rest_seconds: number | null
          rounds: number
          sets: number | null
          source_template_id: string | null
          substitute_exercise_ids: string[]
          updated_at: string
        }
        Insert: {
          assigned_workout_id: string
          created_at?: string
          exercise_equipment?: string | null
          exercise_function?: string | null
          exercise_id?: string | null
          exercise_muscle_group?: string | null
          exercise_name?: string | null
          id?: string
          item_config?: Json
          item_type: string
          method_key?: string | null
          notes?: string | null
          order_index: number
          parent_item_id?: string | null
          reps?: string | null
          rest_seconds?: number | null
          rounds?: number
          sets?: number | null
          source_template_id?: string | null
          substitute_exercise_ids?: string[]
          updated_at?: string
        }
        Update: {
          assigned_workout_id?: string
          created_at?: string
          exercise_equipment?: string | null
          exercise_function?: string | null
          exercise_id?: string | null
          exercise_muscle_group?: string | null
          exercise_name?: string | null
          id?: string
          item_config?: Json
          item_type?: string
          method_key?: string | null
          notes?: string | null
          order_index?: number
          parent_item_id?: string | null
          reps?: string | null
          rest_seconds?: number | null
          rounds?: number
          sets?: number | null
          source_template_id?: string | null
          substitute_exercise_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_workout_items_assigned_workout_id_fkey"
            columns: ["assigned_workout_id"]
            isOneToOne: false
            referencedRelation: "assigned_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workout_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "assigned_workout_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workout_items_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "workout_item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      assigned_workouts: {
        Row: {
          assigned_program_id: string
          created_at: string
          id: string
          name: string
          order_index: number
          scheduled_days: number[] | null
          source_template_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_program_id: string
          created_at?: string
          id?: string
          name: string
          order_index: number
          scheduled_days?: number[] | null
          source_template_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_program_id?: string
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          scheduled_days?: number[] | null
          source_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_workouts_assigned_program_id_fkey"
            columns: ["assigned_program_id"]
            isOneToOne: false
            referencedRelation: "assigned_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_workouts_source_template_id_fkey"
            columns: ["source_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_insights: {
        Row: {
          action_metadata: Json | null
          action_type: string | null
          body: string
          category: string
          created_at: string | null
          expires_at: string | null
          id: string
          insight_key: string
          priority: string
          source: string
          status: string
          student_id: string | null
          title: string
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          action_metadata?: Json | null
          action_type?: string | null
          body: string
          category: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          insight_key: string
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title: string
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          action_metadata?: Json | null
          action_type?: string | null
          body?: string
          category?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          insight_key?: string
          priority?: string
          source?: string
          status?: string
          student_id?: string | null
          title?: string
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_insights_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_insights_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_llm_usage: {
        Row: {
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          insight_id: string | null
          model: string
          output_tokens: number
          trainer_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          insight_id?: string | null
          model: string
          output_tokens?: number
          trainer_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          insight_id?: string | null
          model?: string
          output_tokens?: number
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_llm_usage_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "assistant_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_llm_usage_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_turn_traces: {
        Row: {
          confirmation: Json | null
          cost_usd_micros: number | null
          created_at: string
          credits: number
          id: string
          input: string
          input_tokens: number | null
          intents: string[]
          kind: string
          model: string | null
          output: string
          output_tokens: number | null
          prompt_version: string | null
          route: string | null
          student_id: string | null
          surface: string | null
          tools: Json
          trainer_id: string
        }
        Insert: {
          confirmation?: Json | null
          cost_usd_micros?: number | null
          created_at?: string
          credits?: number
          id?: string
          input?: string
          input_tokens?: number | null
          intents?: string[]
          kind?: string
          model?: string | null
          output?: string
          output_tokens?: number | null
          prompt_version?: string | null
          route?: string | null
          student_id?: string | null
          surface?: string | null
          tools?: Json
          trainer_id: string
        }
        Update: {
          confirmation?: Json | null
          cost_usd_micros?: number | null
          created_at?: string
          credits?: number
          id?: string
          input?: string
          input_tokens?: number | null
          intents?: string[]
          kind?: string
          model?: string | null
          output?: string
          output_tokens?: number | null
          prompt_version?: string | null
          route?: string | null
          student_id?: string | null
          surface?: string | null
          tools?: Json
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_turn_traces_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_turn_traces_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_email_domains: {
        Row: {
          blocked_at: string
          domain: string
          reason: string
        }
        Insert: {
          blocked_at?: string
          domain: string
          reason?: string
        }
        Update: {
          blocked_at?: string
          domain?: string
          reason?: string
        }
        Relationships: []
      }
      concierge_requests: {
        Row: {
          channel: string
          id: string
          notes: string | null
          requested_at: string
          source: string
          trainer_id: string
        }
        Insert: {
          channel?: string
          id?: string
          notes?: string | null
          requested_at?: string
          source?: string
          trainer_id: string
        }
        Update: {
          channel?: string
          id?: string
          notes?: string | null
          requested_at?: string
          source?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concierge_requests_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          contract_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          student_id: string
          trainer_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          student_id: string
          trainer_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          student_id?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      curso_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
      daily_activity_samples: {
        Row: {
          calories_active: number | null
          distance_meters: number | null
          id: string
          sample_date: string
          source: string
          steps: number | null
          student_id: string
          synced_at: string
        }
        Insert: {
          calories_active?: number | null
          distance_meters?: number | null
          id?: string
          sample_date: string
          source?: string
          steps?: number | null
          student_id: string
          synced_at?: string
        }
        Update: {
          calories_active?: number | null
          distance_meters?: number | null
          id?: string
          sample_date?: string
          source?: string
          steps?: number | null
          student_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_activity_samples_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sleep_samples: {
        Row: {
          awake_minutes: number | null
          deep_minutes: number | null
          duration_minutes: number | null
          efficiency_pct: number | null
          id: string
          light_minutes: number | null
          raw: Json | null
          rem_minutes: number | null
          sample_date: string
          source: string
          student_id: string
          synced_at: string
        }
        Insert: {
          awake_minutes?: number | null
          deep_minutes?: number | null
          duration_minutes?: number | null
          efficiency_pct?: number | null
          id?: string
          light_minutes?: number | null
          raw?: Json | null
          rem_minutes?: number | null
          sample_date: string
          source?: string
          student_id: string
          synced_at?: string
        }
        Update: {
          awake_minutes?: number | null
          deep_minutes?: number | null
          duration_minutes?: number | null
          efficiency_pct?: number | null
          id?: string
          light_minutes?: number | null
          raw?: Json | null
          rem_minutes?: number | null
          sample_date?: string
          source?: string
          student_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sleep_samples_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_condition_constraints: {
        Row: {
          condition_id: string
          constraint_type: string
          created_at: string | null
          exercise_id: string
          id: string
          notes: string | null
        }
        Insert: {
          condition_id: string
          constraint_type: string
          created_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          condition_id?: string
          constraint_type?: string
          created_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_condition_constraints_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscle_groups: {
        Row: {
          created_at: string
          exercise_id: string
          muscle_group_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          muscle_group_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          muscle_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_groups_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscle_groups_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_relationships: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          relationship_type: string
          source: string
          source_exercise_id: string
          target_exercise_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_type: string
          source?: string
          source_exercise_id: string
          target_exercise_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relationship_type?: string
          source?: string
          source_exercise_id?: string
          target_exercise_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_relationships_source_exercise_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_relationships_target_exercise_id_fkey"
            columns: ["target_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_synergies: {
        Row: {
          created_at: string | null
          id: string
          primary_group_id: string
          secondary_group_id: string
          weight: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          primary_group_id: string
          secondary_group_id: string
          weight: number
        }
        Update: {
          created_at?: string | null
          id?: string
          primary_group_id?: string
          secondary_group_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_synergies_primary_group_id_fkey"
            columns: ["primary_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_synergies_secondary_group_id_fkey"
            columns: ["secondary_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          difficulty_level: string
          equipment: string | null
          fatigue_class: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_ai_curated: boolean
          is_archived: boolean
          is_primary_movement: boolean
          movement_pattern: string | null
          movement_pattern_family: string | null
          name: string
          organization_id: string | null
          original_system_id: string | null
          owner_id: string | null
          prescription_notes: string | null
          session_position: string
          studio_id: string | null
          thumbnail_url: string | null
          updated_at: string
          video_source_drive_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          difficulty_level?: string
          equipment?: string | null
          fatigue_class?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_ai_curated?: boolean
          is_archived?: boolean
          is_primary_movement?: boolean
          movement_pattern?: string | null
          movement_pattern_family?: string | null
          name: string
          organization_id?: string | null
          original_system_id?: string | null
          owner_id?: string | null
          prescription_notes?: string | null
          session_position?: string
          studio_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_source_drive_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          difficulty_level?: string
          equipment?: string | null
          fatigue_class?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_ai_curated?: boolean
          is_archived?: boolean
          is_primary_movement?: boolean
          movement_pattern?: string | null
          movement_pattern_family?: string | null
          name?: string
          organization_id?: string | null
          original_system_id?: string | null
          owner_id?: string | null
          prescription_notes?: string | null
          session_position?: string
          studio_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_source_drive_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_trainer_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      external_activities: {
        Row: {
          activity_type: string
          avg_heart_rate: number | null
          calories: number | null
          distance_meters: number | null
          duration_seconds: number
          elevation_gain_meters: number | null
          external_id: string
          id: string
          max_heart_rate: number | null
          name: string
          raw: Json | null
          source: string
          started_at: string
          student_id: string
          synced_at: string
        }
        Insert: {
          activity_type: string
          avg_heart_rate?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds: number
          elevation_gain_meters?: number | null
          external_id: string
          id?: string
          max_heart_rate?: number | null
          name: string
          raw?: Json | null
          source: string
          started_at: string
          student_id: string
          synced_at?: string
        }
        Update: {
          activity_type?: string
          avg_heart_rate?: number | null
          calories?: number | null
          distance_meters?: number | null
          duration_seconds?: number
          elevation_gain_meters?: number | null
          external_id?: string
          id?: string
          max_heart_rate?: number | null
          name?: string
          raw?: Json | null
          source?: string
          started_at?: string
          student_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_activities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          coach_id: string | null
          created_at: string | null
          description: string
          id: string
          page_url: string | null
          screenshot_url: string | null
          status: string | null
          type: string
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          page_url?: string | null
          screenshot_url?: string | null
          status?: string | null
          type: string
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          page_url?: string | null
          screenshot_url?: string | null
          status?: string | null
          type?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount_gross: number
          amount_net: number
          asaas_payment_id: string | null
          coach_id: string
          contract_id: string | null
          created_at: string
          credit_date: string | null
          currency: string
          description: string | null
          estimated_credit_date: string | null
          id: string
          installment_number: number | null
          installment_total: number | null
          payment_method: string | null
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          status: string
          stripe_invoice_id: string | null
          stripe_payment_id: string | null
          student_id: string | null
          type: string
        }
        Insert: {
          amount_gross: number
          amount_net: number
          asaas_payment_id?: string | null
          coach_id: string
          contract_id?: string | null
          created_at?: string
          credit_date?: string | null
          currency?: string
          description?: string | null
          estimated_credit_date?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          payment_method?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_id?: string | null
          student_id?: string | null
          type: string
        }
        Update: {
          amount_gross?: number
          amount_net?: number
          asaas_payment_id?: string | null
          coach_id?: string
          contract_id?: string | null
          created_at?: string
          credit_date?: string | null
          currency?: string
          description?: string | null
          estimated_credit_date?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          payment_method?: string | null
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_id?: string | null
          student_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "student_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      form_schedules: {
        Row: {
          created_at: string
          form_template_id: string
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          next_due_at: string
          student_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_template_id: string
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_due_at: string
          student_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_template_id?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          next_due_at?: string
          student_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_schedules_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_schedules_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_schedules_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          answers_json: Json | null
          created_at: string
          feedback_sent_at: string | null
          form_template_id: string
          form_template_version: number
          id: string
          inbox_item_id: string | null
          schema_snapshot_json: Json
          status: string
          student_id: string
          submitted_at: string | null
          trainer_feedback: Json | null
          trainer_id: string
          trigger_context: string
          updated_at: string
        }
        Insert: {
          answers_json?: Json | null
          created_at?: string
          feedback_sent_at?: string | null
          form_template_id: string
          form_template_version: number
          id?: string
          inbox_item_id?: string | null
          schema_snapshot_json: Json
          status: string
          student_id: string
          submitted_at?: string | null
          trainer_feedback?: Json | null
          trainer_id: string
          trigger_context?: string
          updated_at?: string
        }
        Update: {
          answers_json?: Json | null
          created_at?: string
          feedback_sent_at?: string | null
          form_template_id?: string
          form_template_version?: number
          id?: string
          inbox_item_id?: string | null
          schema_snapshot_json?: Json
          status?: string
          student_id?: string
          submitted_at?: string | null
          trainer_feedback?: Json | null
          trainer_id?: string
          trigger_context?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "student_inbox_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          ai_confidence_score: number | null
          ai_generation_version: string | null
          ai_warnings: Json | null
          category: string
          created_at: string
          created_source: string
          delivery_mode: string
          description: string | null
          id: string
          is_active: boolean
          is_default_for_new_students: boolean
          schema_json: Json
          system_key: string | null
          title: string
          trainer_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_generation_version?: string | null
          ai_warnings?: Json | null
          category: string
          created_at?: string
          created_source?: string
          delivery_mode?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default_for_new_students?: boolean
          schema_json: Json
          system_key?: string | null
          title: string
          trainer_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_confidence_score?: number | null
          ai_generation_version?: string | null
          ai_warnings?: Json | null
          category?: string
          created_at?: string
          created_source?: string
          delivery_mode?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default_for_new_students?: boolean
          schema_json?: Json
          system_key?: string | null
          title?: string
          trainer_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          access_token_expires_at: string
          calendar_id: string
          connected_at: string
          google_account_email: string
          last_sync_at: string | null
          last_sync_error: string | null
          refresh_token: string
          scope: string
          status: string
          trainer_id: string
          updated_at: string
          watch_channel_id: string | null
          watch_expires_at: string | null
          watch_resource_id: string | null
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          calendar_id: string
          connected_at?: string
          google_account_email: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token: string
          scope: string
          status?: string
          trainer_id: string
          updated_at?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          calendar_id?: string
          connected_at?: string
          google_account_email?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          refresh_token?: string
          scope?: string
          status?: string
          trainer_id?: string
          updated_at?: string
          watch_channel_id?: string | null
          watch_expires_at?: string | null
          watch_resource_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: true
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_resting_samples: {
        Row: {
          bpm: number
          id: string
          sample_date: string
          source: string
          student_id: string
          synced_at: string
        }
        Insert: {
          bpm: number
          id?: string
          sample_date: string
          source?: string
          student_id: string
          synced_at?: string
        }
        Update: {
          bpm?: number
          id?: string
          sample_date?: string
          source?: string
          student_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_resting_samples_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      hrv_samples: {
        Row: {
          id: string
          sample_date: string
          source: string
          student_id: string
          synced_at: string
          value_ms: number
        }
        Insert: {
          id?: string
          sample_date: string
          source?: string
          student_id: string
          synced_at?: string
          value_ms: number
        }
        Update: {
          id?: string
          sample_date?: string
          source?: string
          student_id?: string
          synced_at?: string
          value_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "hrv_samples_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_oauth_clients: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          id: string
          redirect_uris: string[]
        }
        Insert: {
          client_id: string
          client_name?: string
          created_at?: string
          id?: string
          redirect_uris?: string[]
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          id?: string
          redirect_uris?: string[]
        }
        Relationships: []
      }
      mcp_oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string
          code_challenge_method: string
          created_at: string
          expires_at: string
          id: string
          redirect_uri: string
          scope: string | null
          state: string | null
          trainer_id: string
          used_at: string | null
        }
        Insert: {
          client_id: string
          code: string
          code_challenge: string
          code_challenge_method?: string
          created_at?: string
          expires_at: string
          id?: string
          redirect_uri: string
          scope?: string | null
          state?: string | null
          trainer_id: string
          used_at?: string | null
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string
          code_challenge_method?: string
          created_at?: string
          expires_at?: string
          id?: string
          redirect_uri?: string
          scope?: string | null
          state?: string | null
          trainer_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_codes_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_oauth_tokens: {
        Row: {
          access_token_hash: string
          client_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_expires_at: string | null
          refresh_token_hash: string | null
          revoked_at: string | null
          scope: string | null
          trainer_id: string
        }
        Insert: {
          access_token_hash: string
          client_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scope?: string | null
          trainer_id: string
        }
        Update: {
          access_token_hash?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_expires_at?: string | null
          refresh_token_hash?: string | null
          revoked_at?: string | null
          scope?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_oauth_tokens_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tool_usage_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          success: boolean
          tool_name: string
          trainer_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          success?: boolean
          tool_name: string
          trainer_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          success?: boolean
          tool_name?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "trainer_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_tool_usage_logs_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          image_path: string | null
          image_url: string | null
          read_at: string | null
          sender_id: string
          sender_type: string
          student_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          read_at?: string | null
          sender_id: string
          sender_type: string
          student_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string | null
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "muscle_groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muscle_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          is_coach: boolean
          joined_at: string | null
          organization_id: string
          role: string
          status: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          is_coach?: boolean
          joined_at?: string | null
          organization_id: string
          role?: string
          status?: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          is_coach?: boolean
          joined_at?: string | null
          organization_id?: string
          role?: string
          status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          grace_until: string | null
          id: string
          logo_url: string | null
          name: string
          plan_tier: string | null
          seat_limit: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          grace_until?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan_tier?: string | null
          seat_limit?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          grace_until?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan_tier?: string | null
          seat_limit?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          charges_enabled: boolean | null
          created_at: string
          details_submitted: boolean | null
          payouts_enabled: boolean | null
          stripe_connect_id: string | null
          stripe_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean | null
          created_at?: string
          details_submitted?: boolean | null
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
          stripe_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          charges_enabled?: boolean | null
          created_at?: string
          details_submitted?: boolean | null
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
          stripe_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount_cents: number
          asaas_transfer_id: string | null
          completed_at: string | null
          end_to_end_id: string | null
          failure_reason: string | null
          id: string
          pix_key_id: string | null
          pix_key_snapshot: string
          pix_key_type_snapshot: Database["public"]["Enums"]["pix_key_type"]
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          trainer_id: string
        }
        Insert: {
          amount_cents: number
          asaas_transfer_id?: string | null
          completed_at?: string | null
          end_to_end_id?: string | null
          failure_reason?: string | null
          id?: string
          pix_key_id?: string | null
          pix_key_snapshot: string
          pix_key_type_snapshot: Database["public"]["Enums"]["pix_key_type"]
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          trainer_id: string
        }
        Update: {
          amount_cents?: number
          asaas_transfer_id?: string | null
          completed_at?: string | null
          end_to_end_id?: string | null
          failure_reason?: string | null
          id?: string
          pix_key_id?: string | null
          pix_key_snapshot?: string
          pix_key_type_snapshot?: Database["public"]["Enums"]["pix_key_type"]
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_pix_key_id_fkey"
            columns: ["pix_key_id"]
            isOneToOne: false
            referencedRelation: "pix_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      perfect_weeks: {
        Row: {
          achieved_at: string
          assigned_program_id: string | null
          completed_count: number
          created_at: string
          expected_count: number
          id: string
          program_week: number | null
          student_id: string
          trainer_id: string | null
          week_start_date: string
        }
        Insert: {
          achieved_at?: string
          assigned_program_id?: string | null
          completed_count: number
          created_at?: string
          expected_count: number
          id?: string
          program_week?: number | null
          student_id: string
          trainer_id?: string | null
          week_start_date: string
        }
        Update: {
          achieved_at?: string
          assigned_program_id?: string | null
          completed_count?: number
          created_at?: string
          expected_count?: number
          id?: string
          program_week?: number | null
          student_id?: string
          trainer_id?: string | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfect_weeks_assigned_program_id_fkey"
            columns: ["assigned_program_id"]
            isOneToOne: false
            referencedRelation: "assigned_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfect_weeks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfect_weeks_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_keys: {
        Row: {
          alias: string
          bank_name: string | null
          created_at: string
          id: string
          is_default: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          owner_name: string | null
          pix_key: string
          trainer_id: string
          validated_at: string | null
        }
        Insert: {
          alias: string
          bank_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          key_type: Database["public"]["Enums"]["pix_key_type"]
          owner_name?: string | null
          pix_key: string
          trainer_id: string
          validated_at?: string | null
        }
        Update: {
          alias?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          key_type?: Database["public"]["Enums"]["pix_key_type"]
          owner_name?: string | null
          pix_key?: string
          trainer_id?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      prescription_generations: {
        Row: {
          agent_conversation: Json | null
          ai_mode_used: string
          ai_model: string
          ai_source: string
          approval_notes: string | null
          approved_at: string | null
          assigned_program_id: string | null
          confidence_score: number | null
          context_analysis: Json | null
          cost_usd: number | null
          created_at: string
          expires_at: string
          generation_time_ms: number | null
          id: string
          input_snapshot: Json
          model_used: string | null
          output_snapshot: Json | null
          prompt_version: string | null
          rejected_at: string | null
          retry_count: number | null
          rules_violations: Json
          rules_violations_count: number | null
          rules_violations_json: Json | null
          status: string
          student_id: string
          tokens_input_cached: number | null
          tokens_input_new: number | null
          tokens_output: number | null
          trainer_edits_count: number
          trainer_edits_diff: Json | null
          trainer_id: string
          updated_at: string
          web_search_queries: string[] | null
        }
        Insert: {
          agent_conversation?: Json | null
          ai_mode_used: string
          ai_model: string
          ai_source?: string
          approval_notes?: string | null
          approved_at?: string | null
          assigned_program_id?: string | null
          confidence_score?: number | null
          context_analysis?: Json | null
          cost_usd?: number | null
          created_at?: string
          expires_at?: string
          generation_time_ms?: number | null
          id?: string
          input_snapshot: Json
          model_used?: string | null
          output_snapshot?: Json | null
          prompt_version?: string | null
          rejected_at?: string | null
          retry_count?: number | null
          rules_violations?: Json
          rules_violations_count?: number | null
          rules_violations_json?: Json | null
          status?: string
          student_id: string
          tokens_input_cached?: number | null
          tokens_input_new?: number | null
          tokens_output?: number | null
          trainer_edits_count?: number
          trainer_edits_diff?: Json | null
          trainer_id: string
          updated_at?: string
          web_search_queries?: string[] | null
        }
        Update: {
          agent_conversation?: Json | null
          ai_mode_used?: string
          ai_model?: string
          ai_source?: string
          approval_notes?: string | null
          approved_at?: string | null
          assigned_program_id?: string | null
          confidence_score?: number | null
          context_analysis?: Json | null
          cost_usd?: number | null
          created_at?: string
          expires_at?: string
          generation_time_ms?: number | null
          id?: string
          input_snapshot?: Json
          model_used?: string | null
          output_snapshot?: Json | null
          prompt_version?: string | null
          rejected_at?: string | null
          retry_count?: number | null
          rules_violations?: Json
          rules_violations_count?: number | null
          rules_violations_json?: Json | null
          status?: string
          student_id?: string
          tokens_input_cached?: number | null
          tokens_input_new?: number | null
          tokens_output?: number | null
          trainer_edits_count?: number
          trainer_edits_diff?: Json | null
          trainer_id?: string
          updated_at?: string
          web_search_queries?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_generations_assigned_program_id_fkey"
            columns: ["assigned_program_id"]
            isOneToOne: false
            referencedRelation: "assigned_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_generations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_generations_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      program_form_triggers: {
        Row: {
          created_at: string
          form_template_id: string
          id: string
          is_active: boolean
          program_template_id: string
          trainer_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_template_id: string
          id?: string
          is_active?: boolean
          program_template_id: string
          trainer_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_template_id?: string
          id?: string
          is_active?: boolean
          program_template_id?: string
          trainer_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_form_triggers_form_template_id_fkey"
            columns: ["form_template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_form_triggers_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_form_triggers_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      program_reports: {
        Row: {
          assigned_program_id: string
          auto_notes_draft: string | null
          created_at: string
          generated_at: string
          id: string
          metrics_json: Json
          program_completed_at: string | null
          program_duration_weeks: number | null
          program_name: string
          program_started_at: string | null
          published_at: string | null
          status: string
          student_id: string
          trainer_id: string
          trainer_notes: string | null
          updated_at: string
        }
        Insert: {
          assigned_program_id: string
          auto_notes_draft?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          metrics_json?: Json
          program_completed_at?: string | null
          program_duration_weeks?: number | null
          program_name: string
          program_started_at?: string | null
          published_at?: string | null
          status?: string
          student_id: string
          trainer_id: string
          trainer_notes?: string | null
          updated_at?: string
        }
        Update: {
          assigned_program_id?: string
          auto_notes_draft?: string | null
          created_at?: string
          generated_at?: string
          id?: string
          metrics_json?: Json
          program_completed_at?: string | null
          program_duration_weeks?: number | null
          program_name?: string
          program_started_at?: string | null
          published_at?: string | null
          status?: string
          student_id?: string
          trainer_id?: string
          trainer_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_reports_assigned_program_id_fkey"
            columns: ["assigned_program_id"]
            isOneToOne: false
            referencedRelation: "assigned_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_reports_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      program_templates: {
        Row: {
          created_at: string
          description: string | null
          duration_weeks: number | null
          id: string
          is_archived: boolean
          is_template: boolean
          name: string
          organization_id: string | null
          trainer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_archived?: boolean
          is_template?: boolean
          name: string
          organization_id?: string | null
          trainer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_archived?: boolean
          is_template?: boolean
          name?: string
          organization_id?: string | null
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_templates_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_errors: {
        Row: {
          created_at: string
          error_message: string | null
          error_type: string | null
          id: string
          notification_id: string | null
          push_token_id: string | null
          raw_ticket: Json | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          notification_id?: string | null
          push_token_id?: string | null
          raw_ticket?: Json | null
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_type?: string | null
          id?: string
          notification_id?: string | null
          push_token_id?: string | null
          raw_ticket?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_errors_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tickets: {
        Row: {
          checked_at: string | null
          created_at: string
          id: string
          notification_id: string | null
          push_token_id: string | null
          receipt_error_type: string | null
          receipt_message: string | null
          receipt_status: string | null
          role: string
          status: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          checked_at?: string | null
          created_at?: string
          id?: string
          notification_id?: string | null
          push_token_id?: string | null
          receipt_error_type?: string | null
          receipt_message?: string | null
          receipt_status?: string | null
          role: string
          status?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          checked_at?: string | null
          created_at?: string
          id?: string
          notification_id?: string | null
          push_token_id?: string | null
          receipt_error_type?: string | null
          receipt_message?: string | null
          receipt_status?: string | null
          role?: string
          status?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tickets_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          active: boolean | null
          created_at: string | null
          expo_push_token: string
          id: string
          platform: string | null
          role: string
          trainer_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          expo_push_token: string
          id?: string
          platform?: string | null
          role: string
          trainer_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          expo_push_token?: string
          id?: string
          platform?: string | null
          role?: string
          trainer_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: number
          key: string
        }
        Insert: {
          created_at?: string
          id?: never
          key: string
        }
        Update: {
          created_at?: string
          id?: never
          key?: string
        }
        Relationships: []
      }
      readiness_scores: {
        Row: {
          computed_at: string
          hr_baseline_30d: number | null
          hr_component: number | null
          id: string
          score: number
          score_date: string
          sleep_component: number | null
          sleep_minutes: number | null
          source: string
          student_id: string
        }
        Insert: {
          computed_at?: string
          hr_baseline_30d?: number | null
          hr_component?: number | null
          id?: string
          score: number
          score_date: string
          sleep_component?: number | null
          sleep_minutes?: number | null
          source?: string
          student_id: string
        }
        Update: {
          computed_at?: string
          hr_baseline_30d?: number | null
          hr_component?: number | null
          id?: string
          score?: number
          score_date?: string
          sleep_component?: number | null
          sleep_minutes?: number | null
          source?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "readiness_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_appointments: {
        Row: {
          appointment_group_id: string | null
          created_at: string
          day_of_week: number
          duration_minutes: number
          ends_on: string | null
          frequency: string
          google_event_id: string | null
          google_sync_status: string | null
          group_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          start_time: string
          starts_on: string
          status: string
          student_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          appointment_group_id?: string | null
          created_at?: string
          day_of_week: number
          duration_minutes?: number
          ends_on?: string | null
          frequency?: string
          google_event_id?: string | null
          google_sync_status?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          start_time: string
          starts_on: string
          status?: string
          student_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          appointment_group_id?: string | null
          created_at?: string
          day_of_week?: number
          duration_minutes?: number
          ends_on?: string | null
          frequency?: string
          google_event_id?: string | null
          google_sync_status?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          start_time?: string
          starts_on?: string
          status?: string
          student_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_appointments_appointment_group_id_fkey"
            columns: ["appointment_group_id"]
            isOneToOne: false
            referencedRelation: "appointment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_appointments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_appointments_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          last_error: string | null
          occurrence_date: string
          recurring_appointment_id: string | null
          scheduled_for: string
          sent_at: string | null
          source: string
          status: string
          student_id: string
          title: string
          trainer_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          last_error?: string | null
          occurrence_date: string
          recurring_appointment_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          source: string
          status?: string
          student_id: string
          title: string
          trainer_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          last_error?: string | null
          occurrence_date?: string
          recurring_appointment_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          source?: string
          status?: string
          student_id?: string
          title?: string
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_recurring_appointment_id_fkey"
            columns: ["recurring_appointment_id"]
            isOneToOne: false
            referencedRelation: "recurring_appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      set_logs: {
        Row: {
          assigned_workout_item_id: string | null
          completed_at: string | null
          created_at: string
          device_id: string | null
          executed_exercise_id: string | null
          exercise_id: string | null
          exercise_name: string | null
          id: string
          is_completed: boolean
          local_id: string | null
          notes: string | null
          planned_exercise_id: string | null
          reps_completed: number | null
          rpe: number | null
          set_number: number
          swap_source: string
          sync_status: string
          updated_at: string
          weight: number | null
          weight_unit: string
          workout_session_id: string
        }
        Insert: {
          assigned_workout_item_id?: string | null
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          executed_exercise_id?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          is_completed?: boolean
          local_id?: string | null
          notes?: string | null
          planned_exercise_id?: string | null
          reps_completed?: number | null
          rpe?: number | null
          set_number: number
          swap_source?: string
          sync_status?: string
          updated_at?: string
          weight?: number | null
          weight_unit?: string
          workout_session_id: string
        }
        Update: {
          assigned_workout_item_id?: string | null
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          executed_exercise_id?: string | null
          exercise_id?: string | null
          exercise_name?: string | null
          id?: string
          is_completed?: boolean
          local_id?: string | null
          notes?: string | null
          planned_exercise_id?: string | null
          reps_completed?: number | null
          rpe?: number | null
          set_number?: number
          swap_source?: string
          sync_status?: string
          updated_at?: string
          weight?: number | null
          weight_unit?: string
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_assigned_workout_item_id_fkey"
            columns: ["assigned_workout_item_id"]
            isOneToOne: false
            referencedRelation: "assigned_workout_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_executed_exercise_id_fkey"
            columns: ["executed_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_planned_exercise_id_fkey"
            columns: ["planned_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_contracts: {
        Row: {
          amount: number
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_payment_link_id: string | null
          asaas_subscription_id: string | null
          billing_type: Database["public"]["Enums"]["billing_type"]
          block_on_fail: boolean
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string | null
          current_period_end: string | null
          end_date: string | null
          id: string
          installment_count: number | null
          plan_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          start_date: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          student_id: string
          trainer_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_payment_link_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"]
          block_on_fail?: boolean
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string | null
          current_period_end?: string | null
          end_date?: string | null
          id?: string
          installment_count?: number | null
          plan_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id: string
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_payment_link_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: Database["public"]["Enums"]["billing_type"]
          block_on_fail?: boolean
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string | null
          current_period_end?: string | null
          end_date?: string | null
          id?: string
          installment_count?: number | null
          plan_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          start_date?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string
          trainer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trainer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_contracts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_inbox_items: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          due_at: string | null
          id: string
          payload: Json
          push_sent_at: string | null
          read_at: string | null
          status: string
          student_id: string
          subtitle: string | null
          title: string
          trainer_id: string
          type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          payload: Json
          push_sent_at?: string | null
          read_at?: string | null
          status: string
          student_id: string
          subtitle?: string | null
          title: string
          trainer_id: string
          type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          payload?: Json
          push_sent_at?: string | null
          read_at?: string | null
          status?: string
          student_id?: string
          subtitle?: string | null
          title?: string
          trainer_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_inbox_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_inbox_items_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_prescription_profiles: {
        Row: {
          adherence_rate: number | null
          agent_answers: Json
          ai_mode: string
          available_days: number[]
          available_equipment: string[]
          avg_session_duration_minutes: number | null
          created_at: string
          cycle_observation: string | null
          disliked_exercise_ids: string[] | null
          favorite_exercise_ids: string[] | null
          goal: string
          id: string
          last_calculated_at: string | null
          medical_restrictions: Json
          session_duration_minutes: number
          student_id: string
          trainer_id: string
          training_level: string
          updated_at: string
          volume_overrides: Json
        }
        Insert: {
          adherence_rate?: number | null
          agent_answers?: Json
          ai_mode?: string
          available_days?: number[]
          available_equipment?: string[]
          avg_session_duration_minutes?: number | null
          created_at?: string
          cycle_observation?: string | null
          disliked_exercise_ids?: string[] | null
          favorite_exercise_ids?: string[] | null
          goal?: string
          id?: string
          last_calculated_at?: string | null
          medical_restrictions?: Json
          session_duration_minutes?: number
          student_id: string
          trainer_id: string
          training_level?: string
          updated_at?: string
          volume_overrides?: Json
        }
        Update: {
          adherence_rate?: number | null
          agent_answers?: Json
          ai_mode?: string
          available_days?: number[]
          available_equipment?: string[]
          avg_session_duration_minutes?: number | null
          created_at?: string
          cycle_observation?: string | null
          disliked_exercise_ids?: string[] | null
          favorite_exercise_ids?: string[] | null
          goal?: string
          id?: string
          last_calculated_at?: string | null
          medical_restrictions?: Json
          session_duration_minutes?: number
          student_id?: string
          trainer_id?: string
          training_level?: string
          updated_at?: string
          volume_overrides?: Json
        }
        Relationships: [
          {
            foreignKeyName: "student_prescription_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_prescription_profiles_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          access_blocked_at: string | null
          access_blocked_reason: string | null
          auth_user_id: string | null
          avatar_url: string | null
          coach_id: string | null
          created_at: string
          email: string
          id: string
          is_trainer_profile: boolean | null
          management_tags: string[] | null
          modality: string
          name: string
          notification_preferences: Json | null
          objective: string | null
          organization_id: string | null
          phone: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trainer_notes: string | null
          updated_at: string
        }
        Insert: {
          access_blocked_at?: string | null
          access_blocked_reason?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_trainer_profile?: boolean | null
          management_tags?: string[] | null
          modality?: string
          name: string
          notification_preferences?: Json | null
          objective?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trainer_notes?: string | null
          updated_at?: string
        }
        Update: {
          access_blocked_at?: string | null
          access_blocked_reason?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          coach_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_trainer_profile?: boolean | null
          management_tags?: string[] | null
          modality?: string
          name?: string
          notification_preferences?: Json | null
          objective?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trainer_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_trainer_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string
          trainer_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id: string
          trainer_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          trainer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          trainer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          trainer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_api_keys_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_exercise_videos: {
        Row: {
          created_at: string | null
          exercise_id: string
          file_size_bytes: number | null
          id: string
          original_filename: string | null
          storage_path: string | null
          trainer_id: string
          updated_at: string | null
          video_type: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path?: string | null
          trainer_id: string
          updated_at?: string | null
          video_type: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          file_size_bytes?: number | null
          id?: string
          original_filename?: string | null
          storage_path?: string | null
          trainer_id?: string
          updated_at?: string | null
          video_type?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_exercise_videos_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_exercise_videos_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_financial_settings: {
        Row: {
          block_on_overdue: boolean
          created_at: string
          default_allow_boleto: boolean
          default_allow_credit_card: boolean
          default_allow_pix: boolean
          id: string
          notify_on_kyc_alert: boolean
          notify_on_payment_received: boolean
          notify_on_payout_completed: boolean
          notify_on_subscription_canceled: boolean
          overdue_grace_days: number
          show_stripe_legacy: boolean
          trainer_id: string
          updated_at: string
        }
        Insert: {
          block_on_overdue?: boolean
          created_at?: string
          default_allow_boleto?: boolean
          default_allow_credit_card?: boolean
          default_allow_pix?: boolean
          id?: string
          notify_on_kyc_alert?: boolean
          notify_on_payment_received?: boolean
          notify_on_payout_completed?: boolean
          notify_on_subscription_canceled?: boolean
          overdue_grace_days?: number
          show_stripe_legacy?: boolean
          trainer_id: string
          updated_at?: string
        }
        Update: {
          block_on_overdue?: boolean
          created_at?: string
          default_allow_boleto?: boolean
          default_allow_credit_card?: boolean
          default_allow_pix?: boolean
          id?: string
          notify_on_kyc_alert?: boolean
          notify_on_payment_received?: boolean
          notify_on_payout_completed?: boolean
          notify_on_subscription_canceled?: boolean
          overdue_grace_days?: number
          show_stripe_legacy?: boolean
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_financial_settings_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: true
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_leads: {
        Row: {
          contacted_at: string | null
          converted_to_student_id: string | null
          created_at: string
          email: string
          goal: string | null
          id: string
          ip_hash: string | null
          level: string | null
          message: string | null
          name: string
          source: string
          source_slug: string | null
          status: string
          trainer_id: string
          user_agent: string | null
          whatsapp: string
        }
        Insert: {
          contacted_at?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          email: string
          goal?: string | null
          id?: string
          ip_hash?: string | null
          level?: string | null
          message?: string | null
          name: string
          source?: string
          source_slug?: string | null
          status?: string
          trainer_id: string
          user_agent?: string | null
          whatsapp: string
        }
        Update: {
          contacted_at?: string | null
          converted_to_student_id?: string | null
          created_at?: string
          email?: string
          goal?: string | null
          id?: string
          ip_hash?: string | null
          level?: string | null
          message?: string | null
          name?: string
          source?: string
          source_slug?: string | null
          status?: string
          trainer_id?: string
          user_agent?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_leads_converted_to_student_id_fkey"
            columns: ["converted_to_student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_leads_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_notifications: {
        Row: {
          body: string
          category: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          push_sent_at: string | null
          title: string
          trainer_id: string
          type: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          push_sent_at?: string | null
          title: string
          trainer_id: string
          type?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          push_sent_at?: string | null
          title?: string
          trainer_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_notifications_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_payment_accounts: {
        Row: {
          account_mode: string
          activated_at: string | null
          address: string | null
          address_number: string | null
          asaas_account_id: string | null
          asaas_api_key_encrypted: string | null
          asaas_wallet_id: string | null
          company_type: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          income_value: number | null
          legal_name: string | null
          mobile_phone: string | null
          postal_code: string | null
          province: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["wallet_status"]
          trainer_id: string
          updated_at: string
          webhook_configured_at: string | null
          webhook_token_hash: string | null
        }
        Insert: {
          account_mode?: string
          activated_at?: string | null
          address?: string | null
          address_number?: string | null
          asaas_account_id?: string | null
          asaas_api_key_encrypted?: string | null
          asaas_wallet_id?: string | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          income_value?: number | null
          legal_name?: string | null
          mobile_phone?: string | null
          postal_code?: string | null
          province?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          trainer_id: string
          updated_at?: string
          webhook_configured_at?: string | null
          webhook_token_hash?: string | null
        }
        Update: {
          account_mode?: string
          activated_at?: string | null
          address?: string | null
          address_number?: string | null
          asaas_account_id?: string | null
          asaas_api_key_encrypted?: string | null
          asaas_wallet_id?: string | null
          company_type?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          income_value?: number | null
          legal_name?: string | null
          mobile_phone?: string | null
          postal_code?: string | null
          province?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["wallet_status"]
          trainer_id?: string
          updated_at?: string
          webhook_configured_at?: string | null
          webhook_token_hash?: string | null
        }
        Relationships: []
      }
      trainer_plans: {
        Row: {
          allow_boleto: boolean
          allow_credit_card: boolean
          allow_pix: boolean
          created_at: string | null
          description: string | null
          id: string
          interval: string | null
          interval_count: number | null
          is_active: boolean | null
          max_installment_count: number
          payment_method: string | null
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          trainer_id: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          allow_boleto?: boolean
          allow_credit_card?: boolean
          allow_pix?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          is_active?: boolean | null
          max_installment_count?: number
          payment_method?: string | null
          price: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          trainer_id: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          allow_boleto?: boolean
          allow_credit_card?: boolean
          allow_pix?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          is_active?: boolean | null
          max_installment_count?: number
          payment_method?: string | null
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          trainer_id?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      trainer_student_links: {
        Row: {
          coach_id: string
          created_at: string
          end_reason: string | null
          ended_at: string | null
          id: string
          is_current: boolean
          started_at: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          started_at?: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          started_at?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_student_links_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      trainers: {
        Row: {
          ai_prescriptions_enabled: boolean
          ai_tier: string
          auth_user_id: string
          auto_publish_reports: boolean
          avatar_url: string | null
          brand_color: string | null
          brand_logo_url: string | null
          brand_name: string | null
          brand_show_powered_by: boolean
          branding_enabled: boolean
          created_at: string
          email: string
          financial_attention_seen_at: string | null
          home_style: string
          id: string
          instagram_handle: string | null
          landing_bio: string | null
          landing_certifications: string[] | null
          landing_city: string | null
          landing_cref: string | null
          landing_faq: Json
          landing_headline: string | null
          landing_hero_image_url: string | null
          landing_plans: Json
          landing_price_label: string | null
          landing_published: boolean
          landing_sections: Json
          landing_specializations: string[] | null
          landing_stats: Json
          landing_subheadline: string | null
          landing_testimonials: Json
          landing_year_started: number | null
          modality_focus: string | null
          name: string
          notification_preferences: Json | null
          onboarding_state: Json | null
          prescription_patterns: Json | null
          prescription_preferences: Json | null
          public_slug: string | null
          smart_v2_enabled: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          ai_prescriptions_enabled?: boolean
          ai_tier?: string
          auth_user_id: string
          auto_publish_reports?: boolean
          avatar_url?: string | null
          brand_color?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_show_powered_by?: boolean
          branding_enabled?: boolean
          created_at?: string
          email: string
          financial_attention_seen_at?: string | null
          home_style?: string
          id?: string
          instagram_handle?: string | null
          landing_bio?: string | null
          landing_certifications?: string[] | null
          landing_city?: string | null
          landing_cref?: string | null
          landing_faq?: Json
          landing_headline?: string | null
          landing_hero_image_url?: string | null
          landing_plans?: Json
          landing_price_label?: string | null
          landing_published?: boolean
          landing_sections?: Json
          landing_specializations?: string[] | null
          landing_stats?: Json
          landing_subheadline?: string | null
          landing_testimonials?: Json
          landing_year_started?: number | null
          modality_focus?: string | null
          name: string
          notification_preferences?: Json | null
          onboarding_state?: Json | null
          prescription_patterns?: Json | null
          prescription_preferences?: Json | null
          public_slug?: string | null
          smart_v2_enabled?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          ai_prescriptions_enabled?: boolean
          ai_tier?: string
          auth_user_id?: string
          auto_publish_reports?: boolean
          avatar_url?: string | null
          brand_color?: string | null
          brand_logo_url?: string | null
          brand_name?: string | null
          brand_show_powered_by?: boolean
          branding_enabled?: boolean
          created_at?: string
          email?: string
          financial_attention_seen_at?: string | null
          home_style?: string
          id?: string
          instagram_handle?: string | null
          landing_bio?: string | null
          landing_certifications?: string[] | null
          landing_city?: string | null
          landing_cref?: string | null
          landing_faq?: Json
          landing_headline?: string | null
          landing_hero_image_url?: string | null
          landing_plans?: Json
          landing_price_label?: string | null
          landing_published?: boolean
          landing_sections?: Json
          landing_specializations?: string[] | null
          landing_stats?: Json
          landing_subheadline?: string | null
          landing_testimonials?: Json
          landing_year_started?: number | null
          modality_focus?: string | null
          name?: string
          notification_preferences?: Json | null
          onboarding_state?: Json | null
          prescription_patterns?: Json | null
          prescription_preferences?: Json | null
          public_slug?: string | null
          smart_v2_enabled?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_method_presets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          sets_config: Json
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          sets_config: Json
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          sets_config?: Json
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_method_presets_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      wearable_connections: {
        Row: {
          connected_at: string
          external_user_id: string | null
          granted_categories: string[]
          id: string
          last_error: string | null
          last_sync_at: string | null
          revoked_at: string | null
          source: string
          status: string
          student_id: string
        }
        Insert: {
          connected_at?: string
          external_user_id?: string | null
          granted_categories?: string[]
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          revoked_at?: string | null
          source: string
          status?: string
          student_id: string
        }
        Update: {
          connected_at?: string
          external_user_id?: string | null
          granted_categories?: string[]
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          revoked_at?: string | null
          source?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wearable_connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      wearable_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          external_user_id: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          source: string
          student_id: string
          updated_at: string
          webhook_subscription_ids: Json
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          source: string
          student_id: string
          updated_at?: string
          webhook_subscription_ids?: Json
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          external_user_id?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          source?: string
          student_id?: string
          updated_at?: string
          webhook_subscription_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "wearable_oauth_tokens_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      wearable_provider_config: {
        Row: {
          callback_url: string | null
          client_id: string
          client_secret: string
          setup_secret: string | null
          source: string
          updated_at: string
          verification_token: string | null
        }
        Insert: {
          callback_url?: string | null
          client_id: string
          client_secret: string
          setup_secret?: string | null
          source: string
          updated_at?: string
          verification_token?: string | null
        }
        Update: {
          callback_url?: string | null
          client_id?: string
          client_secret?: string
          setup_secret?: string | null
          source?: string
          updated_at?: string
          verification_token?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string
        }
        Relationships: []
      }
      workout_health_samples: {
        Row: {
          avg_heart_rate: number | null
          calories_active: number | null
          created_at: string
          heart_rate_series: Json | null
          id: string
          max_heart_rate: number | null
          min_heart_rate: number | null
          source: string
          workout_session_id: string
        }
        Insert: {
          avg_heart_rate?: number | null
          calories_active?: number | null
          created_at?: string
          heart_rate_series?: Json | null
          id?: string
          max_heart_rate?: number | null
          min_heart_rate?: number | null
          source?: string
          workout_session_id: string
        }
        Update: {
          avg_heart_rate?: number | null
          calories_active?: number | null
          created_at?: string
          heart_rate_series?: Json | null
          id?: string
          max_heart_rate?: number | null
          min_heart_rate?: number | null
          source?: string
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_health_samples_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: true
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_item_set_templates: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reps: string
          rest_seconds: number
          rir: number | null
          round_number: number | null
          set_number: number
          set_type: string
          tempo: string | null
          updated_at: string
          weight_target_kg: number | null
          weight_target_pct1rm: number | null
          workout_item_template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reps: string
          rest_seconds?: number
          rir?: number | null
          round_number?: number | null
          set_number: number
          set_type: string
          tempo?: string | null
          updated_at?: string
          weight_target_kg?: number | null
          weight_target_pct1rm?: number | null
          workout_item_template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reps?: string
          rest_seconds?: number
          rir?: number | null
          round_number?: number | null
          set_number?: number
          set_type?: string
          tempo?: string | null
          updated_at?: string
          weight_target_kg?: number | null
          weight_target_pct1rm?: number | null
          workout_item_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_item_set_templates_workout_item_template_id_fkey"
            columns: ["workout_item_template_id"]
            isOneToOne: false
            referencedRelation: "workout_item_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_item_templates: {
        Row: {
          created_at: string
          exercise_function: string | null
          exercise_id: string | null
          id: string
          item_config: Json
          item_type: string
          method_key: string | null
          notes: string | null
          order_index: number
          parent_item_id: string | null
          reps: string | null
          rest_seconds: number | null
          rounds: number
          sets: number | null
          substitute_exercise_ids: string[]
          updated_at: string
          workout_template_id: string
        }
        Insert: {
          created_at?: string
          exercise_function?: string | null
          exercise_id?: string | null
          id?: string
          item_config?: Json
          item_type: string
          method_key?: string | null
          notes?: string | null
          order_index: number
          parent_item_id?: string | null
          reps?: string | null
          rest_seconds?: number | null
          rounds?: number
          sets?: number | null
          substitute_exercise_ids?: string[]
          updated_at?: string
          workout_template_id: string
        }
        Update: {
          created_at?: string
          exercise_function?: string | null
          exercise_id?: string | null
          id?: string
          item_config?: Json
          item_type?: string
          method_key?: string | null
          notes?: string | null
          order_index?: number
          parent_item_id?: string | null
          reps?: string | null
          rest_seconds?: number | null
          rounds?: number
          sets?: number | null
          substitute_exercise_ids?: string[]
          updated_at?: string
          workout_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_item_templates_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_item_templates_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "workout_item_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_item_templates_workout_template_id_fkey"
            columns: ["workout_template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          assigned_program_id: string | null
          assigned_workout_id: string | null
          completed_at: string | null
          created_at: string
          device_id: string | null
          duration_seconds: number | null
          feedback: string | null
          id: string
          notes: string | null
          post_workout_submission_id: string | null
          pre_workout_submission_id: string | null
          program_week: number | null
          rpe: number | null
          scheduled_date: string | null
          started_at: string
          status: string
          student_id: string
          sync_status: string
          trainer_id: string
          updated_at: string
          workout_name: string | null
        }
        Insert: {
          assigned_program_id?: string | null
          assigned_workout_id?: string | null
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          duration_seconds?: number | null
          feedback?: string | null
          id?: string
          notes?: string | null
          post_workout_submission_id?: string | null
          pre_workout_submission_id?: string | null
          program_week?: number | null
          rpe?: number | null
          scheduled_date?: string | null
          started_at?: string
          status?: string
          student_id: string
          sync_status?: string
          trainer_id: string
          updated_at?: string
          workout_name?: string | null
        }
        Update: {
          assigned_program_id?: string | null
          assigned_workout_id?: string | null
          completed_at?: string | null
          created_at?: string
          device_id?: string | null
          duration_seconds?: number | null
          feedback?: string | null
          id?: string
          notes?: string | null
          post_workout_submission_id?: string | null
          pre_workout_submission_id?: string | null
          program_week?: number | null
          rpe?: number | null
          scheduled_date?: string | null
          started_at?: string
          status?: string
          student_id?: string
          sync_status?: string
          trainer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_assigned_program_id_fkey"
            columns: ["assigned_program_id"]
            isOneToOne: false
            referencedRelation: "assigned_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_assigned_workout_id_fkey"
            columns: ["assigned_workout_id"]
            isOneToOne: false
            referencedRelation: "assigned_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_post_workout_submission_id_fkey"
            columns: ["post_workout_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_pre_workout_submission_id_fkey"
            columns: ["pre_workout_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "trainers"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          frequency: string[] | null
          id: string
          name: string
          order_index: number
          program_template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          frequency?: string[] | null
          id?: string
          name: string
          order_index: number
          program_template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          frequency?: string[] | null
          id?: string
          name?: string
          order_index?: number
          program_template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_program_template_id_fkey"
            columns: ["program_template_id"]
            isOneToOne: false
            referencedRelation: "program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_draft_program: { Args: { p_program_id: string }; Returns: Json }
      assign_form_to_students:
        | {
            Args: {
              p_due_at?: string
              p_form_template_id: string
              p_message?: string
              p_student_ids: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_due_at?: string
              p_form_template_id: string
              p_message?: string
              p_student_ids: string[]
              p_trainer_id: string
            }
            Returns: Json
          }
      assign_program_from_snapshot: {
        Args: {
          p_bump_edits: boolean
          p_generation_id: string
          p_is_scheduled: boolean
          p_snapshot: Json
          p_start_date: string
          p_student_id: string
          p_trainer_id: string
        }
        Returns: string
      }
      assign_program_from_template: {
        Args: {
          p_is_scheduled?: boolean
          p_prescription_generation_id?: string
          p_scheduled_start_date?: string
          p_student_id: string
          p_template_id: string
          p_trainer_id: string
          p_workout_schedule?: Json
        }
        Returns: string
      }
      assign_program_to_student:
        | {
            Args: {
              p_start_date?: string
              p_student_id: string
              p_template_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_start_date?: string
              p_student_id: string
              p_template_id: string
              p_trainer_id: string
            }
            Returns: string
          }
      block_overdue_students: {
        Args: never
        Returns: {
          days_overdue: number
          reason: string
          student_id: string
          trainer_id: string
        }[]
      }
      block_student_access: {
        Args: { p_reason?: string; p_student_id: string }
        Returns: boolean
      }
      can_read_student: { Args: { p_student: string }; Returns: boolean }
      can_write_student: { Args: { p_student: string }; Returns: boolean }
      check_student_access: { Args: { p_student_id: string }; Returns: Json }
      cleanup_stale_sessions: { Args: never; Returns: number }
      consume_ai_usage: {
        Args: {
          p_cost_micros: number
          p_credits: number
          p_limit?: number
          p_period_start: string
          p_period_type: string
          p_trainer_id: string
        }
        Returns: number
      }
      consume_rate_limit: {
        Args: { p_key: string; p_per_day: number; p_per_minute: number }
        Returns: Json
      }
      create_assessment_session:
        | {
            Args: {
              p_notes?: string
              p_scheduled_at?: string
              p_student_id: string
              p_template_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_notes?: string
              p_scheduled_at?: string
              p_student_id: string
              p_template_id: string
              p_trainer_id: string
            }
            Returns: string
          }
      create_assigned_program_tree: {
        Args: { p_payload: Json; p_student_id: string; p_trainer_id: string }
        Returns: Json
      }
      create_program_template_tree: {
        Args: { p_payload: Json; p_trainer_id: string }
        Returns: Json
      }
      current_member_org_ids: { Args: never; Returns: string[] }
      current_student_coach_id: { Args: never; Returns: string }
      current_student_id: { Args: never; Returns: string }
      current_student_id_active: { Args: never; Returns: string }
      current_trainer_id: { Args: never; Returns: string }
      current_trainer_id_active: { Args: never; Returns: string }
      delete_student_account: { Args: never; Returns: undefined }
      detect_training_gaps: {
        Args: { p_trainer_id: string }
        Returns: {
          days_since_last: number
          last_completed_at: string
          student_id: string
          student_name: string
        }[]
      }
      duplicate_program_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      finalize_assessment_session:
        | {
            Args: {
              p_computed_metrics: Json
              p_notes?: string
              p_session_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_computed_metrics: Json
              p_notes?: string
              p_session_id: string
              p_trainer_id: string
            }
            Returns: Json
          }
      get_active_workout_triggers: {
        Args: { p_assigned_program_id: string }
        Returns: Json
      }
      get_assessment_session:
        | { Args: { p_session_id: string }; Returns: Json }
        | {
            Args: { p_session_id: string; p_trainer_id: string }
            Returns: Json
          }
      get_assessment_sessions:
        | {
            Args: { p_limit?: number; p_status?: string; p_student_id?: string }
            Returns: Json
          }
        | {
            Args: {
              p_limit?: number
              p_status?: string
              p_student_id?: string
              p_trainer_id: string
            }
            Returns: Json
          }
      get_contract_events: { Args: { p_contract_id: string }; Returns: Json }
      get_financial_dashboard: { Args: never; Returns: Json }
      get_financial_students: {
        Args: { p_trainer_id: string }
        Returns: {
          access_blocked_at: string
          access_blocked_reason: string
          amount: number
          avatar_url: string
          billing_type: string
          block_on_fail: boolean
          cancel_at_period_end: boolean
          canceled_at: string
          canceled_by: string
          contract_id: string
          contract_status: string
          current_period_end: string
          display_status: string
          installment_count: number
          phone: string
          plan_interval: string
          plan_title: string
          stripe_subscription_id: string
          student_id: string
          student_name: string
        }[]
      }
      get_form_submission_detail: {
        Args: { p_submission_id: string }
        Returns: Json
      }
      get_last_exercise_metrics: {
        Args: { p_exercise_id: string; p_student_id: string }
        Returns: {
          avg_reps: number
          avg_weight: number
          completed_at: string
          max_weight: number
          sets_count: number
          workout_session_id: string
        }[]
      }
      get_org_athlete_absences: {
        Args: { p_days?: number; p_org: string }
        Returns: {
          coach_id: string
          completed: number
          no_shows: number
          student_id: string
          student_name: string
        }[]
      }
      get_org_class_overview: {
        Args: { p_org: string }
        Returns: {
          capacity: number
          class_id: string
          coach_id: string
          coach_name: string
          day_of_week: number
          enrolled: number
          occupancy_pct: number
          start_time: string
          title: string
        }[]
      }
      get_org_coach_load: {
        Args: { p_org: string }
        Returns: {
          athletes: number
          classes: number
          coach_id: string
          coach_name: string
        }[]
      }
      get_previous_exercise_sets: {
        Args: { p_exercise_id: string; p_student_id: string }
        Returns: {
          reps: number
          set_number: number
          weight: number
        }[]
      }
      get_program_form_triggers: {
        Args: { p_program_template_id: string }
        Returns: Json
      }
      get_smart_substitutes: {
        Args: { match_limit?: number; target_exercise_id: string }
        Returns: {
          id: string
          image_url: string
          name: string
          similarity_score: number
        }[]
      }
      get_student_detail_v2: { Args: { p_student_id: string }; Returns: Json }
      get_student_profile_detail: {
        Args: { p_student_id: string }
        Returns: Json
      }
      get_student_sessions_heatmap: {
        Args: { p_end_date: string; p_start_date: string; p_student_id: string }
        Returns: Json
      }
      get_student_today_workout_for_trainer: {
        Args: { p_assigned_workout_id: string; p_student_id: string }
        Returns: Json
      }
      get_trainer_daily_activity: { Args: never; Returns: Json }
      get_trainer_form_submissions: { Args: never; Returns: Json }
      get_trainer_form_templates: { Args: never; Returns: Json }
      get_trainer_pending_actions: { Args: never; Returns: Json }
      get_trainer_program_templates: { Args: never; Returns: Json }
      get_trainer_stats: { Args: never; Returns: Json }
      get_trainer_students_list: { Args: never; Returns: Json }
      get_training_room_students: { Args: never; Returns: Json }
      get_unread_notification_count: { Args: never; Returns: number }
      increment_ai_usage: {
        Args: {
          p_cost_micros: number
          p_credits: number
          p_period_start: string
          p_period_type: string
          p_trainer_id: string
        }
        Returns: undefined
      }
      is_org_manager: { Args: { p_org: string }; Returns: boolean }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_student: { Args: never; Returns: boolean }
      is_trainer: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      save_assessment_measurements:
        | {
            Args: { p_measurements: Json; p_session_id: string }
            Returns: number
          }
        | {
            Args: {
              p_measurements: Json
              p_session_id: string
              p_trainer_id: string
            }
            Returns: number
          }
      save_assigned_program_tree: {
        Args: { p_payload: Json; p_program_id: string }
        Returns: Json
      }
      send_submission_feedback: {
        Args: { p_feedback: Json; p_submission_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_form_submission: {
        Args: { p_answers_json: Json; p_submission_id: string }
        Returns: Json
      }
      submit_inline_form: {
        Args: {
          p_answers_json: Json
          p_form_template_id: string
          p_student_id: string
          p_trainer_id: string
          p_trigger_context: string
        }
        Returns: Json
      }
      trainer_finish_workout_session: {
        Args: {
          p_assigned_program_id: string
          p_assigned_workout_id: string
          p_duration_seconds: number
          p_feedback?: string
          p_rpe?: number
          p_sets: Json
          p_started_at: string
          p_student_id: string
        }
        Returns: string
      }
      trainer_org_id: { Args: never; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      unblock_student_access: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      update_student_avatar: {
        Args: { p_avatar_url: string }
        Returns: undefined
      }
      update_student_notification_preferences: {
        Args: { p_prefs: Json }
        Returns: undefined
      }
      update_student_self_email: {
        Args: { p_email: string }
        Returns: undefined
      }
      upsert_prescription_profile: {
        Args: {
          p_ai_mode?: string
          p_available_days?: number[]
          p_available_equipment?: string[]
          p_goal?: string
          p_medical_restrictions?: Json
          p_session_duration_minutes?: number
          p_student_id: string
          p_training_level?: string
        }
        Returns: Json
      }
      wearable_source_priority: { Args: { src: string }; Returns: number }
    }
    Enums: {
      billing_type:
        | "stripe_auto"
        | "manual_recurring"
        | "manual_one_off"
        | "courtesy"
        | "asaas_auto"
        | "asaas_auto_recurring"
      payment_provider: "stripe" | "asaas"
      payout_status:
        | "requested"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
        | "awaiting_authorization"
      pix_key_type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"
      wallet_status:
        | "not_started"
        | "pending"
        | "awaiting"
        | "approved"
        | "rejected"
        | "blocked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      billing_type: [
        "stripe_auto",
        "manual_recurring",
        "manual_one_off",
        "courtesy",
        "asaas_auto",
        "asaas_auto_recurring",
      ],
      payment_provider: ["stripe", "asaas"],
      payout_status: [
        "requested",
        "processing",
        "completed",
        "failed",
        "cancelled",
        "awaiting_authorization",
      ],
      pix_key_type: ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"],
      wallet_status: [
        "not_started",
        "pending",
        "awaiting",
        "approved",
        "rejected",
        "blocked",
      ],
    },
  },
} as const
