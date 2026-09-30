export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'senior_manager'
  | 'inventory'
  | 'procurement'
  | 'employee'
  | 'user';

export type PrStatus =
  | 'pending_check'
  | 'ready'
  | 'procurement_hold'
  | 'assigned'
  | 'in_progress'
  | 'qc'
  | 'packing'
  | 'delivery'
  | 'installed'
  | 'done';

export type QcResultValue = 'pass' | 'fail';
export type TaskType = 'assembly' | 'qc' | 'packing' | 'delivery' | 'installation';

export type NotificationChannel = 'email' | 'push';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/**
 * Placeholder database types until `supabase gen types typescript` is run
 * against a linked project. Replace this file after migrations are applied.
 */
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: UserRole;
          created_by: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: UserRole;
          created_by?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: UserRole;
          created_by?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          contact_info: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_info?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parts: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          mpn: string | null;
          footprint: string | null;
          vendor_id: string | null;
          unit_cost: number;
          qty_available: number;
          low_stock_threshold: number;
          storage_location: string | null;
          last_used_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          mpn?: string | null;
          footprint?: string | null;
          vendor_id?: string | null;
          unit_cost?: number;
          qty_available?: number;
          low_stock_threshold?: number;
          storage_location?: string | null;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          mpn?: string | null;
          footprint?: string | null;
          vendor_id?: string | null;
          unit_cost?: number;
          qty_available?: number;
          low_stock_threshold?: number;
          storage_location?: string | null;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_in_events: {
        Row: {
          id: string;
          request_id: string;
          part_id: string;
          vendor_id: string | null;
          qty: number;
          unit_cost: number;
          notes: string | null;
          received_by: string;
          received_at: string;
          box_id: string | null;
        };
        Insert: {
          id?: string;
          request_id: string;
          part_id: string;
          vendor_id?: string | null;
          qty: number;
          unit_cost: number;
          notes?: string | null;
          received_by: string;
          received_at?: string;
          box_id?: string | null;
        };
        Update: {
          id?: string;
          request_id?: string;
          part_id?: string;
          vendor_id?: string | null;
          qty?: number;
          unit_cost?: number;
          notes?: string | null;
          received_by?: string;
          received_at?: string;
          box_id?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_by: string;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_by: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_by?: string;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bom: {
        Row: {
          id: string;
          product_id: string;
          part_id: string;
          qty_required: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          part_id: string;
          qty_required: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          part_id?: string;
          qty_required?: number;
        };
        Relationships: [];
      };
      assembly_templates: {
        Row: {
          id: string;
          product_id: string;
          step_order: number;
          step_name: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          step_order: number;
          step_name: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          step_order?: number;
          step_name?: string;
        };
        Relationships: [];
      };
      qc_templates: {
        Row: {
          id: string;
          product_id: string;
          checkpoint_order: number;
          checkpoint_name: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          checkpoint_order: number;
          checkpoint_name: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          checkpoint_order?: number;
          checkpoint_name?: string;
        };
        Relationships: [];
      };
      product_forms: {
        Row: {
          id: string;
          product_id: string;
          form_type: string;
          title: string;
          description: string | null;
          definition: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          form_type: string;
          title?: string;
          description?: string | null;
          definition?: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          form_type?: string;
          title?: string;
          description?: string | null;
          definition?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_requests: {
        Row: {
          id: string;
          product_id: string;
          qty: number;
          priority: number;
          status: PrStatus;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          qty: number;
          priority?: number;
          status?: PrStatus;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          qty?: number;
          priority?: number;
          status?: PrStatus;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      serials: {
        Row: {
          id: string;
          pr_id: string;
          serial_number: string;
          assigned_to: string | null;
          assigned_by: string | null;
          priority: number;
          current_stage: string | null;
          current_task_type: TaskType | null;
          packed_by: string | null;
          packed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pr_id: string;
          serial_number: string;
          assigned_to?: string | null;
          assigned_by?: string | null;
          priority?: number;
          current_stage?: string | null;
          current_task_type?: TaskType | null;
          packed_by?: string | null;
          packed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pr_id?: string;
          serial_number?: string;
          assigned_to?: string | null;
          assigned_by?: string | null;
          priority?: number;
          current_stage?: string | null;
          current_task_type?: TaskType | null;
          packed_by?: string | null;
          packed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      serial_assignments: {
        Row: {
          id: string;
          serial_id: string;
          task_type: TaskType;
          assigned_to: string;
          assigned_by: string;
          assigned_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          serial_id: string;
          task_type: TaskType;
          assigned_to: string;
          assigned_by: string;
          assigned_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          serial_id?: string;
          task_type?: TaskType;
          assigned_to?: string;
          assigned_by?: string;
          assigned_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      serial_steps: {
        Row: {
          id: string;
          serial_id: string;
          step_name: string;
          status: string;
          done_by: string | null;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          serial_id: string;
          step_name: string;
          status?: string;
          done_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          serial_id?: string;
          step_name?: string;
          status?: string;
          done_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      qc_results: {
        Row: {
          id: string;
          serial_id: string;
          checkpoint_name: string;
          result: QcResultValue;
          note: string | null;
          checked_by: string;
          checked_at: string;
        };
        Insert: {
          id?: string;
          serial_id: string;
          checkpoint_name: string;
          result: QcResultValue;
          note?: string | null;
          checked_by: string;
          checked_at?: string;
        };
        Update: {
          id?: string;
          serial_id?: string;
          checkpoint_name?: string;
          result?: QcResultValue;
          note?: string | null;
          checked_by?: string;
          checked_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          serial_id: string;
          step_name: string;
          task_type: TaskType | null;
          checkpoint_name: string | null;
          drive_link: string;
          file_type: string;
          uploaded_by: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          serial_id: string;
          step_name: string;
          task_type?: TaskType | null;
          checkpoint_name?: string | null;
          drive_link: string;
          file_type: string;
          uploaded_by: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          serial_id?: string;
          step_name?: string;
          task_type?: TaskType | null;
          checkpoint_name?: string | null;
          drive_link?: string;
          file_type?: string;
          uploaded_by?: string;
          uploaded_at?: string;
        };
        Relationships: [];
      };
      material_handover: {
        Row: {
          id: string;
          serial_id: string;
          part_id: string;
          qty: number;
          damage_report_id: string | null;
          issued_by: string;
          issued_at: string;
          received_by: string | null;
          received_at: string | null;
        };
        Insert: {
          id?: string;
          serial_id: string;
          part_id: string;
          qty: number;
          damage_report_id?: string | null;
          issued_by: string;
          issued_at?: string;
          received_by?: string | null;
          received_at?: string | null;
        };
        Update: {
          id?: string;
          serial_id?: string;
          part_id?: string;
          qty?: number;
          damage_report_id?: string | null;
          issued_by?: string;
          issued_at?: string;
          received_by?: string | null;
          received_at?: string | null;
        };
        Relationships: [];
      };
      damage_reports: {
        Row: {
          id: string;
          serial_id: string;
          part_id: string;
          qty: number;
          reason: string;
          reported_by: string;
          reported_at: string;
          original_handover_id: string | null;
          replacement_handover_id: string | null;
          replacement_issued_by: string | null;
          replacement_issued_at: string | null;
        };
        Insert: {
          id?: string;
          serial_id: string;
          part_id: string;
          qty?: number;
          reason: string;
          reported_by: string;
          reported_at?: string;
          original_handover_id?: string | null;
          replacement_handover_id?: string | null;
          replacement_issued_by?: string | null;
          replacement_issued_at?: string | null;
        };
        Update: {
          id?: string;
          serial_id?: string;
          part_id?: string;
          qty?: number;
          reason?: string;
          reported_by?: string;
          reported_at?: string;
          original_handover_id?: string | null;
          replacement_handover_id?: string | null;
          replacement_issued_by?: string | null;
          replacement_issued_at?: string | null;
        };
        Relationships: [];
      };
      remarks: {
        Row: {
          id: string;
          serial_id: string;
          step_name: string;
          author: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          serial_id: string;
          step_name: string;
          author: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          serial_id?: string;
          step_name?: string;
          author?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      delivery_install: {
        Row: {
          id: string;
          serial_id: string;
          delivery_partner: string | null;
          delivery_docs_link: string | null;
          delivered_by: string | null;
          delivered_at: string | null;
          installed_by: string | null;
          installation_docs_link: string | null;
          installed_at: string | null;
        };
        Insert: {
          id?: string;
          serial_id: string;
          delivery_partner?: string | null;
          delivery_docs_link?: string | null;
          delivered_by?: string | null;
          delivered_at?: string | null;
          installed_by?: string | null;
          installation_docs_link?: string | null;
          installed_at?: string | null;
        };
        Update: {
          id?: string;
          serial_id?: string;
          delivery_partner?: string | null;
          delivery_docs_link?: string | null;
          delivered_by?: string | null;
          delivered_at?: string | null;
          installed_by?: string | null;
          installation_docs_link?: string | null;
          installed_at?: string | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sheet_backup_cursors: {
        Row: {
          table_name: string;
          last_synced_at: string;
        };
        Insert: {
          table_name: string;
          last_synced_at?: string;
        };
        Update: {
          table_name?: string;
          last_synced_at?: string;
        };
        Relationships: [];
      };
      notifications_log: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          channel: NotificationChannel;
          sent_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          channel: NotificationChannel;
          sent_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          channel?: NotificationChannel;
          sent_at?: string;
        };
        Relationships: [];
      };
      racks: {
        Row: {
          id: string;
          code: string;
          name: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      boxes: {
        Row: {
          id: string;
          rack_id: string;
          code: string;
          name: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rack_id: string;
          code: string;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rack_id?: string;
          code?: string;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      part_locations: {
        Row: {
          id: string;
          part_id: string;
          box_id: string;
          qty: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          part_id: string;
          box_id: string;
          qty?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          part_id?: string;
          box_id?: string;
          qty?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_out_events: {
        Row: {
          id: string;
          request_id: string;
          part_id: string;
          box_id: string | null;
          qty: number;
          reason: string;
          notes: string | null;
          issued_by: string;
          issued_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          part_id: string;
          box_id?: string | null;
          qty: number;
          reason: string;
          notes?: string | null;
          issued_by: string;
          issued_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          part_id?: string;
          box_id?: string | null;
          qty?: number;
          reason?: string;
          notes?: string | null;
          issued_by?: string;
          issued_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_inventory: {
        Args: {
          p_query: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          part_id: string;
          part_name: string;
          mpn: string | null;
          description: string | null;
          unit_cost: number;
          qty_available: number;
          location_id: string | null;
          box_id: string | null;
          box_code: string | null;
          box_name: string | null;
          rack_id: string | null;
          rack_code: string | null;
          rack_name: string | null;
          qty_in_box: number | null;
          total_count: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      pr_status: PrStatus;
      qc_result_value: QcResultValue;
      notification_channel: NotificationChannel;
      task_type: TaskType;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type UserProfile = Database['public']['Tables']['users']['Row'];
