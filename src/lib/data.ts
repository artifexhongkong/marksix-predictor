import { supabase, type Draw, type Prediction } from './supabase';
import type { EngineParams } from './engine';

export async function fetchDraws(limit = 200): Promise<Draw[]> {
  const { data, error } = await supabase
    .from('draws')
    .select('*')
    .order('draw_number', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Draw[];
}

export async function savePrediction(
  numbers: number[],
  specialNumber: number,
  method: string,
  params: EngineParams,
  targetDrawNumber: number | null = null
): Promise<Prediction> {
  const { data, error } = await supabase
    .from('predictions')
    .insert({
      numbers,
      special_number: specialNumber,
      method,
      params: params as unknown as Record<string, unknown>,
      target_draw_number: targetDrawNumber,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Prediction;
}

export async function fetchRecentPredictions(limit = 20): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Prediction[];
}
