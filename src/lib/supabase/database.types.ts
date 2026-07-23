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
      ai_provider_configs: {
        Row: {
          api_key_set: boolean
          created_at: string
          id: string
          is_enabled: boolean
          model: string
          monthly_budget_usd: number | null
          organization_id: string
          provider: Database["public"]["Enums"]["ai_provider"]
          updated_at: string
        }
        Insert: {
          api_key_set?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          model?: string
          monthly_budget_usd?: number | null
          organization_id: string
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string
        }
        Update: {
          api_key_set?: boolean
          created_at?: string
          id?: string
          is_enabled?: boolean
          model?: string
          monthly_budget_usd?: number | null
          organization_id?: string
          provider?: Database["public"]["Enums"]["ai_provider"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          organization_id: string
          output_tokens: number
          project_id: string | null
          route: string
          user_id: string | null
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          organization_id: string
          output_tokens?: number
          project_id?: string | null
          route: string
          user_id?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          organization_id?: string
          output_tokens?: number
          project_id?: string | null
          route?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_exceptions: {
        Row: {
          created_at: string
          date: string
          id: string
          is_working: boolean
          note: string | null
          organization_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_working?: boolean
          note?: string | null
          organization_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_working?: boolean
          note?: string | null
          organization_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_exceptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_exceptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_entries: {
        Row: {
          actual: number
          budget: number
          category: Database["public"]["Enums"]["cost_category"]
          committed: number
          cost_code: string | null
          created_at: string
          description: string | null
          entry_date: string
          external_id: string | null
          id: string
          organization_id: string
          project_id: string
          source: string
          supplier: string | null
        }
        Insert: {
          actual?: number
          budget?: number
          category?: Database["public"]["Enums"]["cost_category"]
          committed?: number
          cost_code?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          external_id?: string | null
          id?: string
          organization_id: string
          project_id: string
          source?: string
          supplier?: string | null
        }
        Update: {
          actual?: number
          budget?: number
          category?: Database["public"]["Enums"]["cost_category"]
          committed?: number
          cost_code?: string | null
          created_at?: string
          description?: string | null
          entry_date?: string
          external_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          source?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_report_entries: {
        Row: {
          created_at: string
          daily_report_id: string
          description: string
          id: string
          organization_id: string
          quantity: number | null
          task_id: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string
          daily_report_id: string
          description: string
          id?: string
          organization_id: string
          quantity?: number | null
          task_id?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string
          daily_report_id?: string
          description?: string
          id?: string
          organization_id?: string
          quantity?: number | null
          task_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_report_entries_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_report_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          ai_summary: string | null
          author_id: string | null
          created_at: string
          hours: number
          id: string
          organization_id: string
          progress_note: string | null
          project_id: string
          report_date: string
          status: Database["public"]["Enums"]["report_status"]
          summary: string | null
          updated_at: string
          weather: string | null
          workforce: number
        }
        Insert: {
          ai_summary?: string | null
          author_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          organization_id: string
          progress_note?: string | null
          project_id: string
          report_date?: string
          status?: Database["public"]["Enums"]["report_status"]
          summary?: string | null
          updated_at?: string
          weather?: string | null
          workforce?: number
        }
        Update: {
          ai_summary?: string | null
          author_id?: string | null
          created_at?: string
          hours?: number
          id?: string
          organization_id?: string
          progress_note?: string | null
          project_id?: string
          report_date?: string
          status?: Database["public"]["Enums"]["report_status"]
          summary?: string | null
          updated_at?: string
          weather?: string | null
          workforce?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      fatsat_points: {
        Row: {
          actual_result: string | null
          created_at: string
          description: string
          expected_result: string | null
          id: string
          notes: string | null
          organization_id: string
          protocol_id: string
          result: Database["public"]["Enums"]["fatsat_result"]
          section: string | null
          sort_order: number
        }
        Insert: {
          actual_result?: string | null
          created_at?: string
          description?: string
          expected_result?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          protocol_id: string
          result?: Database["public"]["Enums"]["fatsat_result"]
          section?: string | null
          sort_order?: number
        }
        Update: {
          actual_result?: string | null
          created_at?: string
          description?: string
          expected_result?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          protocol_id?: string
          result?: Database["public"]["Enums"]["fatsat_result"]
          section?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatsat_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatsat_points_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "fatsat_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      fatsat_protocols: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          approved_by_role: string | null
          code: string | null
          created_at: string
          equipment_item_id: string | null
          equipment_name: string | null
          executed_at: string | null
          executed_by_name: string | null
          executed_by_role: string | null
          id: string
          location: string | null
          name: string | null
          notes: string | null
          organization_id: string
          project_id: string
          protocol_date: string
          status: Database["public"]["Enums"]["fatsat_status"]
          tag: string | null
          type: Database["public"]["Enums"]["fatsat_type"]
          updated_at: string
          witness_at: string | null
          witness_by_name: string | null
          witness_by_role: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_role?: string | null
          code?: string | null
          created_at?: string
          equipment_item_id?: string | null
          equipment_name?: string | null
          executed_at?: string | null
          executed_by_name?: string | null
          executed_by_role?: string | null
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          organization_id: string
          project_id: string
          protocol_date?: string
          status?: Database["public"]["Enums"]["fatsat_status"]
          tag?: string | null
          type?: Database["public"]["Enums"]["fatsat_type"]
          updated_at?: string
          witness_at?: string | null
          witness_by_name?: string | null
          witness_by_role?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_role?: string | null
          code?: string | null
          created_at?: string
          equipment_item_id?: string | null
          equipment_name?: string | null
          executed_at?: string | null
          executed_by_name?: string | null
          executed_by_role?: string | null
          id?: string
          location?: string | null
          name?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string
          protocol_date?: string
          status?: Database["public"]["Enums"]["fatsat_status"]
          tag?: string | null
          type?: Database["public"]["Enums"]["fatsat_type"]
          updated_at?: string
          witness_at?: string | null
          witness_by_name?: string | null
          witness_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fatsat_protocols_equipment_item_id_fkey"
            columns: ["equipment_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatsat_protocols_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatsat_protocols_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          barcode: string | null
          brand_model: string | null
          category: Database["public"]["Enums"]["inventory_category"]
          created_at: string
          description: string
          equipment_name: string | null
          id: string
          ilo_license: string | null
          ilo_password: string | null
          ilo_user: string | null
          location: Database["public"]["Enums"]["inventory_location"]
          notes: string | null
          organization_id: string
          product_number: string | null
          project_id: string
          quantity: number
          rack_position: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          supplier: string | null
          task_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_model?: string | null
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          description: string
          equipment_name?: string | null
          id?: string
          ilo_license?: string | null
          ilo_password?: string | null
          ilo_user?: string | null
          location?: Database["public"]["Enums"]["inventory_location"]
          notes?: string | null
          organization_id: string
          product_number?: string | null
          project_id: string
          quantity?: number
          rack_position?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          supplier?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_model?: string | null
          category?: Database["public"]["Enums"]["inventory_category"]
          created_at?: string
          description?: string
          equipment_name?: string | null
          id?: string
          ilo_license?: string | null
          ilo_password?: string | null
          ilo_user?: string | null
          location?: Database["public"]["Enums"]["inventory_location"]
          notes?: string | null
          organization_id?: string
          product_number?: string | null
          project_id?: string
          quantity?: number
          rack_position?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          supplier?: string | null
          task_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          billable: boolean
          billing_currency: string
          brand_accent: string | null
          brand_dark: string | null
          brand_primary: string | null
          company_tax_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          export_credit: boolean
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          price_per_seat: number
          report_footer: string | null
          seat_limit: number | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billable?: boolean
          billing_currency?: string
          brand_accent?: string | null
          brand_dark?: string | null
          brand_primary?: string | null
          company_tax_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          export_credit?: boolean
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          price_per_seat?: number
          report_footer?: string | null
          seat_limit?: number | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billable?: boolean
          billing_currency?: string
          brand_accent?: string | null
          brand_dark?: string | null
          brand_primary?: string | null
          company_tax_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          export_credit?: boolean
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          price_per_seat?: number
          report_footer?: string | null
          seat_limit?: number | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      progress_snapshots: {
        Row: {
          actual_cost: number | null
          actual_pct: number | null
          created_at: string
          earned_value: number | null
          id: string
          organization_id: string
          planned_pct: number
          planned_value: number
          project_id: string
          snapshot_date: string
        }
        Insert: {
          actual_cost?: number | null
          actual_pct?: number | null
          created_at?: string
          earned_value?: number | null
          id?: string
          organization_id: string
          planned_pct?: number
          planned_value?: number
          project_id: string
          snapshot_date: string
        }
        Update: {
          actual_cost?: number | null
          actual_pct?: number | null
          created_at?: string
          earned_value?: number | null
          id?: string
          organization_id?: string
          planned_pct?: number
          planned_value?: number
          project_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          baseline_set_at: string | null
          budget: number
          client_name: string | null
          code: string | null
          created_at: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          name: string
          organization_id: string
          pm_user_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workdays: number[]
        }
        Insert: {
          baseline_set_at?: string | null
          budget?: number
          client_name?: string | null
          code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name: string
          organization_id: string
          pm_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workdays?: number[]
        }
        Update: {
          baseline_set_at?: string | null
          budget?: number
          client_name?: string | null
          code?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          pm_user_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      punch_items: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["punch_priority"]
          project_id: string
          resolved_at: string | null
          responsible: string | null
          status: Database["public"]["Enums"]["punch_status"]
        }
        Insert: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["punch_priority"]
          project_id: string
          resolved_at?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["punch_priority"]
          project_id?: string
          resolved_at?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
        }
        Relationships: [
          {
            foreignKeyName: "punch_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punch_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_analyses: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          scope_doc_id: string | null
          status: string
          system_id: string
          system_type: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          scope_doc_id?: string | null
          status?: string
          system_id: string
          system_type: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          scope_doc_id?: string | null
          status?: string
          system_id?: string
          system_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_analysis_system"
            columns: ["system_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_systems"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_analyses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_analyses_scope_doc_id_fkey"
            columns: ["scope_doc_id"]
            isOneToOne: false
            referencedRelation: "takeoff_scope_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_cable_params: {
        Row: {
          analysis_id: string | null
          cable_type: string
          computed_length_m: number | null
          id: string
          mounting_height_m: number
          organization_id: string
          slack_pct: number
        }
        Insert: {
          analysis_id?: string | null
          cable_type: string
          computed_length_m?: number | null
          id?: string
          mounting_height_m?: number
          organization_id: string
          slack_pct?: number
        }
        Update: {
          analysis_id?: string | null
          cable_type?: string
          computed_length_m?: number | null
          id?: string
          mounting_height_m?: number
          organization_id?: string
          slack_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_cable_analysis"
            columns: ["analysis_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_analyses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_cable_params_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_calibration: {
        Row: {
          id: string
          notes: string | null
          organization_id: string | null
          params: Json
          scope: string
          system_type: string
          updated_at: string
        }
        Insert: {
          id?: string
          notes?: string | null
          organization_id?: string | null
          params?: Json
          scope?: string
          system_type: string
          updated_at?: string
        }
        Update: {
          id?: string
          notes?: string | null
          organization_id?: string | null
          params?: Json
          scope?: string
          system_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_calibration_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_correction_events: {
        Row: {
          action: string
          batch_id: string | null
          created_at: string
          created_by: string | null
          detection_id: string | null
          from_key: string | null
          id: string
          organization_id: string
          sheet_id: string
          signature: Json | null
          to_key: string | null
        }
        Insert: {
          action: string
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          detection_id?: string | null
          from_key?: string | null
          id?: string
          organization_id: string
          sheet_id: string
          signature?: Json | null
          to_key?: string | null
        }
        Update: {
          action?: string
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          detection_id?: string | null
          from_key?: string | null
          id?: string
          organization_id?: string
          sheet_id?: string
          signature?: Json | null
          to_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_corr_sheet"
            columns: ["sheet_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_sheets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_correction_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_detections: {
        Row: {
          confidence: string
          element_key: string
          id: string
          method: string | null
          organization_id: string
          original_key: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sheet_id: string
          signature: Json | null
          status: string
          x: number
          y: number
        }
        Insert: {
          confidence: string
          element_key: string
          id?: string
          method?: string | null
          organization_id: string
          original_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sheet_id: string
          signature?: Json | null
          status?: string
          x: number
          y: number
        }
        Update: {
          confidence?: string
          element_key?: string
          id?: string
          method?: string | null
          organization_id?: string
          original_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sheet_id?: string
          signature?: Json | null
          status?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_detection_sheet"
            columns: ["sheet_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_sheets"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_detections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_org_settings: {
        Row: {
          organization_id: string
          share_learning: boolean
          updated_at: string
          use_global_library: boolean
        }
        Insert: {
          organization_id: string
          share_learning?: boolean
          updated_at?: string
          use_global_library?: boolean
        }
        Update: {
          organization_id?: string
          share_learning?: boolean
          updated_at?: string
          use_global_library?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_org_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_results: {
        Row: {
          analysis_id: string
          cost_item_id: string | null
          element_key: string
          element_name: string
          id: string
          organization_id: string
          qty_detected: number
          qty_final: number
          unit: string
        }
        Insert: {
          analysis_id: string
          cost_item_id?: string | null
          element_key: string
          element_name: string
          id?: string
          organization_id: string
          qty_detected: number
          qty_final: number
          unit?: string
        }
        Update: {
          analysis_id?: string
          cost_item_id?: string | null
          element_key?: string
          element_name?: string
          id?: string
          organization_id?: string
          qty_detected?: number
          qty_final?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_result_analysis"
            columns: ["analysis_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_analyses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_results_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_results_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_scope_docs: {
        Row: {
          analyzed_at: string | null
          contracting_entity: string | null
          created_at: string
          created_by: string | null
          doc_name: string
          executive_summary: string | null
          file_hash: string
          id: string
          job_state: Json | null
          location: string | null
          organization_id: string
          page_count: number | null
          pdf_path: string | null
          progress: string | null
          project_id: string
          project_title: string | null
          status: string
          tender_ref: string | null
        }
        Insert: {
          analyzed_at?: string | null
          contracting_entity?: string | null
          created_at?: string
          created_by?: string | null
          doc_name: string
          executive_summary?: string | null
          file_hash: string
          id?: string
          job_state?: Json | null
          location?: string | null
          organization_id: string
          page_count?: number | null
          pdf_path?: string | null
          progress?: string | null
          project_id: string
          project_title?: string | null
          status?: string
          tender_ref?: string | null
        }
        Update: {
          analyzed_at?: string | null
          contracting_entity?: string | null
          created_at?: string
          created_by?: string | null
          doc_name?: string
          executive_summary?: string | null
          file_hash?: string
          id?: string
          job_state?: Json | null
          location?: string | null
          organization_id?: string
          page_count?: number | null
          pdf_path?: string | null
          progress?: string | null
          project_id?: string
          project_title?: string | null
          status?: string
          tender_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scope_doc_project"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_scope_docs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_scope_items: {
        Row: {
          category: string
          cost_impact: boolean
          cost_item_id: string | null
          description: string
          id: string
          manufacturer: string | null
          model: string | null
          organization_id: string
          page_ref: string | null
          qty_specified: number | null
          quote: string | null
          scope_doc_id: string
          severity: string | null
          system_type: string | null
        }
        Insert: {
          category: string
          cost_impact?: boolean
          cost_item_id?: string | null
          description: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          organization_id: string
          page_ref?: string | null
          qty_specified?: number | null
          quote?: string | null
          scope_doc_id: string
          severity?: string | null
          system_type?: string | null
        }
        Update: {
          category?: string
          cost_impact?: boolean
          cost_item_id?: string | null
          description?: string
          id?: string
          manufacturer?: string | null
          model?: string | null
          organization_id?: string
          page_ref?: string | null
          qty_specified?: number | null
          quote?: string | null
          scope_doc_id?: string
          severity?: string | null
          system_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_scope_item_doc"
            columns: ["scope_doc_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_scope_docs"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_scope_items_cost_item_id_fkey"
            columns: ["cost_item_id"]
            isOneToOne: false
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "takeoff_scope_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_scope_status: {
        Row: {
          declared_at: string | null
          declared_by: string | null
          organization_id: string
          project_id: string
          status: string
        }
        Insert: {
          declared_at?: string | null
          declared_by?: string | null
          organization_id: string
          project_id: string
          status?: string
        }
        Update: {
          declared_at?: string | null
          declared_by?: string | null
          organization_id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_scope_status_project"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_scope_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_sheets: {
        Row: {
          analysis_id: string
          candidates: Json | null
          error_detail: string | null
          file_hash: string
          file_name: string | null
          id: string
          is_vector: boolean | null
          job_error: string | null
          legend: Json | null
          organization_id: string
          page_count: number
          page_height: number | null
          page_width: number | null
          pdf_path: string | null
          processed_at: string | null
          scale_text: string | null
          sheet_number: string
          sheet_title: string | null
          snapshot_path: string | null
          stats: Json | null
          status: string
        }
        Insert: {
          analysis_id: string
          candidates?: Json | null
          error_detail?: string | null
          file_hash: string
          file_name?: string | null
          id?: string
          is_vector?: boolean | null
          job_error?: string | null
          legend?: Json | null
          organization_id: string
          page_count?: number
          page_height?: number | null
          page_width?: number | null
          pdf_path?: string | null
          processed_at?: string | null
          scale_text?: string | null
          sheet_number: string
          sheet_title?: string | null
          snapshot_path?: string | null
          stats?: Json | null
          status?: string
        }
        Update: {
          analysis_id?: string
          candidates?: Json | null
          error_detail?: string | null
          file_hash?: string
          file_name?: string | null
          id?: string
          is_vector?: boolean | null
          job_error?: string | null
          legend?: Json | null
          organization_id?: string
          page_count?: number
          page_height?: number | null
          page_width?: number | null
          pdf_path?: string | null
          processed_at?: string | null
          scale_text?: string | null
          sheet_number?: string
          sheet_title?: string | null
          snapshot_path?: string | null
          stats?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sheet_analysis"
            columns: ["analysis_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "takeoff_analyses"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_sheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_symbol_library: {
        Row: {
          created_at: string
          element_key: string
          element_name: string
          id: string
          organization_id: string | null
          promoted_at: string | null
          promoted_from: string | null
          sample_png: string | null
          scope: string
          sig_key: string | null
          signature: Json
          source_firm: string | null
          system_type: string
          times_confirmed: number
          times_corrected: number
        }
        Insert: {
          created_at?: string
          element_key: string
          element_name: string
          id?: string
          organization_id?: string | null
          promoted_at?: string | null
          promoted_from?: string | null
          sample_png?: string | null
          scope?: string
          sig_key?: string | null
          signature: Json
          source_firm?: string | null
          system_type: string
          times_confirmed?: number
          times_corrected?: number
        }
        Update: {
          created_at?: string
          element_key?: string
          element_name?: string
          id?: string
          organization_id?: string | null
          promoted_at?: string | null
          promoted_from?: string | null
          sample_png?: string | null
          scope?: string
          sig_key?: string | null
          signature?: Json
          source_firm?: string | null
          system_type?: string
          times_confirmed?: number
          times_corrected?: number
        }
        Relationships: [
          {
            foreignKeyName: "takeoff_symbol_library_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      takeoff_systems: {
        Row: {
          created_at: string
          display_name: string
          id: string
          legend: Json | null
          organization_id: string
          project_id: string
          sort_order: number
          source: string
          system_type: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          legend?: Json | null
          organization_id: string
          project_id: string
          sort_order?: number
          source?: string
          system_type: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          legend?: Json | null
          organization_id?: string
          project_id?: string
          sort_order?: number
          source?: string
          system_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_system_project"
            columns: ["project_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "takeoff_systems_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          dep_type: string
          id: string
          organization_id: string
          predecessor_id: string
          project_id: string
          successor_id: string
        }
        Insert: {
          created_at?: string
          dep_type?: string
          id?: string
          organization_id: string
          predecessor_id: string
          project_id: string
          successor_id: string
        }
        Update: {
          created_at?: string
          dep_type?: string
          id?: string
          organization_id?: string
          predecessor_id?: string
          project_id?: string
          successor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_predecessor_id_fkey"
            columns: ["predecessor_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_successor_id_fkey"
            columns: ["successor_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assignee_id: string | null
          baseline_end: string | null
          baseline_start: string | null
          created_at: string
          duration_days: number | null
          id: string
          is_milestone: boolean
          name: string
          organization_id: string
          parent_id: string | null
          planned_cost: number
          planned_end: string | null
          planned_start: string | null
          progress: number
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          updated_at: string
          wbs: string | null
          weight: number
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assignee_id?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string
          duration_days?: number | null
          id?: string
          is_milestone?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          planned_cost?: number
          planned_end?: string | null
          planned_start?: string | null
          progress?: number
          project_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          wbs?: string | null
          weight?: number
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assignee_id?: string | null
          baseline_end?: string | null
          baseline_start?: string | null
          created_at?: string
          duration_days?: number | null
          id?: string
          is_milestone?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          planned_cost?: number
          planned_end?: string | null
          planned_start?: string | null
          progress?: number
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          updated_at?: string
          wbs?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_org_ai_key: { Args: { p_org: string }; Returns: undefined }
      cost_summary: {
        Args: { p_project_id: string }
        Returns: {
          actual: number
          budget: number
          category: Database["public"]["Enums"]["cost_category"]
          committed: number
          n: number
        }[]
      }
      get_org_ai_key: { Args: { p_org: string }; Returns: string }
      has_org_role: {
        Args: { org: string; roles: Database["public"]["Enums"]["org_role"][] }
        Returns: boolean
      }
      fatsat_clone_protocols: {
        Args: { p_source: string; p_target: string }
        Returns: number
      }
      import_cost_entries: {
        Args: { p_project_id: string; p_rows: Json }
        Returns: number
      }
      inventory_mark_spare: {
        Args: { p_project: string; p_description: string; p_product: string; p_qty: number }
        Returns: undefined
      }
      inventory_use_spare: {
        Args: {
          p_project: string
          p_description: string
          p_product: string
          p_qty: number
          p_note?: string
        }
        Returns: undefined
      }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      save_report_entries: {
        Args: { p_entries: Json; p_report_id: string }
        Returns: undefined
      }
      set_baseline: { Args: { p_project_id: string }; Returns: undefined }
      set_org_ai_key: {
        Args: { p_key: string; p_org: string }
        Returns: undefined
      }
    }
    Enums: {
      ai_provider: "anthropic" | "openai" | "google"
      cost_category:
        | "labor"
        | "material"
        | "equipment"
        | "subcontract"
        | "other"
      fatsat_result: "pending" | "pass" | "fail" | "na"
      fatsat_status:
        | "draft"
        | "in_progress"
        | "approved"
        | "approved_with_observations"
        | "rejected"
      fatsat_type: "fat" | "sat"
      inventory_category:
        | "equipo"
        | "material"
        | "cable"
        | "repuesto"
        | "consumible"
      inventory_location: "en_proyecto" | "en_galera"
      inventory_status:
        | "por_recibir"
        | "instalado"
        | "faltante"
        | "defectuoso"
        | "spare"
      org_role: "owner" | "admin" | "project_manager" | "member" | "viewer"
      project_status:
        | "planning"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      punch_priority: "low" | "medium" | "high"
      punch_status: "open" | "in_progress" | "done"
      report_status: "draft" | "submitted" | "approved"
      task_status: "not_started" | "in_progress" | "completed" | "delayed"
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
      ai_provider: ["anthropic", "openai", "google"],
      cost_category: ["labor", "material", "equipment", "subcontract", "other"],
      fatsat_result: ["pending", "pass", "fail", "na"],
      fatsat_status: [
        "draft",
        "in_progress",
        "approved",
        "approved_with_observations",
        "rejected",
      ],
      fatsat_type: ["fat", "sat"],
      inventory_category: [
        "equipo",
        "material",
        "cable",
        "repuesto",
        "consumible",
      ],
      inventory_location: ["en_proyecto", "en_galera"],
      inventory_status: ["por_recibir", "instalado", "faltante", "defectuoso", "spare"],
      org_role: ["owner", "admin", "project_manager", "member", "viewer"],
      project_status: [
        "planning",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      punch_priority: ["low", "medium", "high"],
      punch_status: ["open", "in_progress", "done"],
      report_status: ["draft", "submitted", "approved"],
      task_status: ["not_started", "in_progress", "completed", "delayed"],
    },
  },
} as const
