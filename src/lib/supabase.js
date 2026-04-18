import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = process.env.REACT_APP_SUPABASE_URL      || 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

// AUTH
export async function sendOTP(email) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}
export async function verifyOTP(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  return data;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function getSession() { const { data } = await supabase.auth.getSession(); return data.session; }

// PROFILE
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*, companies(*)').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}
export async function upsertProfile(userId, fields) {
  const { data, error } = await supabase.from('profiles').upsert({ id: userId, ...fields }, { onConflict: 'id' }).select('*, companies(*)').single();
  if (error) throw error;
  return data;
}
export async function saveApiKey(userId, apiKey) {
  const { error } = await supabase.from('profiles').update({ claude_api_key: apiKey }).eq('id', userId);
  if (error) throw error;
}
export async function removeApiKey(userId) {
  const { error } = await supabase.from('profiles').update({ claude_api_key: null }).eq('id', userId);
  if (error) throw error;
}

// COMPANY
export async function createCompany(name, userId) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
  const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();
  const { data, error } = await supabase.from('companies').insert({ name, slug, created_by: userId, invite_code: inviteCode }).select().single();
  if (error) throw error;
  await supabase.from('company_members').insert({ company_id: data.id, user_id: userId, role: 'owner' });
  return data;
}
export async function getCompanyByInviteCode(code) {
  const { data, error } = await supabase.from('companies').select('*').eq('invite_code', code.trim().toUpperCase()).single();
  if (error) throw new Error('Invalid invite code.');
  return data;
}
export async function joinCompany(companyId, userId) {
  const { error } = await supabase.from('company_members').upsert({ company_id: companyId, user_id: userId, role: 'member' }, { onConflict: 'company_id,user_id' });
  if (error) throw error;
}
export async function getCompanyMembers(companyId) {
  const { data, error } = await supabase.from('company_members').select('*, profiles(id, email, full_name, claude_api_key)').eq('company_id', companyId);
  if (error) throw error;
  return data || [];
}
export async function regenerateInviteCode(companyId) {
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  const { data, error } = await supabase.from('companies').update({ invite_code: code }).eq('id', companyId).select().single();
  if (error) throw error;
  return data;
}
export async function removeMember(companyId, userId) {
  const { error } = await supabase.from('company_members').delete().eq('company_id', companyId).eq('user_id', userId);
  if (error) throw error;
}

// MoMs
export async function getMoMs(companyId) {
  const { data, error } = await supabase.from('moms').select('*').eq('company_id', companyId).order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(parseMoM);
}
export async function saveMoM(mom, userId, companyId) {
  const record = serializeMoM(mom, userId, companyId);
  if (mom._new) {
    const { id: _id, ...insert } = record;
    const { data, error } = await supabase.from('moms').insert(insert).select().single();
    if (error) throw error;
    return parseMoM(data);
  } else {
    const { data, error } = await supabase.from('moms').update(record).eq('id', mom.id).select().single();
    if (error) throw error;
    return parseMoM(data);
  }
}
export async function deleteMoM(id) {
  const { error } = await supabase.from('moms').delete().eq('id', id);
  if (error) throw error;
}
export async function updateActionStatus(momId, actionId, status) {
  const { data, error } = await supabase.from('moms').select('action_items').eq('id', momId).single();
  if (error) throw error;
  const updated = (data.action_items || []).map(a => a.id === actionId ? { ...a, status } : a);
  const { error: e2 } = await supabase.from('moms').update({ action_items: updated }).eq('id', momId);
  if (e2) throw e2;
}

function serializeMoM(mom, userId, companyId) {
  return {
    id: mom._new ? undefined : mom.id,
    company_id: companyId, created_by: userId,
    title: mom.title || '', client: mom.client || '', date: mom.date || null,
    time: mom.time || '', platform: mom.platform || '', location: mom.location || '',
    category: mom.category || '', agenda: mom.agenda || [],
    attendees: mom.attendees || [], discussions: mom.discussions || [],
    action_items: mom.actionItems || [], created_at: mom.createdAt || new Date().toISOString(),
  };
}
function parseMoM(row) {
  return {
    id: row.id, title: row.title, client: row.client, date: row.date,
    time: row.time, platform: row.platform, location: row.location, category: row.category,
    agenda: row.agenda || [], attendees: row.attendees || [],
    discussions: row.discussions || [], actionItems: row.action_items || [],
    createdBy: row.created_by, companyId: row.company_id, createdAt: row.created_at,
  };
}
