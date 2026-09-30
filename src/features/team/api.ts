import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/database';

export async function listTeamMembers(): Promise<UserProfile[]> {
  const { data, error } = await supabase.from('users').select('*').order('email');
  if (error) throw error;
  return (data ?? []).filter((member) => member.role !== 'super_admin');
}

export async function setUserActive(userId: string, active: boolean): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .update({ active })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
