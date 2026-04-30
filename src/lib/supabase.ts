import { createClient } from '@supabase/supabase-js';
import { getCategory, setCategory, removeCategory } from './categoryStore';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Account {
  id: string;
  name: string;
  balance: number;
  created_at: string;
}

export interface FixedItem {
  id: string;
  name: string;
  amount: number;
  day_of_month: number | null;
  is_last_day: boolean;
  type: 'income' | 'expense';
  category: 'salary' | 'card' | 'regular'; // stored in localStorage, not in DB
  account_id: string;
  created_at: string;
}

export async function checkTablesExist(): Promise<boolean> {
  try {
    const { error } = await supabase.from('accounts').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function setupTables(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/setup-tables`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    return { success: data.success === true, error: data.error };
  } catch (e: any) {
    return { success: false, error: e.message || '설정에 실패했습니다.' };
  }
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createAccount(name: string, balance: number): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name, balance })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAccount(id: string, name: string, balance: number): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({ name, balance })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchFixedItems(): Promise<FixedItem[]> {
  const { data, error } = await supabase
    .from('fixed_items')
    .select('*')
    .order('is_last_day', { ascending: true })
    .order('day_of_month', { ascending: true });
  if (error) throw error;
  // category is not a DB column — enrich from localStorage
  return (data ?? []).map(item => ({ ...item, category: getCategory(item.id) }));
}

// Strip category before sending to DB; persist it in localStorage instead
export async function createFixedItem(item: Omit<FixedItem, 'id' | 'created_at'>): Promise<FixedItem> {
  const { category, ...dbItem } = item;
  const { data, error } = await supabase
    .from('fixed_items')
    .insert(dbItem)
    .select()
    .single();
  if (error) throw error;
  setCategory(data.id, category ?? 'regular');
  return { ...data, category: category ?? 'regular' };
}

export async function updateFixedItem(id: string, item: Omit<FixedItem, 'id' | 'created_at'>): Promise<FixedItem> {
  const { category, ...dbItem } = item;
  const { data, error } = await supabase
    .from('fixed_items')
    .update(dbItem)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  setCategory(id, category ?? 'regular');
  return { ...data, category: category ?? 'regular' };
}

export async function deleteFixedItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('fixed_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
  removeCategory(id);
}
