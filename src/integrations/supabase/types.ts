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
      business_settings: {
        Row: {
          address: string | null
          company_name: string
          default_currency: string
          default_exchange_rate: number
          default_exclusions: string | null
          default_lead_time: string | null
          default_payment_terms: string | null
          default_tax_rate: number
          default_warranty: string | null
          email: string | null
          id: boolean
          logo_url: string | null
          phone: string | null
          quote_validity_days: number
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string
          default_currency?: string
          default_exchange_rate?: number
          default_exclusions?: string | null
          default_lead_time?: string | null
          default_payment_terms?: string | null
          default_tax_rate?: number
          default_warranty?: string | null
          email?: string | null
          id?: boolean
          logo_url?: string | null
          phone?: string | null
          quote_validity_days?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          default_currency?: string
          default_exchange_rate?: number
          default_exclusions?: string | null
          default_lead_time?: string | null
          default_payment_terms?: string | null
          default_tax_rate?: number
          default_warranty?: string | null
          email?: string | null
          id?: boolean
          logo_url?: string | null
          phone?: string | null
          quote_validity_days?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      led_products: {
        Row: {
          application: string
          brightness_nits: number | null
          cabinet_depth_mm: number | null
          cabinet_height_mm: number
          cabinet_pixel_height: number
          cabinet_pixel_width: number
          cabinet_weight_kg: number | null
          cabinet_width_mm: number
          created_at: string
          datasheet_url: string | null
          description: string | null
          diode_manufacturer: string | null
          diode_notes: string | null
          diode_package: string | null
          diode_technology: string | null
          id: string
          integrated_processing: boolean
          ip_rating: string | null
          is_demo: boolean
          last_verified_at: string | null
          manufacturer_id: string
          model: string
          pixel_pitch_mm: number
          power_max_w: number | null
          power_supply_brand: string | null
          power_supply_qty: number | null
          power_supply_redundancy: string | null
          power_typical_w: number | null
          processing_requirements: string | null
          receiver_card_included: boolean
          receiver_cards_per_cabinet: number
          refresh_rate_hz: number | null
          series: string | null
          service_access: string | null
          sku: string | null
          spec_source: string | null
          status: string
          supplier_cost_per_sqm: number | null
          supplier_currency: string
          updated_at: string
        }
        Insert: {
          application?: string
          brightness_nits?: number | null
          cabinet_depth_mm?: number | null
          cabinet_height_mm: number
          cabinet_pixel_height: number
          cabinet_pixel_width: number
          cabinet_weight_kg?: number | null
          cabinet_width_mm: number
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          diode_manufacturer?: string | null
          diode_notes?: string | null
          diode_package?: string | null
          diode_technology?: string | null
          id?: string
          integrated_processing?: boolean
          ip_rating?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id: string
          model: string
          pixel_pitch_mm: number
          power_max_w?: number | null
          power_supply_brand?: string | null
          power_supply_qty?: number | null
          power_supply_redundancy?: string | null
          power_typical_w?: number | null
          processing_requirements?: string | null
          receiver_card_included?: boolean
          receiver_cards_per_cabinet?: number
          refresh_rate_hz?: number | null
          series?: string | null
          service_access?: string | null
          sku?: string | null
          spec_source?: string | null
          status?: string
          supplier_cost_per_sqm?: number | null
          supplier_currency?: string
          updated_at?: string
        }
        Update: {
          application?: string
          brightness_nits?: number | null
          cabinet_depth_mm?: number | null
          cabinet_height_mm?: number
          cabinet_pixel_height?: number
          cabinet_pixel_width?: number
          cabinet_weight_kg?: number | null
          cabinet_width_mm?: number
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          diode_manufacturer?: string | null
          diode_notes?: string | null
          diode_package?: string | null
          diode_technology?: string | null
          id?: string
          integrated_processing?: boolean
          ip_rating?: string | null
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id?: string
          model?: string
          pixel_pitch_mm?: number
          power_max_w?: number | null
          power_supply_brand?: string | null
          power_supply_qty?: number | null
          power_supply_redundancy?: string | null
          power_typical_w?: number | null
          processing_requirements?: string | null
          receiver_card_included?: boolean
          receiver_cards_per_cabinet?: number
          refresh_rate_hz?: number | null
          series?: string | null
          service_access?: string | null
          sku?: string | null
          spec_source?: string | null
          status?: string
          supplier_cost_per_sqm?: number | null
          supplier_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "led_products_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      led_receiver_compat: {
        Row: {
          id: string
          led_product_id: string
          notes: string | null
          receiver_card_id: string
          verified: boolean
        }
        Insert: {
          id?: string
          led_product_id: string
          notes?: string | null
          receiver_card_id: string
          verified?: boolean
        }
        Update: {
          id?: string
          led_product_id?: string
          notes?: string | null
          receiver_card_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "led_receiver_compat_led_product_id_fkey"
            columns: ["led_product_id"]
            isOneToOne: false
            referencedRelation: "led_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "led_receiver_compat_receiver_card_id_fkey"
            columns: ["receiver_card_id"]
            isOneToOne: false
            referencedRelation: "receiver_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      processors: {
        Row: {
          cost: number | null
          cost_currency: string
          created_at: string
          datasheet_url: string | null
          description: string | null
          id: string
          is_demo: boolean
          last_verified_at: string | null
          manufacturer_id: string | null
          manufacturer_name: string | null
          max_pixel_height: number | null
          max_pixel_width: number | null
          max_pixels: number | null
          model: string
          outputs: string | null
          spec_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          cost_currency?: string
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id?: string | null
          manufacturer_name?: string | null
          max_pixel_height?: number | null
          max_pixel_width?: number | null
          max_pixels?: number | null
          model: string
          outputs?: string | null
          spec_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          cost_currency?: string
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id?: string | null
          manufacturer_name?: string | null
          max_pixel_height?: number | null
          max_pixel_width?: number | null
          max_pixels?: number | null
          model?: string
          outputs?: string | null
          spec_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processors_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          category: string
          cost_currency: string
          created_at: string
          description: string
          freight_mode: string | null
          id: string
          included_in_led: boolean
          margin_override: number | null
          markup_override: number | null
          quantity: number
          quote_id: string
          sort_order: number
          taxable: boolean
          unit_cost: number
        }
        Insert: {
          category: string
          cost_currency?: string
          created_at?: string
          description: string
          freight_mode?: string | null
          id?: string
          included_in_led?: boolean
          margin_override?: number | null
          markup_override?: number | null
          quantity?: number
          quote_id: string
          sort_order?: number
          taxable?: boolean
          unit_cost?: number
        }
        Update: {
          category?: string
          cost_currency?: string
          created_at?: string
          description?: string
          freight_mode?: string | null
          id?: string
          included_in_led?: boolean
          margin_override?: number | null
          markup_override?: number | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          taxable?: boolean
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          config: Json
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          customer_company: string | null
          exchange_rate: number | null
          exchange_rate_date: string | null
          exclusions: string | null
          id: string
          is_demo: boolean
          issue_date: string | null
          lead_time: string | null
          margin_pct: number
          markup_pct: number
          notes: string | null
          owner_id: string
          parent_quote_id: string | null
          payment_terms: string | null
          pdf_path: string | null
          pricing_mode: string
          project_name: string | null
          quote_number: string
          revision: number
          snapshot: Json
          status: string
          tax_rate: number
          updated_at: string
          valid_until: string | null
          warranty: string | null
        }
        Insert: {
          config?: Json
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          customer_company?: string | null
          exchange_rate?: number | null
          exchange_rate_date?: string | null
          exclusions?: string | null
          id?: string
          is_demo?: boolean
          issue_date?: string | null
          lead_time?: string | null
          margin_pct?: number
          markup_pct?: number
          notes?: string | null
          owner_id: string
          parent_quote_id?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          pricing_mode?: string
          project_name?: string | null
          quote_number: string
          revision?: number
          snapshot?: Json
          status?: string
          tax_rate?: number
          updated_at?: string
          valid_until?: string | null
          warranty?: string | null
        }
        Update: {
          config?: Json
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          customer_company?: string | null
          exchange_rate?: number | null
          exchange_rate_date?: string | null
          exclusions?: string | null
          id?: string
          is_demo?: boolean
          issue_date?: string | null
          lead_time?: string | null
          margin_pct?: number
          markup_pct?: number
          notes?: string | null
          owner_id?: string
          parent_quote_id?: string | null
          payment_terms?: string | null
          pdf_path?: string | null
          pricing_mode?: string
          project_name?: string | null
          quote_number?: string
          revision?: number
          snapshot?: Json
          status?: string
          tax_rate?: number
          updated_at?: string
          valid_until?: string | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      receiver_cards: {
        Row: {
          cost: number | null
          cost_currency: string
          created_at: string
          datasheet_url: string | null
          description: string | null
          id: string
          is_demo: boolean
          last_verified_at: string | null
          manufacturer_id: string | null
          manufacturer_name: string | null
          max_pixel_height: number | null
          max_pixel_width: number | null
          max_pixels: number | null
          model: string
          spec_notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cost?: number | null
          cost_currency?: string
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id?: string | null
          manufacturer_name?: string | null
          max_pixel_height?: number | null
          max_pixel_width?: number | null
          max_pixels?: number | null
          model: string
          spec_notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cost?: number | null
          cost_currency?: string
          created_at?: string
          datasheet_url?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          last_verified_at?: string | null
          manufacturer_id?: string | null
          manufacturer_name?: string | null
          max_pixel_height?: number | null
          max_pixel_width?: number | null
          max_pixels?: number | null
          model?: string
          spec_notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiver_cards_manufacturer_id_fkey"
            columns: ["manufacturer_id"]
            isOneToOne: false
            referencedRelation: "manufacturers"
            referencedColumns: ["id"]
          },
        ]
      }
      receiver_processor_compat: {
        Row: {
          id: string
          notes: string | null
          processor_id: string
          receiver_card_id: string
          verified: boolean
        }
        Insert: {
          id?: string
          notes?: string | null
          processor_id: string
          receiver_card_id: string
          verified?: boolean
        }
        Update: {
          id?: string
          notes?: string | null
          processor_id?: string
          receiver_card_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "receiver_processor_compat_processor_id_fkey"
            columns: ["processor_id"]
            isOneToOne: false
            referencedRelation: "processors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiver_processor_compat_receiver_card_id_fkey"
            columns: ["receiver_card_id"]
            isOneToOne: false
            referencedRelation: "receiver_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      next_quote_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "salesperson"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "salesperson"],
    },
  },
} as const
