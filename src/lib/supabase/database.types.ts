// Hand-authored placeholder covering only the tables client code touches
// this pass (profiles, body_metrics, body_photos, chat_messages,
// coach_insights). Run `npm run supabase:types` once the local instance is
// up (after `supabase:start` + `supabase:reset`) to regenerate this file
// for real from the live schema — that command overwrites this file
// entirely and will also add the fast-follow tables (nutrition, training,
// plans, onboarding, knowledge_chunks) once those get wired up.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string;
          name: string;
          sex: 'male' | 'female' | 'unspecified';
          age_range: string;
          goal: string;
          sports: string[];
          height_cm: number;
          target_weight_kg: number;
          daily_calorie_target: number;
          protein_g: number;
          carbs_g: number;
          fats_g: number;
          hydration_target_ml: number;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { user_id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      body_metrics: {
        Row: {
          user_id: string;
          date: string;
          weight_kg: number | null;
          body_fat_pct: number | null;
          muscle_mass_kg: number | null;
          shoulders_cm: number | null;
          chest_cm: number | null;
          biceps_cm: number | null;
          waist_cm: number | null;
          hips_cm: number | null;
          thigh_cm: number | null;
          resting_heart_rate: number | null;
          sleep_hours: number | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['body_metrics']['Row']> & { user_id: string; date: string };
        Update: Partial<Database['public']['Tables']['body_metrics']['Row']>;
      };
      body_photos: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          pose: 'frontRelaxed' | 'sideRightRelaxed' | 'sideLeftRelaxed' | 'backRelaxed' | 'frontFlexed' | 'backFlexed';
          storage_path: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['body_photos']['Row']> & {
          user_id: string;
          date: string;
          pose: Database['public']['Tables']['body_photos']['Row']['pose'];
          storage_path: string;
        };
        Update: Partial<Database['public']['Tables']['body_photos']['Row']>;
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['chat_messages']['Row']> & {
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
        };
        Update: Partial<Database['public']['Tables']['chat_messages']['Row']>;
      };
      coach_insights: {
        Row: {
          id: string;
          user_id: string;
          tone: 'positive' | 'warning' | 'neutral';
          headline: string;
          body: string;
          generated_at: string;
          dismissed: boolean;
        };
        Insert: Partial<Database['public']['Tables']['coach_insights']['Row']> & {
          user_id: string;
          tone: 'positive' | 'warning' | 'neutral';
          headline: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['coach_insights']['Row']>;
      };
    };
  };
};
