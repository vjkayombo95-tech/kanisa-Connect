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
      addons: {
        Row: {
          addon_name: string
          church_id: string
          created_at: string
          id: string
          purchased: boolean
          purchased_at: string | null
          updated_at: string
        }
        Insert: {
          addon_name: string
          church_id: string
          created_at?: string
          id?: string
          purchased?: boolean
          purchased_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_name?: string
          church_id?: string
          created_at?: string
          id?: string
          purchased?: boolean
          purchased_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addons_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          church_id: string
          generated_at: string
          generated_by: string | null
          id: string
          payload: Json
          period_end: string
          period_start: string
          snapshot_type: string
        }
        Insert: {
          church_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          period_end: string
          period_start: string
          snapshot_type?: string
        }
        Update: {
          church_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          payload?: Json
          period_end?: string
          period_start?: string
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          archived_at: string | null
          audience: string[]
          category: string
          church_id: string | null
          content: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          featured: boolean
          id: string
          is_published: boolean | null
          lifecycle_metadata: Json
          never_expires: boolean
          notification_strategy: string
          publish_at: string | null
          published_at: string | null
          show_on_calendar: boolean
          status: string
          target_community: string | null
          target_ministry: string | null
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          audience?: string[]
          category?: string
          church_id?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean | null
          lifecycle_metadata?: Json
          never_expires?: boolean
          notification_strategy?: string
          publish_at?: string | null
          published_at?: string | null
          show_on_calendar?: boolean
          status?: string
          target_community?: string | null
          target_ministry?: string | null
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          audience?: string[]
          category?: string
          church_id?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean | null
          lifecycle_metadata?: Json
          never_expires?: boolean
          notification_strategy?: string
          publish_at?: string | null
          published_at?: string | null
          show_on_calendar?: boolean
          status?: string
          target_community?: string | null
          target_ministry?: string | null
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_error_logs: {
        Row: {
          browser_info: string | null
          church_id: string | null
          component: string | null
          created_at: string
          function_name: string | null
          id: string
          level: string
          message: string
          metadata: Json
          occurrence_count: number
          page: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          stack: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          browser_info?: string | null
          church_id?: string | null
          component?: string | null
          created_at?: string
          function_name?: string | null
          id?: string
          level: string
          message: string
          metadata?: Json
          occurrence_count?: number
          page?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          stack?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          browser_info?: string | null
          church_id?: string | null
          component?: string | null
          created_at?: string
          function_name?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json
          occurrence_count?: number
          page?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          route?: string | null
          stack?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_error_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_assets: {
        Row: {
          asset_type: string
          audio_url: string | null
          checksum_sha256: string | null
          church_id: string
          completed_at: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_size: number | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          public_url: string | null
          report_url: string | null
          started_at: string | null
          status: string
          storage_bucket: string
          storage_path: string
          text_url: string | null
          updated_at: string
        }
        Insert: {
          asset_type: string
          audio_url?: string | null
          checksum_sha256?: string | null
          church_id: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          index_url?: string | null
          job_id: string
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          public_url?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          storage_bucket: string
          storage_path: string
          text_url?: string | null
          updated_at?: string
        }
        Update: {
          asset_type?: string
          audio_url?: string | null
          checksum_sha256?: string | null
          church_id?: string
          completed_at?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          index_url?: string | null
          job_id?: string
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          public_url?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          text_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_assets_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_assets_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_bookmarks: {
        Row: {
          church_id: string
          content_id: string
          created_at: string
          id: string
          label: string | null
          metadata: Json
          note: string | null
          position_seconds: number
          track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id: string
          content_id: string
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          note?: string | null
          position_seconds: number
          track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string
          content_id?: string
          created_at?: string
          id?: string
          label?: string | null
          metadata?: Json
          note?: string | null
          position_seconds?: number
          track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_bookmarks_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_bookmarks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "audio_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_bookmarks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_content: {
        Row: {
          church_id: string
          content_type: string
          created_at: string
          created_by: string | null
          description: string | null
          external_ref: string | null
          id: string
          image_url: string | null
          language_code: string
          metadata: Json
          published_at: string | null
          source_id: string | null
          source_table: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          church_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_ref?: string | null
          id?: string
          image_url?: string | null
          language_code?: string
          metadata?: Json
          published_at?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          church_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          external_ref?: string | null
          id?: string
          image_url?: string | null
          language_code?: string
          metadata?: Json
          published_at?: string | null
          source_id?: string | null
          source_table?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_content_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_history: {
        Row: {
          church_id: string
          content_id: string
          created_at: string
          duration_seconds: number | null
          event_type: string
          id: string
          metadata: Json
          position_seconds: number
          session_id: string | null
          track_id: string | null
          user_id: string
        }
        Insert: {
          church_id: string
          content_id: string
          created_at?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          metadata?: Json
          position_seconds?: number
          session_id?: string | null
          track_id?: string | null
          user_id: string
        }
        Update: {
          church_id?: string
          content_id?: string
          created_at?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          metadata?: Json
          position_seconds?: number
          session_id?: string | null
          track_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_history_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "audio_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_history_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_job_logs: {
        Row: {
          church_id: string
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
          metadata: Json
          stage: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
          metadata?: Json
          stage: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
          metadata?: Json
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_job_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_job_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_jobs: {
        Row: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          book: string
          cancelled_at?: string | null
          chapter: number
          church_id: string
          completed_at?: string | null
          content_type: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          index_url?: string | null
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          published_at?: string | null
          published_by?: string | null
          queued_at?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          book?: string
          cancelled_at?: string | null
          chapter?: number
          church_id?: string
          completed_at?: string | null
          content_type?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          index_url?: string | null
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          published_at?: string | null
          published_by?: string | null
          queued_at?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_jobs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_progress: {
        Row: {
          church_id: string
          completed: boolean
          completed_at: string | null
          content_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          last_played_at: string
          metadata: Json
          position_seconds: number
          track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id: string
          completed?: boolean
          completed_at?: string | null
          content_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_played_at?: string
          metadata?: Json
          position_seconds?: number
          track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string
          completed?: boolean
          completed_at?: string | null
          content_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_played_at?: string
          metadata?: Json
          position_seconds?: number
          track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_progress_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "audio_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_progress_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_review_audit: {
        Row: {
          action: string
          church_id: string
          created_at: string
          id: string
          job_id: string
          new_values: Json
          previous_values: Json
          reason: string | null
          review_id: string | null
          reviewer_id: string | null
          verse_review_id: string | null
        }
        Insert: {
          action: string
          church_id: string
          created_at?: string
          id?: string
          job_id: string
          new_values?: Json
          previous_values?: Json
          reason?: string | null
          review_id?: string | null
          reviewer_id?: string | null
          verse_review_id?: string | null
        }
        Update: {
          action?: string
          church_id?: string
          created_at?: string
          id?: string
          job_id?: string
          new_values?: Json
          previous_values?: Json
          reason?: string | null
          review_id?: string | null
          reviewer_id?: string | null
          verse_review_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_review_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_review_audit_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_review_audit_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "audio_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_review_audit_verse_review_id_fkey"
            columns: ["verse_review_id"]
            isOneToOne: false
            referencedRelation: "audio_verse_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_reviews: {
        Row: {
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          notes: string | null
          processing_stage: string
          progress: number
          report_url: string | null
          reviewer_id: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          church_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          index_url?: string | null
          job_id: string
          manifest_url?: string | null
          notes?: string | null
          processing_stage?: string
          progress?: number
          report_url?: string | null
          reviewer_id?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          church_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          index_url?: string | null
          job_id?: string
          manifest_url?: string | null
          notes?: string | null
          processing_stage?: string
          progress?: number
          report_url?: string | null
          reviewer_id?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_reviews_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_tracks: {
        Row: {
          alignment_path: string | null
          church_id: string
          content_id: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          index_path: string | null
          metadata: Json
          mime_type: string | null
          published_at: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          stream_url: string | null
          subtitle: string | null
          title: string
          track_number: number
          transcript_path: string | null
          updated_at: string
        }
        Insert: {
          alignment_path?: string | null
          church_id: string
          content_id: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          index_path?: string | null
          metadata?: Json
          mime_type?: string | null
          published_at?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          stream_url?: string | null
          subtitle?: string | null
          title: string
          track_number?: number
          transcript_path?: string | null
          updated_at?: string
        }
        Update: {
          alignment_path?: string | null
          church_id?: string
          content_id?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          index_path?: string | null
          metadata?: Json
          mime_type?: string | null
          published_at?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          stream_url?: string | null
          subtitle?: string | null
          title?: string
          track_number?: number
          transcript_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_tracks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "audio_content"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_verse_reviews: {
        Row: {
          church_id: string
          confidence: number
          created_at: string
          created_by: string | null
          duration: number
          end_time: number
          id: string
          job_id: string
          manually_edited: boolean
          notes: string | null
          review_id: string | null
          start_time: number
          status: string
          updated_at: string
          updated_by: string | null
          verse_number: number
          verse_text: string
        }
        Insert: {
          church_id: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          duration?: number
          end_time?: number
          id?: string
          job_id: string
          manually_edited?: boolean
          notes?: string | null
          review_id?: string | null
          start_time?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          verse_number: number
          verse_text?: string
        }
        Update: {
          church_id?: string
          confidence?: number
          created_at?: string
          created_by?: string | null
          duration?: number
          end_time?: number
          id?: string
          job_id?: string
          manually_edited?: boolean
          notes?: string | null
          review_id?: string | null
          start_time?: number
          status?: string
          updated_at?: string
          updated_by?: string | null
          verse_number?: number
          verse_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_verse_reviews_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_verse_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_verse_reviews_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "audio_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_version_verses: {
        Row: {
          church_id: string
          confidence: number
          created_at: string
          duration: number
          end_time: number
          id: string
          job_id: string
          manually_edited: boolean
          notes: string | null
          start_time: number
          verse_number: number
          verse_text: string
          version_id: string
        }
        Insert: {
          church_id: string
          confidence?: number
          created_at?: string
          duration?: number
          end_time?: number
          id?: string
          job_id: string
          manually_edited?: boolean
          notes?: string | null
          start_time?: number
          verse_number: number
          verse_text?: string
          version_id: string
        }
        Update: {
          church_id?: string
          confidence?: number
          created_at?: string
          duration?: number
          end_time?: number
          id?: string
          job_id?: string
          manually_edited?: boolean
          notes?: string | null
          start_time?: number
          verse_number?: number
          verse_text?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_version_verses_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_version_verses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_version_verses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "audio_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audio_url?: string | null
          church_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          index_url?: string | null
          job_id: string
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          published_at?: string | null
          published_by?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audio_url?: string | null
          church_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          index_url?: string | null
          job_id?: string
          manifest_url?: string | null
          processing_stage?: string
          progress?: number
          published_at?: string | null
          published_by?: string | null
          report_url?: string | null
          started_at?: string | null
          status?: string
          text_url?: string | null
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "audio_versions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_versions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_worker_heartbeats: {
        Row: {
          created_at: string
          current_job_id: string | null
          id: string
          last_seen_at: string
          metadata: Json
          status: string
          updated_at: string
          worker_id: string
          worker_type: string
        }
        Insert: {
          created_at?: string
          current_job_id?: string | null
          id?: string
          last_seen_at?: string
          metadata?: Json
          status?: string
          updated_at?: string
          worker_id: string
          worker_type?: string
        }
        Update: {
          created_at?: string
          current_job_id?: string | null
          id?: string
          last_seen_at?: string
          metadata?: Json
          status?: string
          updated_at?: string
          worker_id?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_worker_heartbeats_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          church_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          new_values: Json | null
          old_values: Json | null
          source: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          church_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          source?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          church_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          new_values?: Json | null
          old_values?: Json | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          description: string | null
          details: string | null
          entity: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          description?: string | null
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          description?: string | null
          details?: string | null
          entity?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_type: string | null
          id: string
          member_id: string | null
          message: string | null
          sent_at: string | null
        }
        Insert: {
          automation_type?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          sent_at?: string | null
        }
        Update: {
          automation_type?: string | null
          id?: string
          member_id?: string | null
          message?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          processed_count: number
          run_date: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_count?: number
          run_date: string
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          processed_count?: number
          run_date?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      automations: {
        Row: {
          church_id: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          is_public: boolean | null
          message_template: string | null
          type: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_public?: boolean | null
          message_template?: string | null
          type?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_public?: boolean | null
          message_template?: string | null
          type?: string | null
        }
        Relationships: []
      }
      bible_audio_assets: {
        Row: {
          audio_version: string
          book_id: string
          byte_size: number | null
          cache_key: string
          chapter_number: number
          content_hash: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          generated_at: string | null
          generation_started_at: string | null
          id: string
          language_code: string
          provider: string
          provider_model: string
          requested_by: string | null
          status: string
          storage_bucket: string
          storage_path: string | null
          translation_id: string
          updated_at: string
          voice_id: string
        }
        Insert: {
          audio_version: string
          book_id: string
          byte_size?: number | null
          cache_key: string
          chapter_number: number
          content_hash?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generated_at?: string | null
          generation_started_at?: string | null
          id?: string
          language_code: string
          provider?: string
          provider_model?: string
          requested_by?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string | null
          translation_id: string
          updated_at?: string
          voice_id: string
        }
        Update: {
          audio_version?: string
          book_id?: string
          byte_size?: number | null
          cache_key?: string
          chapter_number?: number
          content_hash?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generated_at?: string | null
          generation_started_at?: string | null
          id?: string
          language_code?: string
          provider?: string
          provider_model?: string
          requested_by?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string | null
          translation_id?: string
          updated_at?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_audio_assets_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_audio_assets_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translation_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_audio_assets_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translations"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_books: {
        Row: {
          abbreviation: string | null
          book_number: number
          created_at: string
          id: string
          name: string
          testament: string
          translation_id: string
        }
        Insert: {
          abbreviation?: string | null
          book_number: number
          created_at?: string
          id?: string
          name: string
          testament: string
          translation_id: string
        }
        Update: {
          abbreviation?: string | null
          book_number?: number
          created_at?: string
          id?: string
          name?: string
          testament?: string
          translation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_books_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translation_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_books_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translations"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_chapters: {
        Row: {
          book_id: string
          chapter_number: number
          created_at: string
          id: string
          translation_id: string
        }
        Insert: {
          book_id: string
          chapter_number: number
          created_at?: string
          id?: string
          translation_id: string
        }
        Update: {
          book_id?: string
          chapter_number?: number
          created_at?: string
          id?: string
          translation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_chapters_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translation_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_chapters_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translations"
            referencedColumns: ["id"]
          },
        ]
      }
      bible_translations: {
        Row: {
          active: boolean
          ai_processing_allowed: boolean
          attribution: string | null
          attribution_text: string | null
          audio_generation_allowed: boolean
          audio_generation_notes: string | null
          canon: string | null
          canon_type: string | null
          code: string
          copyright: string | null
          copyright_notice: string | null
          created_at: string
          default_translation: boolean
          description: string | null
          id: string
          is_active: boolean
          language_code: string
          license_name: string | null
          license_url: string | null
          name: string
          publisher: string | null
          source: string | null
          source_url: string | null
        }
        Insert: {
          active?: boolean
          ai_processing_allowed?: boolean
          attribution?: string | null
          attribution_text?: string | null
          audio_generation_allowed?: boolean
          audio_generation_notes?: string | null
          canon?: string | null
          canon_type?: string | null
          code: string
          copyright?: string | null
          copyright_notice?: string | null
          created_at?: string
          default_translation?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          language_code?: string
          license_name?: string | null
          license_url?: string | null
          name: string
          publisher?: string | null
          source?: string | null
          source_url?: string | null
        }
        Update: {
          active?: boolean
          ai_processing_allowed?: boolean
          attribution?: string | null
          attribution_text?: string | null
          audio_generation_allowed?: boolean
          audio_generation_notes?: string | null
          canon?: string | null
          canon_type?: string | null
          code?: string
          copyright?: string | null
          copyright_notice?: string | null
          created_at?: string
          default_translation?: boolean
          description?: string | null
          id?: string
          is_active?: boolean
          language_code?: string
          license_name?: string | null
          license_url?: string | null
          name?: string
          publisher?: string | null
          source?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      bible_verses: {
        Row: {
          archived_at: string | null
          book_id: string | null
          chapter_id: string | null
          chapter_number: number | null
          church_id: string | null
          created_at: string | null
          id: string
          is_active: boolean
          language: string | null
          reference: string
          text: string | null
          translation_id: string | null
          verse_number: number | null
          verse_text: string
        }
        Insert: {
          archived_at?: string | null
          book_id?: string | null
          chapter_id?: string | null
          chapter_number?: number | null
          church_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          reference: string
          text?: string | null
          translation_id?: string | null
          verse_number?: number | null
          verse_text: string
        }
        Update: {
          archived_at?: string | null
          book_id?: string | null
          chapter_id?: string | null
          chapter_number?: number | null
          church_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean
          language?: string | null
          reference?: string
          text?: string | null
          translation_id?: string | null
          verse_number?: number | null
          verse_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_verses_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_chapter_fk_matches_book"
            columns: ["chapter_id", "book_id"]
            isOneToOne: false
            referencedRelation: "bible_chapters"
            referencedColumns: ["id", "book_id"]
          },
          {
            foreignKeyName: "bible_verses_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "bible_chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translation_metadata"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bible_verses_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "bible_translations"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_announcement_automations: {
        Row: {
          announcement_id: string | null
          automation_date: string
          automation_key: string
          church_id: string
          created_at: string
          id: string
          member_id: string
        }
        Insert: {
          announcement_id?: string | null
          automation_date: string
          automation_key: string
          church_id: string
          created_at?: string
          id?: string
          member_id: string
        }
        Update: {
          announcement_id?: string | null
          automation_date?: string
          automation_key?: string
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "birthday_announcement_automations_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_announcement_automations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "birthday_announcement_automations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_members: {
        Row: {
          added_at: string
          channel_id: string
          member_id: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          channel_id: string
          member_id?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          channel_id?: string
          member_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          audience_type: string
          church_id: string
          community_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json
          ministry_id: string | null
          name: string
          owner_scope: string
        }
        Insert: {
          audience_type: string
          church_id: string
          community_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json
          ministry_id?: string | null
          name: string
          owner_scope: string
        }
        Update: {
          audience_type?: string
          church_id?: string
          community_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json
          ministry_id?: string | null
          name?: string
          owner_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channels_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          channel_id: string
          created_at: string
          id: string
          sender_member_id: string | null
          sender_user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          channel_id: string
          created_at?: string
          id?: string
          sender_member_id?: string | null
          sender_user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          sender_member_id?: string | null
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_member_id_fkey"
            columns: ["sender_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      church_features: {
        Row: {
          church_id: string
          created_at: string
          enabled: boolean
          enabled_at: string | null
          enabled_by: string | null
          feature_id: string
          id: string
          locked: boolean
          settings: Json
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_id: string
          id?: string
          locked?: boolean
          settings?: Json
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          enabled?: boolean
          enabled_at?: string | null
          enabled_by?: string | null
          feature_id?: string
          id?: string
          locked?: boolean
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_features_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["id"]
          },
        ]
      }
      church_livestreams: {
        Row: {
          actual_ended_at: string | null
          actual_started_at: string | null
          church_id: string
          created_at: string
          created_by: string | null
          id: string
          provider: string
          provider_external_id: string | null
          provider_failure_count: number
          provider_last_checked_at: string | null
          provider_last_error_category: string | null
          provider_next_sync_at: string | null
          provider_status: string | null
          recording_url: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          status_source: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          watch_url: string
        }
        Insert: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          church_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: string
          provider_external_id?: string | null
          provider_failure_count?: number
          provider_last_checked_at?: string | null
          provider_last_error_category?: string | null
          provider_next_sync_at?: string | null
          provider_status?: string | null
          recording_url?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          status_source?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          watch_url: string
        }
        Update: {
          actual_ended_at?: string | null
          actual_started_at?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          provider?: string
          provider_external_id?: string | null
          provider_failure_count?: number
          provider_last_checked_at?: string | null
          provider_last_error_category?: string | null
          provider_next_sync_at?: string | null
          provider_status?: string | null
          recording_url?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          status_source?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          watch_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_livestreams_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_role_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_manage: boolean
          can_publish: boolean
          can_view: boolean
          church_id: string
          created_at: string
          feature_id: string
          id: string
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage?: boolean
          can_publish?: boolean
          can_view?: boolean
          church_id: string
          created_at?: string
          feature_id: string
          id?: string
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_manage?: boolean
          can_publish?: boolean
          can_view?: boolean
          church_id?: string
          created_at?: string
          feature_id?: string
          id?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_role_permissions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_role_permissions_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["id"]
          },
        ]
      }
      church_staff: {
        Row: {
          church_id: string | null
          community_id: string | null
          created_at: string | null
          id: string
          name: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          church_id?: string | null
          community_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          church_id?: string | null
          community_id?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "church_staff_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          banner_url: string | null
          church_code: string
          code: string | null
          code_generated_at: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          mass_intention_auto_confirm_paid: boolean
          mass_intention_currency: string
          mass_intention_default_fee: number | null
          mass_intention_require_manual_review: boolean
          mass_intention_slot_capacity: number | null
          name: string
          owner_id: string | null
          phone: string | null
          short_code: string | null
          slug: string
          whatsapp_daily_message_limit: number
          whatsapp_enabled: boolean
          whatsapp_mass_intentions_enabled: boolean
          whatsapp_service_window_hours: number
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          church_code: string
          code?: string | null
          code_generated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mass_intention_auto_confirm_paid?: boolean
          mass_intention_currency?: string
          mass_intention_default_fee?: number | null
          mass_intention_require_manual_review?: boolean
          mass_intention_slot_capacity?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          short_code?: string | null
          slug: string
          whatsapp_daily_message_limit?: number
          whatsapp_enabled?: boolean
          whatsapp_mass_intentions_enabled?: boolean
          whatsapp_service_window_hours?: number
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          church_code?: string
          code?: string | null
          code_generated_at?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          mass_intention_auto_confirm_paid?: boolean
          mass_intention_currency?: string
          mass_intention_default_fee?: number | null
          mass_intention_require_manual_review?: boolean
          mass_intention_slot_capacity?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          short_code?: string | null
          slug?: string
          whatsapp_daily_message_limit?: number
          whatsapp_enabled?: boolean
          whatsapp_mass_intentions_enabled?: boolean
          whatsapp_service_window_hours?: number
        }
        Relationships: []
      }
      communities: {
        Row: {
          chairperson_id: string | null
          church_id: string | null
          created_at: string | null
          description: string | null
          id: string
          katibu_id: string | null
          makamu_mwenyekiti_id: string | null
          mweka_hazina_id: string | null
          mwenyekiti_id: string | null
          name: string | null
          secretary_id: string | null
          treasurer_id: string | null
          vice_chairperson_id: string | null
        }
        Insert: {
          chairperson_id?: string | null
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          katibu_id?: string | null
          makamu_mwenyekiti_id?: string | null
          mweka_hazina_id?: string | null
          mwenyekiti_id?: string | null
          name?: string | null
          secretary_id?: string | null
          treasurer_id?: string | null
          vice_chairperson_id?: string | null
        }
        Update: {
          chairperson_id?: string | null
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          katibu_id?: string | null
          makamu_mwenyekiti_id?: string | null
          mweka_hazina_id?: string | null
          mwenyekiti_id?: string | null
          name?: string | null
          secretary_id?: string | null
          treasurer_id?: string | null
          vice_chairperson_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_makamu_mwenyekiti_id_fkey"
            columns: ["makamu_mwenyekiti_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_mweka_hazina_id_fkey"
            columns: ["mweka_hazina_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_mwenyekiti_id_fkey"
            columns: ["mwenyekiti_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_chairperson"
            columns: ["chairperson_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_katibu"
            columns: ["katibu_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_secretary"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_treasurer"
            columns: ["treasurer_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vice_chairperson"
            columns: ["vice_chairperson_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      community_help: {
        Row: {
          created_at: string | null
          current_amount: number | null
          description: string | null
          goal_amount: number | null
          id: string
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          current_amount?: number | null
          description?: string | null
          goal_amount?: number | null
          id?: string
          status?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          current_amount?: number | null
          description?: string | null
          goal_amount?: number | null
          id?: string
          status?: string | null
          title?: string | null
        }
        Relationships: []
      }
      community_help_requests: {
        Row: {
          category: string | null
          church_id: string | null
          created_at: string | null
          current_amount: number
          description: string | null
          id: string
          member_id: string | null
          status: string | null
          target_amount: number | null
        }
        Insert: {
          category?: string | null
          church_id?: string | null
          created_at?: string | null
          current_amount?: number
          description?: string | null
          id?: string
          member_id?: string | null
          status?: string | null
          target_amount?: number | null
        }
        Update: {
          category?: string | null
          church_id?: string | null
          created_at?: string | null
          current_amount?: number
          description?: string | null
          id?: string
          member_id?: string | null
          status?: string | null
          target_amount?: number | null
        }
        Relationships: []
      }
      community_leaders: {
        Row: {
          church_id: string | null
          community_id: string | null
          id: string
          leadership_role: string | null
          user_id: string | null
        }
        Insert: {
          church_id?: string | null
          community_id?: string | null
          id?: string
          leadership_role?: string | null
          user_id?: string | null
        }
        Update: {
          church_id?: string | null
          community_id?: string | null
          id?: string
          leadership_role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_leaders_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_leaders_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_leaders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_targets: {
        Row: {
          church_id: string
          community_id: string
          id: string
          target_amount: number
          total_paid: number
          total_pledged: number
        }
        Insert: {
          church_id: string
          community_id: string
          id?: string
          target_amount?: number
          total_paid?: number
          total_pledged?: number
        }
        Update: {
          church_id?: string
          community_id?: string
          id?: string
          target_amount?: number
          total_paid?: number
          total_pledged?: number
        }
        Relationships: [
          {
            foreignKeyName: "community_targets_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_targets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: true
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      content_bookmarks: {
        Row: {
          church_id: string | null
          content_id: string
          content_type: string
          created_at: string
          excerpt: string | null
          id: string
          label: string | null
          metadata: Json
          reference: string | null
          segment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id?: string | null
          content_id: string
          content_type: string
          created_at?: string
          excerpt?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_bookmarks_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      content_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      content_collection_items: {
        Row: {
          collection_id: string
          content_id: string
          content_type: string
          created_at: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          content_id: string
          content_type: string
          created_at?: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          content_id?: string
          content_type?: string
          created_at?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "content_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      content_collections: {
        Row: {
          cover_image: string | null
          created_at: string
          created_by: string | null
          description: string | null
          featured: boolean
          id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          featured?: boolean
          id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_daily_readings: {
        Row: {
          celebration: string
          created_at: string
          created_by: string | null
          daily_challenge: string | null
          editorial_notes: string | null
          first_reading_reference: string
          gospel_acclamation_reference: string | null
          gospel_reference: string
          id: string
          import_batch_id: string | null
          language_id: string | null
          liturgical_color: string
          liturgical_season: string
          liturgical_year: string
          meditation_questions: string | null
          prayer: string | null
          reading_date: string
          reflection: string | null
          responsorial_psalm_reference: string
          second_reading_reference: string | null
          source_attribution: string | null
          status: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          celebration?: string
          created_at?: string
          created_by?: string | null
          daily_challenge?: string | null
          editorial_notes?: string | null
          first_reading_reference?: string
          gospel_acclamation_reference?: string | null
          gospel_reference?: string
          id?: string
          import_batch_id?: string | null
          language_id?: string | null
          liturgical_color?: string
          liturgical_season?: string
          liturgical_year?: string
          meditation_questions?: string | null
          prayer?: string | null
          reading_date: string
          reflection?: string | null
          responsorial_psalm_reference?: string
          second_reading_reference?: string | null
          source_attribution?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          celebration?: string
          created_at?: string
          created_by?: string | null
          daily_challenge?: string | null
          editorial_notes?: string | null
          first_reading_reference?: string
          gospel_acclamation_reference?: string | null
          gospel_reference?: string
          id?: string
          import_batch_id?: string | null
          language_id?: string | null
          liturgical_color?: string
          liturgical_season?: string
          liturgical_year?: string
          meditation_questions?: string | null
          prayer?: string | null
          reading_date?: string
          reflection?: string | null
          responsorial_psalm_reference?: string
          second_reading_reference?: string | null
          source_attribution?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_daily_readings_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "content_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_daily_readings_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "content_languages"
            referencedColumns: ["id"]
          },
        ]
      }
      content_favorites: {
        Row: {
          church_id: string | null
          content_id: string
          content_type: string
          created_at: string
          excerpt: string | null
          id: string
          label: string | null
          metadata: Json
          reference: string | null
          segment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id?: string | null
          content_id: string
          content_type: string
          created_at?: string
          excerpt?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          label?: string | null
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_favorites_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      content_highlights: {
        Row: {
          church_id: string | null
          color: string
          content_id: string
          content_type: string
          created_at: string
          excerpt: string | null
          id: string
          metadata: Json
          reference: string | null
          segment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          church_id?: string | null
          color?: string
          content_id: string
          content_type: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          church_id?: string | null
          color?: string
          content_id?: string
          content_type?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_highlights_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      content_import_batches: {
        Row: {
          conflict_strategy: string
          content_type: string
          created_at: string
          date_obtained: string | null
          executed_by: string | null
          filename: string
          id: string
          imported_at: string | null
          imported_by: string | null
          imported_rows: number
          information_rows: number
          initiated_by_display_name: string | null
          initiated_by_email: string | null
          initiated_by_user_uuid: string | null
          invalid_rows: number
          language_id: string | null
          notes: string | null
          skipped_rows: number
          source_edition: string | null
          source_organization: string | null
          source_publication: string | null
          source_year: number | null
          status: string
          total_rows: number
          updated_at: string
          updated_rows: number
          valid_rows: number
          validation_summary: Json | null
          warning_rows: number
        }
        Insert: {
          conflict_strategy?: string
          content_type: string
          created_at?: string
          date_obtained?: string | null
          executed_by?: string | null
          filename: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          imported_rows?: number
          information_rows?: number
          initiated_by_display_name?: string | null
          initiated_by_email?: string | null
          initiated_by_user_uuid?: string | null
          invalid_rows?: number
          language_id?: string | null
          notes?: string | null
          skipped_rows?: number
          source_edition?: string | null
          source_organization?: string | null
          source_publication?: string | null
          source_year?: number | null
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
          validation_summary?: Json | null
          warning_rows?: number
        }
        Update: {
          conflict_strategy?: string
          content_type?: string
          created_at?: string
          date_obtained?: string | null
          executed_by?: string | null
          filename?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          imported_rows?: number
          information_rows?: number
          initiated_by_display_name?: string | null
          initiated_by_email?: string | null
          initiated_by_user_uuid?: string | null
          invalid_rows?: number
          language_id?: string | null
          notes?: string | null
          skipped_rows?: number
          source_edition?: string | null
          source_organization?: string | null
          source_publication?: string | null
          source_year?: number | null
          status?: string
          total_rows?: number
          updated_at?: string
          updated_rows?: number
          valid_rows?: number
          validation_summary?: Json | null
          warning_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_import_batches_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "content_languages"
            referencedColumns: ["id"]
          },
        ]
      }
      content_languages: {
        Row: {
          code: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          native_name: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          native_name?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          native_name?: string | null
        }
        Relationships: []
      }
      content_notes: {
        Row: {
          body: string
          body_format: string
          church_id: string | null
          content_id: string
          content_type: string
          created_at: string
          excerpt: string | null
          id: string
          metadata: Json
          reference: string | null
          segment_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          body_format?: string
          church_id?: string | null
          content_id: string
          content_type: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          body_format?: string
          church_id?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          segment_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_notes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      content_prayer_tags: {
        Row: {
          prayer_id: string
          tag_id: string
        }
        Insert: {
          prayer_id: string
          tag_id: string
        }
        Update: {
          prayer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_prayer_tags_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "content_prayers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_prayer_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "content_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      content_prayers: {
        Row: {
          audio_url: string | null
          author: string | null
          body: string | null
          category_id: string | null
          church_id: string | null
          content_edition: string | null
          content_version_label: string | null
          copyright_holder: string | null
          copyright_notice: string | null
          cover_image: string | null
          created_at: string
          created_by: string | null
          ecclesial_approval_authority: string | null
          ecclesial_approval_reference: string | null
          ecclesial_approval_status: string
          estimated_read_time: number | null
          featured: boolean
          id: string
          is_global: boolean
          language_id: string | null
          license_reference: string | null
          license_type: string | null
          liturgical_season: string | null
          metadata: Json
          parent_prayer_id: string | null
          prayer_code: string | null
          prayer_type: string
          recommended_time: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scripture_reference: string | null
          slug: string
          sort_order: number
          source: string | null
          source_notes: string | null
          source_organization: string | null
          source_reference: string | null
          source_title: string | null
          source_type: string | null
          source_url: string | null
          status: string
          summary: string | null
          title: string
          translation_group_id: string
          translation_key: string | null
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          audio_url?: string | null
          author?: string | null
          body?: string | null
          category_id?: string | null
          church_id?: string | null
          content_edition?: string | null
          content_version_label?: string | null
          copyright_holder?: string | null
          copyright_notice?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          ecclesial_approval_authority?: string | null
          ecclesial_approval_reference?: string | null
          ecclesial_approval_status?: string
          estimated_read_time?: number | null
          featured?: boolean
          id?: string
          is_global?: boolean
          language_id?: string | null
          license_reference?: string | null
          license_type?: string | null
          liturgical_season?: string | null
          metadata?: Json
          parent_prayer_id?: string | null
          prayer_code?: string | null
          prayer_type?: string
          recommended_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scripture_reference?: string | null
          slug: string
          sort_order?: number
          source?: string | null
          source_notes?: string | null
          source_organization?: string | null
          source_reference?: string | null
          source_title?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          title: string
          translation_group_id?: string
          translation_key?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          audio_url?: string | null
          author?: string | null
          body?: string | null
          category_id?: string | null
          church_id?: string | null
          content_edition?: string | null
          content_version_label?: string | null
          copyright_holder?: string | null
          copyright_notice?: string | null
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          ecclesial_approval_authority?: string | null
          ecclesial_approval_reference?: string | null
          ecclesial_approval_status?: string
          estimated_read_time?: number | null
          featured?: boolean
          id?: string
          is_global?: boolean
          language_id?: string | null
          license_reference?: string | null
          license_type?: string | null
          liturgical_season?: string | null
          metadata?: Json
          parent_prayer_id?: string | null
          prayer_code?: string | null
          prayer_type?: string
          recommended_time?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scripture_reference?: string | null
          slug?: string
          sort_order?: number
          source?: string | null
          source_notes?: string | null
          source_organization?: string | null
          source_reference?: string | null
          source_title?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          summary?: string | null
          title?: string
          translation_group_id?: string
          translation_key?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_prayers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "content_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_prayers_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_prayers_language_id_fkey"
            columns: ["language_id"]
            isOneToOne: false
            referencedRelation: "content_languages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_prayers_parent_prayer_id_fkey"
            columns: ["parent_prayer_id"]
            isOneToOne: false
            referencedRelation: "content_prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      content_relationships: {
        Row: {
          created_at: string
          id: string
          relationship_type: string
          source_id: string
          source_type: string
          target_id: string | null
          target_key: string | null
          target_label: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          relationship_type: string
          source_id: string
          source_type: string
          target_id?: string | null
          target_key?: string | null
          target_label?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          relationship_type?: string
          source_id?: string
          source_type?: string
          target_id?: string | null
          target_key?: string | null
          target_label?: string | null
          target_type?: string
        }
        Relationships: []
      }
      content_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot: Json
          version_number: number
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: []
      }
      contribution_audit_logs: {
        Row: {
          action: string
          church_id: string
          contribution_id: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          performed_by: string | null
          performer_name: string | null
          reason: string
        }
        Insert: {
          action: string
          church_id: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          performer_name?: string | null
          reason: string
        }
        Update: {
          action?: string
          church_id?: string
          contribution_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_by?: string | null
          performer_name?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "contribution_audit_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_audit_logs_contribution_id_fkey"
            columns: ["contribution_id"]
            isOneToOne: false
            referencedRelation: "contributions"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_categories: {
        Row: {
          church_id: string | null
          created_at: string
          description: string | null
          id: string
          is_special: boolean
          name: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_special?: boolean
          name?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_special?: boolean
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_categories_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          amount: number
          category_id: string | null
          church_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          donor_name: string | null
          id: string
          idempotency_key: string | null
          member_id: string | null
          notes: string | null
          payment_reference: string | null
          phone: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          church_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          donor_name?: string | null
          id?: string
          idempotency_key?: string | null
          member_id?: string | null
          notes?: string | null
          payment_reference?: string | null
          phone?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          church_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          donor_name?: string | null
          id?: string
          idempotency_key?: string | null
          member_id?: string | null
          notes?: string | null
          payment_reference?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contributions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "contribution_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contributions_church"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reading_passages: {
        Row: {
          book_id: string | null
          chapter_end: number | null
          chapter_start: number | null
          created_at: string
          daily_reading_id: string
          id: string
          reading_kind: string
          reference: string | null
          sort_order: number
          text: string | null
          title: string | null
          updated_at: string
          verse_end: number | null
          verse_start: number | null
        }
        Insert: {
          book_id?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          daily_reading_id: string
          id?: string
          reading_kind: string
          reference?: string | null
          sort_order?: number
          text?: string | null
          title?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Update: {
          book_id?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          daily_reading_id?: string
          id?: string
          reading_kind?: string
          reference?: string | null
          sort_order?: number
          text?: string | null
          title?: string | null
          updated_at?: string
          verse_end?: number | null
          verse_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reading_passages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "bible_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reading_passages_daily_reading_id_fkey"
            columns: ["daily_reading_id"]
            isOneToOne: false
            referencedRelation: "daily_readings"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_readings: {
        Row: {
          celebration: string | null
          created_at: string
          day_of_week: string | null
          day_type: string | null
          first_reading: string | null
          first_reading_reference: string | null
          gospel: string | null
          gospel_acclamation: string | null
          gospel_reference: string | null
          id: string
          is_published: boolean
          language_code: string | null
          liturgical_color: string | null
          liturgical_day_id: string | null
          liturgical_season: string | null
          liturgical_week: number | null
          liturgical_year: string | null
          prayer: string | null
          psalm: string | null
          psalm_response: string | null
          reading_code: string | null
          reading_date: string | null
          reflection: string | null
          reflection_id: string | null
          responsorial_psalm_reference: string | null
          second_reading: string | null
          second_reading_reference: string | null
          status: string | null
          updated_at: string
          weekday_cycle: string | null
        }
        Insert: {
          celebration?: string | null
          created_at?: string
          day_of_week?: string | null
          day_type?: string | null
          first_reading?: string | null
          first_reading_reference?: string | null
          gospel?: string | null
          gospel_acclamation?: string | null
          gospel_reference?: string | null
          id?: string
          is_published?: boolean
          language_code?: string | null
          liturgical_color?: string | null
          liturgical_day_id?: string | null
          liturgical_season?: string | null
          liturgical_week?: number | null
          liturgical_year?: string | null
          prayer?: string | null
          psalm?: string | null
          psalm_response?: string | null
          reading_code?: string | null
          reading_date?: string | null
          reflection?: string | null
          reflection_id?: string | null
          responsorial_psalm_reference?: string | null
          second_reading?: string | null
          second_reading_reference?: string | null
          status?: string | null
          updated_at?: string
          weekday_cycle?: string | null
        }
        Update: {
          celebration?: string | null
          created_at?: string
          day_of_week?: string | null
          day_type?: string | null
          first_reading?: string | null
          first_reading_reference?: string | null
          gospel?: string | null
          gospel_acclamation?: string | null
          gospel_reference?: string | null
          id?: string
          is_published?: boolean
          language_code?: string | null
          liturgical_color?: string | null
          liturgical_day_id?: string | null
          liturgical_season?: string | null
          liturgical_week?: number | null
          liturgical_year?: string | null
          prayer?: string | null
          psalm?: string | null
          psalm_response?: string | null
          reading_code?: string | null
          reading_date?: string | null
          reflection?: string | null
          reflection_id?: string | null
          responsorial_psalm_reference?: string | null
          second_reading?: string | null
          second_reading_reference?: string | null
          status?: string | null
          updated_at?: string
          weekday_cycle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_readings_liturgical_day_id_fkey"
            columns: ["liturgical_day_id"]
            isOneToOne: false
            referencedRelation: "liturgical_days"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_benchmark_reports: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          report_payload: Json
          report_type: string
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          report_payload: Json
          report_type: string
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          report_payload?: Json
          report_type?: string
          run_id?: string
        }
        Relationships: []
      }
      evaluation_golden_references: {
        Row: {
          book: string
          chapter: number
          chapter_id: string
          id: string
          imported_at: string
          imported_by: string | null
          metadata: Json
          reference_payload: Json
          source_hash: string | null
          source_name: string | null
          translation_code: string
        }
        Insert: {
          book: string
          chapter: number
          chapter_id: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          metadata?: Json
          reference_payload: Json
          source_hash?: string | null
          source_name?: string | null
          translation_code?: string
        }
        Update: {
          book?: string
          chapter?: number
          chapter_id?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          metadata?: Json
          reference_payload?: Json
          source_hash?: string | null
          source_name?: string | null
          translation_code?: string
        }
        Relationships: []
      }
      evaluation_model_outputs: {
        Row: {
          chapter_id: string
          created_at: string
          id: string
          metadata: Json
          model_id: string
          output_payload: Json
          provider: string
          run_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          id?: string
          metadata?: Json
          model_id: string
          output_payload: Json
          provider: string
          run_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          model_id?: string
          output_payload?: Json
          provider?: string
          run_id?: string
        }
        Relationships: []
      }
      event_attendances: {
        Row: {
          amount_due: number
          attendance_marked_at: string | null
          attendance_marked_by: string | null
          attendance_status: string
          cancelled_at: string | null
          church_id: string
          confirmed_at: string | null
          created_at: string
          currency: string
          event_id: string
          id: string
          member_id: string
          payment_status: string
          registered_at: string
          registration_status: string
          responded_at: string
          response: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string
          cancelled_at?: string | null
          church_id: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          member_id: string
          payment_status?: string
          registered_at?: string
          registration_status?: string
          responded_at?: string
          response: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string
          cancelled_at?: string | null
          church_id?: string
          confirmed_at?: string | null
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          member_id?: string
          payment_status?: string
          registered_at?: string
          registration_status?: string
          responded_at?: string
          response?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendances_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendances_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_audience_targets: {
        Row: {
          church_id: string
          community_id: string | null
          created_at: string
          event_id: string
          id: string
          ministry_id: string | null
        }
        Insert: {
          church_id: string
          community_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          ministry_id?: string | null
        }
        Update: {
          church_id?: string
          community_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          ministry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_audience_targets_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_targets_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_targets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audience_targets_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_payments: {
        Row: {
          amount: number
          attendance_id: string
          church_id: string
          created_at: string
          currency: string
          event_id: string
          id: string
          member_id: string
          payment_method: string
          proof_url: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          attendance_id: string
          church_id: string
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          member_id: string
          payment_method: string
          proof_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          attendance_id?: string
          church_id?: string
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          member_id?: string
          payment_method?: string
          proof_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_payments_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "event_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_payments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requests: {
        Row: {
          additional_notes: string | null
          admin_notes: string | null
          church_id: string | null
          community_id: string | null
          contact_phone: string | null
          converted_at: string | null
          converted_event_id: string | null
          converted_mass_event_id: string | null
          created_at: string | null
          description: string | null
          event_date: string | null
          expected_attendance: number | null
          id: string
          location_preference: string | null
          member_id: string | null
          ministry_id: string | null
          preferred_date: string | null
          preferred_end_time: string | null
          preferred_start_time: string | null
          request_type: string | null
          requester_name: string | null
          requester_phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          admin_notes?: string | null
          church_id?: string | null
          community_id?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_event_id?: string | null
          converted_mass_event_id?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          expected_attendance?: number | null
          id?: string
          location_preference?: string | null
          member_id?: string | null
          ministry_id?: string | null
          preferred_date?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          request_type?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          admin_notes?: string | null
          church_id?: string | null
          community_id?: string | null
          contact_phone?: string | null
          converted_at?: string | null
          converted_event_id?: string | null
          converted_mass_event_id?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string | null
          expected_attendance?: number | null
          id?: string
          location_preference?: string | null
          member_id?: string | null
          ministry_id?: string | null
          preferred_date?: string | null
          preferred_end_time?: string | null
          preferred_start_time?: string | null
          request_type?: string | null
          requester_name?: string | null
          requester_phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_converted_event_id_fkey"
            columns: ["converted_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_converted_mass_event_id_fkey"
            columns: ["converted_mass_event_id"]
            isOneToOne: false
            referencedRelation: "mass_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requests_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
          audience_mode: string
          church_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          event_type: string | null
          id: string
          location: string | null
          ministry: string | null
          payment_required_for_confirmation: boolean
          recurrence_count: number | null
          recurrence_days_of_week: number[] | null
          recurrence_end_date: string | null
          recurrence_frequency: string
          recurrence_interval: number
          recurrence_monthly_pattern: string
          recurrence_monthly_week: number | null
          recurrence_monthly_weekday: number | null
          registration_capacity: number | null
          registration_currency: string
          registration_deadline: string | null
          registration_fee: number
          registration_required: boolean
          registration_type: string
          start_date: string | null
          title: string
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          audience_mode?: string
          church_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          ministry?: string | null
          payment_required_for_confirmation?: boolean
          recurrence_count?: number | null
          recurrence_days_of_week?: number[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string
          recurrence_interval?: number
          recurrence_monthly_pattern?: string
          recurrence_monthly_week?: number | null
          recurrence_monthly_weekday?: number | null
          registration_capacity?: number | null
          registration_currency?: string
          registration_deadline?: string | null
          registration_fee?: number
          registration_required?: boolean
          registration_type?: string
          start_date?: string | null
          title: string
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          audience_mode?: string
          church_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          ministry?: string | null
          payment_required_for_confirmation?: boolean
          recurrence_count?: number | null
          recurrence_days_of_week?: number[] | null
          recurrence_end_date?: string | null
          recurrence_frequency?: string
          recurrence_interval?: number
          recurrence_monthly_pattern?: string
          recurrence_monthly_week?: number | null
          recurrence_monthly_weekday?: number | null
          registration_capacity?: number | null
          registration_currency?: string
          registration_deadline?: string | null
          registration_fee?: number
          registration_required?: boolean
          registration_type?: string
          start_date?: string | null
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          church_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      groups: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      help_comments: {
        Row: {
          author_name: string
          comment: string
          created_at: string
          help_request_id: string
          id: string
          member_id: string | null
        }
        Insert: {
          author_name: string
          comment: string
          created_at?: string
          help_request_id: string
          id?: string
          member_id?: string | null
        }
        Update: {
          author_name?: string
          comment?: string
          created_at?: string
          help_request_id?: string
          id?: string
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_comments_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "community_help_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_comments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      help_donations: {
        Row: {
          amount: number
          created_at: string
          donor_name: string
          help_request_id: string
          id: string
          is_anonymous: boolean
        }
        Insert: {
          amount: number
          created_at?: string
          donor_name: string
          help_request_id: string
          id?: string
          is_anonymous?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          donor_name?: string
          help_request_id?: string
          id?: string
          is_anonymous?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "help_donations_help_request_id_fkey"
            columns: ["help_request_id"]
            isOneToOne: false
            referencedRelation: "community_help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          church_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          role: string | null
          status: string | null
          token: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string | null
          status?: string | null
          token?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string | null
          status?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          church_id: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          status: string | null
          token: string | null
          used: boolean | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          status?: string | null
          token?: string | null
          used?: boolean | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          status?: string | null
          token?: string | null
          used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      jumuiya: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      liturgical_calendar: {
        Row: {
          calendar_date: string
          celebration: string | null
          created_at: string | null
          day_of_week: string | null
          id: string
          liturgical_season: string | null
          liturgical_week: number | null
          liturgical_year: string
          reading_code: string | null
          weekday_cycle: string
        }
        Insert: {
          calendar_date: string
          celebration?: string | null
          created_at?: string | null
          day_of_week?: string | null
          id?: string
          liturgical_season?: string | null
          liturgical_week?: number | null
          liturgical_year: string
          reading_code?: string | null
          weekday_cycle: string
        }
        Update: {
          calendar_date?: string
          celebration?: string | null
          created_at?: string | null
          day_of_week?: string | null
          id?: string
          liturgical_season?: string | null
          liturgical_week?: number | null
          liturgical_year?: string
          reading_code?: string | null
          weekday_cycle?: string
        }
        Relationships: []
      }
      liturgical_calendar_overrides: {
        Row: {
          calendar_date: string
          celebration: string | null
          created_at: string
          day_type: string | null
          id: string
          liturgical_color: string | null
          liturgical_season: string | null
          liturgical_week: number | null
          notes: string | null
          reading_code: string | null
          updated_at: string
        }
        Insert: {
          calendar_date: string
          celebration?: string | null
          created_at?: string
          day_type?: string | null
          id?: string
          liturgical_color?: string | null
          liturgical_season?: string | null
          liturgical_week?: number | null
          notes?: string | null
          reading_code?: string | null
          updated_at?: string
        }
        Update: {
          calendar_date?: string
          celebration?: string | null
          created_at?: string
          day_type?: string | null
          id?: string
          liturgical_color?: string | null
          liturgical_season?: string | null
          liturgical_week?: number | null
          notes?: string | null
          reading_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liturgical_calendar_overrides_reading_code_fkey"
            columns: ["reading_code"]
            isOneToOne: false
            referencedRelation: "daily_readings"
            referencedColumns: ["reading_code"]
          },
        ]
      }
      liturgical_days: {
        Row: {
          celebration: string
          created_at: string
          date: string
          holy_day_of_obligation: boolean
          id: string
          lectionary_number: string
          liturgical_color: string
          liturgical_year: string
          notes: string | null
          rank: string
          saint: string | null
          season: string
          updated_at: string
          week: string
          weekday_cycle: string
        }
        Insert: {
          celebration: string
          created_at?: string
          date: string
          holy_day_of_obligation?: boolean
          id?: string
          lectionary_number?: string
          liturgical_color: string
          liturgical_year: string
          notes?: string | null
          rank: string
          saint?: string | null
          season?: string
          updated_at?: string
          week?: string
          weekday_cycle: string
        }
        Update: {
          celebration?: string
          created_at?: string
          date?: string
          holy_day_of_obligation?: boolean
          id?: string
          lectionary_number?: string
          liturgical_color?: string
          liturgical_year?: string
          notes?: string | null
          rank?: string
          saint?: string | null
          season?: string
          updated_at?: string
          week?: string
          weekday_cycle?: string
        }
        Relationships: []
      }
      mass_events: {
        Row: {
          ask_for_rsvp: boolean
          church_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          id: string
          is_active: boolean
          mass_date: string
          response_deadline: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          ask_for_rsvp?: boolean
          church_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          mass_date: string
          response_deadline?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          ask_for_rsvp?: boolean
          church_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          mass_date?: string
          response_deadline?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_intentions: {
        Row: {
          amount: number | null
          church_id: string | null
          created_at: string | null
          id: string
          idempotency_key: string | null
          intention: string | null
          intention_type: string | null
          mass_date: string | null
          mass_location: string | null
          mass_name: string | null
          mass_occurrence_id: string | null
          mass_time: string | null
          member_id: string | null
          message: string | null
          offered_for_name: string | null
          offering_amount: number | null
          payment_reference: string | null
          payment_status: string
          proof_image_url: string | null
          requested_by_name: string | null
          requested_by_phone: string | null
          review_reason: string | null
          status: string | null
          updated_at: string
          whatsapp_conversation_id: string | null
          whatsapp_mass_slot_id: string | null
        }
        Insert: {
          amount?: number | null
          church_id?: string | null
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          intention?: string | null
          intention_type?: string | null
          mass_date?: string | null
          mass_location?: string | null
          mass_name?: string | null
          mass_occurrence_id?: string | null
          mass_time?: string | null
          member_id?: string | null
          message?: string | null
          offered_for_name?: string | null
          offering_amount?: number | null
          payment_reference?: string | null
          payment_status?: string
          proof_image_url?: string | null
          requested_by_name?: string | null
          requested_by_phone?: string | null
          review_reason?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
          whatsapp_mass_slot_id?: string | null
        }
        Update: {
          amount?: number | null
          church_id?: string | null
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          intention?: string | null
          intention_type?: string | null
          mass_date?: string | null
          mass_location?: string | null
          mass_name?: string | null
          mass_occurrence_id?: string | null
          mass_time?: string | null
          member_id?: string | null
          message?: string | null
          offered_for_name?: string | null
          offering_amount?: number | null
          payment_reference?: string | null
          payment_status?: string
          proof_image_url?: string | null
          requested_by_name?: string | null
          requested_by_phone?: string | null
          review_reason?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
          whatsapp_mass_slot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mass_intentions_mass_occurrence_id_fkey"
            columns: ["mass_occurrence_id"]
            isOneToOne: false
            referencedRelation: "mass_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_intentions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_intentions_occurrence_church_fkey"
            columns: ["mass_occurrence_id", "church_id"]
            isOneToOne: false
            referencedRelation: "mass_occurrences"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "mass_intentions_whatsapp_conversation_id_fkey"
            columns: ["whatsapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_intentions_whatsapp_mass_slot_id_fkey"
            columns: ["whatsapp_mass_slot_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mass_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_occurrences: {
        Row: {
          accepts_intentions: boolean
          celebrant_name: string | null
          church_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          intention_capacity: number | null
          intention_fee: number | null
          is_special_mass: boolean
          language: string | null
          location_id: string | null
          location_name: string | null
          mass_schedule_id: string | null
          name: string
          notes: string | null
          occurrence_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          accepts_intentions?: boolean
          celebrant_name?: string | null
          church_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          intention_capacity?: number | null
          intention_fee?: number | null
          is_special_mass?: boolean
          language?: string | null
          location_id?: string | null
          location_name?: string | null
          mass_schedule_id?: string | null
          name: string
          notes?: string | null
          occurrence_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepts_intentions?: boolean
          celebrant_name?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          intention_capacity?: number | null
          intention_fee?: number | null
          is_special_mass?: boolean
          language?: string | null
          location_id?: string | null
          location_name?: string | null
          mass_schedule_id?: string | null
          name?: string
          notes?: string | null
          occurrence_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_occurrences_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_occurrences_mass_schedule_id_fkey"
            columns: ["mass_schedule_id"]
            isOneToOne: false
            referencedRelation: "mass_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_occurrences_schedule_church_fkey"
            columns: ["mass_schedule_id", "church_id"]
            isOneToOne: false
            referencedRelation: "mass_schedules"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      mass_responses: {
        Row: {
          id: string
          mass_event_id: string
          member_id: string
          responded_at: string
          response: string
          updated_at: string
        }
        Insert: {
          id?: string
          mass_event_id: string
          member_id: string
          responded_at?: string
          response: string
          updated_at?: string
        }
        Update: {
          id?: string
          mass_event_id?: string
          member_id?: string
          responded_at?: string
          response?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_responses_mass_event_id_fkey"
            columns: ["mass_event_id"]
            isOneToOne: false
            referencedRelation: "mass_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_responses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_schedules: {
        Row: {
          accepts_intentions: boolean
          church_id: string
          created_at: string
          created_by: string | null
          day_of_week: number
          default_celebrant_name: string | null
          default_intention_fee: number | null
          effective_from: string
          effective_until: string | null
          end_time: string | null
          id: string
          intention_capacity: number | null
          is_active: boolean
          language: string | null
          location_id: string | null
          location_name: string | null
          name: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          accepts_intentions?: boolean
          church_id: string
          created_at?: string
          created_by?: string | null
          day_of_week: number
          default_celebrant_name?: string | null
          default_intention_fee?: number | null
          effective_from?: string
          effective_until?: string | null
          end_time?: string | null
          id?: string
          intention_capacity?: number | null
          is_active?: boolean
          language?: string | null
          location_id?: string | null
          location_name?: string | null
          name: string
          sort_order?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          accepts_intentions?: boolean
          church_id?: string
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          default_celebrant_name?: string | null
          default_intention_fee?: number | null
          effective_from?: string
          effective_until?: string | null
          end_time?: string | null
          id?: string
          intention_capacity?: number | null
          is_active?: boolean
          language?: string | null
          location_id?: string | null
          location_name?: string | null
          name?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      member_communities: {
        Row: {
          community_id: string | null
          created_at: string | null
          id: string
          member_id: string | null
        }
        Insert: {
          community_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
        }
        Update: {
          community_id?: string | null
          created_at?: string | null
          id?: string
          member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_communities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_communities_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_ministries: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          ministry_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          ministry_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          ministry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ministries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ministries_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_record_subscriptions: {
        Row: {
          amount: number
          church_id: string
          created_at: string
          end_date: string | null
          id: string
          member_id: string
          plan_interval: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount?: number
          church_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          member_id: string
          plan_interval?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          church_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          member_id?: string
          plan_interval?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_record_subscriptions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_record_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          church_id: string | null
          community_id: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          family_id: string | null
          family_role: string | null
          full_name: string
          gender: string | null
          group_id: string | null
          id: string
          jumuiya_id: string | null
          ministry_id: string | null
          phone: string | null
          photo_url: string | null
          spouse_name: string | null
          status: string | null
          user_id: string | null
          wedding_date: string | null
        }
        Insert: {
          church_id?: string | null
          community_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          family_role?: string | null
          full_name: string
          gender?: string | null
          group_id?: string | null
          id?: string
          jumuiya_id?: string | null
          ministry_id?: string | null
          phone?: string | null
          photo_url?: string | null
          spouse_name?: string | null
          status?: string | null
          user_id?: string | null
          wedding_date?: string | null
        }
        Update: {
          church_id?: string | null
          community_id?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          family_role?: string | null
          full_name?: string
          gender?: string | null
          group_id?: string | null
          id?: string
          jumuiya_id?: string | null
          ministry_id?: string | null
          phone?: string | null
          photo_url?: string | null
          spouse_name?: string | null
          status?: string | null
          user_id?: string | null
          wedding_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_jumuiya_fkey"
            columns: ["jumuiya_id"]
            isOneToOne: false
            referencedRelation: "jumuiya"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          church_id: string | null
          content: string | null
          created_at: string
          default_bible_verse: string | null
          id: string
          is_active: boolean
          language: string
          occasion: string | null
          template_type: string | null
          title: string
          tone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          church_id?: string | null
          content?: string | null
          created_at?: string
          default_bible_verse?: string | null
          id?: string
          is_active?: boolean
          language?: string
          occasion?: string | null
          template_type?: string | null
          title: string
          tone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          church_id?: string | null
          content?: string | null
          created_at?: string
          default_bible_verse?: string | null
          id?: string
          is_active?: boolean
          language?: string
          occasion?: string | null
          template_type?: string | null
          title?: string
          tone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          church_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          language: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          language?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          church_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_join_requests: {
        Row: {
          church_id: string
          created_at: string
          id: string
          member_id: string
          message: string | null
          ministry_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          member_id: string
          message?: string | null
          ministry_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string
          message?: string | null
          ministry_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_join_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_join_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_join_requests_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          church_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_events: {
        Row: {
          church_id: string | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          job_id: string | null
          message: string | null
          metadata: Json
          severity: string
          source: string
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          message?: string | null
          metadata?: Json
          severity?: string
          source?: string
        }
        Update: {
          church_id?: string | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          message?: string | null
          metadata?: Json
          severity?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "audio_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_features: {
        Row: {
          available_plans: string[]
          category: string
          church_configurable: boolean
          created_at: string
          description: string | null
          globally_enabled: boolean
          globally_locked: boolean
          id: string
          is_global: boolean
          is_mandatory: boolean
          key: string
          member_available: boolean
          name: string
          staff_available: boolean
          updated_at: string
        }
        Insert: {
          available_plans?: string[]
          category?: string
          church_configurable?: boolean
          created_at?: string
          description?: string | null
          globally_enabled?: boolean
          globally_locked?: boolean
          id?: string
          is_global?: boolean
          is_mandatory?: boolean
          key: string
          member_available?: boolean
          name: string
          staff_available?: boolean
          updated_at?: string
        }
        Update: {
          available_plans?: string[]
          category?: string
          church_configurable?: boolean
          created_at?: string
          description?: string | null
          globally_enabled?: boolean
          globally_locked?: boolean
          id?: string
          is_global?: boolean
          is_mandatory?: boolean
          key?: string
          member_available?: boolean
          name?: string
          staff_available?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          church_id: string
          created_at: string
          fee_amount: number
          fee_percentage: number
          gross_amount: number
          id: string
          member_id: string | null
          net_amount: number
          source_id: string | null
          source_type: string
        }
        Insert: {
          church_id: string
          created_at?: string
          fee_amount: number
          fee_percentage?: number
          gross_amount: number
          id?: string
          member_id?: string | null
          net_amount: number
          source_id?: string | null
          source_type: string
        }
        Update: {
          church_id?: string
          created_at?: string
          fee_amount?: number
          fee_percentage?: number
          gross_amount?: number
          id?: string
          member_id?: string | null
          net_amount?: number
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          allow_downgrades: boolean
          auto_expire_trials: boolean
          billing_lipa_number: string
          billing_payment_instructions: string
          billing_payment_method: string
          created_at: string
          default_trial_days: number
          grace_period_days: number
          id: string
          invite_email_body: string
          invite_email_subject: string
          maintenance_mode: boolean
          notify_new_church_registration: boolean
          notify_payment_received: boolean
          notify_subscription_expiring: boolean
          notify_system_errors: boolean
          platform_description: string
          platform_name: string
          support_email: string
          updated_at: string
          welcome_email_body: string
          welcome_email_subject: string
        }
        Insert: {
          allow_downgrades?: boolean
          auto_expire_trials?: boolean
          billing_lipa_number?: string
          billing_payment_instructions?: string
          billing_payment_method?: string
          created_at?: string
          default_trial_days?: number
          grace_period_days?: number
          id?: string
          invite_email_body?: string
          invite_email_subject?: string
          maintenance_mode?: boolean
          notify_new_church_registration?: boolean
          notify_payment_received?: boolean
          notify_subscription_expiring?: boolean
          notify_system_errors?: boolean
          platform_description?: string
          platform_name?: string
          support_email?: string
          updated_at?: string
          welcome_email_body?: string
          welcome_email_subject?: string
        }
        Update: {
          allow_downgrades?: boolean
          auto_expire_trials?: boolean
          billing_lipa_number?: string
          billing_payment_instructions?: string
          billing_payment_method?: string
          created_at?: string
          default_trial_days?: number
          grace_period_days?: number
          id?: string
          invite_email_body?: string
          invite_email_subject?: string
          maintenance_mode?: boolean
          notify_new_church_registration?: boolean
          notify_payment_received?: boolean
          notify_subscription_expiring?: boolean
          notify_system_errors?: boolean
          platform_description?: string
          platform_name?: string
          support_email?: string
          updated_at?: string
          welcome_email_body?: string
          welcome_email_subject?: string
        }
        Relationships: []
      }
      pledge_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          payment_method: string
          pledge_id: string
          proof_url: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          transaction_id: string | null
          verification_status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          payment_method: string
          pledge_id: string
          proof_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          transaction_id?: string | null
          verification_status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          payment_method?: string
          pledge_id?: string
          proof_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          transaction_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pledge_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledge_payments_pledge_id_fkey"
            columns: ["pledge_id"]
            isOneToOne: false
            referencedRelation: "pledges"
            referencedColumns: ["id"]
          },
        ]
      }
      pledges: {
        Row: {
          amount_paid: number
          amount_pledged: number
          church_id: string
          community_id: string | null
          created_at: string
          id: string
          member_id: string
          status: string
        }
        Insert: {
          amount_paid?: number
          amount_pledged: number
          church_id: string
          community_id?: string | null
          created_at?: string
          id?: string
          member_id: string
          status?: string
        }
        Update: {
          amount_paid?: number
          amount_pledged?: number
          church_id?: string
          community_id?: string | null
          created_at?: string
          id?: string
          member_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pledges_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledges_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pledges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_favorites: {
        Row: {
          created_at: string
          id: string
          prayer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prayer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prayer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_favorites_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "content_prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_reading_history: {
        Row: {
          id: string
          last_read_at: string
          prayer_id: string
          read_count: number
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          prayer_id: string
          read_count?: number
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          prayer_id?: string
          read_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_reading_history_prayer_id_fkey"
            columns: ["prayer_id"]
            isOneToOne: false
            referencedRelation: "content_prayers"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_request_comments: {
        Row: {
          author_name: string
          church_id: string
          comment: string
          created_at: string
          id: string
          member_id: string | null
          prayer_request_id: string
        }
        Insert: {
          author_name: string
          church_id: string
          comment: string
          created_at?: string
          id?: string
          member_id?: string | null
          prayer_request_id: string
        }
        Update: {
          author_name?: string
          church_id?: string
          comment?: string
          created_at?: string
          id?: string
          member_id?: string | null
          prayer_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_request_comments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_request_comments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_request_comments_prayer_request_id_fkey"
            columns: ["prayer_request_id"]
            isOneToOne: false
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_request_prayers: {
        Row: {
          church_id: string
          created_at: string
          id: string
          member_id: string
          prayer_request_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          member_id: string
          prayer_request_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string
          prayer_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prayer_request_prayers_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_request_prayers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_request_prayers_prayer_request_id_fkey"
            columns: ["prayer_request_id"]
            isOneToOne: false
            referencedRelation: "prayer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      prayer_requests: {
        Row: {
          church_id: string | null
          created_at: string | null
          id: string
          idempotency_key: string | null
          is_anonymous: boolean | null
          member_id: string | null
          offering_amount: number | null
          privacy: string
          request: string | null
          request_text: string | null
          status: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_anonymous?: boolean | null
          member_id?: string | null
          offering_amount?: number | null
          privacy?: string
          request?: string | null
          request_text?: string | null
          status?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          id?: string
          idempotency_key?: string | null
          is_anonymous?: boolean | null
          member_id?: string | null
          offering_amount?: number | null
          privacy?: string
          request?: string | null
          request_text?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          church_id: string | null
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          created_at: string | null
          id: string
          qr_data: string | null
          reference_id: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          qr_data?: string | null
          reference_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          qr_data?: string | null
          reference_id?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          actor_id: string | null
          id: string
          occurred_at: string
          scope_key: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          id?: string
          occurred_at?: string
          scope_key: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          id?: string
          occurred_at?: string
          scope_key?: string
        }
        Relationships: []
      }
      sacramental_records: {
        Row: {
          archived_at: string | null
          certificate_issued_at: string | null
          certificate_number: string | null
          certificate_ready_at: string | null
          church_id: string
          created_at: string
          created_by: string | null
          documents: Json
          id: string
          location: string | null
          member_id: string | null
          minister: string | null
          notes: string | null
          parents: Json
          preparation: Json
          register_page: string | null
          sacrament_date: string | null
          sacrament_type: string
          sponsors: Json
          spouse: Json
          status: string
          updated_at: string
          witnesses: Json
        }
        Insert: {
          archived_at?: string | null
          certificate_issued_at?: string | null
          certificate_number?: string | null
          certificate_ready_at?: string | null
          church_id: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          id?: string
          location?: string | null
          member_id?: string | null
          minister?: string | null
          notes?: string | null
          parents?: Json
          preparation?: Json
          register_page?: string | null
          sacrament_date?: string | null
          sacrament_type: string
          sponsors?: Json
          spouse?: Json
          status?: string
          updated_at?: string
          witnesses?: Json
        }
        Update: {
          archived_at?: string | null
          certificate_issued_at?: string | null
          certificate_number?: string | null
          certificate_ready_at?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          id?: string
          location?: string | null
          member_id?: string | null
          minister?: string | null
          notes?: string | null
          parents?: Json
          preparation?: Json
          register_page?: string | null
          sacrament_date?: string | null
          sacrament_type?: string
          sponsors?: Json
          spouse?: Json
          status?: string
          updated_at?: string
          witnesses?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sacramental_records_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sacramental_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      saint_translations: {
        Row: {
          biography_long: string
          biography_short: string
          created_at: string
          id: string
          language_code: string
          prayer: string
          quote: string | null
          reflection: string
          saint_id: string
          translated_name: string
        }
        Insert: {
          biography_long: string
          biography_short: string
          created_at?: string
          id?: string
          language_code: string
          prayer: string
          quote?: string | null
          reflection: string
          saint_id: string
          translated_name: string
        }
        Update: {
          biography_long?: string
          biography_short?: string
          created_at?: string
          id?: string
          language_code?: string
          prayer?: string
          quote?: string | null
          reflection?: string
          saint_id?: string
          translated_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "saint_translations_saint_id_fkey"
            columns: ["saint_id"]
            isOneToOne: false
            referencedRelation: "saints"
            referencedColumns: ["id"]
          },
        ]
      }
      saints: {
        Row: {
          biography_long: string
          biography_short: string
          birth_year: number | null
          color_theme: string | null
          country: string | null
          created_at: string
          death_year: number | null
          feast_day: number
          feast_month: number
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          liturgical_rank: string | null
          name: string
          patron_of: string | null
          prayer: string
          quote: string | null
          reflection: string
          scripture_reference: string | null
          slug: string
          tags: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          biography_long: string
          biography_short: string
          birth_year?: number | null
          color_theme?: string | null
          country?: string | null
          created_at?: string
          death_year?: number | null
          feast_day: number
          feast_month: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          liturgical_rank?: string | null
          name: string
          patron_of?: string | null
          prayer: string
          quote?: string | null
          reflection: string
          scripture_reference?: string | null
          slug: string
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          biography_long?: string
          biography_short?: string
          birth_year?: number | null
          color_theme?: string | null
          country?: string | null
          created_at?: string
          death_year?: number | null
          feast_day?: number
          feast_month?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          liturgical_rank?: string | null
          name?: string
          patron_of?: string | null
          prayer?: string
          quote?: string | null
          reflection?: string
          scripture_reference?: string | null
          slug?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_events: {
        Row: {
          church_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          scope_key: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          scope_key?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          scope_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_audit_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      sermons: {
        Row: {
          archived_at: string | null
          audio_url: string | null
          church_id: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          id: string
          preacher: string | null
          source_livestream_id: string | null
          title: string | null
          video_url: string | null
        }
        Insert: {
          archived_at?: string | null
          audio_url?: string | null
          church_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          preacher?: string | null
          source_livestream_id?: string | null
          title?: string | null
          video_url?: string | null
        }
        Update: {
          archived_at?: string | null
          audio_url?: string | null
          church_id?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          id?: string
          preacher?: string | null
          source_livestream_id?: string | null
          title?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sermons_source_livestream_same_church_fkey"
            columns: ["source_livestream_id", "church_id"]
            isOneToOne: false
            referencedRelation: "church_livestreams"
            referencedColumns: ["id", "church_id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          church_id: string
          created_at: string
          id: string
          payer_phone: string | null
          payment_method: string
          payment_reference: string
          plan: string
          receipt_url: string | null
          rejection_reason: string | null
          requested_by: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          church_id: string
          created_at?: string
          id?: string
          payer_phone?: string | null
          payment_method?: string
          payment_reference: string
          plan: string
          receipt_url?: string | null
          rejection_reason?: string | null
          requested_by: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          church_id?: string
          created_at?: string
          id?: string
          payer_phone?: string | null
          payment_method?: string
          payment_reference?: string
          plan?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          church_id: string
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          message: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          source: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          message?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          source?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          source?: string | null
          title?: string
        }
        Relationships: []
      }
      system_jobs: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          job_name: string
          last_duration_ms: number | null
          last_run_at: string | null
          last_status: string | null
          schedule: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          job_name: string
          last_duration_ms?: number | null
          last_run_at?: string | null
          last_status?: string | null
          schedule?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          job_name?: string
          last_duration_ms?: number | null
          last_run_at?: string | null
          last_status?: string | null
          schedule?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      trial_extensions: {
        Row: {
          church_id: string
          created_at: string
          days_added: number
          extended_by: string
          id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          days_added: number
          extended_by: string
          id?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          days_added?: number
          extended_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_extensions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_duplicate_archive: {
        Row: {
          archive_reason: string
          archived_at: string
          church_id: string | null
          created_at: string | null
          id: string
          normalized_role: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          archive_reason?: string
          archived_at?: string
          church_id?: string | null
          created_at?: string | null
          id: string
          normalized_role?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          archive_reason?: string
          archived_at?: string
          church_id?: string | null
          created_at?: string | null
          id?: string
          normalized_role?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          church_id: string | null
          created_at: string
          id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          church_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          church_id?: string | null
          created_at?: string
          id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      whatsapp_accounts: {
        Row: {
          business_account_id: string
          church_id: string
          created_at: string
          display_phone_number: string | null
          id: string
          phone_number_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_account_id: string
          church_id: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_account_id?: string
          church_id?: string
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          church_id: string
          created_at: string
          id: string
          linked_at: string | null
          member_id: string | null
          normalized_phone: string
          profile_name: string | null
          updated_at: string
          verification_status: string
          wa_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          linked_at?: string | null
          member_id?: string | null
          normalized_phone: string
          profile_name?: string | null
          updated_at?: string
          verification_status?: string
          wa_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          linked_at?: string | null
          member_id?: string | null
          normalized_phone?: string
          profile_name?: string | null
          updated_at?: string
          verification_status?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_contacts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          church_id: string
          contact_id: string
          context: Json
          created_at: string
          current_state: string
          id: string
          last_inbound_at: string | null
          last_outbound_at: string | null
          service_window_expires_at: string | null
          service_window_opened_at: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          contact_id: string
          context?: Json
          created_at?: string
          current_state?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          service_window_expires_at?: string | null
          service_window_opened_at?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          contact_id?: string
          context?: Json
          created_at?: string
          current_state?: string
          id?: string
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          service_window_expires_at?: string | null
          service_window_opened_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_contact_fk"
            columns: ["contact_id", "church_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_intention_audit: {
        Row: {
          church_id: string
          created_at: string
          details: Json
          event_type: string
          id: number
          mass_intention_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          details?: Json
          event_type: string
          id?: never
          mass_intention_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          details?: Json
          event_type?: string
          id?: never
          mass_intention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_intention_audit_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mass_intention_audit_mass_intention_id_fkey"
            columns: ["mass_intention_id"]
            isOneToOne: false
            referencedRelation: "mass_intentions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mass_slots: {
        Row: {
          active: boolean
          capacity: number
          church_id: string
          created_at: string
          id: string
          label: string
          mass_date: string
          mass_time: string
          reserved_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity: number
          church_id: string
          created_at?: string
          id?: string
          label: string
          mass_date: string
          mass_time: string
          reserved_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number
          church_id?: string
          created_at?: string
          id?: string
          label?: string
          mass_date?: string
          mass_time?: string
          reserved_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mass_slots_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          attempt_count: number
          body: string | null
          church_id: string
          claimed_at: string | null
          claimed_by: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          dispatch_status: string
          estimated_cost_usd: number | null
          failed_at: string | null
          failure_category: string | null
          failure_reason: string | null
          id: string
          last_attempt_at: string | null
          message_category: string | null
          message_type: string
          next_attempt_at: string | null
          payload: Json
          provider_message_id: string | null
          read_at: string | null
          requires_template: boolean
          status: string
        }
        Insert: {
          attempt_count?: number
          body?: string | null
          church_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: string
          dispatch_status?: string
          estimated_cost_usd?: number | null
          failed_at?: string | null
          failure_category?: string | null
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          message_category?: string | null
          message_type: string
          next_attempt_at?: string | null
          payload?: Json
          provider_message_id?: string | null
          read_at?: string | null
          requires_template?: boolean
          status?: string
        }
        Update: {
          attempt_count?: number
          body?: string | null
          church_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          dispatch_status?: string
          estimated_cost_usd?: number | null
          failed_at?: string | null
          failure_category?: string | null
          failure_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          message_category?: string | null
          message_type?: string
          next_attempt_at?: string | null
          payload?: Json
          provider_message_id?: string | null
          read_at?: string | null
          requires_template?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_contact_fk"
            columns: ["contact_id", "church_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "whatsapp_message_conversation_fk"
            columns: ["conversation_id", "church_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_payment_attempts: {
        Row: {
          amount: number
          callback_event_key: string | null
          church_id: string
          created_at: string
          currency: string
          id: string
          mass_intention_id: string
          provider: string
          provider_reference: string | null
          secure_token_hash: string
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          callback_event_key?: string | null
          church_id: string
          created_at?: string
          currency: string
          id?: string
          mass_intention_id: string
          provider: string
          provider_reference?: string | null
          secure_token_hash: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          callback_event_key?: string | null
          church_id?: string
          created_at?: string
          currency?: string
          id?: string
          mass_intention_id?: string
          provider?: string
          provider_reference?: string | null
          secure_token_hash?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_payment_attempts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_payment_attempts_mass_intention_id_fkey"
            columns: ["mass_intention_id"]
            isOneToOne: false
            referencedRelation: "mass_intentions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_session_states: {
        Row: {
          church_id: string
          collected_data: Json
          conversation_id: string
          expires_at: string
          flow_name: string
          state: string
          updated_at: string
        }
        Insert: {
          church_id: string
          collected_data?: Json
          conversation_id: string
          expires_at: string
          flow_name?: string
          state: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          collected_data?: Json
          conversation_id?: string
          expires_at?: string
          flow_name?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_session_conversation_fk"
            columns: ["conversation_id", "church_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id", "church_id"]
          },
          {
            foreignKeyName: "whatsapp_session_states_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_usage_daily: {
        Row: {
          authentication_count: number
          church_id: string
          estimated_cost_usd: number
          inbound_count: number
          marketing_count: number
          service_reply_count: number
          usage_date: string
          utility_count: number
        }
        Insert: {
          authentication_count?: number
          church_id: string
          estimated_cost_usd?: number
          inbound_count?: number
          marketing_count?: number
          service_reply_count?: number
          usage_date: string
          utility_count?: number
        }
        Update: {
          authentication_count?: number
          church_id?: string
          estimated_cost_usd?: number
          inbound_count?: number
          marketing_count?: number
          service_reply_count?: number
          usage_date?: string
          utility_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_usage_daily_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          church_id: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          processing_status: string
          provider_event_key: string
          received_at: string
        }
        Insert: {
          church_id?: string | null
          event_type: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider_event_key: string
          received_at?: string
        }
        Update: {
          church_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          processing_status?: string
          provider_event_key?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_logs: {
        Row: {
          action: string | null
          created_at: string | null
          detail: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
          user_name: string | null
          user_role: string | null
        }
        Relationships: []
      }
      bible_translation_metadata: {
        Row: {
          active: boolean | null
          ai_processing_allowed: boolean | null
          attribution_text: string | null
          audio_generation_allowed: boolean | null
          book_count: number | null
          canon_type: string | null
          chapter_count: number | null
          code: string | null
          copyright_notice: string | null
          created_at: string | null
          default_translation: boolean | null
          id: string | null
          language_code: string | null
          license_name: string | null
          license_url: string | null
          name: string | null
          publisher: string | null
          source_url: string | null
          verse_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _count_church_admin_pending_pledge_payments: {
        Args: {
          _church_id: string
          _payment_relation: unknown
          _pledge_relation: unknown
        }
        Returns: number
      }
      _count_church_admin_pending_source: {
        Args: {
          _church_id: string
          _predicate_key: string
          _relation: unknown
          _required_columns: string[]
        }
        Returns: number
      }
      accept_invitation: { Args: { _token: string }; Returns: Json }
      apply_livestream_provider_check: {
        Args: {
          _actual_ended_at?: string
          _actual_started_at?: string
          _checked_at: string
          _church_id: string
          _error_category?: string
          _livestream_id: string
          _provider: string
          _provider_external_id: string
          _provider_status: string
          _recording_url?: string
          _thumbnail_url?: string
        }
        Returns: {
          actual_ended_at: string | null
          actual_started_at: string | null
          church_id: string
          created_at: string
          created_by: string | null
          id: string
          provider: string
          provider_external_id: string | null
          provider_failure_count: number
          provider_last_checked_at: string | null
          provider_last_error_category: string | null
          provider_next_sync_at: string | null
          provider_status: string | null
          recording_url: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          status_source: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          watch_url: string
        }
        SetofOptions: {
          from: "*"
          to: "church_livestreams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_staging_prayer_import:
        | {
            Args: {
              _changes: Json
              _confirmation: string
              _filename: string
              _workbook_checksum: string
            }
            Returns: Json
          }
        | {
            Args: {
              _changes: Json
              _confirmation: string
              _filename: string
              _initiated_by_user_uuid: string
              _workbook_checksum: string
            }
            Returns: Json
          }
      approve_audio_review: {
        Args: { _reason?: string; _review_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "audio_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_audio_version: {
        Args: { _version_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "audio_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_church_member_role: {
        Args: { _church_id: string; _role: string; _user_id: string }
        Returns: Json
      }
      assign_default_member_role:
        | { Args: { _church_id: string; _name: string }; Returns: undefined }
        | { Args: { _church_id: string; _user_id: string }; Returns: undefined }
      baptism_of_the_lord: { Args: { p_year: number }; Returns: string }
      can_access_audio_content: {
        Args: { _content_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_chat_channel: {
        Args: { target_channel_id: string }
        Returns: boolean
      }
      can_manage_church_roles: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_church_workspace: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_event_roster: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_sacramental_records: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_review_pastoral_requests: {
        Args: { p_church_id: string }
        Returns: boolean
      }
      can_view_chat_channel: {
        Args: { target_channel_id: string }
        Returns: boolean
      }
      can_view_church_billing: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_church_workspace: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_event_for_row: {
        Args: {
          _archived_at: string
          _audience_mode: string
          _church_id: string
          _event_id: string
          _user_id: string
          _visibility: string
        }
        Returns: boolean
      }
      cancel_audio_job: {
        Args: { _job_id: string }
        Returns: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      church_code_token: {
        Args: { fallback?: string; value: string }
        Returns: string
      }
      church_permission_constraint_rule: {
        Args: { _action: string; _feature_key: string; _role: string }
        Returns: Json
      }
      claim_whatsapp_messages: {
        Args: {
          _batch_size?: number
          _max_attempts?: number
          _message_id?: string
          _stale_after?: string
          _worker_id: string
        }
        Returns: {
          account_status: string
          attempt_count: number
          body: string
          church_id: string
          contact_id: string
          conversation_id: string
          message_category: string
          message_id: string
          message_type: string
          normalized_phone: string
          payload: Json
          phone_number_id: string
          sent_today: number
          service_window_expires_at: string
          whatsapp_daily_message_limit: number
          whatsapp_enabled: boolean
          whatsapp_mass_intentions_enabled: boolean
        }[]
      }
      complete_public_registration: {
        Args: {
          _church_id: string
          _community_id?: string
          _email: string
          _full_name: string
          _gender: string
          _ministry_ids?: string[]
          _phone: string
          _photo_url: string
        }
        Returns: Json
      }
      complete_whatsapp_dispatch: {
        Args: {
          _failure_category?: string
          _failure_reason?: string
          _message_id: string
          _next_attempt_at?: string
          _outcome: string
          _provider_message_id?: string
          _worker_id: string
        }
        Returns: boolean
      }
      create_audio_job_draft: {
        Args: {
          _book: string
          _chapter: number
          _church_id: string
          _content_type: string
        }
        Returns: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_audit_log: {
        Args: {
          p_action: string
          p_description?: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      create_church_workspace: {
        Args: {
          _address?: string
          _email?: string
          _name: string
          _owner_name?: string
          _phone?: string
        }
        Returns: Json
      }
      create_member_with_relations: {
        Args: {
          p_church_id: string
          p_community_ids?: string[]
          p_date_of_birth?: string
          p_email?: string
          p_family_members?: Json
          p_family_name?: string
          p_full_name: string
          p_gender?: string
          p_is_married?: boolean
          p_ministry_ids?: string[]
          p_phone?: string
          p_primary_family_role?: string
          p_spouse_family_role?: string
          p_spouse_name?: string
          p_wedding_date?: string
        }
        Returns: Json
      }
      create_pledge: {
        Args: {
          _amount_pledged: number
          _church_id: string
          _community_id: string
          _member_id: string
          _target_amount?: number
        }
        Returns: Json
      }
      delete_church_announcement: {
        Args: { _announcement_id: string }
        Returns: Json
      }
      delete_contribution_with_audit: {
        Args: { p_contribution_id: string; p_reason?: string }
        Returns: Json
      }
      delete_old_app_error_logs: { Args: never; Returns: number }
      easter_sunday: { Args: { p_year: number }; Returns: string }
      enforce_rate_limit: {
        Args: {
          _action: string
          _max_attempts: number
          _scope_key: string
          _window: string
        }
        Returns: undefined
      }
      enqueue_audio_job: {
        Args: { _job_id: string }
        Returns: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_birthday_announcements: {
        Args: { _automation_date?: string; _church_id: string }
        Returns: Json
      }
      epiphany_sunday: { Args: { p_year: number }; Returns: string }
      expire_member_record_subscriptions: { Args: never; Returns: number }
      extend_trial: {
        Args: { _church_id: string; _days: number }
        Returns: {
          church_id: string
          created_at: string
          expires_at: string | null
          id: string
          plan: string
          started_at: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      first_sunday_of_advent: { Args: { p_year: number }; Returns: string }
      generate_church_analytics_snapshot: {
        Args: { p_church_id: string }
        Returns: {
          church_id: string
          generated_at: string
          generated_by: string | null
          id: string
          payload: Json
          period_end: string
          period_start: string
          snapshot_type: string
        }
        SetofOptions: {
          from: "*"
          to: "analytics_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_church_code: {
        Args: { _address?: string; _church_name?: string }
        Returns: string
      }
      generate_church_join_code: {
        Args: { _church_name?: string }
        Returns: string
      }
      generate_mass_occurrences: {
        Args: { p_church_id: string; p_end_date: string; p_start_date: string }
        Returns: number
      }
      get_audio_dashboard_summary: {
        Args: { _church_id: string; _recent_limit?: number }
        Returns: Json
      }
      get_audio_operations_health: {
        Args: { _church_id: string }
        Returns: Json
      }
      get_audio_operations_metrics: {
        Args: { _church_id: string }
        Returns: Json
      }
      get_available_mass_occurrences: {
        Args: { p_church_id: string; p_date?: string }
        Returns: {
          booked_count: number
          celebrant_name: string
          end_time: string
          id: string
          intention_capacity: number
          intention_fee: number
          is_full: boolean
          is_special_mass: boolean
          language: string
          location_name: string
          name: string
          occurrence_date: string
          remaining_slots: number
          start_time: string
          status: string
        }[]
      }
      get_church_admin_pending_counts: {
        Args: { _church_id: string }
        Returns: Json
      }
      get_church_dashboard_metrics: {
        Args: { p_church_id: string }
        Returns: Json
      }
      get_church_feature_permission_matrix: {
        Args: { _church_id: string }
        Returns: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_manage: boolean
          can_publish: boolean
          can_view: boolean
          category: string
          church_enabled: boolean
          description: string
          feature_id: string
          feature_key: string
          feature_name: string
          globally_enabled: boolean
          globally_locked: boolean
          member_available: boolean
          role: string
          staff_available: boolean
          subscription_available: boolean
        }[]
      }
      get_church_financial_summary: {
        Args: { _church_id: string; _end_date?: string; _start_date?: string }
        Returns: Json
      }
      get_church_permission_constraints: {
        Args: { _church_id: string; _role: string }
        Returns: {
          action: string
          classification: string
          feature_key: string
          reason: string
          record_scope: string
        }[]
      }
      get_church_pledges_summary: {
        Args: { _church_id: string }
        Returns: {
          balance: number
          community_id: string
          community_name: string
          completed_count: number
          pledge_count: number
          progress_percentage: number
          target_amount: number
          total_paid: number
          total_pledged: number
        }[]
      }
      get_church_role_assignments: {
        Args: { _church_id: string }
        Returns: {
          church_id: string
          created_at: string
          full_name: string
          id: string
          role: string
          user_id: string
        }[]
      }
      get_community_pledges: {
        Args: { _community_id: string }
        Returns: {
          amount_paid: number
          amount_pledged: number
          balance: number
          church_id: string
          community_id: string
          community_name: string
          created_at: string
          id: string
          member_id: string
          member_name: string
          status: string
        }[]
      }
      get_contributions_by_member: {
        Args: {
          p_church_id: string
          p_end_date: string
          p_limit?: number
          p_start_date: string
        }
        Returns: {
          contribution_count: number
          last_contribution_date: string
          member_id: string
          member_name: string
          phone: string
          total_amount: number
        }[]
      }
      get_current_user_context: { Args: never; Returns: Json }
      get_daily_reading_for_date: { Args: { p_date?: string }; Returns: Json }
      get_event_registration_roster: {
        Args: { p_event_id: string }
        Returns: {
          amount_due: number
          attendance_id: string
          attendance_status: string
          audience_mode: string
          church_id: string
          community_names: string
          email: string
          event_end_date: string
          event_id: string
          event_location: string
          event_start_date: string
          event_title: string
          expected_revenue: number
          full_name: string
          latest_payment_status: string
          member_id: string
          ministry_names: string
          payment_reference: string
          payment_status: string
          pending_verification: number
          phone: string
          registered_at: string
          registration_capacity: number
          registration_currency: string
          registration_fee: number
          registration_status: string
          registration_type: string
          verified_revenue: number
        }[]
      }
      get_liturgical_context: {
        Args: { p_date?: string }
        Returns: {
          advent_start: string
          calendar_date: string
          context_source: string
          day_of_week: string
          easter_date: string
          liturgical_season: string
          liturgical_week: number
          liturgical_year: string
          weekday_cycle: string
        }[]
      }
      get_mass_intentions_admin_page: {
        Args: {
          p_church_id: string
          p_limit?: number
          p_mass_date?: string
          p_mass_time?: string
          p_offset?: number
          p_payment_status?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_mass_intentions_admin_page_v2: {
        Args: {
          p_church_id: string
          p_limit?: number
          p_mass_date?: string
          p_mass_occurrence_id?: string
          p_mass_time?: string
          p_offset?: number
          p_payment_status?: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_member_pledges: {
        Args: { _member_id: string }
        Returns: {
          amount_paid: number
          amount_pledged: number
          balance: number
          church_id: string
          community_id: string
          community_name: string
          created_at: string
          id: string
          member_id: string
          member_name: string
          status: string
        }[]
      }
      get_next_mass_summary: { Args: { p_church_id?: string }; Returns: Json }
      get_platform_dashboard_metrics: { Args: never; Returns: Json }
      get_portal_announcements: {
        Args: { _church_id: string; _limit?: number }
        Returns: {
          archived_at: string
          audience: string[]
          category: string
          church_id: string
          content: string
          created_at: string
          created_by: string
          expires_at: string
          featured: boolean
          id: string
          is_published: boolean
          publish_at: string
          published_at: string
          show_on_calendar: boolean
          status: string
          title: string
          updated_at: string
        }[]
      }
      get_public_invitation: {
        Args: { _token: string }
        Returns: {
          church_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }[]
      }
      get_public_join_church: {
        Args: { _slug: string }
        Returns: {
          church_code: string
          code: string
          id: string
          logo_url: string
          metadata: Json
          name: string
          short_code: string
          slug: string
        }[]
      }
      get_public_registration_church: {
        Args: { _church_code?: string; _church_id?: string }
        Returns: {
          church_code: string
          code: string
          id: string
          metadata: Json
          name: string
          short_code: string
        }[]
      }
      get_public_registration_communities: {
        Args: { _church_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_public_registration_ministries: {
        Args: { _church_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_published_audio_lookup: {
        Args: {
          _book_normalized: string
          _chapter: number
          _church_id: string
          _content_type: string
        }
        Returns: {
          audio_url: string
          job_id: string
          published_at: string
          version_id: string
          version_number: number
        }[]
      }
      get_sacramental_records: {
        Args: { _church_id: string; _search?: string }
        Returns: {
          archived_at: string
          certificate_issued_at: string
          certificate_number: string
          certificate_ready_at: string
          church_id: string
          created_at: string
          documents: Json
          id: string
          location: string
          member_id: string
          member_name: string
          minister: string
          notes: string
          parents: Json
          preparation: Json
          register_page: string
          sacrament_date: string
          sacrament_type: string
          sponsors: Json
          spouse: Json
          status: string
          updated_at: string
          witnesses: Json
        }[]
      }
      get_saint_of_the_day: {
        Args: never
        Returns: {
          biography_long: string
          biography_short: string
          birth_year: number
          color_theme: string
          country: string
          death_year: number
          feast_day: number
          feast_month: number
          id: string
          image_url: string
          is_featured: boolean
          liturgical_rank: string
          name: string
          patron_of: string
          prayer: string
          quote: string
          reflection: string
          scripture_reference: string
          slug: string
          tags: string[]
          title: string
        }[]
      }
      get_today_reading: { Args: never; Returns: Json }
      get_user_church_id: { Args: never; Returns: string }
      get_user_led_communities: {
        Args: { _user_id: string }
        Returns: {
          church_id: string
          community_id: string
          community_name: string
          leadership_role: string
        }[]
      }
      global_search: { Args: { search_text: string }; Returns: Json }
      has_audio_publisher_role: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      has_audio_reviewer_role: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      has_church_feature_permission: {
        Args: {
          _action: string
          _church_id: string
          _feature_key: string
          _user_id: string
        }
        Returns: boolean
      }
      has_related_feature_permission: {
        Args: { _action: string; _row: Json; _table: string }
        Returns: boolean
      }
      is_active_church_member: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_admin_for_church: {
        Args: { target_church_id: string }
        Returns: boolean
      }
      is_church_admin: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_church_member: {
        Args: { _church_id: string; _user_id: string }
        Returns: boolean
      }
      is_current_user_community_leader_for: {
        Args: { target_church_id: string; target_community_id: string }
        Returns: boolean
      }
      is_feature_available_for_church: {
        Args: { _church_id: string; _feature_key: string }
        Returns: boolean
      }
      is_platform_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_pledge_admin_for_church: {
        Args: { _church_id: string }
        Returns: boolean
      }
      is_pledge_leader_for_community: {
        Args: { _community_id: string }
        Returns: boolean
      }
      is_pledge_owner: { Args: { _member_id: string }; Returns: boolean }
      is_service_feature_available: {
        Args: { _church_id: string; _feature_key: string }
        Returns: boolean
      }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      join_church_workspace: {
        Args: {
          _community_id?: string
          _email?: string
          _full_name: string
          _gender?: string
          _ministry_ids?: string[]
          _phone?: string
          _photo_url?: string
          _slug: string
        }
        Returns: Json
      }
      list_audio_jobs_page: {
        Args: {
          _church_id: string
          _limit?: number
          _offset?: number
          _search?: string
          _sort_asc?: boolean
          _status?: string
        }
        Returns: {
          audio_url: string
          book: string
          chapter: number
          church_id: string
          completed_at: string
          content_type: string
          created_at: string
          created_by: string
          error_message: string
          id: string
          index_url: string
          manifest_url: string
          processing_stage: string
          progress: number
          report_url: string
          started_at: string
          status: string
          text_url: string
          total_count: number
          updated_at: string
        }[]
      }
      liturgical_cycle_year: { Args: { p_date: string }; Returns: number }
      liturgical_year_letter: { Args: { p_date: string }; Returns: string }
      log_app_error: {
        Args: {
          p_browser_info?: string
          p_church_id?: string
          p_component?: string
          p_function_name?: string
          p_level: string
          p_message: string
          p_metadata?: Json
          p_page?: string
          p_route?: string
          p_stack?: string
          p_user_id?: string
        }
        Returns: {
          browser_info: string | null
          church_id: string | null
          component: string | null
          created_at: string
          function_name: string | null
          id: string
          level: string
          message: string
          metadata: Json
          occurrence_count: number
          page: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          stack: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "app_error_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      log_operational_event: {
        Args: {
          _church_id: string
          _event_type: string
          _job_id: string
          _message?: string
          _metadata?: Json
          _severity?: string
          _source?: string
        }
        Returns: string
      }
      make_church_join_slug: {
        Args: { _church_id?: string; _name: string }
        Returns: string
      }
      make_pledge_payment: {
        Args: {
          _amount: number
          _payment_method: string
          _pledge_id: string
          _proof_url?: string
          _transaction_id?: string
        }
        Returns: Json
      }
      mark_event_registration_attendance: {
        Args: {
          p_attendance_ids: string[]
          p_attendance_status: string
          p_event_id: string
        }
        Returns: Json
      }
      notify_mass_rsvp_reminders: { Args: never; Returns: Json }
      publish_livestream_as_sermon: {
        Args: {
          _content?: string | null
          _livestream_id: string
          _preacher?: string | null
          _sermon_date?: string | null
          _title: string
        }
        Returns: string
      }
      publish_audio_version: {
        Args: { _version_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "audio_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recommended_church_feature_permission: {
        Args: {
          _action: string
          _feature_key: string
          _member_available: boolean
          _role: string
          _staff_available: boolean
        }
        Returns: boolean
      }
      record_audio_worker_heartbeat: {
        Args: {
          _current_job_id?: string
          _metadata?: Json
          _status?: string
          _worker_id: string
          _worker_type?: string
        }
        Returns: {
          created_at: string
          current_job_id: string | null
          id: string
          last_seen_at: string
          metadata: Json
          status: string
          updated_at: string
          worker_id: string
          worker_type: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_worker_heartbeats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_contribution_with_key: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_church_id: string
          p_donor_name?: string
          p_idempotency_key: string
          p_member_id?: string
          p_notes?: string
          p_payment_reference?: string
          p_phone?: string
        }
        Returns: Json
      }
      record_portal_contribution: {
        Args: {
          _amount: number
          _category_id?: string
          _church_id: string
          _donor_name?: string
          _member_id?: string
          _notes?: string
          _payment_reference?: string
          _phone?: string
        }
        Returns: Json
      }
      record_prayer_read: { Args: { _prayer_id: string }; Returns: undefined }
      register_audio_asset: {
        Args: {
          _asset_type: string
          _content_type?: string
          _file_name?: string
          _file_size?: number
          _job_id: string
          _storage_bucket: string
          _storage_path: string
        }
        Returns: {
          asset_type: string
          audio_url: string | null
          checksum_sha256: string | null
          church_id: string
          completed_at: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          file_name: string | null
          file_size: number | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          public_url: string | null
          report_url: string | null
          started_at: string | null
          status: string
          storage_bucket: string
          storage_path: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_for_event: { Args: { _event_id: string }; Returns: Json }
      remove_church_member_role: { Args: { _role_id: string }; Returns: Json }
      resolve_announcement_status: {
        Args: {
          _archived_at: string
          _expires_at: string
          _featured: boolean
          _is_published: boolean
          _never_expires: boolean
          _publish_at: string
        }
        Returns: string
      }
      resolve_app_error_log: {
        Args: { p_log_id: string }
        Returns: {
          browser_info: string | null
          church_id: string | null
          component: string | null
          created_at: string
          function_name: string | null
          id: string
          level: string
          message: string
          metadata: Json
          occurrence_count: number
          page: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          route: string | null
          stack: string | null
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "app_error_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retry_audio_job: {
        Args: { _job_id: string }
        Returns: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_event_registration_payment: {
        Args: { _approve: boolean; _payment_id: string; _reason?: string }
        Returns: Json
      }
      review_member_record_subscription: {
        Args: {
          p_approved: boolean
          p_rejection_reason?: string
          p_subscription_id: string
        }
        Returns: {
          amount: number
          church_id: string
          created_at: string
          end_date: string | null
          id: string
          member_id: string
          plan_interval: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: string
          transaction_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "member_record_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_pledge_payment: {
        Args: { _approve: boolean; _payment_id: string; _reason?: string }
        Returns: Json
      }
      review_subscription_payment: {
        Args: {
          _approved: boolean
          _payment_id: string
          _rejection_reason?: string
        }
        Returns: {
          amount: number
          church_id: string
          created_at: string
          id: string
          payer_phone: string | null
          payment_method: string
          payment_reference: string
          plan: string
          receipt_url: string | null
          rejection_reason: string | null
          requested_by: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "subscription_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_daily_automations: { Args: never; Returns: undefined }
      save_audio_verse_review: {
        Args: {
          _confidence: number
          _end_time: number
          _job_id: string
          _notes?: string
          _review_id: string
          _start_time: number
          _verse_number: number
          _verse_text: string
        }
        Returns: {
          church_id: string
          confidence: number
          created_at: string
          created_by: string | null
          duration: number
          end_time: number
          id: string
          job_id: string
          manually_edited: boolean
          notes: string | null
          review_id: string | null
          start_time: number
          status: string
          updated_at: string
          updated_by: string | null
          verse_number: number
          verse_text: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_verse_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_church_announcement: {
        Args: {
          _announcement_id: string
          _audience?: string[]
          _category?: string
          _church_id: string
          _content: string
          _expires_at?: string
          _featured?: boolean
          _is_published?: boolean
          _never_expires?: boolean
          _notification_strategy?: string
          _publish_at?: string
          _show_on_calendar?: boolean
          _target_community?: string
          _target_ministry?: string
          _timezone?: string
          _title: string
        }
        Returns: Json
      }
      save_church_role_permissions: {
        Args: { _church_id: string; _permissions: Json; _role: string }
        Returns: undefined
      }
      save_sacramental_record: {
        Args: {
          _certificate_number: string
          _church_id: string
          _documents: Json
          _location: string
          _member_id: string
          _minister: string
          _notes: string
          _parents: Json
          _preparation: Json
          _record_id: string
          _register_page: string
          _sacrament_date: string
          _sacrament_type: string
          _sponsors: Json
          _spouse: Json
          _status: string
          _witnesses: Json
        }
        Returns: Json
      }
      set_church_announcement_archived: {
        Args: { _announcement_id: string; _archived: boolean }
        Returns: Json
      }
      set_church_feature_enabled: {
        Args: { _church_id: string; _enabled: boolean; _feature_key: string }
        Returns: undefined
      }
      set_super_admin_church_feature: {
        Args: {
          _church_id: string
          _enabled: boolean
          _feature_key: string
          _locked?: boolean
        }
        Returns: undefined
      }
      submit_community_help_donation: {
        Args: {
          p_help_request_id: string
          p_idempotency_key: string
          p_member_id: string
          p_net_amount: number
        }
        Returns: Json
      }
      submit_event_registration_payment: {
        Args: {
          _attendance_id: string
          _payment_method: string
          _proof_url?: string
          _transaction_reference?: string
        }
        Returns: Json
      }
      submit_mass_response: {
        Args: {
          p_mass_event_id: string
          p_member_id: string
          p_response: string
        }
        Returns: Json
      }
      submit_portal_mass_intention: {
        Args: {
          p_church_id: string
          p_idempotency_key?: string
          p_intention_type: string
          p_member_id: string
          p_message: string
          p_offering_amount: number
          p_requested_mass_date?: string
        }
        Returns: Json
      }
      submit_portal_mass_intention_for_occurrence: {
        Args: {
          p_church_id: string
          p_idempotency_key: string
          p_intention_type: string
          p_mass_occurrence_id: string
          p_member_id: string
          p_message: string
          p_offering_amount: number
        }
        Returns: Json
      }
      submit_portal_prayer_request: {
        Args: {
          p_church_id: string
          p_idempotency_key?: string
          p_member_id: string
          p_offering_amount?: number
          p_privacy?: string
          p_request_text: string
        }
        Returns: Json
      }
      submit_public_contribution: {
        Args: {
          p_amount: number
          p_church_slug_or_id: string
          p_contribution_type: string
          p_donor_name: string
          p_note?: string
          p_phone: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      submit_subscription_payment: {
        Args: {
          _church_id: string
          _payer_phone?: string
          _payment_reference: string
          _plan: string
          _receipt_url?: string
        }
        Returns: {
          amount: number
          church_id: string
          created_at: string
          id: string
          payer_phone: string | null
          payment_method: string
          payment_reference: string
          plan: string
          receipt_url: string | null
          rejection_reason: string | null
          requested_by: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "subscription_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      swahili_day_name: { Args: { p_date: string }; Returns: string }
      toggle_system_job: {
        Args: { p_enabled: boolean; p_job_id: string }
        Returns: undefined
      }
      transition_church_livestream: {
        Args: { _livestream_id: string; _new_status: string }
        Returns: {
          actual_ended_at: string | null
          actual_started_at: string | null
          church_id: string
          created_at: string
          created_by: string | null
          id: string
          provider: string
          provider_external_id: string | null
          provider_failure_count: number
          provider_last_checked_at: string | null
          provider_last_error_category: string | null
          provider_next_sync_at: string | null
          provider_status: string | null
          recording_url: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          status_source: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
          watch_url: string
        }
        SetofOptions: {
          from: "*"
          to: "church_livestreams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unpublish_audio_version: {
        Args: { _version_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
          version_number: number
        }
        SetofOptions: {
          from: "*"
          to: "audio_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_announcement_lifecycle: {
        Args: { _church_id?: string }
        Returns: Json
      }
      update_audio_review_decision: {
        Args: { _reason?: string; _review_id: string; _status: string }
        Returns: {
          audio_url: string | null
          church_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          index_url: string | null
          job_id: string
          manifest_url: string | null
          notes: string | null
          processing_stage: string
          progress: number
          report_url: string | null
          reviewer_id: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_community_leadership: {
        Args: {
          _community_id: string
          _member_id?: string
          _role_field: string
        }
        Returns: Json
      }
      update_contribution_with_audit: {
        Args: {
          p_amount: number
          p_category_id?: string
          p_contribution_id: string
          p_donor_name?: string
          p_member_id?: string
          p_notes?: string
          p_payment_reference?: string
          p_phone?: string
          p_reason?: string
        }
        Returns: Json
      }
      weekday_lectionary_cycle: { Args: { p_date: string }; Returns: string }
      whatsapp_dispatch_schema_diagnostics: { Args: never; Returns: Json }
      worker_update_audio_job: {
        Args: {
          _audio_url?: string
          _error_message?: string
          _index_url?: string
          _job_id: string
          _manifest_url?: string
          _processing_stage: string
          _progress: number
          _report_url?: string
          _status: string
          _text_url?: string
        }
        Returns: {
          audio_url: string | null
          book: string
          cancelled_at: string | null
          chapter: number
          church_id: string
          completed_at: string | null
          content_type: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          index_url: string | null
          manifest_url: string | null
          processing_stage: string
          progress: number
          published_at: string | null
          published_by: string | null
          queued_at: string | null
          report_url: string | null
          started_at: string | null
          status: string
          text_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "audio_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      write_audit_event: {
        Args: {
          p_action: string
          p_church_id: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_source?: string
        }
        Returns: string
      }
      youtube_video_id: { Args: { _url: string }; Returns: string }
    }
    Enums: {
      notification_type: "info" | "warning" | "success" | "error"
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
      notification_type: ["info", "warning", "success", "error"],
    },
  },
} as const
