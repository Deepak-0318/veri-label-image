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
      activity_events: {
        Row: {
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      annotation_flags: {
        Row: {
          annotation_id: string
          created_at: string
          flag_id: string
          id: string
        }
        Insert: {
          annotation_id: string
          created_at?: string
          flag_id: string
          id?: string
        }
        Update: {
          annotation_id?: string
          created_at?: string
          flag_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_flags_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_flags_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "project_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_variable_values: {
        Row: {
          annotation_id: string
          created_at: string
          id: string
          updated_at: string
          value: Json | null
          variable_id: string
        }
        Insert: {
          annotation_id: string
          created_at?: string
          id?: string
          updated_at?: string
          value?: Json | null
          variable_id: string
        }
        Update: {
          annotation_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          value?: Json | null
          variable_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_variable_values_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_variable_values_variable_id_fkey"
            columns: ["variable_id"]
            isOneToOne: false
            referencedRelation: "project_variables"
            referencedColumns: ["id"]
          },
        ]
      }
      annotations: {
        Row: {
          color: string
          comment: string | null
          created_at: string
          data: Json
          file_id: string
          group_type_id: string | null
          id: string
          label: string
          label_type_id: string | null
          project_id: string | null
          qc_comment: string | null
          qc_status: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          comment?: string | null
          created_at?: string
          data: Json
          file_id: string
          group_type_id?: string | null
          id?: string
          label: string
          label_type_id?: string | null
          project_id?: string | null
          qc_comment?: string | null
          qc_status?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          comment?: string | null
          created_at?: string
          data?: Json
          file_id?: string
          group_type_id?: string | null
          id?: string
          label?: string
          label_type_id?: string | null
          project_id?: string | null
          qc_comment?: string | null
          qc_status?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_group_type_id_fkey"
            columns: ["group_type_id"]
            isOneToOne: false
            referencedRelation: "project_group_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_label_type_id_fkey"
            columns: ["label_type_id"]
            isOneToOne: false
            referencedRelation: "project_label_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          description: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          category?: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_files: {
        Row: {
          created_at: string
          dataset_id: string
          file_id: string
          id: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          file_id: string
          id?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          file_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_files_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dataset_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "datasets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          annotation_count: number
          created_at: string
          download_url: string | null
          file_count: number
          format: string
          id: string
          name: string
          status: string
          user_id: string
        }
        Insert: {
          annotation_count?: number
          created_at?: string
          download_url?: string | null
          file_count?: number
          format?: string
          id?: string
          name: string
          status?: string
          user_id: string
        }
        Update: {
          annotation_count?: number
          created_at?: string
          download_url?: string | null
          file_count?: number
          format?: string
          id?: string
          name?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          content: string | null
          created_at: string
          external_url: string | null
          folder: string | null
          id: string
          name: string
          project_id: string | null
          size: number | null
          storage_mode: string
          thumbnail_url: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          external_url?: string | null
          folder?: string | null
          id?: string
          name: string
          project_id?: string | null
          size?: number | null
          storage_mode?: string
          thumbnail_url?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          external_url?: string | null
          folder?: string | null
          id?: string
          name?: string
          project_id?: string | null
          size?: number | null
          storage_mode?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
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
      organization_project_mapping: {
        Row: {
          id: string
          org_id: string
          project_id: string
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_project_org_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_project_project_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_block_templates: {
        Row: {
          block_type: string
          category: string
          created_at: string
          created_by: string | null
          default_config: Json
          description: string | null
          icon: string
          id: string
          is_system: boolean
          language: string
          name: string
          script: string | null
          updated_at: string
        }
        Insert: {
          block_type?: string
          category?: string
          created_at?: string
          created_by?: string | null
          default_config?: Json
          description?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          language?: string
          name: string
          script?: string | null
          updated_at?: string
        }
        Update: {
          block_type?: string
          category?: string
          created_at?: string
          created_by?: string | null
          default_config?: Json
          description?: string | null
          icon?: string
          id?: string
          is_system?: boolean
          language?: string
          name?: string
          script?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          completed_at: string | null
          completed_items: number
          created_at: string
          error_message: string | null
          id: string
          pipeline_id: string
          progress: number
          project_id: string | null
          started_at: string
          started_by: string
          status: string
          total_items: number
        }
        Insert: {
          completed_at?: string | null
          completed_items?: number
          created_at?: string
          error_message?: string | null
          id?: string
          pipeline_id: string
          progress?: number
          project_id?: string | null
          started_at?: string
          started_by: string
          status?: string
          total_items?: number
        }
        Update: {
          completed_at?: string | null
          completed_items?: number
          created_at?: string
          error_message?: string | null
          id?: string
          pipeline_id?: string
          progress?: number
          project_id?: string | null
          started_at?: string
          started_by?: string
          status?: string
          total_items?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_runs_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          config: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          pipeline_type: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          pipeline_type?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          pipeline_type?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_flags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_group_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_default: boolean
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_group_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_label_types: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_label_types_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_labels: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          label_type_id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          label_type_id: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          label_type_id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_labels_label_type_id_fkey"
            columns: ["label_type_id"]
            isOneToOne: false
            referencedRelation: "project_label_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_labels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          objective_type: string
          project_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          objective_type?: string
          project_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          objective_type?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_objectives_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_variables: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          id: string
          is_required: boolean
          max_value: number | null
          min_value: number | null
          name: string
          options: Json
          project_id: string
          updated_at: string
          variable_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          id?: string
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          name: string
          options?: Json
          project_id: string
          updated_at?: string
          variable_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          id?: string
          is_required?: boolean
          max_value?: number | null
          min_value?: number | null
          name?: string
          options?: Json
          project_id?: string
          updated_at?: string
          variable_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_variables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          annotation_type: string
          created_at: string
          data_type: string
          description: string | null
          guidelines: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annotation_type?: string
          created_at?: string
          data_type?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annotation_type?: string
          created_at?: string
          data_type?: string
          description?: string | null
          guidelines?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string
          end_offset: number | null
          end_time: number | null
          file_id: string
          id: string
          label: string | null
          layer: string
          metadata: Json | null
          start_offset: number | null
          start_time: number | null
        }
        Insert: {
          created_at?: string
          end_offset?: number | null
          end_time?: number | null
          file_id: string
          id?: string
          label?: string | null
          layer?: string
          metadata?: Json | null
          start_offset?: number | null
          start_time?: number | null
        }
        Update: {
          created_at?: string
          end_offset?: number | null
          end_time?: number | null
          file_id?: string
          id?: string
          label?: string | null
          layer?: string
          metadata?: Json | null
          start_offset?: number | null
          start_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "segments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_tasks: {
        Row: {
          created_at: string
          file_id: string
          id: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_tasks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_items: number
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          project_id: string
          qa_assigned_to: string | null
          qa_status: string | null
          status: string
          total_items: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_items?: number
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          qa_assigned_to?: string | null
          qa_status?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_items?: number
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          qa_assigned_to?: string | null
          qa_status?: string | null
          status?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transform_scripts: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          output_format: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          output_format?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          output_format?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_id_map: {
        Row: {
          dev_uid: string | null
          email: string | null
          main_uid: string | null
        }
        Insert: {
          dev_uid?: string | null
          email?: string | null
          main_uid?: string | null
        }
        Update: {
          dev_uid?: string | null
          email?: string | null
          main_uid?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_all: { Args: never; Returns: undefined }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "annotator" | "qc"
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
      app_role: ["admin", "manager", "annotator", "qc"],
    },
  },
} as const
