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
          created_at: string
          details: string | null
          id: string
          tenant_id: string | null
          user_email: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          tenant_id?: string | null
          user_email?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          tenant_id?: string | null
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_config: {
        Row: {
          ai_enabled: boolean | null
          api_base_url: string | null
          api_key_encrypted: string | null
          auto_handoff_on_negative_sentiment: boolean | null
          booking_mode: string
          created_at: string | null
          elevenlabs_api_key_encrypted: string | null
          elevenlabs_model_id: string | null
          elevenlabs_voice_id: string | null
          embedding_model: string | null
          fresha_api_base_url: string | null
          fresha_location_id: string | null
          fresha_partner_token_encrypted: string | null
          handoff_keywords: string[] | null
          handoff_notify_email: string | null
          handoff_notify_sms: boolean | null
          id: string
          max_tokens: number | null
          model_name: string | null
          sinch_app_id: string | null
          sinch_client_id: string | null
          sinch_client_secret_encrypted: string | null
          sinch_project_id: string | null
          sinch_region: string | null
          sinch_webhook_secret: string | null
          system_prompt_override: string | null
          temperature: number | null
          tenant_id: string
          twilio_voice_webhook_url: string | null
          updated_at: string | null
          voice_agent_enabled: boolean | null
          voice_greeting: string | null
          voice_language: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          api_base_url?: string | null
          api_key_encrypted?: string | null
          auto_handoff_on_negative_sentiment?: boolean | null
          booking_mode?: string
          created_at?: string | null
          elevenlabs_api_key_encrypted?: string | null
          elevenlabs_model_id?: string | null
          elevenlabs_voice_id?: string | null
          embedding_model?: string | null
          fresha_api_base_url?: string | null
          fresha_location_id?: string | null
          fresha_partner_token_encrypted?: string | null
          handoff_keywords?: string[] | null
          handoff_notify_email?: string | null
          handoff_notify_sms?: boolean | null
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          sinch_app_id?: string | null
          sinch_client_id?: string | null
          sinch_client_secret_encrypted?: string | null
          sinch_project_id?: string | null
          sinch_region?: string | null
          sinch_webhook_secret?: string | null
          system_prompt_override?: string | null
          temperature?: number | null
          tenant_id: string
          twilio_voice_webhook_url?: string | null
          updated_at?: string | null
          voice_agent_enabled?: boolean | null
          voice_greeting?: string | null
          voice_language?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          api_base_url?: string | null
          api_key_encrypted?: string | null
          auto_handoff_on_negative_sentiment?: boolean | null
          booking_mode?: string
          created_at?: string | null
          elevenlabs_api_key_encrypted?: string | null
          elevenlabs_model_id?: string | null
          elevenlabs_voice_id?: string | null
          embedding_model?: string | null
          fresha_api_base_url?: string | null
          fresha_location_id?: string | null
          fresha_partner_token_encrypted?: string | null
          handoff_keywords?: string[] | null
          handoff_notify_email?: string | null
          handoff_notify_sms?: boolean | null
          id?: string
          max_tokens?: number | null
          model_name?: string | null
          sinch_app_id?: string | null
          sinch_client_id?: string | null
          sinch_client_secret_encrypted?: string | null
          sinch_project_id?: string | null
          sinch_region?: string | null
          sinch_webhook_secret?: string | null
          system_prompt_override?: string | null
          temperature?: number | null
          tenant_id?: string
          twilio_voice_webhook_url?: string | null
          updated_at?: string | null
          voice_agent_enabled?: boolean | null
          voice_greeting?: string | null
          voice_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          expires_at: string | null
          key: string
          key_version: number
          previous_value: string | null
          rotated_at: string | null
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          expires_at?: string | null
          key: string
          key_version?: number
          previous_value?: string | null
          rotated_at?: string | null
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          expires_at?: string | null
          key?: string
          key_version?: number
          previous_value?: string | null
          rotated_at?: string | null
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id: string
          notes: string | null
          payment_intent_id: string | null
          payment_provider: string | null
          payment_status: string
          service_id: string
          start_time: string
          status: string
          tenant_id: string | null
          therapist_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          service_id: string
          start_time: string
          status?: string
          tenant_id?: string | null
          therapist_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          end_time?: string
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_provider?: string | null
          payment_status?: string
          service_id?: string
          start_time?: string
          status?: string
          tenant_id?: string | null
          therapist_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_trading_hours: {
        Row: {
          branch_id: string
          created_at: string
          days_label: string
          hours_label: string
          id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          days_label: string
          hours_label: string
          id?: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          days_label?: string
          hours_label?: string
          id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_trading_hours_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_trading_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          address_note: string | null
          city: string | null
          created_at: string
          id: string
          image_url: string | null
          instagram: string | null
          is_active: boolean
          map_embed_url: string | null
          name: string
          phone: string | null
          public_holidays: string | null
          short_label: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address: string
          address_note?: string | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          map_embed_url?: string | null
          name: string
          phone?: string | null
          public_holidays?: string | null
          short_label: string
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          address_note?: string | null
          city?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          instagram?: string | null
          is_active?: boolean
          map_embed_url?: string | null
          name?: string
          phone?: string | null
          public_holidays?: string | null
          short_label?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          content_type: string | null
          conversation_id: string
          created_at: string | null
          direction: string
          external_message_id: string | null
          id: string
          metadata: Json | null
          sender_name: string | null
          sender_type: string
          tenant_id: string
        }
        Insert: {
          content: string
          content_type?: string | null
          conversation_id: string
          created_at?: string | null
          direction: string
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          sender_name?: string | null
          sender_type: string
          tenant_id: string
        }
        Update: {
          content?: string
          content_type?: string | null
          conversation_id?: string
          created_at?: string | null
          direction?: string
          external_message_id?: string | null
          id?: string
          metadata?: Json | null
          sender_name?: string | null
          sender_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          assigned_to: string | null
          contact_avatar_url: string | null
          contact_identifier: string | null
          contact_name: string | null
          created_at: string | null
          external_contact_id: string | null
          external_conversation_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json | null
          platform: string
          status: string
          tenant_id: string
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          ai_enabled?: boolean
          assigned_to?: string | null
          contact_avatar_url?: string | null
          contact_identifier?: string | null
          contact_name?: string | null
          created_at?: string | null
          external_contact_id?: string | null
          external_conversation_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json | null
          platform?: string
          status?: string
          tenant_id: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_enabled?: boolean
          assigned_to?: string | null
          contact_avatar_url?: string | null
          contact_identifier?: string | null
          contact_name?: string | null
          created_at?: string | null
          external_contact_id?: string | null
          external_conversation_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json | null
          platform?: string
          status?: string
          tenant_id?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_amount: number
          discount_percent: number
          id: string
          is_active: boolean
          max_uses: number | null
          tenant_id: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_amount?: number
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          tenant_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_amount?: number
          discount_percent?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          tenant_id?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          tenant_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          tenant_id?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          tenant_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribe_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_visits: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          membership_tier_id: string | null
          tenant_id: string | null
          updated_at: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          membership_tier_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          membership_tier_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_visits_membership_tier_id_fkey"
            columns: ["membership_tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_visits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_events: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          notified_via: string[] | null
          reason: string
          source: string
          tenant_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          notified_via?: string[] | null
          reason: string
          source?: string
          tenant_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          notified_via?: string[] | null
          reason?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handoff_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_embeddings: {
        Row: {
          chunk_index: number | null
          chunk_text: string
          created_at: string | null
          embedding: string | null
          id: string
          knowledge_base_id: string
          tenant_id: string
        }
        Insert: {
          chunk_index?: number | null
          chunk_text: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id: string
          tenant_id: string
        }
        Update: {
          chunk_index?: number | null
          chunk_text?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_base_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_embeddings_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_embeddings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          activated_at: string | null
          created_at: string
          expires_at: string | null
          features: string[]
          id: string
          is_active: boolean
          key: string
          notes: string | null
          tenant_id: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          key: string
          notes?: string | null
          tenant_id?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          key?: string
          notes?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          created_at: string
          discount_percent: number
          id: string
          is_active: boolean
          min_visits: number
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          min_visits?: number
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_percent?: number
          id?: string
          is_active?: boolean
          min_visits?: number
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cells: {
        Row: {
          column_id: string
          created_at: string
          id: string
          row_id: string
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          row_id: string
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          row_id?: string
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_cells_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "price_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_cells_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "price_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_cells_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_columns: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number
          table_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          table_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          table_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_columns_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_columns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_rows: {
        Row: {
          created_at: string
          id: string
          service: string
          sort_order: number
          table_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          service: string
          sort_order?: number
          table_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          service?: string
          sort_order?: number
          table_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_rows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_rows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tables: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          note: string | null
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          note?: string | null
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_tables_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "price_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_notes: {
        Row: {
          body: string
          category_id: string
          created_at: string
          highlight: string | null
          icon: string | null
          id: string
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category_id: string
          created_at?: string
          highlight?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category_id?: string
          created_at?: string
          highlight?: string | null
          icon?: string | null
          id?: string
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "price_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          price: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          price?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          key: string
          tokens: number
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          tokens?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          tokens?: number
          window_start?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          is_addon: boolean
          item_type: string
          price: number
          product_id: string | null
          sale_id: string
          service_id: string | null
          service_name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_addon?: boolean
          item_type?: string
          price?: number
          product_id?: string | null
          sale_id: string
          service_id?: string | null
          service_name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_addon?: boolean
          item_type?: string
          price?: number
          product_id?: string | null
          sale_id?: string
          service_id?: string | null
          service_name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          external_payment_id: string | null
          id: string
          is_refunded: boolean
          notes: string | null
          payment_method: string
          payment_provider: string | null
          sale_date: string
          tax_amount: number
          tax_label: string
          tax_rate_percent: number
          tenant_id: string | null
          therapist_id: string | null
          therapist_name: string | null
          tip_amount: number
          tip_method: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          external_payment_id?: string | null
          id?: string
          is_refunded?: boolean
          notes?: string | null
          payment_method?: string
          payment_provider?: string | null
          sale_date?: string
          tax_amount?: number
          tax_label?: string
          tax_rate_percent?: number
          tenant_id?: string | null
          therapist_id?: string | null
          therapist_name?: string | null
          tip_amount?: number
          tip_method?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          external_payment_id?: string | null
          id?: string
          is_refunded?: boolean
          notes?: string | null
          payment_method?: string
          payment_provider?: string | null
          sale_date?: string
          tax_amount?: number
          tax_label?: string
          tax_rate_percent?: number
          tenant_id?: string | null
          therapist_id?: string | null
          therapist_name?: string | null
          tip_amount?: number
          tip_method?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          disclaimer: string | null
          duration_minutes: number
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          price: number
          price_label: string | null
          sort_order: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          disclaimer?: string | null
          duration_minutes?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          price?: number
          price_label?: string | null
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          disclaimer?: string | null
          duration_minutes?: number
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          price?: number
          price_label?: string | null
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_holidays: {
        Row: {
          created_at: string
          early_close_hour: number | null
          holiday_date: string
          id: string
          reason: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          early_close_hour?: number | null
          holiday_date: string
          id?: string
          reason?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          early_close_hour?: number | null
          holiday_date?: string
          id?: string
          reason?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppressed_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          owner_email: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          owner_email: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          owner_email?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      therapist_unavailability: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          tenant_id: string | null
          therapist_id: string
          unavailable_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id?: string | null
          therapist_id: string
          unavailable_date: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          tenant_id?: string | null
          therapist_id?: string
          unavailable_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_unavailability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_unavailability_therapist_id_fkey"
            columns: ["therapist_id"]
            isOneToOne: false
            referencedRelation: "therapists"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          break_end: number | null
          break_start: number | null
          created_at: string
          email: string | null
          end_hour: number
          id: string
          is_active: boolean
          name: string
          phone: string | null
          start_hour: number
          tenant_id: string | null
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_end?: number | null
          break_start?: number | null
          created_at?: string
          email?: string | null
          end_hour?: number
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          start_hour?: number
          tenant_id?: string | null
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_end?: number | null
          break_start?: number | null
          created_at?: string
          email?: string | null
          end_hour?: number
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          start_hour?: number
          tenant_id?: string | null
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "therapists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string
          id: string
          key: string
          lang: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          lang: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          lang?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max_tokens?: number; p_window_sec?: number }
        Returns: Json
      }
      cleanup_expired_handoff_events: { Args: never; Returns: number }
      cleanup_expired_keys: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_license_key: { Args: never; Returns: string }
      generate_license_keys: {
        Args: { count?: number; feature_list?: string[] }
        Returns: {
          activated_at: string | null
          created_at: string
          expires_at: string | null
          features: string[]
          id: string
          is_active: boolean
          key: string
          notes: string | null
          tenant_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "license_keys"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_active_key: {
        Args: { p_key_name: string; p_tenant_id: string }
        Returns: Json
      }
      get_my_tenant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      request_tenant_id: { Args: never; Returns: string }
      rotate_api_key: {
        Args: {
          p_grace_hours?: number
          p_key_name: string
          p_new_value: string
          p_rotated_by?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      search_knowledge_base: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_tenant_id: string
          query_embedding: string
        }
        Returns: {
          category: string
          chunk_text: string
          id: string
          knowledge_base_id: string
          similarity: number
          title: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "employee"
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
      app_role: ["admin", "user", "employee"],
    },
  },
} as const
