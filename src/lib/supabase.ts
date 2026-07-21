import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: { persistSession: false },
});

export type Draw = {
  id: string;
  draw_number: number;
  draw_date: string;
  numbers: number[];
  special_number: number;
  created_at: string;
};

export type Prediction = {
  id: string;
  numbers: number[];
  special_number: number;
  method: string;
  params: Record<string, unknown>;
  target_draw_number: number | null;
  hit_count: number;
  created_at: string;
};
