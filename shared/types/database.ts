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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      exercise_categories: {
        Row: {
          created_at: string | null
          id: string
          is_system: boolean | null
          name: string
          studio_id: string | null
          trainer_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          studio_id?: string | null
          trainer_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          studio_id?: string | null
          trainer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_categories_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          instructions: string | null
          muscle_groups: string[] | null
          name: string
          original_system_id: string | null
          owner_id: string | null
          studio_id: string | null
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          instructions?: string | null
          muscle_groups?: string[] | null
          name: string
          original_system_id?: string | null
          owner_id?: string | null
          studio_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          instructions?: string | null
          muscle_groups?: string[] | null
          name?: string
          original_system_id?: string | null
          owner_id?: string | null
          studio_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_original_system_id_fkey"
            columns: ["original_system_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount_gross: number
          amount_net: number
          coach_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          processed_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_invoice_id: string | null
          stripe_payment_id: string
          student_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount_gross: number
          amount_net: number
          coach_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          processed_at?: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_invoice_id?: string | null
          stripe_payment_id: string
          student_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount_gross?: number
          amount_net?: number
          coach_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_invoice_id?: string | null
          stripe_payment_id?: string
          student_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_workout_items: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          load: string | null
          notes: string | null
          order_index: number | null
          reps: string | null
          rest_time: number | null
          sets: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          load?: string | null
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_time?: number | null
          sets?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          load?: string | null
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_time?: number | null
          sets?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_workout_items_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "library_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      library_workouts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          muscle_groups: string[] | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_groups?: string[] | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_groups?: string[] | null
          title?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          general_notifications: boolean | null
          id: string
          program_updates: boolean | null
          student_id: string
          updated_at: string | null
          workout_reminders: boolean | null
        }
        Insert: {
          created_at?: string | null
          general_notifications?: boolean | null
          id?: string
          program_updates?: boolean | null
          student_id: string
          updated_at?: string | null
          workout_reminders?: boolean | null
        }
        Update: {
          created_at?: string | null
          general_notifications?: boolean | null
          id?: string
          program_updates?: boolean | null
          student_id?: string
          updated_at?: string | null
          workout_reminders?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          charges_enabled: boolean | null
          created_at: string | null
          details_submitted: boolean | null
          payouts_enabled: boolean | null
          stripe_connect_id: string | null
          stripe_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
          stripe_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          payouts_enabled?: boolean | null
          stripe_connect_id?: string | null
          stripe_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          can_coach: boolean | null
          can_manage: boolean | null
          coach_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram_handle: string | null
          phone: string | null
          preferred_view: string | null
          role: Database["public"]["Enums"]["user_role"]
          specialty: string | null
          stripe_account_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          studio_id: string | null
          studio_role: Database["public"]["Enums"]["studio_role"] | null
          subscription_status:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          subscription_tier:
          | Database["public"]["Enums"]["subscription_tier"]
          | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          can_coach?: boolean | null
          can_manage?: boolean | null
          coach_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          instagram_handle?: string | null
          phone?: string | null
          preferred_view?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          specialty?: string | null
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_id?: string | null
          studio_role?: Database["public"]["Enums"]["studio_role"] | null
          subscription_status?:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          subscription_tier?:
          | Database["public"]["Enums"]["subscription_tier"]
          | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          can_coach?: boolean | null
          can_manage?: boolean | null
          coach_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_handle?: string | null
          phone?: string | null
          preferred_view?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          specialty?: string | null
          stripe_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          studio_id?: string | null
          studio_role?: Database["public"]["Enums"]["studio_role"] | null
          subscription_status?:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          subscription_tier?:
          | Database["public"]["Enums"]["subscription_tier"]
          | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          duration_weeks: number
          id: string
          is_active: boolean
          is_template: boolean | null
          name: string
          original_template_id: string | null
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          is_active?: boolean
          is_template?: boolean | null
          name: string
          original_template_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          duration_weeks?: number
          id?: string
          is_active?: boolean
          is_template?: boolean | null
          name?: string
          original_template_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_original_template_id_fkey"
            columns: ["original_template_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      student_contracts: {
        Row: {
          amount: number
          billing_type: Database["public"]["Enums"]["billing_type"]
          block_on_fail: boolean
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          end_date: string | null
          id: string
          plan_id: string
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
          billing_type?: Database["public"]["Enums"]["billing_type"]
          block_on_fail?: boolean
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          end_date?: string | null
          id?: string
          plan_id: string
          start_date?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id: string
          trainer_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          billing_type?: Database["public"]["Enums"]["billing_type"]
          block_on_fail?: boolean
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          end_date?: string | null
          id?: string
          plan_id?: string
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
      student_invites: {
        Row: {
          accepted_at: string | null
          coach_id: string
          created_at: string
          declined_at: string | null
          existing_student_id: string | null
          expires_at: string
          id: string
          invite_type: Database["public"]["Enums"]["invite_type"]
          message: string | null
          plan_id: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["invite_status"]
          student_email: string
          student_name: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          coach_id: string
          created_at?: string
          declined_at?: string | null
          existing_student_id?: string | null
          expires_at?: string
          id?: string
          invite_type?: Database["public"]["Enums"]["invite_type"]
          message?: string | null
          plan_id?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          student_email: string
          student_name: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          coach_id?: string
          created_at?: string
          declined_at?: string | null
          existing_student_id?: string | null
          expires_at?: string
          id?: string
          invite_type?: Database["public"]["Enums"]["invite_type"]
          message?: string | null
          plan_id?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          student_email?: string
          student_name?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_invites_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_invites_existing_student_id_fkey"
            columns: ["existing_student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_invites_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "trainer_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      student_milestones: {
        Row: {
          created_at: string
          due_date: string
          id: string
          is_completed: boolean
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          is_completed?: boolean
          student_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          is_completed?: boolean
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_milestones_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_programs: {
        Row: {
          coach_id: string
          created_at: string
          custom_adjustments: Json | null
          deleted_at: string | null
          end_date: string | null
          id: string
          is_active: boolean
          program_id: string
          start_date: string
          status: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          custom_adjustments?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          program_id: string
          start_date?: string
          status?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          custom_adjustments?: Json | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          program_id?: string
          start_date?: string
          status?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_programs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_workout_items: {
        Row: {
          content: string | null
          created_at: string
          exercise_id: string | null
          id: string
          item_type: string
          note_type: string | null
          notes: string | null
          order_index: number
          original_item_id: string | null
          reps: string
          rest_seconds: number | null
          sets: number
          student_workout_id: string
          superset_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          item_type?: string
          note_type?: string | null
          notes?: string | null
          order_index: number
          original_item_id?: string | null
          reps: string
          rest_seconds?: number | null
          sets: number
          student_workout_id: string
          superset_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          exercise_id?: string | null
          id?: string
          item_type?: string
          note_type?: string | null
          notes?: string | null
          order_index?: number
          original_item_id?: string | null
          reps?: string
          rest_seconds?: number | null
          sets?: number
          student_workout_id?: string
          superset_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_items_original_item_id_fkey"
            columns: ["original_item_id"]
            isOneToOne: false
            referencedRelation: "workout_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_items_student_workout_id_fkey"
            columns: ["student_workout_id"]
            isOneToOne: false
            referencedRelation: "student_workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      student_workout_logs: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          performed_at: string
          program_id: string
          status: string
          student_id: string
          student_workout_id: string | null
          updated_at: string
          workout_id: string | null
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          performed_at: string
          program_id: string
          status: string
          student_id: string
          student_workout_id?: string | null
          updated_at?: string
          workout_id?: string | null
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          performed_at?: string
          program_id?: string
          status?: string
          student_id?: string
          student_workout_id?: string | null
          updated_at?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_workout_logs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_logs_student_workout_id_fkey"
            columns: ["student_workout_id"]
            isOneToOne: false
            referencedRelation: "student_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workout_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      student_workouts: {
        Row: {
          created_at: string
          day_of_week: number | null
          id: string
          name: string
          notes: string | null
          order_index: number
          original_workout_id: string | null
          scheduled_days: number[] | null
          student_program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          name: string
          notes?: string | null
          order_index: number
          original_workout_id?: string | null
          scheduled_days?: number[] | null
          student_program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          original_workout_id?: string | null
          scheduled_days?: number[] | null
          student_program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_workouts_original_workout_id_fkey"
            columns: ["original_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_workouts_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          activated_at: string | null
          anamnesis: Json | null
          avatar_url: string | null
          coach_id: string
          created_at: string
          current_plan_name: string | null
          current_program_id: string | null
          email: string
          end_date: string | null
          id: string
          internal_notes: string | null
          invited_at: string
          last_workout_at: string | null
          management_tags: string[] | null
          name: string
          objective: string | null
          payment_method: string | null
          pending_plan_id: string | null
          plan_status: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["student_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          student_id: string | null
          studio_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          anamnesis?: Json | null
          avatar_url?: string | null
          coach_id: string
          created_at?: string
          current_plan_name?: string | null
          current_program_id?: string | null
          email: string
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          invited_at?: string
          last_workout_at?: string | null
          management_tags?: string[] | null
          name: string
          objective?: string | null
          payment_method?: string | null
          pending_plan_id?: string | null
          plan_status?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          anamnesis?: Json | null
          avatar_url?: string | null
          coach_id?: string
          created_at?: string
          current_plan_name?: string | null
          current_program_id?: string | null
          email?: string
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          invited_at?: string
          last_workout_at?: string | null
          management_tags?: string[] | null
          name?: string
          objective?: string | null
          payment_method?: string | null
          pending_plan_id?: string | null
          plan_status?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["student_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          student_id?: string | null
          studio_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_program_id_fkey"
            columns: ["current_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_pending_plan_id_fkey"
            columns: ["pending_plan_id"]
            isOneToOne: false
            referencedRelation: "trainer_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          invite_code: string
          role: Database["public"]["Enums"]["studio_role"]
          status: string
          studio_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          invite_code?: string
          role?: Database["public"]["Enums"]["studio_role"]
          status?: string
          studio_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          invite_code?: string
          role?: Database["public"]["Enums"]["studio_role"]
          status?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_invites_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          logo_url: string | null
          max_students: number | null
          max_trainers: number | null
          name: string
          owner_id: string
          phone: string | null
          plan_tier: string | null
          state: string | null
          stripe_account_id: string | null
          subscription_status:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          trial_ends_at: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_students?: number | null
          max_trainers?: number | null
          name: string
          owner_id: string
          phone?: string | null
          plan_tier?: string | null
          state?: string | null
          stripe_account_id?: string | null
          subscription_status?:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_students?: number | null
          max_trainers?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          plan_tier?: string | null
          state?: string | null
          stripe_account_id?: string | null
          subscription_status?:
          | Database["public"]["Enums"]["subscription_status"]
          | null
          trial_ends_at?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studios_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trainer_change_audit: {
        Row: {
          change_type: string
          changed_at: string
          id: string
          invite_id: string | null
          ip_address: unknown
          new_coach_id: string
          old_coach_id: string | null
          student_id: string
          user_agent: string | null
        }
        Insert: {
          change_type: string
          changed_at?: string
          id?: string
          invite_id?: string | null
          ip_address?: unknown
          new_coach_id: string
          old_coach_id?: string | null
          student_id: string
          user_agent?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          id?: string
          invite_id?: string | null
          ip_address?: unknown
          new_coach_id?: string
          old_coach_id?: string | null
          student_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_change_audit_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "student_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_audit_new_coach_id_fkey"
            columns: ["new_coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_audit_old_coach_id_fkey"
            columns: ["old_coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_change_audit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          interval: string | null
          interval_count: number | null
          is_active: boolean | null
          payment_method: string | null
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          title: string
          trainer_id: string
          updated_at: string | null
          visibility: Database["public"]["Enums"]["plan_visibility"] | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          is_active?: boolean | null
          payment_method?: string | null
          price: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title: string
          trainer_id: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["plan_visibility"] | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          interval?: string | null
          interval_count?: number | null
          is_active?: boolean | null
          payment_method?: string | null
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          title?: string
          trainer_id?: string
          updated_at?: string | null
          visibility?: Database["public"]["Enums"]["plan_visibility"] | null
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
          invite_id: string | null
          is_current: boolean
          previous_coach_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["link_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          invite_id?: string | null
          is_current?: boolean
          previous_coach_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          invite_id?: string | null
          is_current?: boolean
          previous_coach_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["link_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_student_links_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_student_links_invite_id_fkey"
            columns: ["invite_id"]
            isOneToOne: false
            referencedRelation: "student_invites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_student_links_previous_coach_id_fkey"
            columns: ["previous_coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string | null
        }
        Insert: {
          event_id: string
          event_type: string
          id: string
          metadata?: Json | null
          processed_at?: string | null
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          content: string | null
          created_at: string | null
          exercise_id: string | null
          id: string
          item_type: string
          note_type: string | null
          notes: string | null
          order_index: number | null
          reps: string | null
          rest_seconds: number | null
          rpe: number | null
          sets: number | null
          superset_id: string | null
          title: string | null
          workout_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          item_type?: string
          note_type?: string | null
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          rpe?: number | null
          sets?: number | null
          superset_id?: string | null
          title?: string | null
          workout_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string
          item_type?: string
          note_type?: string | null
          notes?: string | null
          order_index?: number | null
          reps?: string | null
          rest_seconds?: number | null
          rpe?: number | null
          sets?: number | null
          superset_id?: string | null
          title?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_items: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          order_index: number
          reps: string
          rest_seconds: number | null
          sets: number
          superset_id: string | null
          updated_at: string
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          order_index: number
          reps: string
          rest_seconds?: number | null
          sets: number
          superset_id?: string | null
          updated_at?: string
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          order_index?: number
          reps?: string
          rest_seconds?: number | null
          sets?: number
          superset_id?: string | null
          updated_at?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_items_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_log_sets: {
        Row: {
          completed: boolean | null
          exercise_id: string | null
          id: string
          log_id: string | null
          reps: number | null
          rpe: number | null
          set_number: number
          weight: number | null
        }
        Insert: {
          completed?: boolean | null
          exercise_id?: string | null
          id?: string
          log_id?: string | null
          reps?: number | null
          rpe?: number | null
          set_number: number
          weight?: number | null
        }
        Update: {
          completed?: boolean | null
          exercise_id?: string | null
          id?: string
          log_id?: string | null
          reps?: number | null
          rpe?: number | null
          set_number?: number
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_log_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_log_sets_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          device_source: string | null
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          reps_completed: number | null
          rpe: number | null
          session_id: string
          set_completed_at: string | null
          set_number: number | null
          student_id: string
          student_workout_item_id: string | null
          weight: number | null
          weight_used: number | null
          workout_id: string | null
          workout_item_id: string | null
          workout_session_id: string | null
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          device_source?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          reps_completed?: number | null
          rpe?: number | null
          session_id: string
          set_completed_at?: string | null
          set_number?: number | null
          student_id: string
          student_workout_item_id?: string | null
          weight?: number | null
          weight_used?: number | null
          workout_id?: string | null
          workout_item_id?: string | null
          workout_session_id?: string | null
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          device_source?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          reps_completed?: number | null
          rpe?: number | null
          session_id?: string
          set_completed_at?: string | null
          set_number?: number | null
          student_id?: string
          student_workout_item_id?: string | null
          weight?: number | null
          weight_used?: number | null
          workout_id?: string | null
          workout_item_id?: string | null
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions_with_completion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_student_workout_item_id_fkey"
            columns: ["student_workout_item_id"]
            isOneToOne: false
            referencedRelation: "student_workout_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_item_id_fkey"
            columns: ["workout_item_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions_with_completion"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          device_used: string | null
          duration: number | null
          duration_seconds: number | null
          ended_at: string | null
          feeling: string | null
          finished_at: string | null
          id: string
          notes: string | null
          performed_by_user_id: string | null
          started_at: string
          status: string | null
          student_id: string
          student_program_id: string | null
          student_workout_id: string | null
          total_volume: number | null
          workout_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          device_used?: string | null
          duration?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          feeling?: string | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          started_at?: string
          status?: string | null
          student_id: string
          student_program_id?: string | null
          student_workout_id?: string | null
          total_volume?: number | null
          workout_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          device_used?: string | null
          duration?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          feeling?: string | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          performed_by_user_id?: string | null
          started_at?: string
          status?: string | null
          student_id?: string
          student_program_id?: string | null
          student_workout_id?: string | null
          total_volume?: number | null
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_performed_by_user_id_fkey"
            columns: ["performed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "workout_sessions_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_student_workout_id_fkey"
            columns: ["student_workout_id"]
            isOneToOne: false
            referencedRelation: "student_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          day_of_week: number | null
          description: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          program_id: string
          scheduled_days: number[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index: number
          program_id: string
          scheduled_days?: number[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          program_id?: string
          scheduled_days?: number[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      workout_sessions_with_completion: {
        Row: {
          completed_at: string | null
          completion_timestamp: string | null
          computed_status: string | null
          created_at: string | null
          duration_seconds: number | null
          finished_at: string | null
          id: string | null
          notes: string | null
          started_at: string | null
          status: string | null
          student_id: string | null
          student_program_id: string | null
          total_volume: number | null
          workout_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_student_program_id_fkey"
            columns: ["student_program_id"]
            isOneToOne: false
            referencedRelation: "student_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_student_invite: {
        Args: {
          p_ip_address?: unknown
          p_student_id: string
          p_token: string
          p_user_agent?: string
        }
        Returns: Json
      }
      check_is_studio_owner: { Args: { p_studio_id: string }; Returns: boolean }
      decline_student_invite: {
        Args: { p_student_id: string; p_token: string }
        Returns: Json
      }
      expire_old_invites: { Args: never; Returns: undefined }
      get_auth_studio_id: { Args: never; Returns: string }
      get_coach_dashboard_metrics: { Args: never; Returns: Json }
      get_profile_studio_id: { Args: { user_uuid: string }; Returns: string }
      get_student_last_workout: {
        Args: { p_coach_id: string; p_student_id: string }
        Returns: Json
      }
      get_tier_student_limit: { Args: { tier: string }; Returns: number }
      get_user_studio_id: { Args: never; Returns: string }
    }
    Enums: {
      billing_interval: "month" | "quarter" | "year"
      billing_type: "stripe_auto" | "manual_recurring" | "manual_one_off" | "courtesy"
      invite_status: "pending" | "accepted" | "declined" | "expired" | "revoked"
      invite_type: "new_student" | "switch_trainer"
      link_status: "active" | "inactive" | "ended"
      plan_visibility: "public" | "hidden"
      student_status: "pending" | "active" | "inactive" | "blocked" | "archived"
      studio_role: "owner" | "trainer"
      subscription_status: "active" | "inactive" | "canceled"
      subscription_tier: "free" | "pro"
      transaction_status: "succeeded" | "failed" | "pending" | "canceled"
      transaction_type: "subscription" | "payout" | "refund"
      user_role: "coach" | "student"
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
  public: {
    Enums: {
      billing_interval: ["month", "quarter", "year"],
      billing_type: ["stripe_auto", "manual_recurring", "manual_one_off", "courtesy"],
      invite_status: ["pending", "accepted", "declined", "expired", "revoked"],
      invite_type: ["new_student", "switch_trainer"],
      link_status: ["active", "inactive", "ended"],
      plan_visibility: ["public", "hidden"],
      student_status: ["pending", "active", "inactive", "blocked", "archived"],
      studio_role: ["owner", "trainer"],
      subscription_status: ["active", "inactive", "canceled"],
      subscription_tier: ["free", "pro"],
      transaction_status: ["succeeded", "failed", "pending", "canceled"],
      transaction_type: ["subscription", "payout", "refund"],
      user_role: ["coach", "student"],
    },
  },
} as const
