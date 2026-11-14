import { jobTitleKey } from './jobTitles';
import { supabase } from './supabaseClient';

export function parseSalaryRate(value: unknown) {
  const rate = typeof value === 'number'
    ? value
    : Number(String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

export async function loadJobSalaryRates(positions: string[]) {
  const rates = new Map<string, number>();
  const requested = new Set(positions.map(jobTitleKey).filter(Boolean));
  if (!requested.size) return rates;

  const { data, error } = await supabase
    .from('job_postings')
    .select('title, salary_range')
    .order('is_active', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('id');

  if (error) throw error;

  for (const job of data ?? []) {
    const key = jobTitleKey(job.title ?? '');
    const rate = parseSalaryRate(job.salary_range);
    if (requested.has(key) && rate && !rates.has(key)) rates.set(key, rate);
    if (rates.size === requested.size) break;
  }
  return rates;
}
