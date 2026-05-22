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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          church_id: string | null
          created_at: string
          detail: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
          user_name: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          church_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          church_id?: string | null
          created_at?: string
          detail?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
          user_name?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_church_id_fkey"
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
          church_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          church_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          church_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      addons: {
        Row: {
          addon_name: Database["public"]["Enums"]["billing_addon_name"]
          church_id: string
          created_at: string
          id: string
          purchased: boolean
          purchased_at: string | null
          updated_at: string
        }
        Insert: {
          addon_name: Database["public"]["Enums"]["billing_addon_name"]
          church_id: string
          created_at?: string
          id?: string
          purchased?: boolean
          purchased_at?: string | null
          updated_at?: string
        }
        Update: {
          addon_name?: Database["public"]["Enums"]["billing_addon_name"]
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
      bible_verses: {
        Row: {
          church_id: string
          created_at: string
          id: string
          is_active: boolean
          reference: string
          text: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          reference: string
          text: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          reference?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "bible_verses_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_features: {
        Row: {
          church_id: string
          created_at: string
          enabled: boolean
          feature_id: string
          id: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          enabled?: boolean
          feature_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          enabled?: boolean
          feature_id?: string
          id?: string
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
      church_subscriptions: {
        Row: {
          church_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_subscriptions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          banner_url: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          metadata: Json | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["church_status"]
          theme_color: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          banner_url?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["church_status"]
          theme_color?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          banner_url?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["church_status"]
          theme_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          church_id: string
          created_at: string
          description: string | null
          id: string
          katibu_id: string | null
          leader_id: string | null
          makamu_mwenyekiti_id: string | null
          mweka_hazina_id: string | null
          mwenyekiti_id: string | null
          name: string
          status: Database["public"]["Enums"]["church_status"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          description?: string | null
          id?: string
          katibu_id?: string | null
          leader_id?: string | null
          makamu_mwenyekiti_id?: string | null
          mweka_hazina_id?: string | null
          mwenyekiti_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["church_status"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          description?: string | null
          id?: string
          katibu_id?: string | null
          leader_id?: string | null
          makamu_mwenyekiti_id?: string | null
          mweka_hazina_id?: string | null
          mwenyekiti_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["church_status"]
          updated_at?: string
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
            foreignKeyName: "communities_katibu_id_fkey"
            columns: ["katibu_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
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
        ]
      }
      community_help_requests: {
        Row: {
          category: string
          church_id: string
          created_at: string
          current_amount: number
          description: string
          id: string
          member_id: string | null
          status: Database["public"]["Enums"]["help_request_status"]
          target_amount: number | null
        }
        Insert: {
          category: string
          church_id: string
          created_at?: string
          current_amount?: number
          description: string
          id?: string
          member_id?: string | null
          status?: Database["public"]["Enums"]["help_request_status"]
          target_amount?: number | null
        }
        Update: {
          category?: string
          church_id?: string
          created_at?: string
          current_amount?: number
          description?: string
          id?: string
          member_id?: string | null
          status?: Database["public"]["Enums"]["help_request_status"]
          target_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_help_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_help_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          member_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          member_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
          church_id: string
          created_at: string
          description: string | null
          id: string
          is_special: boolean
          name: string
        }
        Insert: {
          church_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_special?: boolean
          name: string
        }
        Update: {
          church_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_special?: boolean
          name?: string
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
          church_id: string
          community_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date: string
          donor_name: string | null
          id: string
          member_id: string | null
          notes: string | null
          payment_reference: string | null
          phone: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          church_id: string
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          donor_name?: string | null
          id?: string
          member_id?: string | null
          notes?: string | null
          payment_reference?: string | null
          phone?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          church_id?: string
          community_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date?: string
          donor_name?: string | null
          id?: string
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
            foreignKeyName: "contributions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requests: {
        Row: {
          admin_notes: string | null
          church_id: string
          created_at: string
          description: string | null
          id: string
          member_id: string | null
          preferred_date: string | null
          request_type: Database["public"]["Enums"]["event_request_type"]
          requester_name: string
          requester_phone: string | null
          status: Database["public"]["Enums"]["event_request_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          church_id: string
          created_at?: string
          description?: string | null
          id?: string
          member_id?: string | null
          preferred_date?: string | null
          request_type?: Database["public"]["Enums"]["event_request_type"]
          requester_name: string
          requester_phone?: string | null
          status?: Database["public"]["Enums"]["event_request_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          church_id?: string
          created_at?: string
          description?: string | null
          id?: string
          member_id?: string | null
          preferred_date?: string | null
          request_type?: Database["public"]["Enums"]["event_request_type"]
          requester_name?: string
          requester_phone?: string | null
          status?: Database["public"]["Enums"]["event_request_status"]
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
            foreignKeyName: "event_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendances: {
        Row: {
          church_id: string
          created_at: string
          event_id: string
          id: string
          member_id: string
          responded_at: string
          response: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          event_id: string
          id?: string
          member_id: string
          responded_at?: string
          response: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          event_id?: string
          id?: string
          member_id?: string
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
      events: {
        Row: {
          archived_at: string | null
          church_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          start_date: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          church_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          church_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          church_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          wedding_date: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          wedding_date?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          wedding_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          member_id: string
          role: Database["public"]["Enums"]["family_role"]
        }
        Insert: {
          family_id: string
          id?: string
          member_id: string
          role?: Database["public"]["Enums"]["family_role"]
        }
        Update: {
          family_id?: string
          id?: string
          member_id?: string
          role?: Database["public"]["Enums"]["family_role"]
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
          church_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          church_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
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
      mass_intentions: {
        Row: {
          church_id: string
          created_at: string
          id: string
          intention_type: string
          message: string
          member_id: string | null
          offering_amount: number | null
          status: Database["public"]["Enums"]["mass_intention_status"]
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          intention_type?: string
          message: string
          member_id?: string | null
          offering_amount?: number | null
          status?: Database["public"]["Enums"]["mass_intention_status"]
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          intention_type?: string
          message?: string
          member_id?: string | null
          offering_amount?: number | null
          status?: Database["public"]["Enums"]["mass_intention_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mass_intentions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mass_intentions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
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
          status: string
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
      members: {
        Row: {
          address: string | null
          church_id: string
          created_at: string
          date_joined: string | null
          date_of_birth: string | null
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          church_id: string
          created_at?: string
          date_joined?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          church_id?: string
          created_at?: string
          date_joined?: string | null
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          church_id: string
          created_at: string
          description: string | null
          id: string
          leader_id: string | null
          name: string
          status: Database["public"]["Enums"]["church_status"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          name: string
          status?: Database["public"]["Enums"]["church_status"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string | null
          name?: string
          status?: Database["public"]["Enums"]["church_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministries_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_members: {
        Row: {
          id: string
          joined_at: string
          member_id: string
          ministry_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          member_id: string
          ministry_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          member_id?: string
          ministry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministry_members_ministry_id_fkey"
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
      plan_features: {
        Row: {
          feature_id: string
          id: string
          plan_id: string
        }
        Insert: {
          feature_id: string
          id?: string
          plan_id: string
        }
        Update: {
          feature_id?: string
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "platform_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_features: {
        Row: {
          created_at: string
          description: string | null
          globally_enabled: boolean
          globally_locked: boolean
          id: string
          is_global: boolean
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          globally_enabled?: boolean
          globally_locked?: boolean
          id?: string
          is_global?: boolean
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          globally_enabled?: boolean
          globally_locked?: boolean
          id?: string
          is_global?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          allow_downgrades: boolean
          auto_expire_trials: boolean
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
      pledge_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          member_id: string
          payment_method: string
          pledge_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          member_id: string
          payment_method: string
          pledge_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          member_id?: string
          payment_method?: string
          pledge_id?: string
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
      prayer_requests: {
        Row: {
          church_id: string
          created_at: string
          id: string
          member_id: string | null
          offering_amount: number | null
          request_text: string
          status: Database["public"]["Enums"]["prayer_status"]
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          member_id?: string | null
          offering_amount?: number | null
          request_text: string
          status?: Database["public"]["Enums"]["prayer_status"]
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          member_id?: string | null
          offering_amount?: number | null
          request_text?: string
          status?: Database["public"]["Enums"]["prayer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "prayer_requests_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prayer_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sermons: {
        Row: {
          archived_at: string | null
          audio_url: string | null
          church_id: string
          content: string | null
          created_at: string
          date: string
          id: string
          preacher: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          archived_at?: string | null
          audio_url?: string | null
          church_id: string
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          preacher?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          archived_at?: string | null
          audio_url?: string | null
          church_id?: string
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          preacher?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sermons_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          max_members: number | null
          name: Database["public"]["Enums"]["subscription_plan"]
          price_monthly: number
          price_yearly: number
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          name: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          price_yearly?: number
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          name?: Database["public"]["Enums"]["subscription_plan"]
          price_monthly?: number
          price_yearly?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          church_id: string
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["billing_plan"]
          started_at: string
          status: Database["public"]["Enums"]["billing_status"]
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["billing_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["billing_status"]
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["billing_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["billing_status"]
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
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
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
      user_roles: {
        Row: {
          church_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: Json }
      create_pledge: {
        Args: {
          _amount_pledged: number
          _church_id: string
          _community_id?: string | null
          _member_id: string
          _target_amount?: number | null
        }
        Returns: Json
      }
      extend_trial: {
        Args: { _church_id: string; _days: number }
        Returns: {
          church_id: string
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["billing_plan"]
          started_at: string
          status: Database["public"]["Enums"]["billing_status"]
          updated_at: string
        }
      }
      generate_church_code: { Args: never; Returns: string }
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
      get_community_pledges: {
        Args: { _community_id: string }
        Returns: {
          amount_paid: number
          amount_pledged: number
          balance: number
          church_id: string
          community_id: string | null
          community_name: string | null
          created_at: string
          id: string
          member_id: string
          member_name: string
          status: string
        }[]
      }
      get_member_pledges: {
        Args: { _member_id: string }
        Returns: {
          amount_paid: number
          amount_pledged: number
          balance: number
          church_id: string
          community_id: string | null
          community_name: string | null
          created_at: string
          id: string
          member_id: string
          member_name: string
          status: string
        }[]
      }
      get_user_church_id: { Args: { _user_id: string }; Returns: string }
      get_user_led_communities: {
        Args: { _user_id: string }
        Returns: {
          church_id: string
          community_id: string
          community_name: string
          leadership_role: string
        }[]
      }
      has_church_role: {
        Args: {
          _church_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      is_community_leader: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
      }
      make_pledge_payment: {
        Args: { _amount: number; _payment_method: string; _pledge_id: string }
        Returns: Json
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "church_admin"
        | "pastor"
        | "secretary"
        | "treasurer"
        | "member"
      billing_addon_name: "member_portal"
      billing_plan: "free" | "basic" | "intermediate" | "pro" | "enterprise"
      billing_status: "active" | "trial" | "expired"
      church_status: "active" | "inactive" | "suspended"
      event_request_status: "pending" | "approved" | "rejected" | "completed"
      event_request_type: "wedding" | "baptism" | "funeral" | "other"
      event_status: "upcoming" | "ongoing" | "completed" | "cancelled"
      family_role: "father" | "mother" | "child" | "guardian" | "other"
      gender_type: "male" | "female"
      help_request_status: "pending" | "approved" | "rejected"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      mass_intention_status: "pending" | "approved" | "rejected"
      member_status: "active" | "inactive" | "pending"
      notification_type: "info" | "warning" | "success" | "error"
      prayer_status: "pending" | "approved" | "rejected"
      subscription_plan: "free" | "starter" | "growth" | "premium"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "cancelled"
        | "expired"
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
      app_role: [
        "super_admin",
        "church_admin",
        "pastor",
        "secretary",
        "treasurer",
        "member",
      ],
      billing_addon_name: ["member_portal"],
      billing_plan: ["free", "basic", "intermediate", "pro", "enterprise"],
      billing_status: ["active", "trial", "expired"],
      church_status: ["active", "inactive", "suspended"],
      event_request_status: ["pending", "approved", "rejected", "completed"],
      event_request_type: ["wedding", "baptism", "funeral", "other"],
      event_status: ["upcoming", "ongoing", "completed", "cancelled"],
      family_role: ["father", "mother", "child", "guardian", "other"],
      gender_type: ["male", "female"],
      help_request_status: ["pending", "approved", "rejected"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      mass_intention_status: ["pending", "approved", "rejected"],
      member_status: ["active", "inactive", "pending"],
      notification_type: ["info", "warning", "success", "error"],
      prayer_status: ["pending", "approved", "rejected"],
      subscription_plan: ["free", "starter", "growth", "premium"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "cancelled",
        "expired",
      ],
    },
  },
} as const
