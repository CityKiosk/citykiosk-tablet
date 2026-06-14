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
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name_de: string
          owner_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_de: string
          owner_id?: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name_de?: string
          owner_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string | null
          notes: string | null
          owner_id: string
          phone: string | null
          shop_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          shop_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          owner_id?: string
          phone?: string | null
          shop_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_shares: {
        Row: {
          id: string
          owner_id: string
          token: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id?: string
          token?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          token?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_shares_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          owner_id: string
          product_id: string | null
          product_image_url: string | null
          product_name_de: string
          product_sku: string | null
          product_description: string | null
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          order_id: string
          owner_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name_de: string
          product_sku?: string | null
          product_description?: string | null
          quantity: number
          sort_order?: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          owner_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name_de?: string
          product_sku?: string | null
          product_description?: string | null
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_first_name: string
          customer_id: string | null
          customer_last_name: string | null
          customer_shop_name: string
          discount_amount: number
          discount_pct: number
          gross_total: number
          id: string
          idempotency_key: string | null
          notes: string | null
          order_number: string
          owner_id: string
          status: string
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_first_name: string
          customer_id?: string | null
          customer_last_name?: string | null
          customer_shop_name: string
          discount_amount?: number
          discount_pct?: number
          gross_total?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number: string
          owner_id?: string
          status?: string
          tax_amount?: number
          tax_rate?: number
          total: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_first_name?: string
          customer_id?: string | null
          customer_last_name?: string | null
          customer_shop_name?: string
          discount_amount?: number
          discount_pct?: number
          gross_total?: number
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_number?: string
          owner_id?: string
          status?: string
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description_de: string | null
          dimensions: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name_de: string
          owner_id: string
          packaging_unit: number | null
          price: number
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description_de?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_de: string
          owner_id?: string
          packaging_unit?: number | null
          price: number
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description_de?: string | null
          dimensions?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name_de?: string
          owner_id?: string
          packaging_unit?: number | null
          price?: number
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_pin_hash: string | null
          created_at: string
          display_fields: Json
          display_fields_browse: Json
          display_fields_catalog: Json
          display_name: string | null
          id: string
          locale: string
          shop_address: string | null
          shop_email: string | null
          shop_name: string | null
          shop_phone: string | null
          updated_at: string
        }
        Insert: {
          admin_pin_hash?: string | null
          created_at?: string
          display_fields?: Json
          display_fields_browse?: Json
          display_fields_catalog?: Json
          display_name?: string | null
          id: string
          locale?: string
          shop_address?: string | null
          shop_email?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          updated_at?: string
        }
        Update: {
          admin_pin_hash?: string | null
          created_at?: string
          display_fields?: Json
          display_fields_browse?: Json
          display_fields_catalog?: Json
          display_name?: string | null
          id?: string
          locale?: string
          shop_address?: string | null
          shop_email?: string | null
          shop_name?: string | null
          shop_phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_sessions: {
        Row: {
          id: string
          user_id: string
          created_at: string
          last_seen: string
        }
        Insert: {
          id: string
          user_id: string
          created_at?: string
          last_seen?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          last_seen?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_order_number: { Args: never; Returns: string }
      has_admin_pin: { Args: never; Returns: boolean }
      has_admin_pin_for_scope: { Args: { p_scope: string }; Returns: boolean }
      verify_admin_pin: { Args: { p_pin: string; p_scope: string }; Returns: boolean }
      set_admin_pin: {
        Args: { p_current_pin: string | null; p_new_pin: string; p_scope?: string }
        Returns: boolean
      }
      remove_admin_pin: {
        Args: { p_admin_pin: string; p_scope: string }
        Returns: boolean
      }
      is_admin_pin_unlocked: { Args: { p_scope: string }; Returns: boolean }
      extend_admin_pin_unlock: { Args: { p_scope: string }; Returns: void }
      lock_admin_pin: { Args: { p_scope?: string | null }; Returns: void }
      register_session: { Args: { p_sid: string }; Returns: boolean }
      touch_session: { Args: { p_sid: string }; Returns: boolean }
      update_display_field: {
        Args: { p_scope: string; p_key: string; p_value: boolean }
        Returns: void
      }
      get_public_catalog: {
        Args: { share_token: string }
        Returns: {
          products: {
            id: string
            name_de: string
            price: number
            image_url: string | null
            category_id: string | null
            dimensions: string | null
            packaging_unit: number | null
            sku: string | null
            description_de: string | null
            sort_order: number
          }[] | null
          categories: {
            id: string
            slug: string
            name_de: string
            sort_order: number
          }[] | null
          display_fields: {
            name: boolean
            description: boolean
            sku: boolean
            dimensions: boolean
            price: boolean
            packagingUnit: boolean
          }
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
