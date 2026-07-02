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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          pdf_name: string | null
          pdf_path: string | null
          student_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string
          daily_score: number
          id: string
          log_date: string
          student_id: string
          trained: boolean
          updated_at: string
          water_ml: number
        }
        Insert: {
          created_at?: string
          daily_score?: number
          id?: string
          log_date?: string
          student_id: string
          trained?: boolean
          updated_at?: string
          water_ml?: number
        }
        Update: {
          created_at?: string
          daily_score?: number
          id?: string
          log_date?: string
          student_id?: string
          trained?: boolean
          updated_at?: string
          water_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_prescriptions: {
        Row: {
          created_at: string
          data: Json
          observacoes: string | null
          source_name: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          observacoes?: string | null
          source_name?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          observacoes?: string | null
          source_name?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercise_gallery: {
        Row: {
          created_at: string
          description: string | null
          id: string
          muscle_group: string
          title: string
          youtube_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_group?: string
          title: string
          youtube_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          muscle_group?: string
          title?: string
          youtube_url?: string
        }
        Relationships: []
      }
      logbook_entries: {
        Row: {
          created_at: string
          entry_date: string
          exercise: string
          id: string
          load: string
          order_index: number
          reps: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          exercise?: string
          id?: string
          load?: string
          order_index?: number
          reps?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          exercise?: string
          id?: string
          load?: string
          order_index?: number
          reps?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      meal_checks: {
        Row: {
          daily_log_id: string
          done: boolean
          id: string
          meal_name: string
          order_index: number
          rating: number
        }
        Insert: {
          daily_log_id: string
          done?: boolean
          id?: string
          meal_name: string
          order_index?: number
          rating?: number
        }
        Update: {
          daily_log_id?: string
          done?: boolean
          id?: string
          meal_name?: string
          order_index?: number
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_checks_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "daily_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_items: {
        Row: {
          calories: number | null
          carbs: number | null
          fat: number | null
          food_name: string
          id: string
          meal_id: string
          notes: string | null
          order_index: number
          protein: number | null
          quantity: string | null
        }
        Insert: {
          calories?: number | null
          carbs?: number | null
          fat?: number | null
          food_name?: string
          id?: string
          meal_id: string
          notes?: string | null
          order_index?: number
          protein?: number | null
          quantity?: string | null
        }
        Update: {
          calories?: number | null
          carbs?: number | null
          fat?: number | null
          food_name?: string
          id?: string
          meal_id?: string
          notes?: string | null
          order_index?: number
          protein?: number | null
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          id: string
          meal_name: string
          meal_time: string | null
          order_index: number
          plan_id: string
        }
        Insert: {
          id?: string
          meal_name?: string
          meal_time?: string | null
          order_index?: number
          plan_id: string
        }
        Update: {
          id?: string
          meal_name?: string
          meal_time?: string | null
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "nutrition_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_plans: {
        Row: {
          active: boolean
          general_notes: string | null
          id: string
          pdf_name: string | null
          pdf_path: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          general_notes?: string | null
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          general_notes?: string | null
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          email: string
          full_name: string
          height_cm: number | null
          id: string
          initial_weight_kg: number | null
          phone: string | null
          trainer_id: string | null
          water_ml_per_kg: number
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email: string
          full_name?: string
          height_cm?: number | null
          id: string
          initial_weight_kg?: number | null
          phone?: string | null
          trainer_id?: string | null
          water_ml_per_kg?: number
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          email?: string
          full_name?: string
          height_cm?: number | null
          id?: string
          initial_weight_kg?: number | null
          phone?: string | null
          trainer_id?: string | null
          water_ml_per_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      structured_training_plans: {
        Row: {
          created_at: string
          plan: Json
          source_name: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          plan?: Json
          source_name?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          plan?: Json
          source_name?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "structured_training_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_exercises: {
        Row: {
          day_label: string
          exercise_name: string
          gallery_video_id: string | null
          id: string
          load: string | null
          notes: string | null
          order_index: number
          plan_id: string
          reps: string | null
          rest: string | null
          sets: string | null
        }
        Insert: {
          day_label?: string
          exercise_name?: string
          gallery_video_id?: string | null
          id?: string
          load?: string | null
          notes?: string | null
          order_index?: number
          plan_id: string
          reps?: string | null
          rest?: string | null
          sets?: string | null
        }
        Update: {
          day_label?: string
          exercise_name?: string
          gallery_video_id?: string | null
          id?: string
          load?: string | null
          notes?: string | null
          order_index?: number
          plan_id?: string
          reps?: string | null
          rest?: string | null
          sets?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_exercises_gallery_video_id_fkey"
            columns: ["gallery_video_id"]
            isOneToOne: false
            referencedRelation: "exercise_gallery"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_exercises_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          active: boolean
          id: string
          pdf_name: string | null
          pdf_path: string | null
          student_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          id?: string
          pdf_name?: string | null
          pdf_path?: string | null
          student_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weight_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          student_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          student_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          student_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "aluno" | "treinador" | "admin"
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
      app_role: ["aluno", "treinador", "admin"],
    },
  },
} as const
