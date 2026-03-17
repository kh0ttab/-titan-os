import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, metadata) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// ── Profile helpers ───────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Workspace state (JSONB persistence) ───────────────────────────────────────

const WORKSPACE_ID = "default";

export async function loadWorkspaceState() {
  const { data, error } = await supabase
    .from("workspace_state")
    .select("data")
    .eq("id", WORKSPACE_ID)
    .single();
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data?.data || null;
}

export async function saveWorkspaceState(state) {
  const { error } = await supabase
    .from("workspace_state")
    .upsert({ id: WORKSPACE_ID, data: state, updated_at: new Date().toISOString() });
  if (error) throw error;
}
