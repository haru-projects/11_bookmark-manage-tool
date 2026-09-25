import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * ユーザーが誤ってSupabaseダッシュボードのURL
 * (例: https://supabase.com/dashboard/project/<ref>/...) を設定した場合でも、
 * 正しいAPI URL (https://<ref>.supabase.co) に自動正規化する
 */
export const normalizeSupabaseUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();

  // 例: https://supabase.com/dashboard/project/bwhojxoheytsqjefxunb/...
  const dashboardMatch = trimmed.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // 末尾のスラッシュ除去
  return trimmed.replace(/\/+$/, '');
};

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl !== 'https://your-project.supabase.co' &&
    supabaseAnonKey &&
    supabaseAnonKey !== 'your-supabase-anon-key'
  );
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (clientInstance) return clientInstance;

  if (!isSupabaseConfigured()) {
    clientInstance = createClient(
      supabaseUrl || 'https://placeholder-url.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key'
    );
    return clientInstance;
  }

  clientInstance = createClient(supabaseUrl, supabaseAnonKey);
  return clientInstance;
};
